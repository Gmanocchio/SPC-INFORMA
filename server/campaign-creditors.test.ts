import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));

import {
  campaignFormAfterOwnerChange,
  creditorsForCampaignOwner,
} from "../client/src/lib/campaign-options";
import { listCampaignOptions } from "./campaign-service";

const owners = [
  { id: 1, type: "SPC_BRASIL" as const },
  { id: 2, type: "CDL" as const },
];

const creditors = [
  { id: 10, parentOrganizationId: null, linkedToOrganizationId: null, tradeName: "Credor direto do SPC" },
  { id: 11, parentOrganizationId: null, linkedToOrganizationId: 1, tradeName: "Credor vinculado ao SPC" },
  { id: 12, parentOrganizationId: null, linkedToOrganizationId: 2, tradeName: "Credor da CDL" },
];

describe("credores disponíveis na preparação de campanhas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("oferece somente credores diretamente vinculados ao SPC Brasil quando ele é responsável", () => {
    expect(creditorsForCampaignOwner(owners, creditors, "1", true)).toEqual([creditors[0], creditors[1]]);
  });

  it("mantém o escopo do proprietário selecionado fora do contexto SPC Brasil", () => {
    expect(creditorsForCampaignOwner(owners, creditors, "2", true)).toEqual([creditors[2]]);
    expect(creditorsForCampaignOwner(owners, creditors, "2", false)).toEqual([creditors[2]]);
  });

  it("não oferece credores antes da seleção de uma organização responsável válida", () => {
    expect(creditorsForCampaignOwner(owners, creditors, "", true)).toEqual([]);
    expect(creditorsForCampaignOwner(owners, creditors, "999", true)).toEqual([]);
  });

  it("oferece o próprio credor quando o usuário está vinculado diretamente a ele", () => {
    expect(creditorsForCampaignOwner([], creditors, "11", false)).toEqual([creditors[1]]);
  });

  it("limpa o credor selecionado ao trocar a organização responsável", () => {
    const form = {
      name: "Campanha de cobrança",
      organizationId: "1",
      creditorOrganizationId: "11",
      templateId: "7",
    };

    expect(campaignFormAfterOwnerChange(form, "2")).toEqual({
      ...form,
      organizationId: "2",
      creditorOrganizationId: "",
    });
  });

  it("lê no backend os credores ativos disponíveis ao SPC_ADMIN, inclusive sem vínculo persistido", async () => {
    const rows = [
      { id: 1, tradeName: "SPC Brasil", type: "SPC_BRASIL", parentOrganizationId: null, linkedToOrganizationId: null, billingModel: "PREPAID", balanceCents: 0 },
      { id: 10, tradeName: "Credor direto", type: "CREDITOR", parentOrganizationId: null, linkedToOrganizationId: null, billingModel: "PREPAID", balanceCents: 0 },
      { id: 11, tradeName: "Credor vinculado", type: "CREDITOR", parentOrganizationId: null, linkedToOrganizationId: 1, billingModel: "PREPAID", balanceCents: 0 },
    ];
    const limit = vi.fn(async () => rows);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    mocks.getDb.mockResolvedValue({ select });

    await expect(listCampaignOptions({ id: 9, organizationId: 1, role: "SPC_ADMIN" })).resolves.toEqual({
      owners: [rows[0]],
      creditors: [rows[1], rows[2]],
    });
    expect(limit).toHaveBeenCalledWith(1000);
  });

  it("mantém a releitura e os estados vazios explícitos no formulário", () => {
    const source = readFileSync(new URL("../client/src/pages/Campaigns.tsx", import.meta.url), "utf8");
    expect(source).toContain("if (next) void options.refetch()");
    expect(source).toContain("campaignFormAfterOwnerChange");
    expect(source).toContain("creditorsForCampaignOwner");
    expect(source).toContain("Atualizando credores…");
    expect(source).toContain("Nenhum credor ativo foi encontrado para a organização responsável.");
  });
});
