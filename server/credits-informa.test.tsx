/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardLayout from "../client/src/components/DashboardLayout";
import {
  BrandProvider,
  CREDITS_ORGANIZATION_ID,
  isCreditsOrganizationAdmin,
  isCreditsPath,
} from "../client/src/contexts/BrandContext";
import CreditsHome from "../client/src/pages/CreditsHome";

const mocks = vi.hoisted(() => ({ logout: vi.fn() }));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    loading: false,
    logout: mocks.logout,
    user: {
      user: { id: 90002, name: "Administrador Credits", role: "ORG_ADMIN", mustChangePassword: false },
      organization: { id: 90002, tradeName: "Credits Brasil", type: "DISTRIBUTOR" },
    },
  }),
}));

vi.mock("@/hooks/useMobile", () => ({ useIsMobile: () => false }));

const projectFile = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8");

beforeEach(() => {
  window.history.replaceState({}, "", "/credits-informa");
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  document.documentElement.classList.remove("credits-brand");
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

    const links = Array.from(container.querySelectorAll("a"));
    expect(links.some(link => link.getAttribute("href") === "/credits-informa/acesso")).toBe(true);
    expect(links.every(link => link.getAttribute("target") !== "_blank")).toBe(true);
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
