import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Megaphone,
  Pencil,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QueryErrorState } from "@/components/QueryErrorState";
import { campaignFormAfterOwnerChange, creditorsForCampaignOwner } from "@/lib/campaign-options";
import { trpc } from "@/lib/trpc";

type Channel = "SMS" | "EMAIL" | "WHATSAPP" | "RCS";
type ImportSummary = {
  id: string;
  status: "READY" | "FAILED";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  unitPriceMicros: number;
  totalAmountCents: number;
  errors: Array<{ rowNumber: number; errorCode: string; message: string | null }>;
  errorsTruncated: boolean;
};

const labels: Record<Channel, string> = {
  SMS: "SMS",
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  RCS: "RCS",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Rascunho",
  VALIDATING: "Validando",
  READY: "Pronta",
  SCHEDULED: "Agendada",
  QUEUED: "Na fila",
  PROCESSING: "Processando",
  COMPLETED: "Concluída",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
};

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Campaigns() {
  const utils = trpc.useUtils();
  const { data: identity } = trpc.auth.me.useQuery();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [processingStage, setProcessingStage] = useState(0);
  const [editingCampaign, setEditingCampaign] = useState<null | { id: string; status: string }>(null);
  const [campaignEditForm, setCampaignEditForm] = useState({ name: "", scheduledFor: "" });
  const [form, setForm] = useState({
    name: "",
    channel: "SMS" as Channel,
    organizationId: "",
    creditorOrganizationId: "",
    templateId: "",
    scheduledFor: "",
  });

  const campaigns = trpc.campaigns.list.useQuery();
  const templates = trpc.commercial.templates.available.useQuery({ channel: form.channel });
  const options = trpc.campaigns.options.useQuery(undefined, { refetchOnMount: "always" });
  const layout = trpc.campaigns.layout.useQuery({ channel: form.channel });
  const isSpc = identity?.user.role === "SPC_ADMIN";
  const ownerId = isSpc ? Number(form.organizationId) || undefined : identity?.user.organizationId;
  const owners = options.data?.owners ?? [];
  const creditors = useMemo(
    () => creditorsForCampaignOwner(owners, options.data?.creditors ?? [], String(ownerId ?? ""), isSpc),
    [creditorsForCampaignOwner, isSpc, options.data?.creditors, ownerId, owners],
  );

  const importCampaign = trpc.campaigns.import.useMutation({
    onSuccess: async result => {
      setProcessingStage(100);
      await utils.campaigns.list.invalidate();
      setSummary(result);
      setOpen(false);
      setProcessingStage(0);
      toast.success(
        result.validRows
          ? "Arquivo validado. Revise o resumo antes de confirmar."
          : "Importação concluída sem destinatários válidos.",
      );
    },
    onError: error => {
      setProcessingStage(0);
      toast.error(error.message);
    },
  });

  const confirmCampaignMutation = trpc.campaigns.confirm.useMutation({
    onSuccess: async result => {
      await utils.campaigns.list.invalidate();
      setSummary(null);
      toast.success(
        result.status === "SCHEDULED"
          ? "Campanha agendada com sucesso."
          : "Campanha confirmada e enviada para a fila.",
      );
    },
    onError: error => toast.error(error.message),
  });

  const updateCampaign = trpc.campaigns.update.useMutation({
    onSuccess: async () => {
      await utils.campaigns.list.invalidate();
      setEditingCampaign(null);
      toast.success("Campanha atualizada e alteração registrada na auditoria.");
    },
    onError: error => toast.error(error.message),
  });

  const deleteCampaign = trpc.campaigns.delete.useMutation({
    onSuccess: async () => {
      await utils.campaigns.list.invalidate();
      toast.success("Campanha deletada com sucesso. Você pode fazer upload novamente.");
    },
    onError: error => toast.error(error.message),
  });

  function startEditingCampaign(campaign: NonNullable<typeof campaigns.data>[number]) {
    setEditingCampaign({ id: campaign.id, status: campaign.status });
    setCampaignEditForm({
      name: campaign.name,
      scheduledFor: campaign.scheduledFor ? toLocalDateTimeInput(campaign.scheduledFor) : "",
    });
  }

  function submitCampaignEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingCampaign) return;
    updateCampaign.mutate({
      id: editingCampaign.id,
      data: {
        name: campaignEditForm.name,
        scheduledFor: campaignEditForm.scheduledFor ? new Date(campaignEditForm.scheduledFor) : null,
      },
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return toast.error("Selecione um arquivo CSV, XLSX ou TXT.");
    if (file.size > 8 * 1024 * 1024) return toast.error("O arquivo deve possuir até 8 MB.");
    if (isSpc && !form.organizationId) return toast.error("Selecione a organização responsável.");
    if (!form.creditorOrganizationId || !form.templateId) {
      return toast.error("Selecione credor e template.");
    }

    try {
      setProcessingStage(15);
      const buffer = await file.arrayBuffer();
      setProcessingStage(35);
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(index, index + 0x8000)),
        );
      }
      const mimeType = file.name.toLowerCase().endsWith(".xlsx")
        ? ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" as const)
        : ("text/csv" as const);
      setProcessingStage(60);
      importCampaign.mutate({
        organizationId: isSpc ? Number(form.organizationId) || undefined : undefined,
        creditorOrganizationId: Number(form.creditorOrganizationId),
        templateId: Number(form.templateId),
        name: form.name,
        channel: form.channel,
        filename: file.name,
        mimeType,
        base64: btoa(binary),
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor) : null,
        idempotencyKey: crypto.randomUUID(),
      });
    } catch {
      setProcessingStage(0);
      toast.error("Não foi possível ler o arquivo selecionado.");
    }
  }

  function downloadLayout() {
    const spec = layout.data;
    if (!spec) return;
    const blob = new Blob([`\uFEFF${spec.columns.join(spec.separator)}\r\n`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = spec.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="command-panel overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="eyebrow">
              <Megaphone className="size-4" /> Orquestração multicanal
            </div>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-950">Campanhas</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Importe destinatários, valide linha a linha, confira preço e saldo e só então
              confirme o envio ou agendamento.
            </p>
          </div>
          <Dialog
            open={open}
            onOpenChange={next => {
              setOpen(next);
              if (next) void options.refetch();
              if (!next && !importCampaign.isPending) setProcessingStage(0);
            }}
          >
            <DialogTrigger asChild>
              <Button className="h-11 bg-[#0066cc] px-5 text-white">
                <Plus className="size-4" /> Nova campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Preparar campanha</DialogTitle>
                <DialogDescription>
                  Nenhuma mensagem será enviada nesta etapa. A confirmação financeira ocorre
                  somente após a validação.
                </DialogDescription>
              </DialogHeader>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
                <Field label="Nome">
                  <Input
                    required
                    minLength={3}
                    value={form.name}
                    onChange={event => setForm({ ...form, name: event.target.value })}
                  />
                </Field>
                <Field label="Canal">
                  <Select
                    value={form.channel}
                    onValueChange={value =>
                      setForm({ ...form, channel: value as Channel, templateId: "" })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(labels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {isSpc && (
                  <Field label="Organização responsável">
                    <Select
                      value={form.organizationId}
                      onValueChange={value => setForm(current => campaignFormAfterOwnerChange(current, value))}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {owners.map(item => (
                          <SelectItem key={item.id} value={String(item.id)}>{item.tradeName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                <Field label="Credor">
                  <Select
                    value={form.creditorOrganizationId}
                    onValueChange={value => setForm({ ...form, creditorOrganizationId: value })}
                    disabled={!ownerId || options.isFetching}
                  >
                    <SelectTrigger><SelectValue placeholder={options.isFetching ? "Atualizando credores…" : "Selecione"} /></SelectTrigger>
                    <SelectContent>
                      {creditors.length
                        ? creditors.map(item => (
                            <SelectItem key={item.id} value={String(item.id)}>{item.tradeName}</SelectItem>
                          ))
                        : <SelectItem value="__no_creditors__" disabled>Nenhum credor ativo disponível</SelectItem>}
                    </SelectContent>
                  </Select>
                  {ownerId && !options.isFetching && !creditors.length
                    ? <p className="mt-1 text-xs text-amber-700">Nenhum credor ativo foi encontrado para a organização responsável.</p>
                    : null}
                </Field>
                <Field label="Template homologado">
                  <Select
                    value={form.templateId}
                    onValueChange={value => setForm({ ...form, templateId: value })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {templates.data?.map(item => (
                        <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Agendar para (opcional)">
                  <Input
                    type="datetime-local"
                    value={form.scheduledFor}
                    onChange={event => setForm({ ...form, scheduledFor: event.target.value })}
                  />
                </Field>
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Arquivo de destinatários</Label>
                    <Button type="button" size="sm" variant="ghost" onClick={downloadLayout}>
                      <Download className="size-4" /> Baixar modelo padrão
                    </Button>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs leading-5 text-slate-600">
                    <p className="font-semibold text-slate-800">
                      Baixe o modelo, preencha uma linha por cliente e envie o arquivo novamente sem alterar os nomes ou a ordem das colunas.
                    </p>
                    <ol className="mt-2 grid gap-x-4 sm:grid-cols-2" aria-label="Colunas obrigatórias do modelo padrão">
                      {layout.data?.columns.map((column, index) => (
                        <li key={column}><span className="font-semibold text-[#0066cc]">{index + 1}.</span> {column}</li>
                      ))}
                    </ol>
                  </div>
                  <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-5 text-center hover:bg-blue-50">
                    <Upload className="size-6 text-[#0066cc]" />
                    <span className="mt-2 font-semibold text-slate-900">
                      {file ? file.name : "Selecione CSV, XLSX ou TXT"}
                    </span>
                    <span className="text-xs text-slate-500">Mesmo layout para SMS, e-mail, WhatsApp e RCS · Até 8 MB e 20.000 linhas</span>
                    <input
                      className="hidden"
                      type="file"
                      accept=".csv,.xlsx,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={event => setFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
                {processingStage > 0 && (
                  <div className="space-y-2 sm:col-span-2" role="status" aria-live="polite">
                    <div className="flex justify-between text-xs font-semibold text-slate-600">
                      <span>
                        {processingStage < 35
                          ? "Lendo arquivo"
                          : processingStage < 60
                            ? "Preparando envio seguro"
                            : processingStage < 100
                              ? "Validando linhas e calculando preço"
                              : "Validação concluída"}
                      </span>
                      <span>{processingStage}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#0066cc] transition-[width] duration-200"
                        style={{ width: `${processingStage}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-3 border-t pt-4 sm:col-span-2">
                  <Button type="button" variant="outline" disabled={importCampaign.isPending} onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button disabled={importCampaign.isPending} className="bg-[#0066cc] text-white">
                    {importCampaign.isPending ? "Validando arquivo…" : "Validar e calcular"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <Dialog open={Boolean(editingCampaign)} onOpenChange={next => { if (!next) setEditingCampaign(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar campanha</DialogTitle>
            <DialogDescription>Somente nome e agendamento podem ser alterados antes do início do processamento. Canal, template, credor e destinatários permanecem imutáveis.</DialogDescription>
          </DialogHeader>
          {editingCampaign && <form className="space-y-4 pt-2" onSubmit={submitCampaignEdit}>
            <Field label="Nome"><Input required minLength={3} value={campaignEditForm.name} onChange={event => setCampaignEditForm({ ...campaignEditForm, name: event.target.value })} /></Field>
            <Field label="Agendar para (opcional)"><Input type="datetime-local" value={campaignEditForm.scheduledFor} onChange={event => setCampaignEditForm({ ...campaignEditForm, scheduledFor: event.target.value })} /></Field>
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm text-slate-600">Situação atual: <strong className="text-slate-900">{statusLabels[editingCampaign.status] ?? editingCampaign.status}</strong></div>
            <div className="flex justify-end gap-3 border-t pt-4"><Button type="button" variant="outline" onClick={() => setEditingCampaign(null)}>Cancelar</Button><Button disabled={updateCampaign.isPending} className="bg-[#0066cc] text-white">{updateCampaign.isPending ? "Salvando…" : "Salvar alterações"}</Button></div>
          </form>}
        </DialogContent>
      </Dialog>

      {summary && (
        <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-[#00a86b]" />
                <h2 className="font-bold text-slate-950">Resumo da validação</h2>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Summary label="Linhas" value={summary.totalRows} />
                <Summary label="Válidas" value={summary.validRows} />
                <Summary label="Inválidas" value={summary.invalidRows} warning={summary.invalidRows > 0} />
                <Summary label="Valor total" value={money(summary.totalAmountCents)} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                disabled={!summary.validRows || confirmCampaignMutation.isPending}
                onClick={() => confirmCampaignMutation.mutate({ id: summary.id, confirm: true })}
                className="bg-[#00a86b] text-white hover:bg-emerald-700"
              >
                <Send className="size-4" /> Confirmar campanha
              </Button>
              <span className="text-center text-xs text-slate-500">
                A confirmação debita saldo ou registra consumo.
              </span>
              {summary.invalidRows > 0 && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSummary(null);
                      setFile(null);
                      setProcessingStage(0);
                      setOpen(true);
                    }}
                    className="text-amber-600 hover:bg-amber-50"
                  >
                    Excluir arquivo e reenviar
                  </Button>
                  <span className="text-center text-xs text-slate-500">
                    Corrija os dados e envie um novo arquivo.
                  </span>
                </>
              )}
            </div>
          </div>
          {summary.errors.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-xl border border-amber-200">
              <div className="flex items-center gap-2 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                <TriangleAlert className="size-4" /> Linhas que exigem correção
                {summary.errorsTruncated && " (primeiras 500)"}
              </div>
              <div className="max-h-56 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Linha</TableHead><TableHead>Código</TableHead><TableHead>Motivo</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.errors.map(error => (
                      <TableRow key={`${error.rowNumber}-${error.errorCode}`}>
                        <TableCell className="font-mono">{error.rowNumber}</TableCell>
                        <TableCell className="font-mono text-xs">{error.errorCode}</TableCell>
                        <TableCell>{error.message || "Destino inválido."}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="command-panel p-4 md:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-[#0066cc]">
            <FileSpreadsheet className="size-5" />
          </span>
          <div>
            <h2 className="font-bold text-slate-950">Operação recente</h2>
            <p className="text-sm text-slate-500">Até 200 campanhas dentro do seu escopo organizacional.</p>
          </div>
        </div>
        {campaigns.isLoading ? (
          <Skeleton className="h-52 w-full" />
        ) : campaigns.isError ? (
          <QueryErrorState message={campaigns.error.message} onRetry={() => void campaigns.refetch()} />
        ) : campaigns.data?.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead><TableHead>Canal</TableHead><TableHead>Destinatários</TableHead>
                  <TableHead>Entrega</TableHead><TableHead>Valor</TableHead><TableHead>Agenda</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.data.map(campaign => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{campaign.name}</div>
                      <div className="text-xs text-slate-500">{new Date(campaign.createdAt).toLocaleString("pt-BR")}</div>
                    </TableCell>
                    <TableCell>{labels[campaign.channel]}</TableCell>
                    <TableCell>
                      <div className="font-semibold">{campaign.validRecipients.toLocaleString("pt-BR")}</div>
                      {campaign.invalidRecipients > 0 && <div className="text-xs text-amber-700">{campaign.invalidRecipients} inválidos</div>}
                    </TableCell>
                    <TableCell>{campaign.deliveredRecipients.toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{(campaign.totalCostMicros / 1_000_000).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                    <TableCell>
                      {campaign.scheduledFor ? (
                        <span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" />{new Date(campaign.scheduledFor).toLocaleString("pt-BR")}</span>
                      ) : "Imediata"}
                    </TableCell>
                    <TableCell>
                      <Badge className={campaign.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : campaign.status === "FAILED" ? "bg-red-50 text-red-700" : "bg-blue-50 text-[#004a99]"}>
                        {statusLabels[campaign.status] ?? campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {identity?.user.role !== "REQUESTER" && ["DRAFT", "READY", "SCHEDULED", "FAILED"].includes(campaign.status) ? (
                        <div className="flex gap-2 justify-end">
                          <Button type="button" size="icon" variant="outline" className="bg-white" aria-label={`Editar ${campaign.name}`} onClick={() => startEditingCampaign(campaign)}><Pencil className="size-4" /></Button>
                          <Button type="button" size="icon" variant="outline" className="bg-white text-red-600 hover:bg-red-50" aria-label={`Deletar ${campaign.name}`} disabled={deleteCampaign.isPending} onClick={() => {
                            if (confirm(`Tem certeza que deseja deletar "${campaign.name}"? Você poderá fazer upload novamente.`)) {
                              deleteCampaign.mutate({ id: campaign.id });
                            }
                          }}><Trash2 className="size-4" /></Button>
                        </div>
                      ) : <span className="text-xs text-slate-400">Bloqueada após início</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed bg-slate-50 p-8 text-center">
            <TriangleAlert className="size-10 text-[#0066cc]" />
            <h3 className="mt-4 font-bold text-slate-900">Nenhuma campanha encontrada</h3>
            <p className="mt-1 text-sm text-slate-500">Comece baixando o modelo de importação do canal desejado.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function Summary({ label, value, warning }: { label: string; value: string | number; warning?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${warning ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-extrabold text-slate-950">{value}</div>
    </div>
  );
}

function toLocalDateTimeInput(value: Date | string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
