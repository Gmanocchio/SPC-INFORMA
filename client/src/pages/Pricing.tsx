import { useState } from "react";
import { BadgeDollarSign, Building2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QueryErrorState } from "@/components/QueryErrorState";
import { trpc } from "@/lib/trpc";

type Channel = "SMS" | "EMAIL" | "WHATSAPP" | "RCS";
const channels: Channel[] = ["SMS", "EMAIL", "WHATSAPP", "RCS"];
const labels = { SMS: "SMS", EMAIL: "E-mail", WHATSAPP: "WhatsApp", RCS: "RCS" };
const micros = (value: string) => Math.max(0, Math.round(Number(value.replace(",", ".")) * 1_000_000));
const reais = (value: number) => (value / 1_000_000).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4 });

export default function Pricing() {
  const utils = trpc.useUtils();
  const { data: identity } = trpc.auth.me.useQuery();
  const rules = trpc.commercial.pricing.list.useQuery();
  const organizations = trpc.admin.organizations.list.useQuery({});
  const isSpc = identity?.user.role === "SPC_ADMIN";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ mode: "CREDITOR" as "BASE" | "CREDITOR", organizationId: "", creditorOrganizationId: "", channel: "SMS" as Channel, price: "", validFrom: new Date().toISOString().slice(0, 16) });
  const base = trpc.commercial.pricing.setBase.useMutation({ onSuccess: async () => { await utils.commercial.pricing.list.invalidate(); setOpen(false); toast.success("Novo preço-base vigente registrado."); }, onError: error => toast.error(error.message) });
  const creditor = trpc.commercial.pricing.setCreditor.useMutation({ onSuccess: async () => { await utils.commercial.pricing.list.invalidate(); setOpen(false); toast.success("Preço do credor registrado com histórico."); }, onError: error => toast.error(error.message) });
  const owners = organizations.data?.filter(item => ["CDL", "DISTRIBUTOR", "SPC_BRASIL"].includes(item.type)) ?? [];
  const creditors = organizations.data?.filter(item => item.type === "CREDITOR" && (!form.organizationId || item.parentOrganizationId === Number(form.organizationId))) ?? [];

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const common = { channel: form.channel, unitPriceMicros: micros(form.price), validFrom: new Date(form.validFrom) };
    if (form.mode === "BASE") base.mutate(common);
    else creditor.mutate({ ...common, organizationId: isSpc ? Number(form.organizationId) : undefined, creditorOrganizationId: Number(form.creditorOrganizationId) });
  }

  return <div className="space-y-6"><section className="command-panel p-6 md:p-8"><div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end"><div><div className="eyebrow"><BadgeDollarSign className="size-4" /> Governança financeira</div><h1 className="mt-3 text-3xl font-extrabold text-slate-950">Precificação</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Mantenha preços-base SPC visíveis e valores específicos por credor, canal e organização, sempre com vigência histórica.</p></div><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="h-11 bg-[#0066cc] px-5 text-white"><Plus className="size-4" /> Novo preço</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Registrar nova vigência</DialogTitle><DialogDescription>A regra anterior é encerrada automaticamente na data informada.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submit}>{isSpc && <Field label="Tipo de preço"><Select value={form.mode} onValueChange={value => setForm({ ...form, mode: value as typeof form.mode })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BASE">Preço-base SPC</SelectItem><SelectItem value="CREDITOR">Preço do credor</SelectItem></SelectContent></Select></Field>}{form.mode === "CREDITOR" && isSpc && <Field label="CDL / Distribuidora responsável"><Select value={form.organizationId} onValueChange={value => setForm({ ...form, organizationId: value, creditorOrganizationId: "" })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{owners.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.tradeName}</SelectItem>)}</SelectContent></Select></Field>}{form.mode === "CREDITOR" && <Field label="Credor"><Select value={form.creditorOrganizationId} onValueChange={value => setForm({ ...form, creditorOrganizationId: value })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{creditors.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.tradeName}</SelectItem>)}</SelectContent></Select></Field>}<div className="grid gap-4 sm:grid-cols-2"><Field label="Canal"><Select value={form.channel} onValueChange={value => setForm({ ...form, channel: value as Channel })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{channels.map(item => <SelectItem key={item} value={item}>{labels[item]}</SelectItem>)}</SelectContent></Select></Field><Field label="Preço unitário (R$)"><Input required inputMode="decimal" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} placeholder="0,0850" /></Field></div><Field label="Início da vigência"><Input required type="datetime-local" value={form.validFrom} onChange={event => setForm({ ...form, validFrom: event.target.value })} /></Field><div className="flex justify-end gap-3 border-t pt-4"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={base.isPending || creditor.isPending} className="bg-[#0066cc] text-white">Registrar preço</Button></div></form></DialogContent></Dialog></div></section>
    <section className="command-panel p-4 md:p-6"><div className="mb-5 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-[#0066cc]"><ShieldCheck className="size-5" /></span><div><h2 className="font-bold text-slate-950">Histórico e vigências</h2><p className="text-sm text-slate-500">Valores monetários são mantidos como inteiros de alta precisão.</p></div></div>{rules.isLoading ? <Skeleton className="h-48 w-full" /> : rules.isError ? <QueryErrorState message={rules.error.message} onRetry={() => void rules.refetch()} /> : rules.data?.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Escopo</TableHead><TableHead>Canal</TableHead><TableHead>Preço unitário</TableHead><TableHead>Início</TableHead><TableHead>Fim</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader><TableBody>{rules.data.map(rule => <TableRow key={rule.id}><TableCell><span className="inline-flex items-center gap-2"><Building2 className="size-4 text-[#0066cc]" />{rule.priceType === "SPC_BASE" ? "Base SPC Brasil" : `Credor #${rule.creditorOrganizationId}`}</span></TableCell><TableCell>{labels[rule.channel]}</TableCell><TableCell className="font-bold text-slate-900">{reais(rule.unitPriceMicros)}</TableCell><TableCell>{new Date(rule.validFrom).toLocaleString("pt-BR")}</TableCell><TableCell>{rule.validUntil ? new Date(rule.validUntil).toLocaleString("pt-BR") : "Sem término"}</TableCell><TableCell><Badge className={rule.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}>{rule.active ? "Vigente" : "Encerrado"}</Badge></TableCell></TableRow>)}</TableBody></Table></div> : <div className="rounded-2xl border border-dashed bg-slate-50 p-10 text-center text-sm text-slate-500">Nenhuma regra de preço foi registrada.</div>}</section>
  </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
