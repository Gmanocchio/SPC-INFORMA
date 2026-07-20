import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import express from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { campaignRecipients, campaigns, deliveryEvents, webhookReceipts } from "../drizzle/schema";
import { getBrokerForWebhook } from "./broker-service";
import { refreshCampaign } from "./campaign-processing-service";
import { getDb } from "./db";

const webhookPayload = z.object({
  eventId: z.union([z.string(), z.number()]).transform(String),
  event: z.string().trim().min(1).max(80),
  messageId: z.union([z.string(), z.number()]).transform(String).optional(),
  recipientId: z.coerce.number().int().positive().optional(),
  campaignId: z.string().uuid().optional(),
  occurredAt: z.union([z.string(), z.number()]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export function sameHex(actual: string, expected: string) {
  const clean = actual.replace(/^sha256=/i, "").trim().toLowerCase();
  const a = Buffer.from(clean, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export function mappedEvent(value: string) {
  const event = value.trim().toUpperCase().replace(/[.\s-]/g, "_");
  if (["SENT", "ACCEPTED", "QUEUED"].includes(event)) return { eventType: "SENT" as const, status: "SENT" as const };
  if (["DELIVERED", "DELIVERY_SUCCESS"].includes(event)) return { eventType: "DELIVERED" as const, status: "DELIVERED" as const };
  if (["FAILED", "REJECTED", "UNDELIVERED", "BOUNCED"].includes(event)) return { eventType: "FAILED" as const, status: "FAILED" as const };
  if (["READ", "OPEN", "OPENED", "MESSAGE_OPENED", "EMAIL_OPEN", "EMAIL_OPENED"].includes(event)) return { eventType: "READ" as const, status: null };
  if (["CLICK", "CLICKED", "LINK_CLICK", "LINK_CLICKED"].includes(event)) return { eventType: "CLICKED" as const, status: null };
  if (["SPAM", "COMPLAINT", "SPAM_REPORT", "REPORTED_AS_SPAM"].includes(event)) return { eventType: "SPAM" as const, status: "OPTED_OUT" as const };
  if (["OPT_OUT", "UNSUBSCRIBED", "BLOCKED"].includes(event)) return { eventType: "OPTED_OUT" as const, status: "OPTED_OUT" as const };
  return null;
}

export function isFreshWebhookTimestamp(value: string | undefined, nowMs = Date.now(), toleranceMs = 5 * 60_000) {
  if (!value) return false;
  const timestampMs = /^\d{10}$/.test(value) ? Number(value) * 1000 : Number(value);
  return Number.isFinite(timestampMs) && Math.abs(nowMs - timestampMs) <= toleranceMs;
}

export function nextRecipientStatus(current: typeof campaignRecipients.$inferSelect.status, incoming: typeof campaignRecipients.$inferSelect.status) {
  if (current === "DELIVERED" || current === "OPTED_OUT") return current;
  if (incoming === "SENT" && (current === "SENT" || current === "FAILED")) return current;
  return incoming;
}

async function brokerWebhook(req: Request, res: Response) {
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "database-unavailable" });
  const brokerId = Number(req.params.brokerId);
  if (!Number.isInteger(brokerId) || brokerId < 1) return res.status(400).json({ error: "invalid-broker" });
  const broker = await getBrokerForWebhook(brokerId);
  if (!broker) return res.status(404).json({ error: "broker-not-found" });
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  const secret = broker.credentials.webhookSecret ?? broker.credentials.hmacSecret;
  if (!secret) return res.status(403).json({ error: "webhook-secret-not-configured" });
  const signatureHeader = String(broker.extraConfig.signatureHeader || "x-spc-signature").toLowerCase();
  const actualSignature = req.header(signatureHeader) ?? "";
  const timestamp = req.header("x-spc-timestamp");
  if (!isFreshWebhookTimestamp(timestamp)) return res.status(401).json({ error: timestamp ? "stale-signature" : "missing-timestamp" });
  const signedValue = `${timestamp}.${raw.toString("utf8")}`;
  const expected = createHmac("sha256", secret).update(signedValue).digest("hex");
  if (!sameHex(actualSignature, expected)) return res.status(401).json({ error: "invalid-signature" });
  const digest = createHash("sha256").update(raw).digest("hex");
  let payload: z.infer<typeof webhookPayload>;
  try { payload = webhookPayload.parse(JSON.parse(raw.toString("utf8"))); }
  catch { return res.status(400).json({ error: "invalid-payload" }); }
  const externalEventId = `${broker.id}:${payload.eventId}`.slice(0, 190);
  const [existing] = await db.select({ id: webhookReceipts.id, status: webhookReceipts.status }).from(webhookReceipts).where(eq(webhookReceipts.externalEventId, externalEventId)).limit(1);
  if (existing) return res.json({ ok: true, duplicate: true, status: existing.status });
  let receiptId = 0;
  try {
    const inserted = await db.insert(webhookReceipts).values({ brokerId: broker.id, externalEventId, requestDigest: digest, signatureValid: true, status: "RECEIVED" });
    receiptId = Number(inserted[0].insertId);
  } catch {
    return res.json({ ok: true, duplicate: true });
  }
  try {
    const mapped = mappedEvent(payload.event);
    if (!mapped) {
      await db.update(webhookReceipts).set({ status: "REJECTED", processedAt: new Date() }).where(eq(webhookReceipts.id, receiptId));
      return res.json({ ok: true, ignored: true });
    }
    const recipientCondition = payload.recipientId
      ? eq(campaignRecipients.id, payload.recipientId)
      : payload.messageId ? eq(campaignRecipients.brokerMessageId, payload.messageId) : undefined;
    if (!recipientCondition) throw new Error("recipientId ou messageId obrigatório.");
    const [recipient] = await db.select().from(campaignRecipients).where(recipientCondition).limit(1);
    if (!recipient) throw new Error("Destinatário não encontrado.");
    const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, recipient.campaignId), eq(campaigns.brokerId, broker.id))).limit(1);
    if (!campaign || (payload.campaignId && payload.campaignId !== campaign.id)) throw new Error("Campanha incompatível com o broker ou payload.");
    const nextStatus = mapped.status ? nextRecipientStatus(recipient.status, mapped.status) : recipient.status;
    if (nextStatus !== recipient.status || (payload.messageId && payload.messageId !== recipient.brokerMessageId)) {
      await db.update(campaignRecipients).set({ status: nextStatus, brokerMessageId: payload.messageId ?? recipient.brokerMessageId, deliveredAt: nextStatus === "DELIVERED" ? new Date() : recipient.deliveredAt, errorCode: nextStatus === "FAILED" ? "BROKER_DELIVERY_FAILED" : nextStatus === "SENT" ? null : recipient.errorCode }).where(eq(campaignRecipients.id, recipient.id));
    }
    const occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : new Date();
    await db.insert(deliveryEvents).values({ organizationId: campaign.organizationId, campaignId: campaign.id, recipientId: recipient.id, brokerId: broker.id, externalEventId, eventType: mapped.eventType, occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt, payloadDigest: digest });
    await refreshCampaign(campaign.id);
    await db.update(webhookReceipts).set({ status: "PROCESSED", processedAt: new Date() }).where(eq(webhookReceipts.id, receiptId));
    return res.json({ ok: true });
  } catch (error) {
    await db.update(webhookReceipts).set({ status: "ERROR", processedAt: new Date() }).where(eq(webhookReceipts.id, receiptId));
    return res.status(422).json({ error: error instanceof Error ? error.message : "processing-failed" });
  }
}

export function registerBrokerWebhookRoutes(app: Express) {
  app.post("/api/webhooks/brokers/:brokerId", express.raw({ type: "application/json", limit: "1mb" }), brokerWebhook);
}
