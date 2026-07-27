import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  ChevronRight,
  CircleGauge,
  Download,
  Eye,
  Inbox,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

type AuthenticationState = "healthy" | "warning" | "critical";
type ProviderDecision = "Escalar" | "Manter" | "Reduzir";

type AuthenticationRow = {
  domain: string;
  ip: string;
  spf: AuthenticationState;
  dkim: AuthenticationState;
  dmarc: AuthenticationState;
  bimi: AuthenticationState;
  mx: AuthenticationState;
  blocklist: AuthenticationState;
  score: number;
};

type ProviderLimit = {
  provider: string;
  currentLimit: number;
  recommendedLimit: number;
  variation: string;
  engagement: string;
  bounce: string;
  decision: ProviderDecision;
};

export type DomainsDashboardDemoData = {
  decision: {
    status: string;
    recommendation: string;
    rationale: string;
    nextStep: string;
  };
  kpis: Array<{
    label: string;
    value: string;
    detail: string;
    icon: "open" | "compliance" | "bounce" | "inbox";
  }>;
  evolution: Array<{ date: string; sent: number; delivered: number }>;
  integrity: Array<{ layer: string; score: number }>;
  authentication: AuthenticationRow[];
  providers: ProviderLimit[];
  statuses: Array<{
    label: "Saudável" | "Atenção" | "Crítico" | "Bloqueado";
    color: "green" | "yellow" | "orange" | "red";
    description: string;
  }>;
};

/**
 * Dados exclusivamente demonstrativos. A integração futura deve substituir
 * este contrato pelo retorno normalizado da API do broker, sem mudar a
 * composição visual nem as regras semânticas dos estados.
 */
export const domainsDashboardDemoData: DomainsDashboardDemoData = {
  decision: {
    status: "SINAL VERDE",
    recommendation: "Pode aumentar 30%",
    rationale: "Todos os KPIs estáveis nos últimos 5 dias.",
    nextStep: "Elevar volume em 30% e manter janela de 3–5 dias antes do próximo salto.",
  },
  kpis: [
    { label: "Taxa média de abertura", value: "39,4%", detail: "+2,1 pp vs semana anterior", icon: "open" },
    { label: "Compliance dos domínios", value: "82%", detail: "SPF/DKIM/DMARC agregado", icon: "compliance" },
    { label: "Hard / Soft bounce", value: "0,7% / 2%", detail: "Dentro do limite seguro", icon: "bounce" },
    { label: "Inbox placement", value: "94,2%", detail: "Spam rate 0,08%", icon: "inbox" },
  ],
  evolution: [
    { date: "01", sent: 180, delivered: 170 },
    { date: "03", sent: 320, delivered: 302 },
    { date: "05", sent: 520, delivered: 493 },
    { date: "08", sent: 880, delivered: 832 },
    { date: "11", sent: 1_520, delivered: 1_442 },
    { date: "14", sent: 2_550, delivered: 2_416 },
    { date: "18", sent: 4_280, delivered: 4_061 },
    { date: "22", sent: 6_820, delivered: 6_474 },
    { date: "26", sent: 8_940, delivered: 8_486 },
    { date: "30", sent: 11_800, delivered: 11_202 },
  ],
  integrity: [
    { layer: "SPF", score: 96 },
    { layer: "DKIM", score: 88 },
    { layer: "DMARC", score: 84 },
    { layer: "BIMI", score: 62 },
    { layer: "MX", score: 94 },
    { layer: "Blocklist", score: 86 },
  ],
  authentication: [
    { domain: "mkt.acme.com.br", ip: "192.0.2.10", spf: "healthy", dkim: "healthy", dmarc: "healthy", bimi: "healthy", mx: "healthy", blocklist: "healthy", score: 96 },
    { domain: "news.acme.com.br", ip: "192.0.2.11", spf: "healthy", dkim: "healthy", dmarc: "warning", bimi: "warning", mx: "healthy", blocklist: "healthy", score: 82 },
    { domain: "promo.acme.com.br", ip: "192.0.2.12", spf: "healthy", dkim: "warning", dmarc: "warning", bimi: "critical", mx: "healthy", blocklist: "warning", score: 64 },
    { domain: "transac.acme.com.br", ip: "192.0.2.13", spf: "healthy", dkim: "healthy", dmarc: "healthy", bimi: "warning", mx: "healthy", blocklist: "healthy", score: 91 },
    { domain: "shop.acme.com.br", ip: "192.0.2.14", spf: "critical", dkim: "healthy", dmarc: "critical", bimi: "critical", mx: "healthy", blocklist: "critical", score: 38 },
  ],
  providers: [
    { provider: "Gmail", currentLimit: 45_000, recommendedLimit: 58_500, variation: "+30%", engagement: "41%", bounce: "1,2%", decision: "Escalar" },
    { provider: "Yahoo", currentLimit: 22_000, recommendedLimit: 28_600, variation: "+30%", engagement: "36%", bounce: "1,9%", decision: "Escalar" },
    { provider: "Microsoft (Outlook/Hotmail)", currentLimit: 18_000, recommendedLimit: 18_000, variation: "0%", engagement: "28%", bounce: "3,4%", decision: "Manter" },
    { provider: "Apple iCloud", currentLimit: 6_500, recommendedLimit: 8_450, variation: "+30%", engagement: "44%", bounce: "0,8%", decision: "Escalar" },
    { provider: "UOL / BOL / Terra", currentLimit: 4_200, recommendedLimit: 3_000, variation: "-29%", engagement: "14%", bounce: "6,8%", decision: "Reduzir" },
    { provider: "Outros (corporativos)", currentLimit: 9_800, recommendedLimit: 12_740, variation: "+30%", engagement: "39%", bounce: "1,5%", decision: "Escalar" },
  ],
  statuses: [
    { label: "Saudável", color: "green", description: "Score estável, sem sinais de degradação. Monitoramento passivo." },
    { label: "Atenção", color: "yellow", description: "Queda leve no score. Revisão de volume e conteúdo recomendada." },
    { label: "Crítico", color: "orange", description: "Degradação acelerada. Redução imediata de volume e investigação." },
    { label: "Bloqueado", color: "red", description: "Domínio em blacklist ou com bloqueio ativo. Ação corretiva urgente." },
  ],
};

