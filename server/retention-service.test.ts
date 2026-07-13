import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  encryptSensitive: vi.fn(() => "encrypted-retained-value"),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./security", () => ({ encryptSensitive: mocks.encryptSensitive }));

import {
  auditLogs,
  campaignRecipients,
  deliveryEvents,
  uploads,
  webhookReceipts,
} from "../drizzle/schema";
import { cleanupExpiredPersonalData } from "./retention-service";

type AffectedResult = [{ affectedRows: number }];

function createDbDouble(options?: {
  recipientRows?: Array<{ id: number }>;
  importRows?: Array<{ id: number }>;
  affectedRows?: number[];
}) {
  const selectResults = [options?.recipientRows ?? [{ id: 11 }], options?.importRows ?? [{ id: 22 }]];
  const affectedRows = [...(options?.affectedRows ?? [1, 1, 3, 4, 5])];
  const setCalls: Array<Record<string, unknown>> = [];

  const select = vi.fn(() => {
    const rows = selectResults.shift() ?? [];
    return {
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(async () => rows) })),
        })),
      })),
    };
  });

  const update = vi.fn(() => ({
    set: vi.fn((values: Record<string, unknown>) => {
      setCalls.push(values);
      return {
        where: vi.fn(async (): Promise<AffectedResult> => [{ affectedRows: affectedRows.shift() ?? 0 }]),
      };
    }),
  }));

  const remove = vi.fn(() => ({
    where: vi.fn(async (): Promise<AffectedResult> => [{ affectedRows: affectedRows.shift() ?? 0 }]),
  }));

  return {
    db: { select, update, delete: remove },
    select,
    update,
    remove,
    setCalls,
  };
}

describe("cleanupExpiredPersonalData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("anonimiza destinatários e aplica limpeza a todos os domínios configurados", async () => {
    const double = createDbDouble({ affectedRows: [2, 1, 7, 8, 9] });
    mocks.getDb.mockResolvedValue(double.db);
    const now = new Date("2026-07-13T00:00:00.000Z");

    const result = await cleanupExpiredPersonalData(now, {
      authChallengeDays: 7,
      authSessionDays: 30,
      importFileDays: 30,
      recipientPiiDays: 90,
      deliveryEventDays: 365,
      webhookReceiptDays: 90,
      auditContextDays: 730,
    });

    expect(double.update).toHaveBeenNthCalledWith(1, campaignRecipients);
    expect(double.update).toHaveBeenNthCalledWith(2, uploads);
    expect(double.update).toHaveBeenNthCalledWith(3, auditLogs);
    expect(double.remove).toHaveBeenNthCalledWith(1, deliveryEvents);
    expect(double.remove).toHaveBeenNthCalledWith(2, webhookReceipts);

    expect(double.setCalls[0]).toMatchObject({
      destinationCiphertext: "encrypted-retained-value",
      variablesCiphertext: null,
      cpfCiphertext: null,
      firstNameCiphertext: null,
      debtAmountCents: null,
      debtDueDate: null,
      contractNumberCiphertext: null,
      creditorPhoneCiphertext: null,
      creditorEmailCiphertext: null,
      brokerMessageId: null,
      errorCode: "PII_RETAINED",
    });
    expect(double.setCalls[1]).toEqual({
      storageKey: "",
      originalName: "[retido]",
      status: "DELETED",
      deletedAt: now,
    });
    expect(double.setCalls[2]).toEqual({ metadata: null, ipHash: null, userAgentHash: null });
    expect(mocks.encryptSensitive).toHaveBeenCalledWith("[retido]", expect.any(String));
    expect(result).toEqual({
      importReferencesRemoved: 1,
      recipientsAnonymized: 2,
      deliveryEventsDeleted: 7,
      webhookReceiptsDeleted: 8,
      auditContextsMinimized: 9,
    });
  });

  it("não reanonimiza destinatários nem importações quando não há registros elegíveis", async () => {
    const double = createDbDouble({ recipientRows: [], importRows: [], affectedRows: [3, 4, 5] });
    mocks.getDb.mockResolvedValue(double.db);

    const result = await cleanupExpiredPersonalData(new Date("2026-07-13T00:00:00.000Z"));

    expect(double.update).toHaveBeenCalledTimes(1);
    expect(double.update).toHaveBeenCalledWith(auditLogs);
    expect(double.remove).toHaveBeenCalledTimes(2);
    expect(mocks.encryptSensitive).not.toHaveBeenCalled();
    expect(result).toEqual({
      importReferencesRemoved: 0,
      recipientsAnonymized: 0,
      deliveryEventsDeleted: 3,
      webhookReceiptsDeleted: 4,
      auditContextsMinimized: 5,
    });
  });
});
