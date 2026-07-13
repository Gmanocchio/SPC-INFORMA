import { useState } from "react";
import { CheckCircle2, CircleOff, KeyRound, Pencil, Plus, RadioTower, ShieldCheck, Star, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";

type Channel = "SMS" | "EMAIL" | "WHATSAPP" | "RCS";
type BrokerRow = {
  id: number;
  name: string;
  channel: Channel;
  endpointUrl: string;
  active: boolean;
  preferred: boolean;
  credentialFields: string[];
  extraConfig: Record<string, string | number | boolean | null>;
};

const channels: Channel[] = ["SMS", "EMAIL", "WHATSAPP", "RCS"];
const channelLabel: Record<Channel, string> = { SMS: "SMS", EMAIL: "E-mail", WHATSAPP: "WhatsApp", RCS: "RCS" };
const emptyForm = { name: "", channel: "SMS" as Channel, endpointUrl: "", apiKey: "", username: "", password: "", webhookSecret: "", sendPath: "", signatureHeader: "x-spc-signature", timeoutMs: "10000", active: true, preferred: false };

export default function Brokers() {
  const utils = trpc.useUtils();
  const list = trpc.brokers.list.useQuery();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const create = trpc.brokers.create.useMutation({ onSuccess: async () => { await utils.brokers.list.invalidate(); closeDialog(); toast.success("Broker cadastrado com credenciais protegidas."); }, onError: error => toast.error(error.message) });
  const update = trpc.brokers.update.useMutation({ onSuccess: async () => { await utils.brokers.list.invalidate(); closeDialog(); toast.success("Configuração do broker atualizada."); }, onError: error => toast.error(error.message) });
  const deactivate = trpc.brokers.deactivate.useMutation({ onSuccess: async () => { await utils.brokers.list.invalidate(); toast.success("Broker desativado e removido da seleção automática."); }, onError: error => toast.error(error.message) });

  function closeDialog() {
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function edit(row: BrokerRow) {
    setEditingId(row.id);
    setForm({
      ...emptyForm,
      name: row.name,
      channel: row.channel,
      endpointUrl: row.endpointUrl,
      sendPath: typeof row.extraConfig.sendPath === "string" ? row.extraConfig.sendPath : "",
      signatureHeader: typeof row.extraConfig.signatureHeader === "string" ? row.extraConfig.signatureHeader : "x-spc-signature",
      timeoutMs: String(row.extraConfig.timeoutMs ?? "10000"),
      active: row.active,
      preferred: row.preferred,
    });
    setOpen(true);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const credentials = Object.fromEntries(Object.entries({ apiKey: form.apiKey, username: form.username, password: form.password, webhookSecret: form.webhookSecret }).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()]));
    const data = {
      name: form.name,
      channel: form.channel,
      endpointUrl: form.endpointUrl,
      active: form.active,
      preferred: form.preferred,
      extraConfig: { sendPath: form.sendPath.trim(), signatureHeader: form.signatureHeader.trim() || "x-spc-signature", timeoutMs: Math.min(30000, Math.max(1000, Number(form.timeoutMs) || 10000)) },
    };
    if (editingId) update.mutate({ id: editingId, data: { ...data, ...(Object.keys(credentials).length ? { credentials } : {}) } });
    else create.mutate({ ...data, credentials });
  }

  const pending = create.isPending || update.isPending;
  const activeCount = list.data?.filter(item => item.active).length ?? 0;
  const preferredCount = list.data?.filter(item => item.preferred && item.active).length ?? 0;

  return <div className="space-y-6">
    <section className="command-panel overflow-hidden p-6 md:p-8">
      <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><div className="eyebrow"><RadioTower className="size-4" /> Roteamento multicanal</div><h1 className="mt-3 text-3xl font-extrabold text-slate-950">Brokers</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Centralize endpoints, autenticação protegida e preferência por canal. Somente o Administrador SPC Brasil pode consultar ou alterar estas configurações.</p></div>
        <Dialog open={open} onOpenChange={value => value ? setOpen(true) : closeDialog()}><DialogTrigger asChild><Button onClick={() => { setEditingId(null); setForm(emptyForm); }} className="h-11 bg-[#0066cc] px-5 text-white"><Plus className="size-4" /> Novo broker</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editingId ? "Editar broker" : "Cadastrar broker"}</DialogTitle><DialogDescription>Segredos são cifrados antes da persistência e nunca retornam para esta tela. Ao editar, deixe credenciais em branco para preservá-las.</DialogDescription></DialogHeader><form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Nome do provedor"><Input required minLength={2} maxLength={160} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Provedor transacional" /></Field><Field label="Canal"><Select value={form.channel} onValueChange={value => setForm({ ...form, channel: value as Channel })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{channels.map(channel => <SelectItem key={channel} value={channel}>{channelLabel[channel]}</SelectItem>)}</SelectContent></Select></Field></div>
          <Field label="Endpoint HTTPS"><Input required type="url" value={form.endpointUrl} onChange={event => setForm({ ...form, endpointUrl: event.target.value })} placeholder="https://api.provedor.com/" /></Field>
          <div className="rounded-2xl bg-slate-50 p-4"><div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900"><KeyRound className="size-4 text-[#0066cc]" /> Credenciais protegidas</div><div className="grid gap-4 sm:grid-cols-2"><Field label="API key / token"><Input type="password" autoComplete="new-password" value={form.apiKey} onChange={event => setForm({ ...form, apiKey: event.target.value })} placeholder={editingId ? "Manter atual" : "Token do provedor"} /></Field><Field label="Segredo do webhook (HMAC)"><Input type="password" autoComplete="new-password" value={form.webhookSecret} onChange={event => setForm({ ...form, webhookSecret: event.target.value })} placeholder={editingId ? "Manter atual" : "Segredo compartilhado"} /></Field><Field label="Usuário (opcional)"><Input autoComplete="off" value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} /></Field><Field label="Senha (opcional)"><Input type="password" autoComplete="new-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></Field></div></div>
          <div className="grid gap-4 sm:grid-cols-3"><Field label="Rota de envio"><Input value={form.sendPath} onChange={event => setForm({ ...form, sendPath: event.target.value })} placeholder="v1/messages" /></Field><Field label="Header da assinatura"><Input value={form.signatureHeader} onChange={event => setForm({ ...form, signatureHeader: event.target.value })} /></Field><Field label="Timeout (ms)"><Input type="number" min={1000} max={30000} value={form.timeoutMs} onChange={event => setForm({ ...form, timeoutMs: event.target.value })} /></Field></div>
          <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2"><Toggle label="Broker ativo" description="Pode receber novos disparos." checked={form.active} onCheckedChange={active => setForm({ ...form, active })} /><Toggle label="Preferencial no canal" description="Substitui o preferencial atual." checked={form.preferred} onCheckedChange={preferred => setForm({ ...form, preferred })} /></div>
          <div className="flex justify-end gap-3 border-t pt-4"><Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button><Button disabled={pending || (!editingId && !form.apiKey.trim() && !form.webhookSecret.trim() && !(form.username.trim() && form.password.trim()))} className="bg-[#0066cc] text-white">{pending ? "Salvando…" : editingId ? "Salvar alterações" : "Cadastrar broker"}</Button></div>
        </form></DialogContent></Dialog>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-3"><Metric icon={ShieldCheck} label="Brokers ativos" value={activeCount} /><Metric icon={Star} label="Preferenciais ativos" value={preferredCount} /><Metric icon={Webhook} label="Callback" value="HMAC SHA-256" /></div>
    </section>

    <section className="command-panel p-4 md:p-6"><div className="mb-5"><h2 className="font-bold text-slate-950">Provedores configurados</h2><p className="mt-1 text-sm text-slate-500">A lista mostra apenas os nomes dos campos secretos, nunca seus valores.</p></div>
      {list.isLoading ? <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div> : list.isError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{list.error.message}</div> : list.data?.length ? <div className="grid gap-4 lg:grid-cols-2">{list.data.map(row => <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-transform duration-200 hover:-translate-y-0.5"><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${row.active ? "bg-blue-50 text-[#0066cc]" : "bg-slate-100 text-slate-500"}`}><RadioTower className="size-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-bold text-slate-950">{row.name}</h3>{row.preferred && <Badge className="bg-amber-50 text-amber-700"><Star className="mr-1 size-3" /> Preferencial</Badge>}</div><p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{channelLabel[row.channel]}</p></div></div><Badge className={row.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}>{row.active ? <CheckCircle2 className="mr-1 size-3" /> : <CircleOff className="mr-1 size-3" />}{row.active ? "Ativo" : "Inativo"}</Badge></div>
          <div className="mt-5 space-y-3 text-sm"><div><span className="text-xs font-bold uppercase tracking-wider text-slate-400">Endpoint</span><p className="mt-1 break-all font-medium text-slate-700">{row.endpointUrl}</p></div><div><span className="text-xs font-bold uppercase tracking-wider text-slate-400">Campos protegidos</span><div className="mt-2 flex flex-wrap gap-2">{row.credentialFields.map(field => <Badge key={field} variant="outline"><KeyRound className="mr-1 size-3" /> {field}</Badge>)}</div></div></div>
          <div className="mt-5 flex justify-end gap-2 border-t pt-4"><Button variant="outline" size="sm" onClick={() => edit(row)}><Pencil className="size-4" /> Editar</Button>{row.active && <Button variant="outline" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" disabled={deactivate.isPending} onClick={() => { if (window.confirm(`Desativar ${row.name}? Campanhas futuras não usarão este broker.`)) deactivate.mutate({ id: row.id }); }}><Trash2 className="size-4" /> Desativar</Button>}</div>
        </article>)}</div> : <div className="rounded-2xl border border-dashed bg-slate-50 p-10 text-center"><RadioTower className="mx-auto size-8 text-slate-400" /><h3 className="mt-3 font-bold text-slate-900">Nenhum broker cadastrado</h3><p className="mt-1 text-sm text-slate-500">Cadastre o primeiro provedor para habilitar o roteamento de campanhas.</p></div>}
    </section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Toggle({ label, description, checked, onCheckedChange }: { label: string; description: string; checked: boolean; onCheckedChange: (value: boolean) => void }) { return <div className="flex items-center justify-between gap-4"><div><Label>{label}</Label><p className="mt-1 text-xs text-slate-500">{description}</p></div><Switch checked={checked} onCheckedChange={onCheckedChange} /></div>; }
function Metric({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string | number }) { return <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><Icon className="size-4 text-[#0066cc]" /> {label}</div><p className="mt-2 text-xl font-extrabold text-slate-950">{value}</p></div>; }