const evolutionChartConfig = {
  sent: { label: "Enviado", color: "#266FAF" },
  delivered: { label: "Entregue", color: "#59B9AD" },
} satisfies ChartConfig;

const integrityChartConfig = {
  score: { label: "Integridade", color: "#6FA8DC" },
} satisfies ChartConfig;

const integer = new Intl.NumberFormat("pt-BR");

const kpiIcons = {
  open: Eye,
  compliance: ShieldCheck,
  bounce: Activity,
  inbox: Inbox,
} as const;

const authenticationLabels: Record<AuthenticationState, string> = {
  healthy: "Saudável",
  warning: "Atenção",
  critical: "Crítico",
};

const authenticationColors: Record<AuthenticationState, string> = {
  healthy: "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,.12)]",
  warning: "bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,.14)]",
  critical: "bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,.12)]",
};

const decisionStyles: Record<ProviderDecision, string> = {
  Escalar: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Manter: "border-amber-200 bg-amber-50 text-amber-700",
  Reduzir: "border-rose-200 bg-rose-50 text-rose-700",
};

const statusColors = {
  green: "from-emerald-400 to-emerald-600",
  yellow: "from-amber-300 to-amber-500",
  orange: "from-orange-400 to-orange-600",
  red: "from-rose-400 to-rose-700",
} as const;

