/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Organizations from "../client/src/pages/Organizations";

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(async () => undefined),
  mutate: vi.fn(),
  listQuery: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ admin: { organizations: { list: { invalidate: mocks.invalidate } } } }),
    auth: {
      me: {
        useQuery: () => ({ data: { user: { id: 7, organizationId: 1, role: "SPC_ADMIN" } } }),
      },
    },
    admin: {
      organizations: {
        list: { useQuery: (...args: unknown[]) => mocks.listQuery(...args) },
        create: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) },
        update: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) },
        uploadLogo: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) },
      },
    },
  },
}));

const organizations = [
  {
    id: 1,
    parentOrganizationId: null,
    linkedToOrganizationId: null,
    type: "CDL",
    legalName: "CDL Centro Ltda",
    tradeName: "CDL Centro",
    cnpj: "11222333000181",
    responsibleName: "Responsável CDL",
    responsibleEmail: "cdl@example.com",
    responsiblePhone: null,
    logoUrl: null,
    postalCode: null,
    street: null,
    streetNumber: null,
    addressExtra: null,
    district: null,
    city: "São Paulo",
    state: "SP",
    billingModel: "POSTPAID",
    balanceCents: 0,
    creditLimitCents: 100_000,
    status: "ACTIVE",
    createdAt: new Date(),
  },
  {
    id: 2,
    parentOrganizationId: null,
    linkedToOrganizationId: 999,
    type: "CREDITOR",
    legalName: "Credor Acme Ltda",
    tradeName: "Credor Acme",
    cnpj: "44555666000190",
    responsibleName: "Responsável Acme",
    responsibleEmail: "acme@example.com",
    responsiblePhone: null,
    logoUrl: null,
    postalCode: null,
    street: null,
    streetNumber: null,
    addressExtra: null,
    district: null,
    city: "Curitiba",
    state: "PR",
    billingModel: "PREPAID",
    balanceCents: 25_000,
    creditLimitCents: 0,
    status: "ACTIVE",
    createdAt: new Date(),
  },
] as const;

async function exerciseEnabledSelects(dialog: HTMLElement) {
  const user = userEvent.setup();
  const triggers = within(dialog).getAllByRole("combobox");

  for (const trigger of triggers) {
    if ((trigger as HTMLButtonElement).disabled) continue;
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    await user.keyboard("{Escape}");
  }
}

describe("formulário real de empresas", () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock, configurable: true });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: vi.fn(), configurable: true });
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { value: () => false, configurable: true });
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { value: vi.fn(), configurable: true });
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { value: vi.fn(), configurable: true });
  });

  beforeEach(() => {
    mocks.listQuery.mockReturnValue({
      data: organizations,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("abre Nova empresa como Credor e monta Tipo, Vinculado a e Modelo financeiro sem exceção", async () => {
    const user = userEvent.setup();
    render(<Organizations />);

    await user.click(screen.getByRole("button", { name: "Nova empresa" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByRole("heading", { name: "Cadastrar empresa" })).toBeTruthy();
    const selectValues = within(dialog).getAllByRole("combobox").map(trigger => trigger.textContent?.trim());
    expect(selectValues).toEqual(["Credor", "SPC Brasil", "Pré-pago"]);
    expect(selectValues.every(Boolean)).toBe(true);
    await exerciseEnabledSelects(dialog);
  });

  it("abre a edição de Credor com vínculo órfão e monta Vinculado a, Modelo financeiro e Situação sem exceção", async () => {
    const user = userEvent.setup();
    render(<Organizations />);

    await user.click(screen.getByRole("button", { name: "Editar Credor Acme" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByRole("heading", { name: "Editar empresa" })).toBeTruthy();
    expect(within(dialog).getByDisplayValue("Credor Acme")).toBeTruthy();
    const selectValues = within(dialog).getAllByRole("combobox").map(trigger => trigger.textContent?.trim());
    expect(selectValues).toEqual(["Credor", "Vínculo atual indisponível (ID 999)", "Pré-pago", "Ativa"]);
    expect(selectValues.every(Boolean)).toBe(true);
    await exerciseEnabledSelects(dialog);
    expect(screen.queryByText("Ocorreu um erro inesperado")).toBeNull();
  });
});
