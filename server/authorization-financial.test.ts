import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { assertCanAccessOrganization, assertRole, canManageOrganization } from "./authorization";
import { calculateBalanceAfterConfirmation, calculateCampaignAmountCents } from "./campaign-service";

const spcAdmin = { id: 1, organizationId: 1, role: "SPC_ADMIN" as const };
const orgAdmin = { id: 2, organizationId: 20, role: "ORG_ADMIN" as const };
const requester = { id: 3, organizationId: 20, role: "REQUESTER" as const };

describe("autorização e escopo organizacional", () => {
  it("permite ao SPC administrar qualquer organização e ao administrador local apenas a própria árvore", () => {
    expect(canManageOrganization(spcAdmin, { id: 999, parentOrganizationId: null })).toBe(true);
    expect(canManageOrganization(orgAdmin, { id: 20, parentOrganizationId: null })).toBe(true);
    expect(canManageOrganization(orgAdmin, { id: 21, parentOrganizationId: 20 })).toBe(true);
    expect(canManageOrganization(orgAdmin, { id: 30, parentOrganizationId: 10 })).toBe(false);
  });

  it("oculta recursos fora do escopo e rejeita perfil não autorizado", () => {
    expect(() => assertCanAccessOrganization(requester, 30)).toThrow(TRPCError);
    expect(() => assertRole(requester, ["SPC_ADMIN", "ORG_ADMIN"])).toThrowError(/permissão/i);
    expect(() => assertRole(orgAdmin, ["SPC_ADMIN", "ORG_ADMIN"])).not.toThrow();
  });
});

describe("cálculo financeiro de campanhas", () => {
  it("converte micros em centavos com arredondamento conservador", () => {
    expect(calculateCampaignAmountCents(3, 15_001)).toBe(5);
    expect(calculateCampaignAmountCents(100, 20_000)).toBe(200);
  });

  it("reserva saldo pré-pago e impede saldo insuficiente", () => {
    expect(calculateBalanceAfterConfirmation({ billingModel: "PREPAID", balanceCents: 500, creditLimitCents: 0, amountCents: 120 })).toBe(380);
    expect(() => calculateBalanceAfterConfirmation({ billingModel: "PREPAID", balanceCents: 100, creditLimitCents: 0, amountCents: 101 })).toThrowError(/insuficiente/i);
  });

  it("acumula consumo pós-pago e respeita o limite de crédito", () => {
    expect(calculateBalanceAfterConfirmation({ billingModel: "POSTPAID", balanceCents: 300, creditLimitCents: 500, amountCents: 150 })).toBe(450);
    expect(() => calculateBalanceAfterConfirmation({ billingModel: "POSTPAID", balanceCents: 450, creditLimitCents: 500, amountCents: 51 })).toThrowError(/limite/i);
  });
});
