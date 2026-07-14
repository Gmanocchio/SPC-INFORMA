import { describe, expect, it } from "vitest";
import { resolveDashboardCreditorScope } from "./dashboard-service";

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
