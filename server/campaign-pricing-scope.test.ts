import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));

import {
  determineCampaignPricingTarget,
  resolveCampaignPrice,
} from "./pricing-service";

type Organization = Parameters<typeof determineCampaignPricingTarget>[0]["responsibleOrganization"];

const organization = (values: Partial<Organization> & Pick<Organization, "id" | "type">): Organization => ({
  status: "ACTIVE",
  parentOrganizationId: null,
  linkedToOrganizationId: null,
  ...values,
});

const spc = organization({ id: 1, type: "SPC_BRASIL" });
const cdl = organization({ id: 10, type: "CDL" });
const distributor = organization({ id: 20, type: "DISTRIBUTOR" });

function mockSelectResults(...results: unknown[][]) {
  const queue = [...results];
  const select = vi.fn(() => {
    const rows = queue.shift() ?? [];
    const query = {
      from: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
      limit: vi.fn(async () => rows),
    };
    query.from.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.orderBy.mockReturnValue(query);
    return query;
  });
  mocks.getDb.mockResolvedValue({ select });
  return select;
}

describe("hierarquia de preços de campanha por vínculo organizacional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usa exclusivamente a Base SPC Brasil para o usuário do credor VIVO vinculado diretamente ao SPC", () => {
    const vivo = organization({ id: 101, type: "CREDITOR", linkedToOrganizationId: null });

    expect(determineCampaignPricingTarget({
      responsibleOrganization: vivo,
      creditorOrganization: vivo,
      spcOrganization: spc,
      linkedOrganization: null,
    })).toEqual({
      priceOwnerOrganizationId: 1,
      creditorOrganizationId: null,
      priceType: "SPC_BASE",
    });
  });

  it("usa a Base SPC Brasil quando o vínculo direto foi persistido explicitamente com o id do SPC", () => {
    const creditor = organization({ id: 102, type: "CREDITOR", linkedToOrganizationId: 1 });

    expect(determineCampaignPricingTarget({
      responsibleOrganization: creditor,
      creditorOrganization: creditor,
      spcOrganization: spc,
      linkedOrganization: spc,
    }).priceType).toBe("SPC_BASE");
  });

  it("usa o preço específico do credor cadastrado pela Distribuidora", () => {
    const creditor = organization({ id: 201, type: "CREDITOR", linkedToOrganizationId: 20 });

    expect(determineCampaignPricingTarget({
      responsibleOrganization: creditor,
      creditorOrganization: creditor,
      spcOrganization: spc,
      linkedOrganization: distributor,
    })).toEqual({
      priceOwnerOrganizationId: 20,
      creditorOrganizationId: 201,
      priceType: "CREDITOR_PRICE",
    });
  });

  it("usa o preço específico do credor cadastrado pela CDL", () => {
    const creditor = organization({ id: 301, type: "CREDITOR", linkedToOrganizationId: 10 });

    expect(determineCampaignPricingTarget({
      responsibleOrganization: creditor,
      creditorOrganization: creditor,
      spcOrganization: spc,
      linkedOrganization: cdl,
    })).toEqual({
      priceOwnerOrganizationId: 10,
      creditorOrganizationId: 301,
      priceType: "CREDITOR_PRICE",
    });
  });

  it.each([
    [cdl, organization({ id: 401, type: "CREDITOR", linkedToOrganizationId: 10 })],
    [distributor, organization({ id: 402, type: "CREDITOR", linkedToOrganizationId: 20 })],
  ])("mantém o preço específico quando o usuário pertence à organização intermediária", (responsible, creditor) => {
    expect(determineCampaignPricingTarget({
      responsibleOrganization: responsible,
      creditorOrganization: creditor,
      spcOrganization: spc,
      linkedOrganization: null,
    })).toMatchObject({
      priceOwnerOrganizationId: responsible.id,
      creditorOrganizationId: creditor.id,
      priceType: "CREDITOR_PRICE",
    });
  });

  it("rejeita um credor de outra CDL ou Distribuidora", () => {
    const creditor = organization({ id: 501, type: "CREDITOR", linkedToOrganizationId: 20 });

    expect(() => determineCampaignPricingTarget({
      responsibleOrganization: cdl,
      creditorOrganization: creditor,
      spcOrganization: spc,
      linkedOrganization: null,
    })).toThrow("Credor inválido ou fora do escopo da organização.");
  });

  it("resolve no banco o preço-base vigente do SPC para o próprio usuário credor", async () => {
    const vivo = organization({ id: 101, type: "CREDITOR" });
    const select = mockSelectResults([vivo], [vivo], [spc], [{ unitPriceMicros: 75_000 }]);

    await expect(resolveCampaignPrice(vivo.id, vivo.id, "SMS")).resolves.toBe(75_000);
    expect(select).toHaveBeenCalledTimes(4);
  });

  it("informa ausência de preço-base vigente do SPC sem procurar preço específico no credor direto", async () => {
    const vivo = organization({ id: 101, type: "CREDITOR" });
    mockSelectResults([vivo], [vivo], [spc], []);

    await expect(resolveCampaignPrice(vivo.id, vivo.id, "SMS")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Não existe preço-base vigente do SPC Brasil para SMS.",
    });
  });

  it("resolve no banco o preço específico para usuário de credor vinculado à Distribuidora", async () => {
    const creditor = organization({ id: 201, type: "CREDITOR", linkedToOrganizationId: distributor.id });
    mockSelectResults([creditor], [creditor], [spc], [distributor], [{ unitPriceMicros: 91_000 }]);

    await expect(resolveCampaignPrice(creditor.id, creditor.id, "WHATSAPP")).resolves.toBe(91_000);
  });

  it("mantém filtros explícitos de início e fim de vigência na consulta do preço", () => {
    const source = readFileSync(new URL("./pricing-service.ts", import.meta.url), "utf8");
    expect(source).toContain("lte(pricingRules.validFrom, now)");
    expect(source).toContain("or(isNull(pricingRules.validUntil), gt(pricingRules.validUntil, now))");
  });
});
