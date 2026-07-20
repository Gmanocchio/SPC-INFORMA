// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Faq from "../client/src/pages/Faq";
import {
  FAQ_ITEMS,
  filterFaqItems,
  getVisibleFaqItems,
  type FaqOrganizationType,
  type FaqRole,
} from "../client/src/lib/faq-content";

const mocks = vi.hoisted(() => ({
  currentUser: {
    user: { role: "SPC_ADMIN" },
    organization: { type: "SPC_BRASIL" },
  } as {
    user: { role: string };
    organization: { type: string };
  },
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.currentUser }),
}));

const readProjectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

afterEach(() => cleanup());

function useIdentity(role: FaqRole, organizationType: FaqOrganizationType) {
  mocks.currentUser = {
    user: { role },
    organization: { type: organizationType },
  };
}

describe("FAQ segmentado por perfil", () => {
  it("libera todas as perguntas e categorias para o nível SPC Brasil", () => {
    useIdentity("SPC_ADMIN", "SPC_BRASIL");
    const visible = getVisibleFaqItems({ role: "SPC_ADMIN", organizationType: "SPC_BRASIL" });

    expect(visible).toHaveLength(FAQ_ITEMS.length);
    expect(visible.some(item => item.category === "TEMPLATES")).toBe(true);
    expect(visible.some(item => item.category === "BROKERS")).toBe(true);
    expect(visible.some(item => item.category === "DOMAINS")).toBe(true);
  });

  it.each([
    ["CDL", "CDL"],
    ["Distribuidora", "DISTRIBUTOR"],
    ["Credor", "CREDITOR"],
  ] as const)("limita administrador de %s às telas administrativas permitidas", (_label, organizationType) => {
    const visible = getVisibleFaqItems({ role: "ORG_ADMIN", organizationType });
    const categories = new Set(visible.map(item => item.category));

    expect(categories).toContain("ACCESS");
    expect(categories).toContain("DASHBOARD");
    expect(categories).toContain("CAMPAIGNS");
    expect(categories).toContain("ORGANIZATIONS");
    expect(categories).toContain("USERS");
    expect(categories).toContain("PRICING");
    expect(categories).toContain("API_KEYS");
    expect(categories).not.toContain("TEMPLATES");
    expect(categories).not.toContain("BROKERS");
    expect(categories).not.toContain("DOMAINS");
  });

  it("limita solicitante a acesso, Dashboard e Campanhas", () => {
    const visible = getVisibleFaqItems({ role: "REQUESTER", organizationType: "CREDITOR" });
    expect(Array.from(new Set(visible.map(item => item.category))).sort()).toEqual([
      "ACCESS",
      "CAMPAIGNS",
      "DASHBOARD",
    ]);
  });

  it("renderiza o escopo completo do SPC e permite buscar sem considerar acentos", () => {
    useIdentity("SPC_ADMIN", "SPC_BRASIL");
    render(<Faq />);

    expect(screen.getByTestId("faq-page")).toBeTruthy();
    expect(screen.getByText("Visão completa: inclui orientações de todos os níveis e módulos.")).toBeTruthy();
    expect(screen.getByTestId("faq-category-TEMPLATES")).toBeTruthy();
    expect(screen.getByTestId("faq-category-BROKERS")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Buscar no FAQ"), { target: { value: "limite de conteudo sms" } });

    expect(screen.getByText("Qual é o limite de conteúdo para SMS?")).toBeTruthy();
    expect(screen.queryByText("Para que serve a tela Brokers?")).toBeNull();
  });

  it("renderiza somente categorias autorizadas para administrador de Distribuidora", () => {
    useIdentity("ORG_ADMIN", "DISTRIBUTOR");
    render(<Faq />);

    expect(screen.getByText("O conteúdo foi filtrado para exibir somente telas disponíveis ao seu perfil.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Empresas/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Precificação/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Templates/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Brokers/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Gestão de Domínios/ })).toBeNull();
  });

  it("exibe estado vazio e oferece limpeza quando a busca não encontra resposta", () => {
    useIdentity("REQUESTER", "CREDITOR");
    render(<Faq />);

    fireEvent.change(screen.getByLabelText("Buscar no FAQ"), { target: { value: "termo sem correspondencia 999" } });

    expect(screen.getByTestId("faq-empty-state")).toBeTruthy();
    expect(screen.getByText("Nenhuma resposta encontrada")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca e filtros" }));
    expect(screen.getByText("Como obtenho acesso ao SPC Informa?")).toBeTruthy();
  });

  it("filtra por categoria e texto em pergunta, resposta, nota e passos", () => {
    const requesterItems = getVisibleFaqItems({ role: "REQUESTER", organizationType: "CDL" });
    expect(filterFaqItems(requesterItems, "20.000 linhas", "CAMPAIGNS").map(item => item.id)).toEqual(["campaign-files"]);
    expect(filterFaqItems(requesterItems, "spam", "ACCESS").map(item => item.id)).toEqual(["access-two-factor"]);
    expect(filterFaqItems(requesterItems, "modelo financeiro", "DASHBOARD").map(item => item.id)).toContain("dashboard-financial");
  });
});

describe("contratos de integração e qualidade do FAQ", () => {
  it("mantém a rota protegida e o item de menu visível aos três papéis", () => {
    const app = readProjectFile("client/src/App.tsx");
    const layout = readProjectFile("client/src/components/DashboardLayout.tsx");

    expect(app).toContain('<Route path="/app/faq">{() => <ProtectedPage><Faq /></ProtectedPage>}</Route>');
    expect(layout).toContain('{ icon: HelpCircle, label: "FAQ", path: "/app/faq", roles: ["SPC_ADMIN", "ORG_ADMIN", "REQUESTER"] }');
  });

  it("preserva contratos explícitos de acessibilidade e responsividade", () => {
    const source = readProjectFile("client/src/pages/Faq.tsx");

    expect(source).toContain('aria-label="Buscar no FAQ"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('aria-pressed={active}');
    expect(source).toContain("overflow-x-auto");
    expect(source).toMatch(/sm:/);
    expect(source).toMatch(/lg:/);
    expect(source).toMatch(/xl:/);
    expect(source).toContain('data-testid="faq-empty-state"');
  });

  it("mantém exemplos visuais explicitamente demonstrativos e sem segredos reais", () => {
    const source = readProjectFile("client/src/pages/Faq.tsx");

    expect(source).toContain("Dados demonstrativos");
    expect(source).toContain("As telas ilustrativas usam dados fictícios.");
    expect(source).toContain("Nenhuma credencial ou dado pessoal é exibido.");
    expect(source).not.toMatch(/BEGIN (?:RSA|OPENSSH) PRIVATE KEY/);
  });
});
