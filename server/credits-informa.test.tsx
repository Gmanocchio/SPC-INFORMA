/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardLayout from "../client/src/components/DashboardLayout";
import {
  BrandProvider,
  CREDITS_ORGANIZATION_ID,
  isCreditsOrganizationAdmin,
  isCreditsPortalUser,
  isCreditsPath,
} from "../client/src/contexts/BrandContext";
import Access from "../client/src/pages/Access";
import CreditsHome from "../client/src/pages/CreditsHome";

const mocks = vi.hoisted(() => ({
  accessMe: null as any,
  logout: vi.fn(async () => undefined),
  session: null as any,
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    loading: false,
    logout: mocks.logout,
    user: mocks.session,
  }),
}));

vi.mock("@/hooks/useMobile", () => ({ useIsMobile: () => false }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { invalidate: vi.fn(), fetch: vi.fn(async () => mocks.accessMe) } } }),
    auth: {
      me: { useQuery: () => ({ data: mocks.accessMe }) },
      login: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
      verifyTwoFactor: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
    },
  },
}));

const projectFile = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8");

const creditsAdminSession = {
  user: { id: 90002, name: "Administrador Credits", role: "ORG_ADMIN", mustChangePassword: false },
  organization: { id: 90002, tradeName: "Credits Brasil", type: "DISTRIBUTOR", status: "ACTIVE", parentOrganizationId: 1, linkedToOrganizationId: null },
};

const creditsRequesterSession = {
  user: { id: 120900, name: "Solicitante Credor", role: "REQUESTER", mustChangePassword: false },
  organization: { id: 120001, tradeName: "Organização Credora", type: "CREDITOR", status: "ACTIVE", parentOrganizationId: 1, linkedToOrganizationId: CREDITS_ORGANIZATION_ID },
};

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
  mocks.accessMe = null;
  mocks.session = creditsAdminSession;
  mocks.logout.mockClear();
  window.history.replaceState({}, "", "/credits-informa");
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  document.documentElement.classList.remove("credits-brand");
  document.getElementById("runtime-brand-favicon")?.remove();
});

