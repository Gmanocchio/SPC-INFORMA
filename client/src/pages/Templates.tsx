import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Braces, FileText, Mail, MessageSquareText, Pencil, Plus, RadioTower } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { QueryErrorState } from "@/components/QueryErrorState";
import { trpc } from "@/lib/trpc";
import {
  extractTemplateVariables,
  findUnsupportedTemplateVariables,
  insertTemplateVariableAtSelection,
  TEMPLATE_VARIABLES,
  templateVariableToken,
  type TemplateVariableKey,
} from "@shared/template-variables";

type Channel = "SMS" | "EMAIL" | "WHATSAPP" | "RCS";

const channelIcon = { SMS: MessageSquareText, EMAIL: Mail, WHATSAPP: MessageSquareText, RCS: RadioTower };
const channelLabel = { SMS: "SMS", EMAIL: "E-mail", WHATSAPP: "WhatsApp", RCS: "RCS" };
const syntheticPreviewData: Record<string, string> = Object.fromEntries(
  TEMPLATE_VARIABLES.map(variable => [variable.key, variable.preview]),
);

function renderSafePreview(value: string) {
  return value.replace(/{{\s*([A-Za-z_][A-Za-z0-9_.-]{0,49})\s*}}/g, (_token, variable: string) => syntheticPreviewData[variable.toLowerCase()] ?? `[${variable}: exemplo]`);
}

