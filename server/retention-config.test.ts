import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETENTION_POLICY,
  loadRetentionPolicy,
  retentionCutoff,
  TERMINAL_CAMPAIGN_STATUSES,
} from "./retention-config";

describe("retention policy", () => {
  it("loads explicit per-domain retention windows", () => {
    expect(loadRetentionPolicy({
      RETENTION_AUTH_CHALLENGE_DAYS: "3",
      RETENTION_AUTH_SESSION_DAYS: "15",
      RETENTION_IMPORT_FILE_DAYS: "10",
      RETENTION_RECIPIENT_PII_DAYS: "45",
      RETENTION_DELIVERY_EVENT_DAYS: "180",
      RETENTION_WEBHOOK_RECEIPT_DAYS: "60",
      RETENTION_AUDIT_CONTEXT_DAYS: "365",
    })).toEqual({
      authChallengeDays: 3,
      authSessionDays: 15,
      importFileDays: 10,
      recipientPiiDays: 45,
      deliveryEventDays: 180,
      webhookReceiptDays: 60,
      auditContextDays: 365,
    });
  });

  it("falls back safely for missing, invalid or excessive values", () => {
    expect(loadRetentionPolicy({
      RETENTION_AUTH_CHALLENGE_DAYS: "0",
      RETENTION_AUTH_SESSION_DAYS: "not-a-number",
      RETENTION_RECIPIENT_PII_DAYS: "36501",
    })).toMatchObject({
      authChallengeDays: DEFAULT_RETENTION_POLICY.authChallengeDays,
      authSessionDays: DEFAULT_RETENTION_POLICY.authSessionDays,
      recipientPiiDays: DEFAULT_RETENTION_POLICY.recipientPiiDays,
    });
  });

  it("calculates UTC cutoffs and only anonymizes terminal campaigns", () => {
    const now = new Date("2026-07-13T00:00:00.000Z");
    expect(retentionCutoff(now, 30).toISOString()).toBe("2026-06-13T00:00:00.000Z");
    expect(TERMINAL_CAMPAIGN_STATUSES).toEqual(["COMPLETED", "PARTIAL", "FAILED", "CANCELED"]);
  });
});
