import { and, asc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { campaignRecipients, campaigns, deliveryEvents, messageTemplates } from "../drizzle/schema";
import { formatDebtAmountCents, formatDebtDueDate } from "../shared/template-variables";
import { ENV } from "./_core/env";
import { getPreferredBrokerForDispatch } from "./broker-service";
import { getDb } from "./db";
import { decryptSensitive, sha256 } from "./security";

type ProcessingOptions = { campaignLimit?: number; recipientLimit?: number; concurrency?: number };

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db;
}

export function renderTemplate(content: string, variables: Record<string, string>) {
  return content.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) => variables[key] ?? "");
}

function targetFor(recipient: typeof campaignRecipients.$inferSelect) {
  return decryptSensitive(recipient.destinationCiphertext, ENV.cookieSecret);
}

export function variablesFor(recipient: typeof campaignRecipients.$inferSelect): Record<string, string> {
  if (
    recipient.cpfCiphertext
    && recipient.firstNameCiphertext
    && recipient.debtAmountCents !== null
    && recipient.debtDueDate
    && recipient.contractNumberCiphertext
    && recipient.creditorPhoneCiphertext
    && recipient.creditorEmailCiphertext
  ) {
    return {
      cpf: decryptSensitive(recipient.cpfCiphertext, ENV.cookieSecret),
      primeiro_nome: decryptSensitive(recipient.firstNameCiphertext, ENV.cookieSecret),
      valor_divida: formatDebtAmountCents(recipient.debtAmountCents),
      vencimento_divida: formatDebtDueDate(recipient.debtDueDate),
      numero_contrato: decryptSensitive(recipient.contractNumberCiphertext, ENV.cookieSecret),
      telefone_credor: decryptSensitive(recipient.creditorPhoneCiphertext, ENV.cookieSecret),
      email_credor: decryptSensitive(recipient.creditorEmailCiphertext, ENV.cookieSecret),
    };
  }
  if (!recipient.variablesCiphertext) return {};
  const parsed = JSON.parse(decryptSensitive(recipient.variablesCiphertext, ENV.cookieSecret)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value ?? "")]));
}

export function brokerHeaders(credentials: Record<string, string>, extra: Record<string, string | number | boolean | null>) {
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  if (credentials.apiKey) headers[String(extra.apiKeyHeader || "authorization")] = extra.apiKeyPrefix === false ? credentials.apiKey : `Bearer ${credentials.apiKey}`;
  else if (credentials.token) headers.authorization = `Bearer ${credentials.token}`;
  else if (credentials.username && credentials.password) headers.authorization = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64")}`;
  if (credentials.accountId) headers["x-account-id"] = credentials.accountId;
  return headers;
}

export function dispatchUrl(endpointUrl: string, extra: Record<string, string | number | boolean | null>) {
  const path = typeof extra.sendPath === "string" ? extra.sendPath.trim() : "";
  if (!path) return endpointUrl;
  return new URL(path, endpointUrl.endsWith("/") ? endpointUrl : `${endpointUrl}/`).toString();
}

export function brokerTimeoutMs(extra: Record<string, string | number | boolean | null>) {
  return Math.min(30_000, Math.max(1_000, Number(extra.timeoutMs) || 10_000));
}

