import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("edição administrativa de registros persistidos", () => {
  it("expõe usuários e organizações somente por procedimentos administrativos validados", () => {
    const router = source("server/routers/admin.ts");
    expect(router).toContain("update: adminProcedure");
    expect(router).toContain("updateOrganization(actor(ctx), input.id, input.data)");
    expect(router).toContain("updateUser(actor(ctx), input.id, input.data)");
    expect(router).toContain('email: z.string().trim().email().max(320).optional()');
    expect(router).toContain('status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional()');
  });

  it("preserva identificadores, escopo, autoproteção e auditoria de usuários e organizações", () => {
    const service = source("server/admin-service.ts");
    expect(service).toContain('Omit<OrganizationInput, "type" | "cnpj" | "parentOrganizationId">');
    expect(service).toContain("canManageOrganization(actor, target)");
    expect(service).toContain('id === actor.id && (input.role || input.status === "INACTIVE")');
    expect(service).toContain('action: "ORGANIZATION_UPDATED"');
    expect(service).toContain('action: "USER_UPDATED"');
    expect(service).toContain("changedFields: Object.keys(input)");
  });

  it("permite editar campanhas somente antes do processamento e registra concorrência e auditoria", () => {
    const router = source("server/routers/campaigns.ts");
    const service = source("server/campaign-service.ts");
    expect(router).toContain("update: adminProcedure");
    expect(router).toContain("Informe ao menos um campo para editar.");
    expect(service).toContain("Apenas administradores podem editar campanhas.");
    expect(service).toContain("assertCampaignEditable(campaign.status)");
    expect(service).toContain("A campanha foi alterada por outra operação.");
    expect(service).toContain('action: "CAMPAIGN_UPDATED"');
  });

  it("mantém templates sob controle exclusivo do SPC e versiona alterações auditáveis", () => {
    const router = source("server/routers/commercial.ts");
    const service = source("server/template-service.ts");
    expect(router).toContain("update: spcAdminProcedure");
    expect(service).toContain('existing.status === "ARCHIVED"');
    expect(service).not.toContain('existing.status === "ACTIVE"');
    expect(service).not.toContain("O conteúdo de um template ativo é imutável.");
    expect(service).toContain("version: existing.version + 1");
    expect(service).toContain("templateContentSnapshot: existing.content");
    expect(service).toContain("isNull(campaigns.templateContentSnapshot)");
    expect(service).toContain('action: "TEMPLATE_UPDATED"');
  });

  it("oferece formulários de edição ligados às mutações em todos os módulos solicitados", () => {
    const users = source("client/src/pages/Users.tsx");
    const organizations = source("client/src/pages/Organizations.tsx");
    const campaigns = source("client/src/pages/Campaigns.tsx");
    const templates = source("client/src/pages/Templates.tsx");
    expect(users).toContain("trpc.admin.users.update.useMutation");
    expect(users).toContain("Editar usuário");
    expect(organizations).toContain("startEditing(org");
    expect(organizations).toContain("Editar empresa");
    expect(campaigns).toContain("startEditingCampaign");
    expect(campaigns).toContain("Bloqueada após início");
    expect(templates).toContain("trpc.commercial.templates.update.useMutation");
    expect(templates).toContain("startEditingTemplate");
    expect(templates).toContain("A alteração cria uma nova versão. Campanhas já vinculadas mantêm a mensagem da versão anterior.");
    expect(templates).toContain("Salvar nova versão");
    expect(templates).toContain('toast.success("Template atualizado e nova versão registrada na auditoria.")');
    expect(templates).toContain("update.isPending");
    expect(templates).toContain("onError: error => toast.error(error.message)");
    expect(templates).not.toContain("template ativo é imutável");
  });

  it("preserva as operações seguras já existentes nos demais cadastros administrativos", () => {
    const brokers = source("client/src/pages/Brokers.tsx");
    const commercialRouter = source("server/routers/commercial.ts");
    const apiKeyService = source("server/api-key-service.ts");
    const pricing = source("client/src/pages/Pricing.tsx");
    const apiKeys = source("client/src/pages/ApiKeys.tsx");
    expect(brokers).toContain("trpc.brokers.update.useMutation");
    expect(brokers).toContain("Editar broker");
    expect(commercialRouter).toContain("setBase: spcAdminProcedure");
    expect(commercialRouter).toContain("setCreditor: adminProcedure");
    expect(pricing).toContain("startPriceRevision");
    expect(pricing).toContain("A alteração cria uma nova vigência");
    expect(commercialRouter).toContain("rotate: adminProcedure");
    expect(apiKeyService).toContain('action: "API_KEY_ROTATED"');
    expect(apiKeys).toContain("trpc.commercial.apiKeys.rotate.useMutation");
    expect(apiKeys).toContain("Substituir e revogar anterior");
    expect(commercialRouter).toContain("revoke: adminProcedure");
  });
});
