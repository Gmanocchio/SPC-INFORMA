import { describe, expect, it } from "vitest";
import { buildSpcOrganizationConsolidation, resolveDashboardCreditorScope } from "./dashboard-service";

const linkedCreditors = [
  { id: 101, tradeName: "Credor Alfa" },
  { id: 102, tradeName: "Credor Beta" },
];

describe("escopo de credores do dashboard", () => {
  it.each(["DISTRIBUTOR", "CDL"] as const)(
    "consolida todos os credores vinculados para administrador de %s",
    organizationType => {
      expect(resolveDashboardCreditorScope({ organizationId: 50, organizationType, role: "ORG_ADMIN" }, linkedCreditors)).toEqual({
        canFilterByCreditor: true,
        creditorIds: [101, 102],
        creditorOptions: linkedCreditors,
        selectedCreditorId: null,
      });
    },
  );

  it("restringe a agregação ao credor selecionado dentro do escopo", () => {
    expect(resolveDashboardCreditorScope(
      { organizationId: 50, organizationType: "DISTRIBUTOR", role: "ORG_ADMIN" },
      linkedCreditors,
      102,
    )).toEqual({
      canFilterByCreditor: true,
      creditorIds: [102],
      creditorOptions: linkedCreditors,
      selectedCreditorId: 102,
    });
  });

  it("bloqueia filtro por credor externo à Distribuidora ou CDL", () => {
    expect(() => resolveDashboardCreditorScope(
      { organizationId: 50, organizationType: "CDL", role: "ORG_ADMIN" },
      linkedCreditors,
      999,
    )).toThrow("Credor inválido ou fora do escopo do dashboard.");
  });

  it("mantém usuário de credor limitado ao próprio credor", () => {
    expect(resolveDashboardCreditorScope(
      { organizationId: 101, organizationType: "CREDITOR", role: "ORG_REQUESTER" },
      [],
    )).toEqual({
      canFilterByCreditor: false,
      creditorIds: [101],
      creditorOptions: [],
      selectedCreditorId: 101,
    });
  });

  it("mantém usuário não administrador de Distribuidora no escopo da própria organização", () => {
    expect(resolveDashboardCreditorScope(
      { organizationId: 50, organizationType: "DISTRIBUTOR", role: "ORG_REQUESTER" },
      linkedCreditors,
    )).toEqual({
      canFilterByCreditor: false,
      creditorIds: [],
      creditorOptions: [],
      selectedCreditorId: null,
    });
  });
});