async function dispatchRecipient(campaign: typeof campaigns.$inferSelect, template: typeof messageTemplates.$inferSelect, recipient: typeof campaignRecipients.$inferSelect, broker: NonNullable<Awaited<ReturnType<typeof getPreferredBrokerForDispatch>>>) {
  const extra = broker.extraConfig;
  const variables = variablesFor(recipient);
  const destination = targetFor(recipient);
  if (!destination) throw Object.assign(new Error("Destinatário sem endereço compatível com o canal."), { retryable: false });
  const timeout = brokerTimeoutMs(extra);
  const payload = {
    idempotencyKey: recipient.id,
    campaignId: campaign.id,
    recipientId: recipient.id,
    channel: campaign.channel,
    destination,
    destinationType: "CPF",
    subject: template.subject ? renderTemplate(template.subject, variables) : null,
    content: renderTemplate(template.content, variables),
    variables,
    callbackUrl: typeof extra.callbackUrl === "string" ? extra.callbackUrl : undefined,
    metadata: { brokerId: broker.id, organizationId: campaign.organizationId, creditorOrganizationId: campaign.creditorOrganizationId, destinationType: "CPF" },
  };
  let response: Response;
  try {
    response = await fetch(dispatchUrl(broker.baseUrl, extra), { method: "POST", headers: brokerHeaders(broker.credentials, extra), body: JSON.stringify(payload), signal: AbortSignal.timeout(timeout) });
  } catch (error) {
    throw Object.assign(new Error(error instanceof Error ? error.message : "Falha de rede ao acionar broker."), { retryable: true });
  }
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try { body = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { body = {}; }
  if (!response.ok) throw Object.assign(new Error(`Broker respondeu HTTP ${response.status}.`), { retryable: response.status === 408 || response.status === 429 || response.status >= 500, status: response.status });
  return { brokerMessageId: String(body.messageId ?? body.id ?? body.externalId ?? recipient.id), responseStatus: response.status };
}

async function refreshCampaign(campaignId: string) {
  const db = await requireDb();
  const [counts] = await db.select({
    pending: sql<number>`SUM(CASE WHEN ${campaignRecipients.status} IN ('PENDING','QUEUED') THEN 1 ELSE 0 END)`,
    delivered: sql<number>`SUM(CASE WHEN ${campaignRecipients.status} = 'DELIVERED' THEN 1 ELSE 0 END)`,
    failed: sql<number>`SUM(CASE WHEN ${campaignRecipients.status} = 'FAILED' THEN 1 ELSE 0 END)`,
    optedOut: sql<number>`SUM(CASE WHEN ${campaignRecipients.status} = 'OPTED_OUT' THEN 1 ELSE 0 END)`,
    terminal: sql<number>`SUM(CASE WHEN ${campaignRecipients.status} IN ('DELIVERED','FAILED','OPTED_OUT') THEN 1 ELSE 0 END)`,
  }).from(campaignRecipients).where(eq(campaignRecipients.campaignId, campaignId));
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  if (!campaign) return;
  const pending = Number(counts?.pending ?? 0);
  const delivered = Number(counts?.delivered ?? 0);
  const failed = Number(counts?.failed ?? 0);
  const optedOut = Number(counts?.optedOut ?? 0);
  const terminal = Number(counts?.terminal ?? 0);
  let status = campaign.status;
  let completedAt = campaign.completedAt;
  if (campaign.validRecipientCount > 0 && terminal >= campaign.validRecipientCount) {
    status = delivered === 0 && failed + optedOut >= campaign.validRecipientCount ? "FAILED" : failed > 0 || optedOut > 0 ? "PARTIAL" : "COMPLETED";
    completedAt = new Date();
  }
  else status = "PROCESSING";
  await db.update(campaigns).set({ status, deliveredCount: delivered, failedCount: failed, completedAt }).where(eq(campaigns.id, campaignId));
}

async function processCampaign(campaign: typeof campaigns.$inferSelect, recipientLimit: number, concurrency: number) {
  const db = await requireDb();
  if (campaign.status === "QUEUED") {
    const result = await db.update(campaigns).set({ status: "PROCESSING", startedAt: new Date() }).where(and(eq(campaigns.id, campaign.id), eq(campaigns.status, "QUEUED")));
    if (Number(result[0].affectedRows) !== 1) return { campaignId: campaign.id, skipped: true };
  }
  const broker = await getPreferredBrokerForDispatch(campaign.channel);
  if (!broker) {
    await db.update(campaigns).set({ status: "FAILED", completedAt: new Date() }).where(eq(campaigns.id, campaign.id));
    return { campaignId: campaign.id, failed: "NO_BROKER" };
  }
  await db.update(campaigns).set({ brokerId: broker.id }).where(eq(campaigns.id, campaign.id));
  const [template] = await db.select().from(messageTemplates).where(eq(messageTemplates.id, campaign.templateId)).limit(1);
  if (!template) throw new Error(`Template ${campaign.templateId} não encontrado.`);
  const recipients = await db.select().from(campaignRecipients).where(and(eq(campaignRecipients.campaignId, campaign.id), eq(campaignRecipients.status, "PENDING"))).orderBy(asc(campaignRecipients.createdAt)).limit(recipientLimit);
  for (let offset = 0; offset < recipients.length; offset += concurrency) {
    const chunk = recipients.slice(offset, offset + concurrency);
    await Promise.all(chunk.map(async recipient => {
      const claim = await db.update(campaignRecipients).set({ status: "QUEUED" }).where(and(eq(campaignRecipients.id, recipient.id), eq(campaignRecipients.status, "PENDING")));
      if (Number(claim[0].affectedRows) !== 1) return;
      try {
        const result = await dispatchRecipient(campaign, template, recipient, broker);
        await db.update(campaignRecipients).set({ status: "SENT", brokerMessageId: result.brokerMessageId, sentAt: new Date(), errorCode: null }).where(and(eq(campaignRecipients.id, recipient.id), eq(campaignRecipients.status, "QUEUED")));
        const externalEventId = `dispatch:${campaign.id}:${recipient.id}`;
        await db.insert(deliveryEvents).values({ organizationId: campaign.organizationId, campaignId: campaign.id, recipientId: recipient.id, brokerId: broker.id, externalEventId, eventType: "ACCEPTED", occurredAt: new Date(), payloadDigest: sha256(`${externalEventId}:${result.brokerMessageId}:${result.responseStatus}`) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha desconhecida.";
        const previousAttempt = Number(recipient.errorCode?.match(/^RETRY_(\d+)$/)?.[1] ?? 0);
        const attempt = previousAttempt + 1;
        const retryable = Boolean((error as { retryable?: boolean } | null)?.retryable) && attempt < 3;
        await db.update(campaignRecipients).set({ status: retryable ? "PENDING" : "FAILED", errorCode: retryable ? `RETRY_${attempt}` : "BROKER_REJECTED" }).where(and(eq(campaignRecipients.id, recipient.id), eq(campaignRecipients.status, "QUEUED")));
        const externalEventId = `dispatch-failed:${campaign.id}:${recipient.id}:attempt:${attempt}`;
        await db.insert(deliveryEvents).values({ organizationId: campaign.organizationId, campaignId: campaign.id, recipientId: recipient.id, brokerId: broker.id, externalEventId, eventType: "FAILED", occurredAt: new Date(), payloadDigest: sha256(`${externalEventId}:${message}`) });
      }
    }));
  }
  await refreshCampaign(campaign.id);
  return { campaignId: campaign.id, attempted: recipients.length, brokerId: broker.id };
}

export async function processCampaignQueue(options: ProcessingOptions = {}) {
  const db = await requireDb();
  const now = new Date();
  const staleClaimBefore = new Date(now.getTime() - 5 * 60 * 1000);
  await db.update(campaignRecipients).set({ status: "PENDING" }).where(and(eq(campaignRecipients.status, "QUEUED"), lte(campaignRecipients.updatedAt, staleClaimBefore)));
  await db.update(campaigns).set({ status: "QUEUED" }).where(and(eq(campaigns.status, "SCHEDULED"), or(isNull(campaigns.scheduledFor), lte(campaigns.scheduledFor, now))));
  const candidates = await db.select().from(campaigns).where(inArray(campaigns.status, ["QUEUED", "PROCESSING"])).orderBy(asc(campaigns.scheduledFor), asc(campaigns.createdAt)).limit(options.campaignLimit ?? 5);
  const results = [];
  for (const campaign of candidates) results.push(await processCampaign(campaign, options.recipientLimit ?? 100, options.concurrency ?? 8));
  return { processedAt: now.toISOString(), campaigns: results };
}

export { refreshCampaign };
