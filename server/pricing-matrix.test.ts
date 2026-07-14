import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPricingMatrixRows,
  findCellRules,
  PRICING_CHANNELS,
  type PricingOrganization,
  type PricingRule,
} from "../client/src/pages/pricing-matrix";

const organizations: PricingOrganization[] = [
  { id: 1, parentOrganizationId: null, type: "SPC_BRASIL", legalName: "SPC Brasil", tradeName: "SPC Brasil", status: "ACTIVE" },
  { id: 10, parentOrganizationId: 1, type: "CDL", legalName: "CDL Regional", tradeName: "CDL Regional", status: "ACTIVE" },
  { id: 20, parentOrganizationId: 1, type: "DISTRIBUTOR", legalName: "Distribuidora Nacional", tradeName: "Distribuidora Nacional", status: "ACTIVE" },
  { id: 101, parentOrganizationId: 10, type: "CREDITOR", legalName: "Credor Alfa S.A.", tradeName: "Credor Alfa", status: "ACTIVE" },
  { id: 102, parentOrganizationId: 10, type: "CREDITOR", legalName: "Credor Beta S.A.", tradeName: "Credor Beta", status: "ACTIVE" },
  { id: 201, parentOrganizationId: 20, type: "CREDITOR", legalName: "Credor Gama S.A.", tradeName: "Credor Gama", status: "ACTIVE" },
  { id: 202, parentOrganizationId: 20, type: "CREDITOR", legalName: "Credor Suspenso S.A.", tradeName: "Credor Suspenso", status: "SUSPENDED" },
];

const rule = (values: Partial<PricingRule> & Pick<PricingRule, "id" | "organizationId" | "creditorOrganizationId" | "channel">): PricingRule => ({
  priceType: values.creditorOrganizationId === null ? "SPC_BASE" : "CREDITOR_PRICE",
  unitPriceMicros: 60_000,
  validFrom: new Date("2026-07-13T12:00:00.000Z"),
  validUntil: null,
  active: true,
  ...values,
});

describe("matriz de precificação por credor e canal", () => {
  it("exibe Base SPC e todos os credores ativos pelo nome para SPC_ADMIN", () => {
    const rows = buildPricingMatrixRows({ organizations, actorOrganizationId: 1, isSpcAdmin: true });
    expect(rows.map(row => row.name)).toEqual(["Base SPC Brasil", "Credor Alfa", "Credor Beta", "Credor Gama"]);
    expect(rows.map(row => row.name).join(" ")).not.toMatch(/#\d+|101|102|201/);
    expect(PRICING_CHANNELS).toEqual(["EMAIL", "SMS", "WHATSAPP", "RCS"]);
  });

  it("exibe Base SPC Brasil como primeira linha para CDL_ADMIN e DISTRIBUTOR_ADMIN, seguida pelos credores do escopo", () => {
    const cdlRows = buildPricingMatrixRows({ organizations, actorOrganizationId: 10, isSpcAdmin: false });
    const distributorRows = buildPricingMatrixRows({ organizations, actorOrganizationId: 20, isSpcAdmin: false });
    expect(cdlRows.map(row => row.name)).toEqual(["Base SPC Brasil", "Credor Alfa", "Credor Beta"]);
    expect(distributorRows.map(row => row.name)).toEqual(["Base SPC Brasil", "Credor Gama"]);
    expect(cdlRows[0]?.priceType).toBe("SPC_BASE");
    expect(distributorRows[0]?.priceType).toBe("SPC_BASE");
    expect(cdlRows.slice(1).every(row => row.organizationId === 10)).toBe(true);
    expect(distributorRows.slice(1).every(row => row.organizationId === 20)).toBe(true);
  });

  it("desabilita visualmente a Base SPC Brasil para CDL_ADMIN e DISTRIBUTOR_ADMIN na interface", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Pricing.tsx"), "utf8");
    expect(source).toContain('const isReadOnly = row.priceType === "SPC_BASE" && !isSpc;');
    expect(source).toContain('disabled={isReadOnly}');
    expect(source).toContain('"border-slate-300 bg-slate-200 text-slate-500 cursor-not-allowed"');
    expect(source).toContain('toast.info("Base SPC Brasil é somente leitura para sua organização.");');
  });

  it("considera verde apenas a regra ativa e mantém a última regra inativa como referência editável", () => {
    const rows = buildPricingMatrixRows({ organizations, actorOrganizationId: 10, isSpcAdmin: false });
    const row = rows[1]; // Pular Base SPC Brasil e usar primeiro credor
    const inactive = rule({ id: 1, organizationId: 10, creditorOrganizationId: 101, channel: "SMS", active: false, validFrom: new Date("2026-07-12T12:00:00.000Z") });
    const active = rule({ id: 2, organizationId: 10, creditorOrganizationId: 101, channel: "SMS", active: true, validFrom: new Date("2026-07-13T12:00:00.000Z") });
    expect(findCellRules([inactive, active], row, "SMS")).toEqual({ activeRule: active, latestRule: active });
    expect(findCellRules([inactive], row, "SMS")).toEqual({ activeRule: null, latestRule: inactive });
    expect(findCellRules([], row, "SMS")).toEqual({ activeRule: null, latestRule: null });
  });

  it("mantém na tela a legenda, as cores verde e vermelha e a ação de clique por célula", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Pricing.tsx"), "utf8");
    expect(source).toContain("Preço ativo");
    expect(source).toContain("Inativo ou sem preço");
    expect(source).toContain("bg-emerald-600");
    expect(source).toContain("bg-rose-600");
    expect(source).toContain("onClick={() => openCell(row, channel)}");
    expect(source).toContain('className="overflow-x-auto"');
    expect(source).toContain('className="min-w-[940px]"');
    expect(source).toContain("sticky left-0");
    expect(source).toContain("grid grid-cols-3");
    expect(source).not.toContain("Credor #");
  });

  it("preserva no backend o isolamento, valida o credor e audita as duas modalidades de preço", () => {
    const service = readFileSync(resolve(process.cwd(), "server/pricing-service.ts"), "utf8");
    expect(service).toContain('eq(pricingRules.organizationId, actor.organizationId)');
    expect(service).toContain("creditor[0].parentOrganizationId !== ownerOrganizationId");
    expect(service).toContain("await assertCreditorScope(actor, input.creditorOrganizationId, ownerOrganizationId)");
    expect(service).toContain('action: "SPC_BASE_PRICE_SET"');
    expect(service).toContain('action: "CREDITOR_PRICE_SET"');
    expect(service.match(/await writeAudit\(/g)).toHaveLength(2);
  });

  it("retorna SPC_BASE para CDL_ADMIN e DISTRIBUTOR_ADMIN na listagem de precos", () => {
    const service = readFileSync(resolve(process.cwd(), "server/pricing-service.ts"), "utf8");
    expect(service).toContain('eq(pricingRules.priceType, "SPC_BASE")');
    expect(service).toContain('or(eq(pricingRules.organizationId, actor.organizationId), eq(pricingRules.priceType, "SPC_BASE"))');
  });

  it("retorna SPC_BRASIL para CDL_ADMIN e DISTRIBUTOR_ADMIN na listagem de organizacoes", () => {
    const adminService = readFileSync(resolve(process.cwd(), "server/admin-service.ts"), "utf8");
    expect(adminService).toContain('eq(organizations.type, "SPC_BRASIL")');
    expect(adminService).toContain('or(eq(organizations.id, actor.organizationId), eq(organizations.parentOrganizationId, actor.organizationId), eq(organizations.type, "SPC_BRASIL"))');
  });
});