export default function Templates() {
  const utils = trpc.useUtils();
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [variablePickerOpen, setVariablePickerOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    channel: "SMS" as Channel,
    subject: "",
    content: "",
    status: "DRAFT" as "DRAFT" | "ACTIVE",
  });
  const templates = trpc.commercial.templates.list.useQuery();
  const create = trpc.commercial.templates.create.useMutation({
    onSuccess: async () => {
      await utils.commercial.templates.list.invalidate();
      setOpen(false);
      setForm({ name: "", channel: "SMS", subject: "", content: "", status: "DRAFT" });
      toast.success("Template registrado na biblioteca homologada.");
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.commercial.templates.update.useMutation({
    onSuccess: async () => {
      await utils.commercial.templates.list.invalidate();
      setOpen(false);
      setEditingTemplateId(null);
      toast.success("Template atualizado e nova versão registrada na auditoria.");
    },
    onError: error => toast.error(error.message),
  });
  const variables = extractTemplateVariables(form.subject, form.content);
  const unsupportedVariables = findUnsupportedTemplateVariables(form.subject, form.content);
  const previewSubject = renderSafePreview(form.subject || "Assunto demonstrativo");
  const previewContent = renderSafePreview(form.content || "A pré-visualização aparecerá aqui conforme o conteúdo for digitado.");
  const destinationColumn = "CPF";

  function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { ...form, subject: form.channel === "EMAIL" ? form.subject : null };
    if (editingTemplateId) update.mutate({ id: editingTemplateId, ...payload });
    else create.mutate(payload);
  }

  function resetForm() {
    setForm({ name: "", channel: "SMS", subject: "", content: "", status: "DRAFT" });
  }

  function startEditingTemplate(template: NonNullable<typeof templates.data>[number]) {
    setEditingTemplateId(template.id);
    setForm({
      name: template.name,
      channel: template.channel,
      subject: template.subject ?? "",
      content: template.content,
      status: template.status === "ARCHIVED" ? "DRAFT" : template.status,
    });
    setOpen(true);
  }

  function insertVariable(key: TemplateVariableKey) {
    const textarea = contentRef.current;
    const insertion = insertTemplateVariableAtSelection(
      textarea?.value ?? form.content,
      key,
      textarea?.selectionStart,
      textarea?.selectionEnd,
    );
    setForm(current => ({ ...current, content: insertion.value }));
    setVariablePickerOpen(false);
    window.requestAnimationFrame(() => {
      contentRef.current?.focus();
      contentRef.current?.setSelectionRange(insertion.selectionStart, insertion.selectionEnd);
    });
  }

  return (
    <div className="space-y-6">
      <section className="command-panel p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="eyebrow"><FileText className="size-4" /> Conteúdo homologado SPC</div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Templates</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Centralize mensagens versionadas para os quatro canais. Variáveis dinâmicas usam o formato <code className="rounded bg-blue-50 px-1.5 py-0.5 text-[#004a99]">{"{{nome_cliente}}"}</code>.
            </p>
          </div>

          <Dialog open={open} onOpenChange={next => { setOpen(next); if (!next) setEditingTemplateId(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingTemplateId(null); resetForm(); }} className="h-11 bg-[#0066cc] px-5 text-white hover:bg-[#004a99]"><Plus className="size-4" /> Novo template</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingTemplateId ? "Editar template homologado" : "Novo template homologado"}</DialogTitle>
                <DialogDescription>{editingTemplateId ? "A alteração cria uma nova versão. Campanhas já vinculadas mantêm a mensagem da versão anterior." : "Selecione variáveis compatíveis com as colunas da planilha e acompanhe a pré-visualização."}</DialogDescription>
              </DialogHeader>

              <form className="space-y-4" onSubmit={submit}>
                <Field label="Nome">
                  <Input required minLength={3} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Canal">
                    <Select value={form.channel} onValueChange={value => setForm({ ...form, channel: value as Channel })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(channelLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Situação inicial">
                    <Select value={form.status} onValueChange={value => setForm({ ...form, status: value as typeof form.status })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="DRAFT">Rascunho</SelectItem><SelectItem value="ACTIVE">Ativo</SelectItem></SelectContent>
                    </Select>
                  </Field>
                </div>

                {form.channel === "EMAIL" && (
                  <Field label="Assunto do e-mail">
                    <Input required value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} />
                  </Field>
                )}

                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <Label htmlFor="template-content">Conteúdo</Label>
                      <p className="mt-1 text-xs text-slate-500">Posicione o cursor na mensagem e selecione uma variável da planilha.</p>
                    </div>
                    <Popover open={variablePickerOpen} onOpenChange={setVariablePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" size="sm" variant="outline" className="w-full shrink-0 bg-white text-[#004a99] sm:w-auto" aria-label="Inserir variável da planilha no conteúdo">
                          <Braces className="size-4" /> Inserir variável
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className="z-[70] flex max-h-[min(32rem,var(--radix-popover-content-available-height))] w-[min(22rem,calc(100vw-2rem))] flex-col p-2"
                      >
                        <div className="shrink-0 px-2 pb-2 pt-1">
                          <p className="text-sm font-bold text-slate-950">Variáveis da planilha</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">A variável será inserida na posição atual do cursor. Role a lista para ver todas as opções.</p>
                        </div>
                        <div
                          className="variable-picker-scrollbar grid min-h-0 flex-1 gap-1 overflow-y-scroll overscroll-contain pr-1 [scrollbar-gutter:stable]"
                          aria-label="Variáveis disponíveis"
                          tabIndex={0}
                        >
                          {TEMPLATE_VARIABLES.map(variable => (
                            <button
                              key={variable.key}
                              type="button"
                              className="rounded-lg px-3 py-2 text-left transition-colors duration-150 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]"
                              onClick={() => insertVariable(variable.key)}
                            >
                              <span className="flex items-center justify-between gap-3">
                                <span className="font-semibold text-slate-900">{variable.label}</span>
                                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-[#004a99]">{templateVariableToken(variable.key)}</code>
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-slate-500">{variable.description}</span>
                            </button>
                          ))}
                        </div>
                        <p className="mx-2 mt-2 shrink-0 border-t pt-3 text-xs leading-5 text-slate-500">
                          A coluna <code className="font-semibold text-slate-700">{destinationColumn}</code> identifica o destinatário em todos os canais e também pode ser usada na mensagem como <code className="font-semibold text-slate-700">{"{{cpf}}"}</code>.
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Textarea
                    id="template-content"
                    ref={contentRef}
                    required
                    className="min-h-44 font-mono text-sm"
                    value={form.content}
                    onChange={event => setForm({ ...form, content: event.target.value })}
                    placeholder="Olá {{nome_cliente}}, o valor de {{valor}} com {{nome_credor}} vence em {{data_vencimento}}. Acesse: {{link}}"
                  />
                </div>

                <div className={`rounded-xl border p-3 text-sm ${unsupportedVariables.length ? "border-red-200 bg-red-50 text-red-800" : "border-blue-100 bg-blue-50/70 text-[#004a99]"}`}>
                  <span className="font-semibold">Variáveis detectadas:</span> {variables.length ? variables.map(item => `{{${item}}}`).join(", ") : "nenhuma"}
                  {unsupportedVariables.length > 0 && <p className="mt-1 text-xs">Remova as variáveis não disponíveis ou substitua-as pelo botão “Inserir variável”.</p>}
                </div>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label="Pré-visualização segura do template">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#004a99]">Pré-visualização segura</p>
                      <p className="mt-1 text-xs text-slate-500">Somente dados sintéticos; HTML não é executado.</p>
                    </div>
                    <Badge variant="secondary">Demonstração</Badge>
                  </div>
                  {form.channel === "EMAIL" && <div className="mt-4 rounded-lg border bg-white px-3 py-2 text-sm"><span className="font-semibold text-slate-600">Assunto: </span>{previewSubject}</div>}
                  <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-white p-4 font-sans text-sm leading-6 text-slate-700 shadow-sm">{previewContent}</pre>
                </section>

                <div className="flex justify-end gap-3 border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button disabled={create.isPending || update.isPending || unsupportedVariables.length > 0} className="bg-[#0066cc] text-white">
                    {create.isPending || update.isPending ? "Validando…" : editingTemplateId ? "Salvar nova versão" : "Salvar template"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="command-panel p-4 md:p-6">
        <div className="mb-5"><h2 className="font-bold text-slate-950">Biblioteca multicanal</h2><p className="text-sm text-slate-500">Somente templates ativos ficam disponíveis na criação de campanhas.</p></div>
        {templates.isLoading ? <Skeleton className="h-48 w-full" /> : templates.isError ? <QueryErrorState message={templates.error.message} onRetry={() => void templates.refetch()} /> : templates.data?.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Template</TableHead><TableHead>Canal</TableHead><TableHead>Variáveis</TableHead><TableHead>Versão</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>{templates.data.map(template => {
                const Icon = channelIcon[template.channel];
                return (
                  <TableRow key={template.id}>
                    <TableCell><div className="font-semibold text-slate-900">{template.name}</div><div className="max-w-md truncate text-xs text-slate-500">{template.subject || template.content}</div></TableCell>
                    <TableCell><span className="inline-flex items-center gap-2"><Icon className="size-4 text-[#0066cc]" />{channelLabel[template.channel]}</span></TableCell>
                    <TableCell><div className="flex max-w-sm flex-wrap gap-1">{template.variables.length ? template.variables.map(variable => <Badge key={variable} variant="secondary"><Braces className="mr-1 size-3" />{variable}</Badge>) : <span className="text-sm text-slate-400">Sem variáveis</span>}</div></TableCell>
                    <TableCell>v{template.version}</TableCell>
                    <TableCell>
                      <Select value={template.status} onValueChange={status => update.mutate({ id: template.id, name: template.name, channel: template.channel, subject: template.subject, content: template.content, status: status as "DRAFT" | "ACTIVE" | "ARCHIVED" })}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="DRAFT">Rascunho</SelectItem><SelectItem value="ACTIVE">Ativo</SelectItem><SelectItem value="ARCHIVED">Arquivado</SelectItem></SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right"><Button type="button" size="icon" variant="outline" className="bg-white" aria-label={`Editar ${template.name}`} onClick={() => startEditingTemplate(template)}><Pencil className="size-4" /></Button></TableCell>
                  </TableRow>
                );
              })}</TableBody>
            </Table>
          </div>
        ) : <Empty icon={FileText} title="Nenhum template cadastrado" description="Crie o primeiro conteúdo homologado para iniciar campanhas." />}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function Empty({ icon: Icon, title, description }: { icon: typeof FileText; title: string; description: string }) {
  return <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed bg-slate-50/70 p-8 text-center"><Icon className="size-10 text-[#0066cc]" /><h3 className="mt-4 font-bold text-slate-900">{title}</h3><p className="mt-1 text-sm text-slate-500">{description}</p></div>;
}
