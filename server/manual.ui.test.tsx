// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Manual from "../client/src/pages/Manual";

const mocks = vi.hoisted(() => ({
  currentUser: {
    user: { role: "SPC_ADMIN" },
    organization: { type: "SPC_BRASIL" },
  } as { user: { role: string }; organization: { type: string } } | null,
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.currentUser }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/app/manual", vi.fn()] }));

const readProjectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

afterEach(() => cleanup());

function useIdentity(role: string, organizationType: string) {
  mocks.currentUser = { user: { role }, organization: { type: organizationType } };
}

describe("Manual segmentado por perfil", () => {
  it("renderiza a visão integral para o nível SPC", () => {
    useIdentity("SPC_ADMIN", "SPC_BRASIL");
    render(<Manual />);

    expect(screen.getByTestId("manual-page")).toBeTruthy();
    expect(screen.getByText("Visão integral de todos os níveis, módulos e orientações.")).toBeTruthy();
    expect(screen.getByTestId("manual-chapter-TEMPLATES")).toBeTruthy();
    expect(screen.getByTestId("manual-chapter-BROKERS")).toBeTruthy();
    expect(screen.getByTestId("manual-chapter-DOMAINS")).toBeTruthy();
  });

  it("limita administrador de Distribuidora aos capítulos permitidos", () => {
    useIdentity("ORG_ADMIN", "DISTRIBUTOR");
    render(<Manual />);

    expect(screen.getByText("Visão filtrada para as telas e ações permitidas ao seu acesso.")).toBeTruthy();
    expect(screen.getByTestId("manual-chapter-ORGANIZATIONS")).toBeTruthy();
    expect(screen.getByTestId("manual-chapter-PRICING")).toBeTruthy();
    expect(screen.queryByTestId("manual-chapter-TEMPLATES")).toBeNull();
    expect(screen.queryByTestId("manual-chapter-BROKERS")).toBeNull();
    expect(screen.queryByTestId("manual-chapter-DOMAINS")).toBeNull();
  });

  it("limita solicitante de Credor às telas operacionais", () => {
    useIdentity("REQUESTER", "CREDITOR");
    render(<Manual />);

    expect(screen.getByTestId("manual-chapter-ACCESS")).toBeTruthy();
    expect(screen.getByTestId("manual-chapter-DASHBOARD")).toBeTruthy();
    expect(screen.getByTestId("manual-chapter-CAMPAIGNS")).toBeTruthy();
    expect(screen.getByTestId("manual-chapter-HELP")).toBeTruthy();
    expect(screen.queryByTestId("manual-chapter-USERS")).toBeNull();
    expect(screen.queryByTestId("manual-chapter-API_KEYS")).toBeNull();
  });

  it("exibe e recupera o estado vazio da busca", () => {
    useIdentity("REQUESTER", "CDL");
    render(<Manual />);

    fireEvent.change(screen.getByLabelText("Buscar no Manual"), { target: { value: "termo inexistente 999" } });
    expect(screen.getByTestId("manual-empty-state")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Limpar busca" }).at(-1)!);
    expect(screen.getByTestId("manual-chapter-ACCESS")).toBeTruthy();
  });

  it("exibe estado de erro com ação de recuperação para identidade não suportada", () => {
    useIdentity("ROLE_DESCONHECIDA", "ORG_DESCONHECIDA");
    render(<Manual />);

    expect(screen.getByTestId("manual-error-state")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
  });
});

describe("contratos de integração e qualidade do Manual", () => {
  it("mantém rota protegida e item de menu para os três papéis", () => {
    const app = readProjectFile("client/src/App.tsx");
    const layout = readProjectFile("client/src/components/DashboardLayout.tsx");
    expect(app).toContain('<Route path="/app/manual">{() => <ProtectedPage><Manual /></ProtectedPage>}</Route>');
    expect(layout).toContain('{ icon: BookOpenText, label: "Manual", path: "/app/manual", roles: ["SPC_ADMIN", "ORG_ADMIN", "REQUESTER"] }');
  });

  it("preserva busca acessível, estados explícitos e breakpoints responsivos", () => {
    const source = readProjectFile("client/src/pages/Manual.tsx");
    expect(source).toContain('aria-label="Buscar no Manual"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('data-testid="manual-empty-state"');
    expect(source).toContain('data-testid="manual-error-state"');
    expect(source).toMatch(/sm:/);
    expect(source).toMatch(/lg:/);
    expect(source).toMatch(/xl:/);
  });

  it("referencia a captura real armazenada e identifica ilustrações demonstrativas", () => {
    const source = readProjectFile("client/src/components/manual/ManualVisual.tsx");
    expect(source).toContain('/manus-storage/manual-tela-acesso_6fda9b5e.png');
    expect(source).toContain("Captura sem credenciais");
    expect(source).toContain("Dados demonstrativos");
    expect(source).not.toMatch(/BEGIN (?:RSA|OPENSSH) PRIVATE KEY/);
  });
});