describe("consolidação hierárquica do dashboard SPC Central", () => {
  const organizations = [
    { id: 1, organizationName: "SPC Brasil", organizationType: "SPC_BRASIL" as const, linkedToOrganizationId: null, parentOrganizationId: null },
    { id: 10, organizationName: "CDL Curitiba", organizationType: "CDL" as const, linkedToOrganizationId: null, parentOrganizationId: 1 },
    { id: 30, organizationName: "CDL Sem Credores", organizationType: "CDL" as const, linkedToOrganizationId: null, parentOrganizationId: 1 },
    { id: 20, organizationName: "Distribuidora Sul", organizationType: "DISTRIBUTOR" as const, linkedToOrganizationId: null, parentOrganizationId: 1 },
    { id: 101, organizationName: "Credor Beta", organizationType: "CREDITOR" as const, linkedToOrganizationId: 10, parentOrganizationId: 1 },
    { id: 102, organizationName: "Credor Alfa", organizationType: "CREDITOR" as const, linkedToOrganizationId: 10, parentOrganizationId: 1 },
    { id: 103, organizationName: "Credor Distribuição", organizationType: "CREDITOR" as const, linkedToOrganizationId: 20, parentOrganizationId: 1 },
    { id: 104, organizationName: "Credor SPC", organizationType: "CREDITOR" as const, linkedToOrganizationId: 1, parentOrganizationId: 1 },
    { id: 105, organizationName: "Credor Legado", organizationType: "CREDITOR" as const, linkedToOrganizationId: null, parentOrganizationId: 10 },
    { id: 2, organizationName: "Outro SPC", organizationType: "SPC_BRASIL" as const, linkedToOrganizationId: null, parentOrganizationId: null },
    { id: 201, organizationName: "Credor Externo", organizationType: "CREDITOR" as const, linkedToOrganizationId: 2, parentOrganizationId: 2 },
  ];

  it("mantém cada credor somente no grupo ao qual está vinculado e soma os totais do grupo", () => {
    const groups = buildSpcOrganizationConsolidation(1, organizations, [
      { creditorOrganizationId: 101, sent: 7, delivered: 6, failed: 1, processedMicros: 700_000 },
      { creditorOrganizationId: 102, sent: 5, delivered: 4, failed: 1, processedMicros: 500_000 },
      { creditorOrganizationId: 103, sent: 11, delivered: 9, failed: 2, processedMicros: 1_100_000 },
      { creditorOrganizationId: 104, sent: 13, delivered: 12, failed: 1, processedMicros: 1_300_000 },
      { creditorOrganizationId: 105, sent: 3, delivered: 3, failed: 0, processedMicros: 300_000 },
      { creditorOrganizationId: 201, sent: 99, delivered: 99, failed: 0, processedMicros: 9_900_000 },
    ]);

    expect(groups.map(group => [group.organizationType, group.organizationName])).toEqual([
      ["CDL", "CDL Curitiba"],
      ["CDL", "CDL Sem Credores"],
      ["DISTRIBUTOR", "Distribuidora Sul"],
      ["SPC_BRASIL", "SPC Brasil"],
    ]);
    const cdl = groups.find(group => group.organizationId === 10)!;
    const distributor = groups.find(group => group.organizationId === 20)!;
    const spcBrasil = groups.find(group => group.organizationId === 1)!;
    expect(cdl).toMatchObject({ sent: 15, delivered: 13, failed: 2, processedMicros: 1_500_000 });
    expect(cdl.creditors.map(creditor => creditor.creditorName)).toEqual(["Credor Alfa", "Credor Beta", "Credor Legado"]);
    expect(distributor.creditors.map(creditor => creditor.creditorOrganizationId)).toEqual([103]);
    expect(spcBrasil.creditors.map(creditor => creditor.creditorOrganizationId)).toEqual([104]);
    expect(groups.flatMap(group => group.creditors).some(creditor => creditor.creditorOrganizationId === 201)).toBe(false);
  });

  it("preserva organizações sem credores e credores sem disparos com métricas zeradas", () => {
    const groups = buildSpcOrganizationConsolidation(1, organizations, []);
    expect(groups.find(group => group.organizationId === 10)?.creditors[0]).toMatchObject({ sent: 0, delivered: 0, failed: 0, processedMicros: 0 });
    expect(groups.find(group => group.organizationId === 30)).toMatchObject({ sent: 0, delivered: 0, failed: 0, processedMicros: 0, creditors: [] });
    expect(groups.find(group => group.organizationId === 20)).toMatchObject({ sent: 0, delivered: 0, failed: 0, processedMicros: 0 });
  });

  it("prioriza linkedToOrganizationId e não duplica um credor no parentOrganizationId legado", () => {
    const groups = buildSpcOrganizationConsolidation(1, organizations, []);
    const creditorBetaOccurrences = groups.flatMap(group => group.creditors).filter(creditor => creditor.creditorOrganizationId === 101);
    expect(creditorBetaOccurrences).toHaveLength(1);
    expect(groups.find(group => group.organizationId === 10)?.creditors).toContainEqual(expect.objectContaining({ creditorOrganizationId: 101 }));
    expect(groups.find(group => group.organizationId === 1)?.creditors).not.toContainEqual(expect.objectContaining({ creditorOrganizationId: 101 }));
  });

  it("inclui Jeitto e Vivo no SPC Brasil quando o vínculo legado está vazio e há disparos da organização central", () => {
    const groups = buildSpcOrganizationConsolidation(1, [
      { id: 1, organizationName: "SPC Brasil", organizationType: "SPC_BRASIL", linkedToOrganizationId: null, parentOrganizationId: null },
      { id: 10, organizationName: "CDL Curitiba", organizationType: "CDL", linkedToOrganizationId: null, parentOrganizationId: 1 },
      { id: 20, organizationName: "Distribuidora Sul", organizationType: "DISTRIBUTOR", linkedToOrganizationId: null, parentOrganizationId: 1 },
      { id: 180001, organizationName: "Jeitto", organizationType: "CREDITOR", linkedToOrganizationId: null, parentOrganizationId: null },
      { id: 90001, organizationName: "VIVO", organizationType: "CREDITOR", linkedToOrganizationId: null, parentOrganizationId: null },
      { id: 80001, organizationName: "Sem disparos", organizationType: "CREDITOR", linkedToOrganizationId: null, parentOrganizationId: null },
      { id: 70001, organizationName: "Credor CDL", organizationType: "CREDITOR", linkedToOrganizationId: 10, parentOrganizationId: 1 },
      { id: 60001, organizationName: "Credor Distribuidora", organizationType: "CREDITOR", linkedToOrganizationId: 20, parentOrganizationId: 1 },
    ], [
      { creditorOrganizationId: 180001, organizationId: 1, sent: 4, delivered: 3, failed: 1, processedMicros: 400_000 },
      { creditorOrganizationId: 90001, organizationId: 1, sent: 32, delivered: 30, failed: 2, processedMicros: 3_200_000 },
      { creditorOrganizationId: 90001, organizationId: 90001, sent: 8, delivered: 7, failed: 1, processedMicros: 800_000 },
      { creditorOrganizationId: 80001, organizationId: 1, sent: 0, delivered: 0, failed: 0, processedMicros: 0 },
      { creditorOrganizationId: 70001, organizationId: 1, sent: 5, delivered: 5, failed: 0, processedMicros: 500_000 },
      { creditorOrganizationId: 60001, organizationId: 1, sent: 6, delivered: 6, failed: 0, processedMicros: 600_000 },
    ]);

    const spcBrasil = groups.find(group => group.organizationId === 1)!;
    expect(spcBrasil.creditors).toEqual([
      expect.objectContaining({ creditorOrganizationId: 180001, creditorName: "Jeitto", sent: 4 }),
      expect.objectContaining({ creditorOrganizationId: 90001, creditorName: "VIVO", sent: 32 }),
    ]);
    expect(spcBrasil).toMatchObject({ sent: 36, delivered: 33, failed: 3, processedMicros: 3_600_000 });
    expect(spcBrasil.creditors).not.toContainEqual(expect.objectContaining({ creditorOrganizationId: 80001 }));
    expect(groups.find(group => group.organizationId === 10)?.creditors).toContainEqual(expect.objectContaining({ creditorOrganizationId: 70001 }));
    expect(groups.find(group => group.organizationId === 20)?.creditors).toContainEqual(expect.objectContaining({ creditorOrganizationId: 60001 }));
  });
});