describe("Credits Informa", () => {
  it("reconhece somente o namespace Credits e o administrador da organização distribuidora correta", () => {
    expect(isCreditsPath("/credits-informa")).toBe(true);
    expect(isCreditsPath("/credits-informa/app/campanhas")).toBe(true);
    expect(isCreditsPath("/app/campanhas")).toBe(false);

    expect(isCreditsOrganizationAdmin({
      user: { role: "ORG_ADMIN" },
      organization: { id: CREDITS_ORGANIZATION_ID, type: "DISTRIBUTOR", tradeName: "Credits Brasil" },
    })).toBe(true);
    expect(isCreditsOrganizationAdmin({
      user: { role: "REQUESTER" },
      organization: { id: CREDITS_ORGANIZATION_ID, type: "DISTRIBUTOR", tradeName: "Credits Brasil" },
    })).toBe(false);
    expect(isCreditsOrganizationAdmin({
      user: { role: "ORG_ADMIN" },
      organization: { id: 1, type: "DISTRIBUTOR", tradeName: "Outra organização" },
    })).toBe(false);
    expect(isCreditsPortalUser({
      user: { role: "REQUESTER" },
      organization: { id: 120001, type: "CREDITOR", status: "ACTIVE", parentOrganizationId: 1, linkedToOrganizationId: CREDITS_ORGANIZATION_ID },
    })).toBe(true);
    expect(isCreditsPortalUser({
      user: { role: "ORG_ADMIN" },
      organization: { id: 120001, type: "CREDITOR", status: "ACTIVE", parentOrganizationId: 1, linkedToOrganizationId: CREDITS_ORGANIZATION_ID },
    })).toBe(false);
    expect(isCreditsPortalUser({
      user: { role: "REQUESTER" },
      organization: { id: 120001, type: "CREDITOR", status: "ACTIVE", parentOrganizationId: 1, linkedToOrganizationId: 70000 },
    })).toBe(false);
  });

  it("renderiza a landing Credits sem referências ao SPC Informa e sem abrir novas abas", () => {
    const { container } = render(
      <BrandProvider>
        <CreditsHome />
      </BrandProvider>,
    );

    expect(screen.getByTestId("credits-home")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Credits Informa: operação multicanal/i })).toBeTruthy();
    expect(screen.getAllByAltText("Credits Brasil").length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain("SPC Informa");
    expect(document.documentElement.classList.contains("credits-brand")).toBe(true);
    expect(document.title).toBe("Credits Informa");
    expect(document.querySelector<HTMLLinkElement>("#runtime-brand-favicon")?.href).toContain("credits-symbol_343e47e1.png");

    const links = Array.from(container.querySelectorAll("a"));
    expect(links.some(link => link.getAttribute("href") === "/credits-informa/acesso")).toBe(true);
    expect(links.every(link => link.getAttribute("target") !== "_blank")).toBe(true);
  });

  it("restaura explicitamente o favicon SPC ao sair do namespace Credits na mesma aba", async () => {
    const { rerender } = render(<BrandProvider><div>Marca ativa</div></BrandProvider>);

    await waitFor(() => expect(document.querySelector<HTMLLinkElement>("#runtime-brand-favicon")?.href).toContain("credits-symbol_343e47e1.png"));

    window.history.replaceState({}, "", "/app");
    window.dispatchEvent(new PopStateEvent("popstate"));
    rerender(<BrandProvider><div>Marca ativa</div></BrandProvider>);

    await waitFor(() => {
      expect(document.title).toBe("SPC Informa");
      expect(document.querySelector<HTMLLinkElement>("#runtime-brand-favicon")?.href).toContain("logo-spcbrasil_2505cb7b.webp");
      expect(document.querySelectorAll("link[rel='icon']")).toHaveLength(1);
    });

    const indexSource = projectFile("client/index.html");
    expect(indexSource).toContain('id="runtime-brand-favicon"');
    expect(indexSource).toContain('href="/manus-storage/logo-spcbrasil_2505cb7b.webp"');
  });

  it("mantém as rotas SPC existentes e cria apenas as rotas permitidas ao administrador Credits", () => {
    const appSource = projectFile("client/src/App.tsx");

    for (const path of ["/", "/acesso", "/recuperar-senha", "/app", "/app/campanhas", "/app/dominios"]) {
      expect(appSource).toContain(`path=\"${path}\"`);
    }

    for (const path of [
      "/credits-informa",
      "/credits-informa/acesso",
      "/credits-informa/recuperar-senha",
      "/credits-informa/app",
      "/credits-informa/app/campanhas",
      "/credits-informa/app/empresas",
      "/credits-informa/app/usuarios",
      "/credits-informa/app/precificacao",
      "/credits-informa/app/chaves-api",
      "/credits-informa/app/faq",
      "/credits-informa/app/manual",
    ]) {
      expect(appSource).toContain(`path=\"${path}\"`);
    }

    expect(appSource).not.toContain('path="/credits-informa/app/templates"');
    expect(appSource).not.toContain('path="/credits-informa/app/brokers"');
    expect(appSource).not.toContain('path="/credits-informa/app/dominios"');
    expect(appSource).toContain("<ProtectedPage creditsOnly>");
    expect(appSource).toContain("<ProtectedPage creditsOnly adminOnly><Users /></ProtectedPage>");
    expect(appSource).toContain('user?.user.role === "REQUESTER" ? brand.appPath : null');
  });

  it("renderiza o painel Credits com o menu real de ORG_ADMIN e sem módulos exclusivos do SPC", () => {
    window.history.replaceState({}, "", "/credits-informa/app");

    const { container } = render(
      <BrandProvider>
        <DashboardLayout><div>Painel compartilhado</div></DashboardLayout>
      </BrandProvider>,
    );

    expect(screen.getByAltText("Credits Brasil")).toBeTruthy();
    expect(screen.getByText("Administrador da organização")).toBeTruthy();
    expect(screen.getByText("Painel compartilhado")).toBeTruthy();
    expect(screen.getByText("Campanhas")).toBeTruthy();
    expect(screen.getByText("Empresas")).toBeTruthy();
    expect(screen.getByText("Usuários")).toBeTruthy();
    expect(screen.getByText("Precificação")).toBeTruthy();
    expect(screen.getByText("Chaves de API")).toBeTruthy();
    expect(screen.queryByText("Templates")).toBeNull();
    expect(screen.queryByText("Brokers")).toBeNull();
    expect(screen.queryByText("Gestão de Domínios")).toBeNull();
    expect(container.textContent).not.toContain("SPC Informa");
  });

  it("mantém o REQUESTER credor no white label com somente Dashboard, Campanhas, FAQ e Manual", async () => {
    const user = userEvent.setup();
    mocks.session = creditsRequesterSession;
    window.history.replaceState({}, "", "/credits-informa/app");

    const { container } = render(
      <BrandProvider>
        <DashboardLayout><div>Painel do solicitante</div></DashboardLayout>
      </BrandProvider>,
    );

    expect(screen.getByAltText("Credits Brasil")).toBeTruthy();
    expect(screen.getByText("Solicitante")).toBeTruthy();
    expect(screen.getByText("Painel do solicitante")).toBeTruthy();
    for (const label of ["Dashboard", "Campanhas", "FAQ", "Manual"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    for (const label of ["Empresas", "Usuários", "Templates", "Precificação", "Brokers", "Chaves de API", "Gestão de Domínios"]) expect(screen.queryByText(label)).toBeNull();
    expect(container.textContent).not.toContain("SPC Informa");

    await user.click(screen.getByRole("button", { name: "Campanhas" }));
    await waitFor(() => expect(window.location.pathname).toBe("/credits-informa/app/campanhas"));

    await user.click(screen.getByRole("button", { name: "Abrir menu da conta" }));
    await user.click(await screen.findByText("Sair com segurança"));
    await waitFor(() => expect(window.location.pathname).toBe("/credits-informa/acesso"));
    expect(mocks.logout).toHaveBeenCalledOnce();
  });

  it.each([
    [false, "/credits-informa/app"],
    [true, "/credits-informa/app/primeiro-acesso"],
  ])("redireciona o REQUESTER após autenticação para o destino Credits correto", async (mustChangePassword, expectedPath) => {
    mocks.accessMe = {
      ...creditsRequesterSession,
      user: { ...creditsRequesterSession.user, mustChangePassword },
    };
    window.history.replaceState({}, "", "/credits-informa/acesso");

    render(<BrandProvider><Access /></BrandProvider>);

    await waitFor(() => expect(window.location.pathname).toBe(expectedPath));
    expect(document.title).toBe("Credits Informa");
  });

  it("reutiliza autenticação, sessão e tRPC existentes sem criar API ou lógica paralela", () => {
    const accessSource = projectFile("client/src/pages/Access.tsx");
    const layoutSource = projectFile("client/src/components/DashboardLayout.tsx");
    const creditsHomeSource = projectFile("client/src/pages/CreditsHome.tsx");

    expect(accessSource).toContain("trpc.auth.login.useMutation");
    expect(accessSource).toContain("trpc.auth.verifyTwoFactor.useMutation");
    expect(accessSource).toContain("utils.auth.me.fetch()");
    expect(layoutSource).toContain("menuItems.filter(item => role && item.roles.includes(role))");
    expect(creditsHomeSource).not.toMatch(/fetch\(|axios|window\.open|target=["']_blank/);
  });
});
