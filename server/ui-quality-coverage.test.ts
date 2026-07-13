import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

const queryScreens = [
  "client/src/pages/Organizations.tsx",
  "client/src/pages/Users.tsx",
  "client/src/pages/Templates.tsx",
  "client/src/pages/Pricing.tsx",
  "client/src/pages/ApiKeys.tsx",
  "client/src/pages/Campaigns.tsx",
  "client/src/pages/Brokers.tsx",
  "client/src/pages/Dashboard.tsx",
];

describe("contratos arquiteturais de qualidade das telas críticas", () => {
  it.each(queryScreens)("%s distingue carregamento e falha", relativePath => {
    const source = read(relativePath);
    expect(source).toMatch(/isLoading/);
    expect(source).toMatch(/isError/);
  });

  it.each(queryScreens)("%s possui adaptação responsiva explícita", relativePath => {
    const source = read(relativePath);
    expect(source).toMatch(/(?:sm|md|lg):/);
  });

  it("oferece rota de escape por teclado e região principal focável", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain('href="#conteudo-principal"');
    expect(layout).toContain('id="conteudo-principal"');
    expect(layout).toContain('tabIndex={-1}');
    expect(layout).toContain('role="separator"');
    expect(layout).toMatch(/aria-(?:label|valuenow)/);
  });

  it("mantém foco visível no estado de erro recuperável", () => {
    const source = read("client/src/components/QueryErrorState.tsx");
    expect(source).toContain('role="alert"');
    expect(source).toContain("focus-visible:ring-2");
    expect(source).toContain("Tentar novamente");
  });

  it("orienta o download e a reimportação do modelo padrão na tela de campanhas", () => {
    const source = read("client/src/pages/Campaigns.tsx");
    expect(source).toContain("preencha uma linha por cliente e envie o arquivo novamente");
    expect(source).toContain('aria-label="Colunas obrigatórias do modelo padrão"');
    expect(source).toContain("layout.data?.columns.map");
  });
});
