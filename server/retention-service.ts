import { and, eq, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import {
  auditLogs,
  campaignRecipients,
  campaigns,
  deliveryEvents,
  uploads,
  webhookReceipts,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import {
  loadRetentionPolicy,
  retentionCutoff,
  TERMINAL_CAMPAIGN_STATUSES,
  type RetentionPolicy,
} from "./retention-config";
import { encryptSensitive } from "./security";

type CleanupResult = {
  importReferencesRemoved: number;
  recipientsAnonymized: number;
  deliveryEventsDeleted: number;
  webhookReceiptsDeleted: number;
  auditContextsMinimized: number;
};

function affectedRows(result: unknown) {
  if (!Array.isArray(result) || !result[0] || typeof result[0] !== "object") return 0;
  const value = (result[0] as { affectedRows?: unknown }).affectedRows;
  return typeof value === "number" ? value : 0;
}

export async function cleanupExpiredPersonalData(
  now = new Date(),
  policy: RetentionPolicy = loadRetentionPolicy(),
): Promise<CleanupResult> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para retenção.");

  const recipientCutoff = retentionCutoff(now, policy.recipientPiiDays);
  const importCutoff = retentionCutoff(now, policy.importFileDays);

  const recipientRows = await db
    .select({ id: campaignRecipients.id })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaignRecipients.campaignId, campaigns.id))
    .where(and(
      inArray(campaigns.status, [...TERMINAL_CAMPAIGN_STATUSES]),
      isNotNull(campaigns.completedAt),
      lt(campaigns.completedAt, recipientCutoff),
      ne(campaignRecipients.errorCode, "PII_RETAINED"),
    ))
    .limit(500);

  let recipientsAnonymized = 0;
  if (recipientRows.length) {
    const redacted = encryptSensitive("[retido]", ENV.cookieSecret);
    const updateResult = await db
      .update(campaignRecipients)
      .set({
        destinationCiphertext: redacted,
        destinationFingerprint: sql<string>`SHA2(CONCAT('retained:', ${campaignRecipients.id}), 256)`,
        variablesCiphertext: null,
        cpfCiphertext: null,
        customerNameCiphertext: null,
        creditorNameCiphertext: null,
        amountCents: null,
        dueDate: null,
        contractNumberCiphertext: null,
        creditorPhoneCiphertext: null,
        creditorEmailCiphertext: null,
        linkCiphertext: null,
        brokerMessageId: null,
        errorCode: "PII_RETAINED",
      })
      .where(inArray(campaignRecipients.id, recipientRows.map(row => row.id)));
    recipientsAnonymized = affectedRows(updateResult);
  }

  const importRows = await db
    .select({ id: uploads.id })
    .from(uploads)
    .innerJoin(campaigns, eq(uploads.id, campaigns.uploadId))
    .where(and(
      inArray(campaigns.status, [...TERMINAL_CAMPAIGN_STATUSES]),
      isNotNull(campaigns.completedAt),
      lt(campaigns.completedAt, importCutoff),
      isNull(uploads.deletedAt),
    ))
    .limit(250);

  let importReferencesRemoved = 0;
  if (importRows.length) {
    const uploadResult = await db
      .update(uploads)
      .set({ storageKey: "", originalName: "[retido]", status: "DELETED", deletedAt: now })
      .where(inArray(uploads.id, importRows.map(row => row.id)));
    importReferencesRemoved = affectedRows(uploadResult);
  }

  const deliveryResult = await db
    .delete(deliveryEvents)
    .where(lt(deliveryEvents.createdAt, retentionCutoff(now, policy.deliveryEventDays)));
  const webhookResult = await db
    .delete(webhookReceipts)
    .where(lt(webhookReceipts.receivedAt, retentionCutoff(now, policy.webhookReceiptDays)));
  const auditResult = await db
    .update(auditLogs)
    .set({ metadata: null, ipHash: null, userAgentHash: null })
    .where(and(
      lt(auditLogs.createdAt, retentionCutoff(now, policy.auditContextDays)),
      or(isNotNull(auditLogs.metadata), isNotNull(auditLogs.ipHash), isNotNull(auditLogs.userAgentHash)),
    ));

  return {
    importReferencesRemoved,
    recipientsAnonymized,
    deliveryEventsDeleted: affectedRows(deliveryResult),
    webhookReceiptsDeleted: affectedRows(webhookResult),
    auditContextsMinimized: affectedRows(auditResult),
  };
}
