import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { BarChart3, CheckCircle2, CircleDollarSign, Clock3, Send, TrendingUp, TriangleAlert } from "lucide-react";

const labels = { SMS: "SMS", EMAIL: "E-mail", WHATSAPP: "WhatsApp", RCS: "RCS" };
const integer = new Intl.NumberFormat("pt-BR");
const currency = (micros: number) => (micros / 1_000_000).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const organizationTypeLabel: Record<string, string> = { SPC_BRASIL: "SPC Brasil", CDL: "CDL", DISTRIBUTOR: "Distribuidora", CREDITOR: "Credor" };

export default function Dashboard() {
  const overview = trpc.dashboard.overview.useQuery(undefined, { refetchInterval: 30_000 });
  if (overview.isLoading) {
    return <div className="space-y-6"><Skeleton className="h-24" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-40" />)}</div><Skeleton className="h-80" /></div>;
  }
  if (overview.isError || !overview.data) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700"><TriangleAlert className="mb-3 size-6" /><p className="font-bold">Não foi possível carregar os indicadores.</p><p className="mt-1 text-sm">{overview.error?.message}</p></div>;
  }

  const data = overview.data;
  const cards = [
    { label: "Envios no período", value: integer.format(data.sent), detail: `${integer.format(data.campaignCount)} campanhas`, icon: Send, accent: "text-[#0066CC] bg-blue-50" },
    { label: "Entregas confirmadas", value: integer.format(data.delivered), detail: `${integer.format(data.failed)} falhas`, icon: CheckCircle2, accent: "text-[#00A86B] bg-emerald-50" },
    { label: "Taxa de entrega", value: `${data.deliveryRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`, detail: "sobre destinatários válidos", icon: TrendingUp, accent: "text-[#0066CC] bg-blue-50" },
    { label: "Valor processado", value: currency(data.processedMicros), detail: "últimos 30 dias", icon: CircleDollarSign, accent: "text-amber-600 bg-amber-50" },
  ];

  return <div className="space-y-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="flex items-center gap-3"><p className="text-sm font-bold uppercase tracking-[.14em] text-[#0066CC]">Visão executiva</p><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Atualização a cada 30 s</Badge></div><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#003B7A]">Dashboard operacional</h1><p className="mt-2 text-slate-600">Acompanhe desempenho, entrega e consumo dentro do seu escopo de acesso.</p></div>
      <div className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm text-slate-600"><Clock3 className="h-4 w-4" /> Desde {new Date(data.periodStart).toLocaleDateString("pt-BR")}</div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, detail, icon: Icon, accent }) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 text-3xl font-extrabold tracking-tight text-[#003B7A]">{value}</p></div><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}><Icon className="h-5 w-5" /></span></div><p className="mt-5 text-xs text-slate-400">{detail}</p></article>)}</div>

    <div className="grid gap-5 xl:grid-cols-[1.45fr_.55fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold text-[#003B7A]">Desempenho por canal</h2><p className="mt-1 text-sm text-slate-500">Destinatários válidos, entregues e com falha</p></div><BarChart3 className="h-5 w-5 text-[#0066CC]" /></div>{data.byChannel.length ? <div className="mt-7 space-y-5">{data.byChannel.map(item => { const rate = item.sent ? item.delivered / item.sent * 100 : 0; return <div key={item.channel}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-bold text-slate-800">{labels[item.channel]}</span><span className="text-slate-500">{integer.format(item.delivered)} de {integer.format(item.sent)} · {rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#0066CC] to-[#00A86B]" style={{ width: `${Math.min(100, rate)}%` }} /></div></div>; })}</div> : <EmptyChart />}</section>
      <section className="rounded-2xl bg-[#003B7A] p-6 text-white shadow-sm"><p className="text-sm font-semibold text-blue-100/70">Situação financeira</p><h2 className="mt-2 text-2xl font-extrabold">Saldo e consumo</h2><div className="mt-8 rounded-2xl border border-white/10 bg-white/[.07] p-5"><p className="text-xs uppercase tracking-[.14em] text-blue-100/60">{data.financial?.billingModel === "POSTPAID" ? "Consumo acumulado" : data.financial ? "Saldo disponível" : "Processado na plataforma"}</p><p className="mt-2 text-3xl font-extrabold text-[#FFD54A]">{data.financial ? (data.financial.balanceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : currency(data.processedMicros)}</p><p className="mt-3 text-sm leading-6 text-blue-100/65">{data.financial ? `Modelo ${data.financial.billingModel === "PREPAID" ? "pré-pago" : "pós-pago"}.` : "Consolidação de todas as organizações no período."}</p></div></section>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-[#003B7A]">Volume diário</h2><p className="mt-1 text-sm text-slate-500">Envios confirmados nos últimos 30 dias</p>{data.byDay.length ? <MiniBars items={data.byDay.slice(-14).map(item => ({ label: new Date(`${item.period}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), value: item.sent, title: `${item.period}: ${integer.format(item.sent)} envios` }))} /> : <EmptyChart />}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-[#003B7A]">Evolução mensal</h2><p className="mt-1 text-sm text-slate-500">Envios confirmados nos últimos 12 meses</p>{data.byMonth.length ? <MiniBars items={data.byMonth.map(item => ({ label: new Date(`${item.period}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }), value: item.sent, title: `${item.period}: ${integer.format(item.sent)} envios` }))} /> : <EmptyChart />}</section>
    </div>

    {data.byOrganization.length ? <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div><h2 className="font-bold text-[#003B7A]">Consolidado por organização</h2><p className="mt-1 text-sm text-slate-500">Gráficos e tabela de CDLs, Distribuidoras e Credores no escopo SPC Brasil</p></div>
      <div className="mt-6 grid gap-4 xl:grid-cols-3">{(["CDL", "DISTRIBUTOR", "CREDITOR"] as const).map(type => {
        const rows = data.byOrganization.filter(item => item.organizationType === type);
        return <article key={type} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-bold text-slate-800">{organizationTypeLabel[type]}</h3><p className="mt-1 text-xs text-slate-500">Volume confirmado por organização</p>{rows.length ? <MiniBars compact items={rows.slice(0, 8).map(item => ({ label: item.organizationName.slice(0, 10), value: item.sent, title: `${item.organizationName}: ${integer.format(item.sent)} envios` }))} /> : <p className="mt-8 rounded-lg border border-dashed p-5 text-center text-sm text-slate-500">Sem movimentação no período.</p>}</article>;
      })}</div>
      <div className="mt-7 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Organização</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3 text-right">Envios</th><th className="px-3 py-3 text-right">Entregues</th><th className="px-3 py-3 text-right">Valor</th></tr></thead><tbody>{data.byOrganization.map(item => <tr key={item.organizationId} className="border-b border-slate-100 last:border-0"><td className="px-3 py-4 font-semibold text-slate-800">{item.organizationName}</td><td className="px-3 py-4"><Badge variant="outline">{organizationTypeLabel[item.organizationType] ?? item.organizationType}</Badge></td><td className="px-3 py-4 text-right">{integer.format(item.sent)}</td><td className="px-3 py-4 text-right">{integer.format(item.delivered)}</td><td className="px-3 py-4 text-right font-semibold">{currency(item.processedMicros)}</td></tr>)}</tbody></table></div>
    </section> : null}
  </div>;
}

function EmptyChart() {
  return <div className="mt-8 flex min-h-52 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC]"><div className="max-w-xs text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#0066CC]"><BarChart3 /></span><p className="mt-4 font-semibold text-slate-700">Aguardando movimentação</p><p className="mt-2 text-sm leading-6 text-slate-500">Os indicadores serão preenchidos automaticamente a partir das campanhas e retornos dos brokers.</p></div></div>;
}

function MiniBars({ items, compact = false }: { items: Array<{ label: string; value: number; title: string }>; compact?: boolean }) {
  const maximum = Math.max(1, ...items.map(item => item.value));
  return <div className={`flex items-end gap-2 overflow-x-auto pb-1 ${compact ? "mt-5 h-36" : "mt-7 h-52"}`} role="img" aria-label="Gráfico de volume de envios por período ou organização">{items.map(item => <div key={`${item.label}-${item.title}`} className="flex min-w-8 flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] font-semibold text-slate-500">{integer.format(item.value)}</span><div className="w-full min-w-5 rounded-t-md bg-gradient-to-t from-[#0066CC] to-[#4DA3FF]" style={{ height: `${Math.max(6, item.value / maximum * (compact ? 85 : 150))}px` }} title={item.title} /><span className="max-w-16 truncate text-[10px] text-slate-500" title={item.title}>{item.label}</span></div>)}</div>;
}
