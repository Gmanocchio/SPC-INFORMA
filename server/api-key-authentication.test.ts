import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = { records: [] as Array<Record<string, unknown>> };
  const limit = vi.fn(async () => state.records);
  const whereSelect = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where: whereSelect }));
  const select = vi.fn(() => ({ from }));
  const whereUpdate = vi.fn(async () => [{ affectedRows: 1 }]);
  const set = vi.fn(() => ({ where: whereUpdate }));
  const update = vi.fn(() => ({ set }));
  return { state, db: { select, update }, select, update, set, whereUpdate };
});

vi.mock("./db", () => ({ getDb: vi.fn(async () => mocks.db) }));

import { authenticateApiKey } from "./api-key-service";

describe("autenticação de chave da API pública", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.records = [];
  });

  it("rejeita formato inválido antes de consultar o banco", async () => {
    await expect(authenticateApiKey("curta", "campaigns:write")).rejects.toBeInstanceOf(TRPCError);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("aceita chave ativa com escopo e atualiza lastUsedAt", async () => {
    mocks.state.records = [{ id: 5, organizationId: 12, createdByUserId: 9, scopes: ["campaigns:write"], expiresAt: null }];
    await expect(authenticateApiKey("ntf_prefix_abcdefghijklmnopqrstuvwxyz123456", "campaigns:write")).resolves.toMatchObject({ organizationId: 12 });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith({ lastUsedAt: expect.any(Date) });
  });

  it("rejeita chave expirada e chave sem o escopo exigido", async () => {
    mocks.state.records = [{ id: 5, organizationId: 12, createdByUserId: 9, scopes: ["campaigns:write"], expiresAt: new Date("2020-01-01") }];
    await expect(authenticateApiKey("ntf_prefix_abcdefghijklmnopqrstuvwxyz123456", "campaigns:write")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    mocks.state.records = [{ id: 5, organizationId: 12, createdByUserId: 9, scopes: ["campaigns:read"], expiresAt: null }];
    await expect(authenticateApiKey("ntf_prefix_abcdefghijklmnopqrstuvwxyz123456", "campaigns:write")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
