import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { domainsDashboardDemoData } from "../client/src/pages/Domains";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("dashboard demonstrativo de Gestão de Domínios", () => {
  it("preserva todos os indicadores e valores centrais das referências", () => {
    expect(domainsDashboardDemoData.decision.recommendation).toBe("Pode aumentar 30%");
    expect(domainsDashboardDemoData.kpis.map(kpi => [kpi.label, kpi.value])).toEqual([
      ["Taxa média de abertura", "39,4%"],
      ["Compliance dos domínios", "82%"],
      ["Hard / Soft bounce", "0,7% / 2%"],
      ["Inbox placement", "94,2%"],
    ]);
    expect(domainsDashboardDemoData.evolution.at(-1)).toEqual({ date: "30", sent: 11_800, delivered: 11_202 });
  });

  it("modela radar, autenticação e scores por remetente", () => {
    expect(domainsDashboardDemoData.integrity.map(item => item.layer)).toEqual(["SPF", "DKIM", "DMARC", "BIMI", "MX", "Blocklist"]);
    expect(domainsDashboardDemoData.authentication).toHaveLength(5);
    expect(domainsDashboardDemoData.authentication.map(item => item.score)).toEqual([96, 82, 64, 91, 38]);
    expect(domainsDashboardDemoData.authentication.find(item => item.domain === "shop.acme.com.br")?.blocklist).toBe("critical");
  });

  it("preserva os seis limites e recomendações por provedor", () => {
    expect(domainsDashboardDemoData.providers).toHaveLength(6);
    expect(domainsDashboardDemoData.providers.find(item => item.provider === "Gmail")).toMatchObject({ currentLimit: 45_000, recommendedLimit: 58_500, decision: "Escalar" });
    expect(domainsDashboardDemoData.providers.find(item => item.provider === "UOL / BOL / Terra")).toMatchObject({ currentLimit: 4_200, recommendedLimit: 3_000, variation: "-29%", decision: "Reduzir" });
  });

  it("inclui a legenda semafórica completa e o racional exato", () => {
    expect(domainsDashboardDemoData.statuses.map(status => status.label)).toEqual(["Saudável", "Atenção", "Crítico", "Bloqueado"]);
    expect(domainsDashboardDemoData.statuses.at(-1)?.description).toBe("Domínio em blacklist ou com bloqueio ativo. Ação corretiva urgente.");
  });

  it("usa gráficos Recharts, marca dados demonstrativos e expõe contratos acessíveis e responsivos", () => {
    const source = read("client/src/pages/Domains.tsx");
    expect(source).toContain("AreaChart");
    expect(source).toContain("RadarChart");
    expect(source).toContain("Dados exclusivamente demonstrativos");
    expect(source).toContain('data-testid="domains-dashboard"');
    expect(source).toContain('aria-label="Tabela de autenticação por remetente"');
    expect(source).toContain('aria-label="Tabela de limites por provedor"');
    expect(source).toMatch(/sm:grid-cols-2/);
    expect(source).toMatch(/xl:grid-cols/);
  });

  it("substitui somente o placeholder da rota existente e mantém proteção SPC_ADMIN", () => {
    const app = read("client/src/App.tsx");
    const route = app.match(/<Route path="\/app\/dominios">([\s\S]*?)<\/Route>/)?.[1] ?? "";
    expect(app).toContain('const Domains = lazy(() => import("./pages/Domains"))');
    expect(route).toContain("<ProtectedPage spcOnly>");
    expect(route).toContain("<Domains />");
    expect(route).not.toContain("ModulePlaceholder");
  });
});