function exportDemonstrativeReport(environment: string, sender: string) {
  const header = ["Ambiente", "Remetente", "Provedor", "Limite atual/dia", "Recomendado", "Variação", "Engajamento", "Bounce", "Farol"];
  const rows = domainsDashboardDemoData.providers.map(provider => [
    environment,
    sender,
    provider.provider,
    provider.currentLimit,
    provider.recommendedLimit,
    provider.variation,
    provider.engagement,
    provider.bounce,
    provider.decision,
  ]);
  const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [header, ...rows].map(row => row.map(escapeCsv).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "relatorio-aquecimento-dominios-demonstrativo.csv";
  anchor.click();
  URL.revokeObjectURL(url);
  toast.success("Relatório demonstrativo exportado.");
}

export default function Domains() {
  const [environment, setEnvironment] = useState("production");
  const [sender, setSender] = useState("all");
  const visibleAuthentication = useMemo(
    () => sender === "all"
      ? domainsDashboardDemoData.authentication
      : domainsDashboardDemoData.authentication.filter(item => item.domain === sender),
    [sender],
  );
  const environmentLabel = environment === "production" ? "Produção" : "Homologação";
  const senderLabel = sender === "all" ? "Todos os remetentes" : sender;

  return (
    <div data-testid="domains-dashboard" className="space-y-6 pb-4">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold uppercase tracking-[.14em] text-[#0066CC]">Entregabilidade</p>
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[#0055A8]">
              Dados demonstrativos
            </Badge>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#003B7A]">Aquecimento de Domínios</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Monitoramento da entregabilidade e evolução do warm-up</p>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-[10.5rem_13.5rem_auto] xl:items-end">
          <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[.08em] text-slate-500">
            Ambiente
            <Select value={environment} onValueChange={setEnvironment}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white text-sm font-medium normal-case tracking-normal text-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Produção</SelectItem>
                <SelectItem value="homologation">Homologação</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[.08em] text-slate-500">
            Remetente
            <Select value={sender} onValueChange={setSender}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white text-sm font-medium normal-case tracking-normal text-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os remetentes</SelectItem>
                {domainsDashboardDemoData.authentication.map(item => (
                  <SelectItem key={item.domain} value={item.domain}>{item.domain}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <Button
            type="button"
            className="h-11 rounded-xl bg-[#0066CC] px-5 font-bold shadow-sm hover:bg-[#0057AD] sm:col-span-2 xl:col-span-1"
            onClick={() => exportDemonstrativeReport(environmentLabel, senderLabel)}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar relatório
          </Button>
        </div>
      </header>

      <section aria-labelledby="decision-title" className="grid gap-4 xl:grid-cols-[minmax(18rem,.78fr)_minmax(0,1.72fr)]">
        <article data-testid="decision-light" className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-emerald-500" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="decision-title" className="text-sm font-bold text-[#003B7A]">Farol de decisão</h2>
              <p className="mt-4 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.12em] text-emerald-700">
                <span className="relative flex h-4 w-4 items-center justify-center" aria-hidden="true">
                  <span className="absolute h-4 w-4 rounded-full bg-emerald-200" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                {domainsDashboardDemoData.decision.status}
              </p>
              <p className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">{domainsDashboardDemoData.decision.recommendation}</p>
            </div>
            <CircleGauge className="h-6 w-6 shrink-0 text-emerald-500" />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-500">{domainsDashboardDemoData.decision.rationale}</p>
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-400">Próximo passo</p>
            <p className="mt-1.5 text-sm font-medium leading-6 text-slate-700">{domainsDashboardDemoData.decision.nextStep}</p>
          </div>
        </article>

        <div data-testid="domain-kpis" className="grid gap-4 sm:grid-cols-2">
          {domainsDashboardDemoData.kpis.map(kpi => {
            const Icon = kpiIcons[kpi.icon];
            return (
              <article key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-500"><Icon className="h-4 w-4 text-slate-400" />{kpi.label}</p>
                    <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">{kpi.value}</p>
                  </div>
                  <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500" aria-label="Tendência estável ou positiva" />
                </div>
                <p className="mt-3 text-xs font-medium text-slate-400">{kpi.detail}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="evolution-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="evolution-title" className="font-bold text-[#003B7A]">Evolução do aquecimento</h2>
            <p className="mt-1 text-sm text-slate-500">Volume enviado + entregue · últimos 28 dias</p>
          </div>
          <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">+34% vs período</Badge>
        </div>
        <ChartContainer config={evolutionChartConfig} className="mt-5 h-[18rem] w-full sm:h-[21rem]">
          <AreaChart data={domainsDashboardDemoData.evolution} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="sentGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-sent)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--color-sent)" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="deliveredGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-delivered)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--color-delivered)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} />
            <YAxis
              domain={[0, 12_000]}
              ticks={[0, 4_000, 8_000, 12_000]}
              tickLine={false}
              axisLine={false}
              width={46}
              tickFormatter={value => value === 0 ? "0" : `${Number(value) / 1_000}k`}
            />
            <ChartTooltip cursor={{ stroke: "#CBD5E1", strokeDasharray: "4 4" }} content={<ChartTooltipContent labelFormatter={label => `Dia ${label}`} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area isAnimationActive={false} type="monotone" dataKey="sent" stroke="var(--color-sent)" strokeWidth={2} fill="url(#sentGradient)" />
            <Area isAnimationActive={false} type="monotone" dataKey="delivered" stroke="var(--color-delivered)" strokeWidth={2.5} fill="url(#deliveredGradient)" />
          </AreaChart>
        </ChartContainer>
      </section>

      <section aria-label="Integridade e autenticação" className="grid gap-4 xl:grid-cols-[minmax(19rem,.72fr)_minmax(0,1.28fr)]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="font-bold text-[#003B7A]">Integridade agregada</h2>
          <p className="mt-1 text-sm text-slate-500">Score médio por camada de autenticação</p>
          <ChartContainer config={integrityChartConfig} className="mx-auto mt-4 h-[18rem] w-full max-w-[25rem]">
            <RadarChart data={domainsDashboardDemoData.integrity} outerRadius="72%">
              <PolarGrid stroke="#CBD5E1" />
              <PolarAngleAxis dataKey="layer" tick={{ fill: "#475569", fontSize: 11, fontWeight: 600 }} />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Radar isAnimationActive={false} dataKey="score" stroke="var(--color-score)" fill="var(--color-score)" fillOpacity={0.45} strokeWidth={2} />
            </RadarChart>
          </ChartContainer>
        </article>

        <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="font-bold text-[#003B7A]">Autenticação por remetente</h2>
          <p className="mt-1 text-sm text-slate-500">SPF, DKIM, DMARC, BIMI, MX e verificação de blocklist</p>
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100 [scrollbar-gutter:stable]" tabIndex={0} aria-label="Tabela de autenticação por remetente">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[.06em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Domínio / IP</th>
                  {(["SPF", "DKIM", "DMARC", "BIMI", "MX", "Blocklist"] as const).map(label => <th key={label} className="px-3 py-3 text-center font-bold">{label}</th>)}
                  <th className="px-4 py-3 text-right font-bold">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleAuthentication.map(item => (
                  <tr key={item.domain} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{item.domain}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">{item.ip}</p>
                    </td>
                    <AuthenticationCell state={item.spf} label="SPF" />
                    <AuthenticationCell state={item.dkim} label="DKIM" />
                    <AuthenticationCell state={item.dmarc} label="DMARC" />
                    <AuthenticationCell state={item.bimi} label="BIMI" />
                    <AuthenticationCell state={item.mx} label="MX" />
                    <AuthenticationCell state={item.blocklist} label="Blocklist" />
                    <td className="px-4 py-3 text-right"><ScoreBadge score={item.score} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section data-testid="provider-limits" aria-labelledby="provider-limits-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 id="provider-limits-title" className="font-bold text-[#003B7A]">Limites por provedor</h2>
        <p className="mt-1 text-sm text-slate-500">Volume atual, novo limite recomendado (+30% a cada 3–5 dias com KPIs estáveis) e farol por provedor</p>
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100 [scrollbar-gutter:stable]" tabIndex={0} aria-label="Tabela de limites por provedor">
          <table className="w-full min-w-[55rem] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-[.06em] text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Provedor</th>
                <th className="px-4 py-3 text-right font-bold">Limite atual / dia</th>
                <th className="px-4 py-3 text-right font-bold">Recomendado</th>
                <th className="px-4 py-3 text-right font-bold">Engajamento</th>
                <th className="px-4 py-3 text-right font-bold">Bounce</th>
                <th className="px-4 py-3 text-center font-bold">Farol</th>
                <th className="px-4 py-3 text-right font-bold">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {domainsDashboardDemoData.providers.map(provider => (
                <tr key={provider.provider} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-bold text-slate-800">{provider.provider}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{integer.format(provider.currentLimit)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className="font-bold text-slate-800">{integer.format(provider.recommendedLimit)}</span>
                    <span className={`ml-2 text-xs font-bold ${provider.variation.startsWith("+") ? "text-emerald-600" : provider.variation.startsWith("-") ? "text-rose-600" : "text-slate-400"}`}>{provider.variation}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{provider.engagement}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{provider.bounce}</td>
                  <td className="px-4 py-3 text-center"><Badge variant="outline" className={decisionStyles[provider.decision]}>{provider.decision}</Badge></td>
                  <td className="px-2 py-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="font-bold text-[#0066CC] hover:bg-blue-50 hover:text-[#0055A8]"
                      onClick={() => toast.info(`Recomendação demonstrativa para ${provider.provider}: ${integer.format(provider.recommendedLimit)} envios/dia.`)}
                      aria-label={`Aplicar recomendação demonstrativa para ${provider.provider}`}
                    >
                      Aplicar <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="status-legend-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="status-legend-title" className="font-bold text-[#003B7A]">Legenda operacional</h2>
            <p className="mt-1 text-sm text-slate-500">Racional usado na leitura dos estados de reputação</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {domainsDashboardDemoData.statuses.map(status => (
            <article key={status.label} className="relative min-h-44 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 pl-7 shadow-sm">
              <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-[#4B5CC4]" />
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className={`h-5 w-5 shrink-0 rounded-full bg-gradient-to-b ${statusColors[status.color]} shadow-sm`} />
                <h3 className="text-xl font-extrabold tracking-tight text-slate-900">{status.label}</h3>
              </div>
              <p className="mt-6 text-sm font-medium leading-6 text-slate-600">{status.description}</p>
            </article>
          ))}
        </div>
      </section>

      <p className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs leading-5 text-slate-600">
        <strong className="text-[#0055A8]">Fonte atual:</strong> cenário demonstrativo para validação visual e funcional. Os mesmos contratos de dados estão preparados para futura substituição pelos indicadores fornecidos pela API do broker.
      </p>
    </div>
  );
}

function AuthenticationCell({ state, label }: { state: AuthenticationState; label: string }) {
  return (
    <td className="px-3 py-3 text-center">
      <span
        role="img"
        aria-label={`${label}: ${authenticationLabels[state]}`}
        title={`${label}: ${authenticationLabels[state]}`}
        className={`inline-block h-2.5 w-2.5 rounded-full ${authenticationColors[state]}`}
      />
    </td>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const style = score >= 90
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : score >= 70
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : score >= 50
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : "border-rose-200 bg-rose-50 text-rose-700";
  return <Badge variant="outline" className={`min-w-10 justify-center tabular-nums ${style}`}>{score}</Badge>;
}
