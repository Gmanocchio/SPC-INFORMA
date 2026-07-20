import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  writeAudit: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./audit", () => ({ writeAudit: mocks.writeAudit }));

import { createTemplate, listAvailableTemplates, updateTemplate } from "./template-service";
import { formatTemplatePublicId } from "../shared/template-id";

function createDbDouble(existing: Record<string, unknown>) {
  const organizationLimit = vi.fn(async () => [{ type: "SPC_BRASIL" }]);
  const organizationWhere = vi.fn(() => ({ limit: organizationLimit }));
  const organizationFrom = vi.fn(() => ({ where: organizationWhere }));
  const organizationSelect = vi.fn(() => ({ from: organizationFrom }));
  const templateLimit = vi.fn(async () => [existing]);
  const templateWhere = vi.fn(() => ({ limit: templateLimit }));
  const templateFrom = vi.fn(() => ({ where: templateWhere }));
  const templateSelect = vi.fn(() => ({ from: templateFrom }));
  const updateWhere = vi.fn(async () => [{ affectedRows: 1 }]);
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));
  const transaction = vi.fn(async (callback: (tx: { select: typeof templateSelect; update: typeof update }) => unknown) => callback({ select: templateSelect, update }));

  return { db: { select: organizationSelect, update, transaction }, set, updateWhere, transaction };
}

describe("listAvailableTemplates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna apenas templates do SPC Brasil (organizationId = 1) com status ACTIVE", async () => {
    const spcBrasilTemplates = [
      {
        id: 1,
        name: "Mensagem WhatsApp",
        channel: "WHATSAPP",
        subject: null,
        content: "Olá {{nome_cliente}}",
        variables: ["nome_cliente"],
        version: 1,
      },
      {
        id: 2,
        name: "Notificação Email",
        channel: "EMAIL",
        subject: "Aviso de débito",
        content: "Você tem um débito de {{valor}}",
        variables: ["valor"],
        version: 1,
      },
    ];

    const orderBy = vi.fn(async () => spcBrasilTemplates);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const db = { select };
    mocks.getDb.mockResolvedValue(db);

    const result = await listAvailableTemplates({ id: 10, organizationId: 2, role: "ORG_ADMIN" });

    expect(result).toEqual([
      { ...spcBrasilTemplates[0], publicId: "TP-000001" },
      { ...spcBrasilTemplates[1], publicId: "TP-000002" },
    ]);
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.anything(),
        name: expect.anything(),
        channel: expect.anything(),
      })
    );
  });

  it("filtra por canal quando fornecido", async () => {
    const whatsappTemplates = [
      {
        id: 1,
        name: "Mensagem WhatsApp",
        channel: "WHATSAPP",
        subject: null,
        content: "Olá {{nome_cliente}}",
        variables: ["nome_cliente"],
        version: 1,
      },
    ];

    const orderBy = vi.fn(async () => whatsappTemplates);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const db = { select };
    mocks.getDb.mockResolvedValue(db);

    const result = await listAvailableTemplates({ id: 10, organizationId: 2, role: "ORG_ADMIN" }, "WHATSAPP");

    expect(result).toEqual([{ ...whatsappTemplates[0], publicId: "TP-000001" }]);
  });
});

describe("identificador público do template", () => {
  it("usa a chave primária imutável com prefixo TP e mínimo de seis dígitos", () => {
    expect(formatTemplatePublicId(232)).toBe("TP-000232");
    expect(formatTemplatePublicId(510001)).toBe("TP-510001");
  });

  it("rejeita IDs internos inválidos", () => {
    expect(() => formatTemplatePublicId(0)).toThrow(RangeError);
    expect(() => formatTemplatePublicId(1.5)).toThrow(RangeError);
  });
});

describe("createTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createDbDouble(organizationType: "SPC_BRASIL" | "CREDITOR") {
    const limit = vi.fn(async () => [{ type: organizationType }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const values = vi.fn(async () => [{ insertId: 232 }]);
    const insert = vi.fn(() => ({ values }));
    return { db: { select, insert }, insert, values };
  }

  const input = {
    name: "Aviso homologado",
    channel: "SMS" as const,
    subject: null,
    content: "Olá {{primeiro_nome}}.",
    status: "ACTIVE" as const,
  };

  it("cria para SPC_ADMIN vinculado ao SPC Brasil e retorna o ID público", async () => {
    const double = createDbDouble("SPC_BRASIL");
    mocks.getDb.mockResolvedValue(double.db);

    await expect(createTemplate(
      { id: 9, organizationId: 1, role: "SPC_ADMIN" },
      input,
    )).resolves.toEqual({ id: 232, publicId: "TP-000232" });

    expect(double.values).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 1,
      createdByUserId: 9,
    }));
    expect(mocks.writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "TEMPLATE_CREATED",
      resourceId: 232,
      metadata: expect.objectContaining({ publicId: "TP-000232" }),
    }));
  });

  it("bloqueia qualquer papel diferente de SPC_ADMIN antes da gravação", async () => {
    const double = createDbDouble("SPC_BRASIL");
    mocks.getDb.mockResolvedValue(double.db);

    await expect(createTemplate(
      { id: 10, organizationId: 2, role: "ORG_ADMIN" },
      input,
    )).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(double.insert).not.toHaveBeenCalled();
    expect(mocks.writeAudit).not.toHaveBeenCalled();
  });

  it("bloqueia SPC_ADMIN fora da organização SPC Brasil", async () => {
    const double = createDbDouble("CREDITOR");
    mocks.getDb.mockResolvedValue(double.db);

    await expect(createTemplate(
      { id: 11, organizationId: 99, role: "SPC_ADMIN" },
      input,
    )).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(double.insert).not.toHaveBeenCalled();
    expect(mocks.writeAudit).not.toHaveBeenCalled();
  });
});

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
      metadata: { publicId: "TP-000042", channel: "SMS", status: "ACTIVE", version: 8 },
    }));
    expect(double.transaction).toHaveBeenCalledTimes(1);
  });

  it("bloqueia edição por usuários que não sejam SPC_ADMIN", async () => {
    const double = createDbDouble({
      id: 42,
      organizationId: 1,
      status: "ACTIVE",
      version: 7,
    });
    mocks.getDb.mockResolvedValue(double.db);

    await expect(updateTemplate(
      { id: 10, organizationId: 2, role: "ORG_ADMIN" },
      42,
      {
        name: "Alteração indevida",
        channel: "SMS",
        subject: null,
        content: "Conteúdo indevido",
        status: "ACTIVE",
      },
    )).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(double.transaction).not.toHaveBeenCalled();
    expect(mocks.writeAudit).not.toHaveBeenCalled();
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
