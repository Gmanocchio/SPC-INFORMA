export type RetentionPolicy = {
  authChallengeDays: number;
  authSessionDays: number;
  importFileDays: number;
  recipientPiiDays: number;
  deliveryEventDays: number;
  webhookReceiptDays: number;
  auditContextDays: number;
};

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  authChallengeDays: 7,
  authSessionDays: 30,
  importFileDays: 30,
  recipientPiiDays: 90,
  deliveryEventDays: 365,
  webhookReceiptDays: 90,
  auditContextDays: 730,
};

function configuredDays(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 36_500) return fallback;
  return parsed;
}

export function loadRetentionPolicy(env: NodeJS.ProcessEnv = process.env): RetentionPolicy {
  return {
    authChallengeDays: configuredDays(env.RETENTION_AUTH_CHALLENGE_DAYS, DEFAULT_RETENTION_POLICY.authChallengeDays),
    authSessionDays: configuredDays(env.RETENTION_AUTH_SESSION_DAYS, DEFAULT_RETENTION_POLICY.authSessionDays),
    importFileDays: configuredDays(env.RETENTION_IMPORT_FILE_DAYS, DEFAULT_RETENTION_POLICY.importFileDays),
    recipientPiiDays: configuredDays(env.RETENTION_RECIPIENT_PII_DAYS, DEFAULT_RETENTION_POLICY.recipientPiiDays),
    deliveryEventDays: configuredDays(env.RETENTION_DELIVERY_EVENT_DAYS, DEFAULT_RETENTION_POLICY.deliveryEventDays),
    webhookReceiptDays: configuredDays(env.RETENTION_WEBHOOK_RECEIPT_DAYS, DEFAULT_RETENTION_POLICY.webhookReceiptDays),
    auditContextDays: configuredDays(env.RETENTION_AUDIT_CONTEXT_DAYS, DEFAULT_RETENTION_POLICY.auditContextDays),
  };
}

export function retentionCutoff(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1_000);
}

export const TERMINAL_CAMPAIGN_STATUSES = ["COMPLETED", "PARTIAL", "FAILED", "CANCELED"] as const;
