import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  writeAudit: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./audit", () => ({ writeAudit: mocks.writeAudit }));

import { updateTemplate } from "./template-service";

function createDbDouble(existing: Record<string, unknown>) {
  const limit = vi.fn(async () => [existing]);
  const selectWhere = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from }));
  const updateWhere = vi.fn(async () => [{ affectedRows: 1 }]);
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));
  const transaction = vi.fn(async (callback: (tx: { select: typeof select; update: typeof update }) => unknown) => callback({ select, update }));

  return { db: { select, update, transaction }, set, updateWhere, transaction };
}

describe("updateTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite ao SPC_ADMIN editar conteúdo ativo e registra a nova versão", async () => {
    const double = createDbDouble({
      id: 42,
      organizationId: 1,
      name: "Cobrança vigente",
      channel: "SMS",
      subject: null,
      content: "Olá {{primeiro_nome}}.",
      variables: ["primeiro_nome"],
      status: "ACTIVE",
      version: 7,
    });
    mocks.getDb.mockResolvedValue(double.db);

    await expect(updateTemplate(
      { id: 9, organizationId: 1, role: "SPC_ADMIN" },
      42,
      {
        name: "Cobrança vigente revisada",
        channel: "SMS",
        subject: null,
        content: "Olá {{primeiro_nome}}, consulte o contrato {{numero_contrato}}.",
        status: "ACTIVE",
      },
    )).resolves.toEqual({ success: true });

    expect(double.set).toHaveBeenCalledWith(expect.objectContaining({
      templateNameSnapshot: "Cobrança vigente",
      templateVersionSnapshot: 7,
      templateContentSnapshot: "Olá {{primeiro_nome}}.",
    }));
    expect(double.set).toHaveBeenCalledWith(expect.objectContaining({
      name: "Cobrança vigente revisada",
      content: "Olá {{primeiro_nome}}, consulte o contrato {{numero_contrato}}.",
      variables: expect.arrayContaining(["primeiro_nome", "numero_contrato"]),
      status: "ACTIVE",
      version: 8,
    }));
    expect(mocks.writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 1,
      actorUserId: 9,
      action: "TEMPLATE_UPDATED",
      resourceType: "message_template",
      resourceId: 42,
      metadata: { channel: "SMS", status: "ACTIVE", version: 8 },
    }));
    expect(double.transaction).toHaveBeenCalledTimes(1);
  });

  it("mantém templates arquivados protegidos contra edição ou reativação", async () => {
    const double = createDbDouble({
      id: 77,
      organizationId: 1,
      channel: "EMAIL",
      subject: "Assunto anterior",
      content: "Conteúdo anterior",
      status: "ARCHIVED",
      version: 3,
    });
    mocks.getDb.mockResolvedValue(double.db);

    await expect(updateTemplate(
      { id: 9, organizationId: 1, role: "SPC_ADMIN" },
      77,
      {
        name: "Template arquivado",
        channel: "EMAIL",
        subject: "Novo assunto",
        content: "Novo conteúdo",
        status: "ACTIVE",
      },
    )).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    expect(double.set).not.toHaveBeenCalled();
    expect(mocks.writeAudit).not.toHaveBeenCalled();
  });
});
