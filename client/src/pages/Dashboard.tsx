import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { BarChart3, CheckCircle2, Clock3, Database, Eye, MailWarning, MousePointerClick, Send, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

const labels = { SMS: "SMS", EMAIL: "E-mail", WHATSAPP: "WhatsApp", RCS: "RCS" };
const integer = new Intl.NumberFormat("pt-BR");
const currency = (micros: number) => (micros / 1_000_000).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const percentage = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const organizationTypeLabel: Record<string, string> = { SPC_BRASIL: "SPC Brasil", CDL: "CDL", DISTRIBUTOR: "Distribuidora", CREDITOR: "Credor" };

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedCreditorId, setSelectedCreditorId] = useState<number | null>(null);
  const overviewInput = useMemo(
    () => selectedCreditorId ? { creditorOrganizationId: selectedCreditorId } : undefined,
    [selectedCreditorId],
  );
  const overview = trpc.dashboard.overview.useQuery(overviewInput, { refetchInterval: 30_000 });
  if (overview.isLoading) {
    const indicatorCount = user?.user.role === "SPC_ADMIN" ? 6 : 5;
    return <div className="space-y-6"><Skeleton className="h-24" /><div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${indicatorCount === 6 ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>{Array.from({ length: indicatorCount }, (_, index) => <Skeleton key={index} className="h-40" />)}</div><Skeleton className="h-80" /></div>;
  }
  if (overview.isError || !overview.data) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700"><TriangleAlert className="mb-3 size-6" /><p className="font-bold">Não foi possível carregar os indicadores.</p><p className="mt-1 text-sm">{overview.error?.message}</p></div>;
  }

  const data = overview.data;
  const isSpcLevel = user?.user.role === "SPC_ADMIN";
  const canViewOrganizationConsolidation = user?.user.role === "SPC_ADMIN" && user.organization.type === "SPC_BRASIL";
  const cards = [
    { key: "base-incluida", label: "Base incluída", value: integer.format(data.baseIncluded), detail: "registros carregados", icon: Database, accent: "text-violet-700 bg-violet-50" },
    { key: "envios", label: "Envios", value: integer.format(data.sent), detail: `${integer.format(data.campaignCount)} campanhas`, icon: Send, accent: "text-[#0066CC] bg-blue-50" },
    { key: "entregues", label: "Entregues", value: integer.format(data.delivered), detail: `${percentage(data.deliveryRate)} dos envios`, icon: CheckCircle2, accent: "text-[#00A86B] bg-emerald-50" },
    { key: "abertos", label: "Abertos", value: integer.format(data.opened), detail: `${percentage(data.openRate)} dos entregues`, icon: Eye, accent: "text-cyan-700 bg-cyan-50" },
    { key: "cliques", label: "Cliques", value: integer.format(data.clicked), detail: `${percentage(data.clickRate)} dos entregues`, icon: MousePointerClick, accent: "text-amber-700 bg-amber-50" },
    ...(isSpcLevel ? [{ key: "spam", label: "SPAM", value: integer.format(data.spam ?? 0), detail: `${percentage(data.spamRate ?? 0)} dos entregues`, icon: MailWarning, accent: "text-red-700 bg-red-50" }] : []),
  ];

  return <div className="space-y-7">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><div className="flex items-center gap-3"><p className="text-sm font-bold uppercase tracking-[.14em] text-[#0066CC]">Visão executiva</p><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Atualização a cada 30 s</Badge></div><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#003B7A]">Dashboard operacional</h1><p className="mt-2 text-slate-600">Acompanhe desempenho, entrega e consumo dentro do seu escopo de acesso.</p></div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {data.canFilterByCreditor ? <div data-testid="creditor-filter" className="min-w-64"><label className="mb-1.5 block text-xs font-bold uppercase tracking-[.08em] text-slate-500">Credor</label><Select value={selectedCreditorId?.toString() ?? "all"} onValueChange={value => setSelectedCreditorId(value === "all" ? null : Number(value))}><SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white"><SelectValue placeholder="Todos os credores" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os credores</SelectItem>{data.creditorOptions.map(creditor => <SelectItem key={creditor.id} value={creditor.id.toString()}>{creditor.tradeName}</SelectItem>)}</SelectContent></Select></div> : null}
        <div className="flex h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm text-slate-600"><Clock3 className="h-4 w-4" /> Desde {new Date(data.periodStart).toLocaleDateString("pt-BR")}</div>
      </div>
    </div>

    <div data-testid="dashboard-indicators" className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${isSpcLevel ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>{cards.map(({ key, label, value, detail, icon: Icon, accent }) => <article data-testid={`indicator-${key}`} key={key} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 truncate text-3xl font-extrabold tracking-tight text-[#003B7A]" title={value}>{value}</p></div><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}><Icon className="h-5 w-5" /></span></div><p className="mt-5 text-xs text-slate-400">{detail}</p></article>)}</div>

    <div className="grid gap-5 xl:grid-cols-[1.45fr_.55fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold text-[#003B7A]">Desempenho por canal</h2><p className="mt-1 text-sm text-slate-500">Destinatários válidos, entregues e com falha</p></div><BarChart3 className="h-5 w-5 text-[#0066CC]" /></div>{data.byChannel.length ? <div className="mt-7 space-y-5">{data.byChannel.map(item => { const rate = item.sent ? item.delivered / item.sent * 100 : 0; return <div key={item.channel}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-bold text-slate-800">{labels[item.channel]}</span><span className="text-slate-500">{integer.format(item.delivered)} de {integer.format(item.sent)} · {rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#0066CC] to-[#00A86B]" style={{ width: `${Math.min(100, rate)}%` }} /></div></div>; })}</div> : <EmptyChart />}</section>
      <section className="rounded-2xl bg-[#003B7A] p-6 text-white shadow-sm"><p className="text-sm font-semibold text-blue-100/70">Situação financeira</p><h2 className="mt-2 text-2xl font-extrabold">Saldo e consumo</h2><div className="mt-8 rounded-2xl border border-white/10 bg-white/[.07] p-5"><p className="text-xs uppercase tracking-[.14em] text-blue-100/60">{data.financial?.billingModel === "POSTPAID" ? "Consumo acumulado" : data.financial ? "Saldo disponível" : "Processado na plataforma"}</p><p className="mt-2 text-3xl font-extrabold text-[#FFD54A]">{data.financial ? (data.financial.balanceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : currency(data.processedMicros)}</p><p className="mt-3 text-sm leading-6 text-blue-100/65">{data.financial ? `Modelo ${data.financial.billingModel === "PREPAID" ? "pré-pago" : "pós-pago"}.` : "Consolidação de todas as organizações no período."}</p></div></section>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-[#003B7A]">Volume diário</h2><p className="mt-1 text-sm text-slate-500">Envios confirmados nos últimos 30 dias</p>{data.byDay.length ? <MiniBars items={data.byDay.slice(-14).map(item => ({ label: new Date(`${item.period}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), value: item.sent, title: `${item.period}: ${integer.format(item.sent)} envios` }))} /> : <EmptyChart />}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-[#003B7A]">Evolução mensal</h2><p className="mt-1 text-sm text-slate-500">Envios confirmados nos últimos 12 meses</p>{data.byMonth.length ? <MiniBars items={data.byMonth.map(item => ({ label: new Date(`${item.period}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }), value: item.sent, title: `${item.period}: ${integer.format(item.sent)} envios` }))} /> : <EmptyChart />}</section>
    </div>

    {data.canFilterByCreditor ? <section data-testid="creditor-volume-chart" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4"><div><h2 className="font-bold text-[#003B7A]">Volume por credor</h2><p className="mt-1 text-sm text-slate-500">Envios confirmados dos credores vinculados no período selecionado</p></div><BarChart3 className="h-5 w-5 shrink-0 text-[#0066CC]" /></div>
      {data.byCreditor.length ? <MiniBars items={data.byCreditor.map(creditor => ({ label: creditor.creditorName, value: creditor.sent, title: `${creditor.creditorName}: ${integer.format(creditor.sent)} envios` }))} /> : <EmptyChart />}
    </section> : null}

    {canViewOrganizationConsolidation && data.organizationConsolidation.length ? <OrganizationConsolidation groups={data.organizationConsolidation} /> : null}
  </div>;
}

function EmptyChart() {
  return <div className="mt-8 flex min-h-52 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC]"><div className="max-w-xs text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#0066CC]"><BarChart3 /></span><p className="mt-4 font-semibold text-slate-700">Aguardando movimentação</p><p className="mt-2 text-sm leading-6 text-slate-500">Os indicadores serão preenchidos automaticamente a partir das campanhas e retornos dos brokers.</p></div></div>;
}

type ConsolidationGroup = {
  organizationId: number;
  organizationName: string;
  organizationType: "SPC_BRASIL" | "CDL" | "DISTRIBUTOR";
  sent: number;
  delivered: number;
  failed: number;
  processedMicros: number;
  creditors: Array<{
    creditorOrganizationId: number;
    creditorName: string;
    sent: number;
    delivered: number;
    failed: number;
    processedMicros: number;
  }>;
};

function OrganizationConsolidation({ groups }: { groups: ConsolidationGroup[] }) {
  const groupTypes = ["CDL", "DISTRIBUTOR", "SPC_BRASIL"] as const;
  return <section data-testid="organization-consolidation" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div><h2 className="font-bold text-[#003B7A]">Consolidado por organização</h2><p className="mt-1 text-sm text-slate-500">Credores agrupados conforme o vínculo com CDLs, Distribuidoras e SPC Brasil</p></div>
    <div className="mt-6 grid gap-4 xl:grid-cols-3">{groupTypes.map(type => {
      const organizationGroups = groups.filter(group => group.organizationType === type);
      return <article data-testid={`organization-type-${type}`} key={type} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-800">{organizationTypeLabel[type]}</h3><p className="mt-1 text-xs text-slate-500">Uma coluna para cada credor vinculado</p></div><Badge variant="outline" className="shrink-0 bg-white">{organizationGroups.length}</Badge></div>
        <div className="mt-4 space-y-4">{organizationGroups.length ? organizationGroups.map(group => <div data-testid={`organization-group-${group.organizationId}`} key={group.organizationId} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800" title={group.organizationName}>{group.organizationName}</p><p className="mt-0.5 text-[11px] text-slate-500">{group.creditors.length} {group.creditors.length === 1 ? "credor vinculado" : "credores vinculados"}</p></div><span className="shrink-0 text-xs font-semibold text-[#0066CC]">{integer.format(group.sent)} envios</span></div>
          {group.creditors.length ? <MiniBars compact items={group.creditors.map(creditor => ({ label: creditor.creditorName, value: creditor.sent, title: `${creditor.creditorName}: ${integer.format(creditor.sent)} envios` }))} /> : <p className="mt-4 rounded-lg border border-dashed p-4 text-center text-xs text-slate-500">Nenhum credor vinculado.</p>}
          <div className="sr-only">{group.creditors.map(creditor => <span data-testid={`creditor-column-${creditor.creditorOrganizationId}`} key={creditor.creditorOrganizationId}>{creditor.creditorName}</span>)}</div>
        </div>) : <p className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-500">Nenhuma organização ativa neste grupo.</p>}</div>
      </article>;
    })}</div>
    <div className="mt-7 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Grupo</th><th className="px-3 py-3">Organização vinculadora</th><th className="px-3 py-3">Credor</th><th className="px-3 py-3 text-right">Envios</th><th className="px-3 py-3 text-right">Entregues</th><th className="px-3 py-3 text-right">Falhas</th><th className="px-3 py-3 text-right">Valor</th></tr></thead><tbody>{groups.flatMap(group => group.creditors.length ? group.creditors.map((creditor, creditorIndex) => <tr data-testid={`creditor-detail-${creditor.creditorOrganizationId}`} key={`${group.organizationId}-${creditor.creditorOrganizationId}`} className={`${creditorIndex === 0 ? "border-t-2 border-slate-200" : "border-t border-slate-100"}`}><td className="px-3 py-4"><Badge variant="outline">{organizationTypeLabel[group.organizationType]}</Badge></td><td className="px-3 py-4 font-semibold text-slate-800">{group.organizationName}</td><td className="px-3 py-4 text-slate-700">{creditor.creditorName}</td><td className="px-3 py-4 text-right">{integer.format(creditor.sent)}</td><td className="px-3 py-4 text-right">{integer.format(creditor.delivered)}</td><td className="px-3 py-4 text-right">{integer.format(creditor.failed)}</td><td className="px-3 py-4 text-right font-semibold">{currency(creditor.processedMicros)}</td></tr>) : [<tr key={`${group.organizationId}-empty`} className="border-t-2 border-slate-200"><td className="px-3 py-4"><Badge variant="outline">{organizationTypeLabel[group.organizationType]}</Badge></td><td className="px-3 py-4 font-semibold text-slate-800">{group.organizationName}</td><td className="px-3 py-4 text-slate-400" colSpan={5}>Nenhum credor vinculado.</td></tr>])}</tbody></table></div>
  </section>;
}

function MiniBars({ items, compact = false }: { items: Array<{ label: string; value: number; title: string }>; compact?: boolean }) {
  const maximum = Math.max(1, ...items.map(item => item.value));
  return <div className={`flex items-end gap-2 overflow-x-auto pb-1 ${compact ? "mt-5 h-36" : "mt-7 h-52"}`} role="img" aria-label="Gráfico de volume de envios por período, organização ou credor">{items.map(item => <div key={`${item.label}-${item.title}`} className={`flex flex-1 flex-col items-center justify-end gap-2 ${compact ? "min-w-20" : "min-w-8"}`}><span className="text-[10px] font-semibold text-slate-500">{integer.format(item.value)}</span><div className="w-full min-w-5 rounded-t-md bg-gradient-to-t from-[#0066CC] to-[#4DA3FF]" style={{ height: `${Math.max(6, item.value / maximum * (compact ? 85 : 150))}px` }} title={item.title} /><span className={`${compact ? "max-w-20" : "max-w-16"} truncate text-[10px] text-slate-500`} title={item.title}>{item.label}</span></div>)}</div>;
}
