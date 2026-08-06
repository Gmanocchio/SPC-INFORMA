/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BrandProvider } from "../client/src/contexts/BrandContext";
import { creditsRequesterOrganizationOptions } from "../client/src/lib/user-organization-scope";
import Users from "../client/src/pages/Users";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  writeAudit: vi.fn(),
  assertStrongPassword: vi.fn(),
  hashPassword: vi.fn(async () => "hash-seguro"),
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  invalidateUsers: vi.fn(),
  listUsersInput: vi.fn(),
  identity: {
    user: { id: 90002, organizationId: 90002, role: "ORG_ADMIN" as const },
    organization: { id: 90002, type: "DISTRIBUTOR" as const, tradeName: "Credits Brasil" },
  },
  organizations: [
    { id: 90002, parentOrganizationId: 1, linkedToOrganizationId: null, type: "DISTRIBUTOR" as const, tradeName: "Credits Brasil", status: "ACTIVE" as const },
    { id: 120001, parentOrganizationId: 1, linkedToOrganizationId: 90002, type: "CREDITOR" as const, tradeName: "Organização Alfa", status: "ACTIVE" as const },
    { id: 150001, parentOrganizationId: 90002, linkedToOrganizationId: null, type: "CREDITOR" as const, tradeName: "Organização Beta", status: "ACTIVE" as const },
    { id: 180001, parentOrganizationId: 1, linkedToOrganizationId: 90002, type: "CREDITOR" as const, tradeName: "Organização Inativa", status: "INACTIVE" as const },
    { id: 210001, parentOrganizationId: 1, linkedToOrganizationId: 70000, type: "CREDITOR" as const, tradeName: "Organização Externa", status: "ACTIVE" as const },
  ],
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./audit", () => ({ writeAudit: mocks.writeAudit }));
vi.mock("./security", async () => {
  const actual = await vi.importActual<typeof import("./security")>("./security");
  return { ...actual, assertStrongPassword: mocks.assertStrongPassword, hashPassword: mocks.hashPassword };
});

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ admin: { users: { list: { invalidate: mocks.invalidateUsers } } } }),
    auth: { me: { useQuery: () => ({ data: mocks.identity }) } },
    admin: {
      users: {
        list: { useQuery: (input: unknown) => { mocks.listUsersInput(input); return { data: [], isLoading: false, isError: false, refetch: vi.fn() }; } },
        create: { useMutation: () => ({ mutate: mocks.createMutate, isPending: false }) },
        update: { useMutation: () => ({ mutate: mocks.updateMutate, isPending: false }) },
      },
      organizations: {
        list: { useQuery: () => ({ data: mocks.organizations, isLoading: false, isError: false }) },
      },
    },
  },
}));

import { canAssignUserToOrganization, createUser } from "./admin-service";

const actor = { id: 71, organizationId: 90002, role: "ORG_ADMIN" as const };
const activeChild = {
  id: 120001,
  parentOrganizationId: 1,
  linkedToOrganizationId: 90002,
  type: "CREDITOR" as const,
  status: "ACTIVE" as const,
};

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: vi.fn(), configurable: true });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { value: () => false, configurable: true });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { value: vi.fn(), configurable: true });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { value: vi.fn(), configurable: true });
});

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/credits-informa/app/usuarios");
});

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("credits-brand");
});

describe("cadastro Credits de Solicitante por organização", () => {
  it("oferece somente organizações credoras ativas vinculadas à distribuidora", () => {
    expect(creditsRequesterOrganizationOptions(mocks.organizations, 90002).map(organization => organization.tradeName)).toEqual([
      "Organização Alfa",
      "Organização Beta",
    ]);
  });

  it("permite somente REQUESTER na organização filha e bloqueia elevação ou organização externa", () => {
    expect(canAssignUserToOrganization(actor, activeChild, "REQUESTER")).toBe(true);
    expect(canAssignUserToOrganization(actor, activeChild, "ORG_ADMIN")).toBe(false);
    expect(canAssignUserToOrganization(actor, { ...activeChild, linkedToOrganizationId: 70000 }, "REQUESTER")).toBe(false);
    expect(canAssignUserToOrganization(actor, { ...activeChild, status: "INACTIVE" }, "REQUESTER")).toBe(false);
  });

  it("persiste o novo usuário como REQUESTER na organização vinculada selecionada", async () => {
    const organizationLimit = vi.fn(async () => [activeChild]);
    const organizationWhere = vi.fn(() => ({ limit: organizationLimit }));
    const organizationFrom = vi.fn(() => ({ where: organizationWhere }));
    const select = vi.fn(() => ({ from: organizationFrom }));
    const values = vi.fn(async () => [{ insertId: 321 }]);
    const insert = vi.fn(() => ({ values }));
    mocks.getDb.mockResolvedValue({ select, insert });

    await expect(createUser(actor, {
      organizationId: activeChild.id,
      name: "Solicitante Alfa",
      cpf: "529.982.247-25",
      email: "solicitante@alfa.test",
      phone: null,
      initialPassword: "SenhaForte#123",
      role: "REQUESTER",
    })).resolves.toEqual({ id: 321 });

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: activeChild.id,
      role: "REQUESTER",
      status: "INVITED",
      mustChangePassword: true,
    }));
    expect(mocks.writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "USER_CREATED",
      metadata: { targetOrganizationId: activeChild.id, role: "REQUESTER" },
    }));
  });

  it("exibe no componente real o seletor obrigatório sem listar a Credits, inativas ou externas", async () => {
    const user = userEvent.setup();
    render(<BrandProvider><Users /></BrandProvider>);

    await user.click(screen.getByRole("button", { name: "Novo usuário" }));
    expect(mocks.listUsersInput).toHaveBeenCalledWith(expect.objectContaining({ includeManagedOrganizations: true }));
    const organizationTrigger = screen.getByRole("combobox", { name: "Organização do solicitante" });
    expect(organizationTrigger).toBeTruthy();

    await user.click(organizationTrigger);
    expect(screen.getByRole("option", { name: "Organização Alfa" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Organização Beta" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Credits Brasil" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Organização Inativa" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Organização Externa" })).toBeNull();

    await user.click(screen.getByRole("option", { name: "Organização Alfa" }));
    await user.type(screen.getByRole("textbox", { name: "Nome completo" }), "Novo Solicitante");
    await user.type(screen.getByRole("textbox", { name: "CPF" }), "529.982.247-25");
    await user.type(screen.getByRole("textbox", { name: "E-mail" }), "novo@alfa.test");
    await user.type(screen.getByRole("textbox", { name: "Telefone" }), "11999999999");
    await user.type(screen.getByLabelText("Senha inicial"), "SenhaForte#123");
    await user.click(screen.getByRole("button", { name: "Criar usuário" }));

    expect(mocks.createMutate).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 120001,
      role: "REQUESTER",
      name: "Novo Solicitante",
      email: "novo@alfa.test",
    }));
  });
});
