import { useState } from "react";
import { Braces, FileText, Mail, MessageSquareText, Plus, RadioTower } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { QueryErrorState } from "@/components/QueryErrorState";
import { trpc } from "@/lib/trpc";

type Channel = "SMS" | "EMAIL" | "WHATSAPP" | "RCS";
const channelIcon = { SMS: MessageSquareText, EMAIL: Mail, WHATSAPP: MessageSquareText, RCS: RadioTower };
const channelLabel = { SMS: "SMS", EMAIL: "E-mail", WHATSAPP: "WhatsApp", RCS: "RCS" };
const syntheticPreviewData: Record<string, string> = {
  nome: "Cliente Exemplo",
  primeiro_nome: "Cliente",
  credor: "Credor Demonstrativo",
  contrato: "000000",
  valor: "R$ 000,00",
  vencimento: "31/12/2099",
  link: "https://exemplo.invalid/negociar",
};

function renderSafePreview(value: string) {
  return value.replace(/{{\s*([A-Za-z_][A-Za-z0-9_.-]{0,49})\s*}}/g, (_token, variable: string) => syntheticPreviewData[variable.toLowerCase()] ?? `[${variable}: exemplo]`);
}

export default function Templates() {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", channel: "SMS" as Channel, subject: "", content: "", status: "DRAFT" as "DRAFT" | "ACTIVE" });
  const templates = trpc.commercial.templates.list.useQuery();
  const create = trpc.commercial.templates.create.useMutation({
    onSuccess: async () => { await utils.commercial.templates.list.invalidate(); setOpen(false); setForm({ name: "", channel: "SMS", subject: "", content: "", status: "DRAFT" }); toast.success("Template registrado na biblioteca homologada."); },
    onError: error => toast.error(error.message),
  });
  const update = trpc.commercial.templates.update.useMutation({
    onSuccess: async () => { await utils.commercial.templates.list.invalidate(); toast.success("Situação do template atualizada."); },
    onError: error => toast.error(error.message),
  });
  const variables = Array.from(new Set(Array.from(form.content.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g), match => match[1])));
  const previewSubject = renderSafePreview(form.subject || "Assunto demonstrativo");
  const previewContent = renderSafePreview(form.content || "A pré-visualização aparecerá aqui conforme o conteúdo for digitado.");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    create.mutate({ ...form, subject: form.channel === "EMAIL" ? form.subject : null });
  }

  return <div className="space-y-6">
    <section className="command-panel p-6 md:p-8"><div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end"><div><div className="eyebrow"><FileText className="size-4" /> Conteúdo homologado SPC</div><h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Templates</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Centralize mensagens versionadas para os quatro canais. Variáveis dinâmicas usam o formato <code className="rounded bg-blue-50 px-1.5 py-0.5 text-[#004a99]">{"{{nome}}"}</code>.</p></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="h-11 bg-[#0066cc] px-5 text-white hover:bg-[#004a99]"><Plus className="size-4" /> Novo template</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Novo template homologado</DialogTitle><DialogDescription>O servidor valida limites do canal e extrai as variáveis permitidas.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submit}><Field label="Nome"><Input required minLength={3} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Canal"><Select value={form.channel} onValueChange={value => setForm({ ...form, channel: value as Channel })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(channelLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field><Field label="Situação inicial"><Select value={form.status} onValueChange={value => setForm({ ...form, status: value as typeof form.status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DRAFT">Rascunho</SelectItem><SelectItem value="ACTIVE">Ativo</SelectItem></SelectContent></Select></Field></div>{form.channel === "EMAIL" && <Field label="Assunto do e-mail"><Input required value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} /></Field>}<Field label="Conteúdo"><Textarea required className="min-h-44 font-mono text-sm" value={form.content} onChange={event => setForm({ ...form, content: event.target.value })} placeholder="Olá {{nome}}, há uma oportunidade para regularizar seu contrato." /></Field><div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-sm text-[#004a99]"><span className="font-semibold">Variáveis detectadas:</span> {variables.length ? variables.map(item => `{{${item}}}`).join(", ") : "nenhuma"}</div><section className="rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label="Pré-visualização segura do template"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#004a99]">Pré-visualização segura</p><p className="mt-1 text-xs text-slate-500">Somente dados sintéticos; HTML não é executado.</p></div><Badge variant="secondary">Demonstração</Badge></div>{form.channel === "EMAIL" && <div className="mt-4 rounded-lg border bg-white px-3 py-2 text-sm"><span className="font-semibold text-slate-600">Assunto: </span>{previewSubject}</div>}<pre className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-white p-4 font-sans text-sm leading-6 text-slate-700 shadow-sm">{previewContent}</pre></section><div className="flex justify-end gap-3 border-t pt-4"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={create.isPending} className="bg-[#0066cc] text-white">{create.isPending ? "Validando…" : "Salvar template"}</Button></div></form></DialogContent></Dialog>
    </div></section>
    <section className="command-panel p-4 md:p-6"><div className="mb-5"><h2 className="font-bold text-slate-950">Biblioteca multicanal</h2><p className="text-sm text-slate-500">Somente templates ativos ficam disponíveis na criação de campanhas.</p></div>{templates.isLoading ? <Skeleton className="h-48 w-full" /> : templates.isError ? <QueryErrorState message={templates.error.message} onRetry={() => void templates.refetch()} /> : templates.data?.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Template</TableHead><TableHead>Canal</TableHead><TableHead>Variáveis</TableHead><TableHead>Versão</TableHead><TableHead className="text-right">Situação</TableHead></TableRow></TableHeader><TableBody>{templates.data.map(template => { const Icon = channelIcon[template.channel]; return <TableRow key={template.id}><TableCell><div className="font-semibold text-slate-900">{template.name}</div><div className="max-w-md truncate text-xs text-slate-500">{template.subject || template.content}</div></TableCell><TableCell><span className="inline-flex items-center gap-2"><Icon className="size-4 text-[#0066cc]" />{channelLabel[template.channel]}</span></TableCell><TableCell><div className="flex max-w-sm flex-wrap gap-1">{template.variables.length ? template.variables.map(variable => <Badge key={variable} variant="secondary"><Braces className="mr-1 size-3" />{variable}</Badge>) : <span className="text-sm text-slate-400">Sem variáveis</span>}</div></TableCell><TableCell>v{template.version}</TableCell><TableCell className="text-right"><Select value={template.status} onValueChange={status => update.mutate({ id: template.id, name: template.name, channel: template.channel, subject: template.subject, content: template.content, status: status as "DRAFT" | "ACTIVE" | "ARCHIVED" })}><SelectTrigger className="ml-auto w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DRAFT">Rascunho</SelectItem><SelectItem value="ACTIVE">Ativo</SelectItem><SelectItem value="ARCHIVED">Arquivado</SelectItem></SelectContent></Select></TableCell></TableRow>; })}</TableBody></Table></div> : <Empty icon={FileText} title="Nenhum template cadastrado" description="Crie o primeiro conteúdo homologado para iniciar campanhas." />}</section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Empty({ icon: Icon, title, description }: { icon: typeof FileText; title: string; description: string }) { return <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed bg-slate-50/70 p-8 text-center"><Icon className="size-10 text-[#0066cc]" /><h3 className="mt-4 font-bold text-slate-900">{title}</h3><p className="mt-1 text-sm text-slate-500">{description}</p></div>; }
