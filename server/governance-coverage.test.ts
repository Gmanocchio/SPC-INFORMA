import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const source = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("contrato arquitetural de autorização", () => {
  it("mantém roteadores administrativos atrás dos procedimentos corretos", () => {
    const admin = source("server/routers/admin.ts");
    const brokers = source("server/routers/brokers.ts");
    const campaigns = source("server/routers/campaigns.ts");
    const commercial = source("server/routers/commercial.ts");
    const dashboard = source("server/routers/dashboard.ts");

    expect(admin).toContain("adminProcedure");
    expect(admin).not.toContain("publicProcedure");
    expect(brokers).toContain("spcAdminProcedure");
    expect(brokers).not.toMatch(/\b(publicProcedure|protectedProcedure|adminProcedure)\b/);
    expect(campaigns).toContain("protectedProcedure");
    expect(campaigns).not.toContain("publicProcedure");
    expect(commercial).toContain("spcAdminProcedure");
    expect(commercial).toContain("adminProcedure");
    expect(commercial).toContain("protectedProcedure");
    expect(commercial).not.toContain("publicProcedure");
    expect(dashboard).toContain("authenticatedProcedure");
  });

  it("preserva escopo organizacional nos serviços que consultam dados de negócio", () => {
    const checks: Array<[string, string[]]> = [
      ["server/admin-service.ts", ["canManageOrganization", "actor.organizationId", "parentOrganizationId"]],
      ["server/api-key-service.ts", ["resolveOrganizationId", "actor.organizationId", "key[0].organizationId"]],
      ["server/campaign-service.ts", ["resolveCampaignOrganization", "campaignScope", "actor.organizationId"]],
      ["server/dashboard-service.ts", ["campaigns.organizationId", "actor.organizationId", "actor.role === \"SPC_ADMIN\""]],
      ["server/pricing-service.ts", ["actor.organizationId", "ownerOrganizationId", "pricingRules.organizationId"]],
      ["server/template-service.ts", ["actor.organizationId", "messageTemplates.status", "messageTemplates.channel"]],
      ["server/broker-service.ts", ["actor.organizationId", "brokers.organizationId", "brokers.preferred"]],
    ];

    for (const [path, requiredTokens] of checks) {
      const file = source(path);
      for (const token of requiredTokens) expect(file, `${path} deve conter ${token}`).toContain(token);
    }
  });

  it("mantém auditoria explícita em todos os domínios mutáveis críticos", () => {
    const checks: Array<[string, string[]]> = [
      ["server/auth-service.ts", ["LOGIN_FAILED", "LOGIN_2FA_ISSUED", "LOGIN_SUCCEEDED", "PASSWORD_RESET_REQUESTED", "PASSWORD_RESET_COMPLETED", "LOGOUT"]],
      ["server/admin-service.ts", ["ORGANIZATION_CREATED", "ORGANIZATION_UPDATED", "USER_CREATED", "USER_UPDATED"]],
      ["server/pricing-service.ts", ["SPC_BASE_PRICE_SET", "CREDITOR_PRICE_SET"]],
      ["server/campaign-service.ts", ["CAMPAIGN_IMPORTED", "CAMPAIGN_CONFIRMED"]],
      ["server/broker-service.ts", ["BROKER_CREATED", "BROKER_UPDATED", "BROKER_DEACTIVATED"]],
      ["server/api-key-service.ts", ["API_KEY_CREATED", "API_KEY_REVOKED"]],
      ["server/template-service.ts", ["TEMPLATE_CREATED", "TEMPLATE_UPDATED"]],
    ];

    for (const [path, actions] of checks) {
      const file = source(path);
      expect(file, `${path} deve usar a trilha central`).toContain("writeAudit");
      for (const action of actions) expect(file, `${path} deve auditar ${action}`).toContain(action);
    }
  });
});

describe("contratos administrativos visíveis", () => {
  it("mantém Domínios como placeholder exclusivo do SPC_ADMIN", () => {
    const app = source("client/src/App.tsx");
    expect(app).toMatch(/path="\/app\/dominios"[\s\S]*?<ProtectedPage spcOnly>[\s\S]*?title="Gestão de Domínios"/);
    expect(app).toContain("gestão futura de domínios");
  });

  it("mantém gráficos separados para CDL, Distribuidora e Credor", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    expect(dashboard).toContain('["CDL", "DISTRIBUTOR", "CREDITOR"]');
    expect(dashboard).toContain("Volume confirmado por organização");
    expect(dashboard).toContain("Consolidado por organização");
  });
});
