import { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  Clock3,
  Mail,
  MessageCircle,
  Pencil,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QueryErrorState } from "@/components/QueryErrorState";
import { trpc } from "@/lib/trpc";
import {
  buildPricingMatrixRows,
  findCellRules,
  PRICING_CHANNEL_LABELS,
  PRICING_CHANNELS,
  type PricingChannel,
  type PricingMatrixRow,
  type PricingOrganization,
  type PricingRule,
} from "./pricing-matrix";

const channelIcons = {
  EMAIL: Mail,
  SMS: Smartphone,
  WHATSAPP: MessageCircle,
  RCS: MessageCircle,
} satisfies Record<PricingChannel, typeof Mail>;

const micros = (value: string) => Math.max(0, Math.round(Number(value.replace(",", ".")) * 1_000_000));
const reais = (value: number) => (value / 1_000_000).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 4,
});

const nowLocal = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

type SelectedCell = {
  row: PricingMatrixRow;
  channel: PricingChannel;
  activeRule: PricingRule | null;
  latestRule: PricingRule | null;
};

export default function Pricing() {
  const utils = trpc.useUtils();
  const { data: identity, isLoading: identityLoading, isError: identityIsError, error: identityError } = trpc.auth.me.useQuery();
  const rules = trpc.commercial.pricing.list.useQuery();
  const organizations = trpc.commercial.pricing.organizations.useQuery();
  const isSpc = identity?.user.role === "SPC_ADMIN";
  const actorOrganizationId = identity?.user.organizationId ?? 0;
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [price, setPrice] = useState("");
  const [validFrom, setValidFrom] = useState(nowLocal);

  const matrixRows = useMemo(() => buildPricingMatrixRows({
    organizations: (organizations.data ?? []) as PricingOrganization[],
    actorOrganizationId,
    isSpcAdmin: isSpc,
  }), [actorOrganizationId, isSpc, organizations.data]);

  const pricingRules = (rules.data ?? []) as PricingRule[];
  const totals = useMemo(() => {
    let active = 0;
    for (const row of matrixRows) {
      for (const channel of PRICING_CHANNELS) {
        if (findCellRules(pricingRules, row, channel).activeRule) active += 1;
      }
    }
    const total = matrixRows.length * PRICING_CHANNELS.length;
    return { active, inactive: total - active, total };
  }, [matrixRows, pricingRules]);

  const closeDialog = () => {
    setSelectedCell(null);
    setPrice("");
    setValidFrom(nowLocal());
  };

  const onSaved = async () => {
    await utils.commercial.pricing.list.invalidate();
    closeDialog();
    toast.success("Nova vigência do preço registrada.");
  };

  const base = trpc.commercial.pricing.setBase.useMutation({
    onSuccess: onSaved,
    onError: error => toast.error(error.message),
  });

  const creditor = trpc.commercial.pricing.setCreditor.useMutation({
    onSuccess: onSaved,
    onError: error => toast.error(error.message),
  });

  function openCell(row: PricingMatrixRow, channel: PricingChannel) {
    // Impedir edição da Base SPC Brasil para CDL_ADMIN e DISTRIBUTOR_ADMIN
    if (row.priceType === "SPC_BASE" && !isSpc) {
      toast.info("Base SPC Brasil é somente leitura para sua organização.");
      return;
    }
    const cellRules = findCellRules(pricingRules, row, channel);
    const referenceRule = cellRules.activeRule ?? cellRules.latestRule;
    setSelectedCell({ row, channel, ...cellRules });
    setPrice(referenceRule ? (referenceRule.unitPriceMicros / 1_000_000).toFixed(6).replace(".", ",") : "");
    setValidFrom(nowLocal());
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedCell) return;
    const unitPriceMicros = micros(price);
    if (!Number.isFinite(unitPriceMicros) || unitPriceMicros <= 0) {
      toast.error("Informe um preço unitário maior que zero.");
      return;
    }
    const common = { channel: selectedCell.channel, unitPriceMicros, validFrom: new Date(validFrom) };
    if (selectedCell.row.priceType === "SPC_BASE") {
      base.mutate(common);
      return;
    }
    creditor.mutate({
      ...common,
      organizationId: isSpc ? selectedCell.row.organizationId : undefined,
      creditorOrganizationId: selectedCell.row.creditorOrganizationId!,
    });
  }

  const loading = identityLoading || organizations.isLoading || rules.isLoading;
  const isError = identityIsError || organizations.isError || rules.isError;
  const error = identityError ?? organizations.error ?? rules.error;

  return <div className="space-y-6">
    <section className="command-panel overflow-hidden p-6 md:p-8">
      <div className="grid gap-6 xl:grid-cols-[1fr_auto] xl:items-end">
        <div>
          <div className="eyebrow"><BadgeDollarSign className="size-4" /> Governança financeira</div>
          <h1 className="mt-3 text-3xl font-extrabold text-slate-950">Precificação por credor e canal</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Visualize os preços vigentes de cada credor. Selecione uma célula para cadastrar um valor ausente ou criar uma nova vigência.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
          <SummaryCard label="Células" value={totals.total} tone="slate" />
          <SummaryCard label="Ativas" value={totals.active} tone="green" />
          <SummaryCard label="Inativas" value={totals.inactive} tone="red" />
        </div>
      </div>
    </section>

    <section className="command-panel overflow-hidden">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 md:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0066cc]"><ShieldCheck className="size-5" /></span>
            <div>
              <h2 className="font-bold text-slate-950">Matriz de preços</h2>
              <p className="mt-1 text-sm text-slate-500">Os credores exibidos seguem automaticamente o escopo da sua organização.</p>
            </div>
          </div>
          <div aria-label="Legenda dos preços" className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="text-slate-500">Legenda:</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800"><CheckCircle2 className="size-4" /> Preço ativo</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-800"><XCircle className="size-4" /> Inativo ou sem preço</span>
          </div>
        </div>
      </div>

      {loading ? <div className="space-y-3 p-6"><Skeleton className="h-14 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
        : isError && error ? <div className="p-6"><QueryErrorState message={error.message} onRetry={() => { void organizations.refetch(); void rules.refetch(); }} /></div>
          : matrixRows.length ? <div className="overflow-x-auto">
            <Table className="min-w-[940px]">
              <TableHeader>
                <TableRow className="border-b-0 bg-slate-950 hover:bg-slate-950">
                  <TableHead className="sticky left-0 z-20 min-w-[260px] bg-slate-950 px-5 py-4 text-xs font-bold uppercase tracking-[0.12em] text-white">Credor</TableHead>
                  {PRICING_CHANNELS.map(channel => {
                    const Icon = channelIcons[channel];
                    return <TableHead key={channel} className="min-w-[165px] px-3 py-4 text-center text-white">
                      <span className="inline-flex items-center gap-2 text-sm font-bold"><Icon className="size-4 text-[#ffd54a]" />{PRICING_CHANNEL_LABELS[channel]}</span>
                    </TableHead>;
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrixRows.map((row, index) => <TableRow key={row.key} className="border-slate-200 hover:bg-transparent">
                  <TableCell className={`sticky left-0 z-10 border-r border-slate-200 px-5 py-4 ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${row.priceType === "SPC_BASE" ? "bg-blue-100 text-[#0066cc]" : "bg-slate-100 text-slate-600"}`}><Building2 className="size-5" /></span>
                      <div className="min-w-0">
                        <div className="truncate font-bold text-slate-950" title={row.name}>{row.name}</div>
                        {row.ownerName && <div className="mt-0.5 truncate text-xs text-slate-500" title={row.ownerName}>{row.ownerName}</div>}
                      </div>
                    </div>
                  </TableCell>
                  {PRICING_CHANNELS.map(channel => {
                    const { activeRule, latestRule } = findCellRules(pricingRules, row, channel);
                    const referenceRule = activeRule ?? latestRule;
                    const isReadOnly = row.priceType === "SPC_BASE" && !isSpc;
                    return <TableCell key={`${row.key}-${channel}`} className={`p-2.5 ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                      <button
                        type="button"
                        onClick={() => openCell(row, channel)}
                        disabled={isReadOnly}
                        aria-label={`${activeRule ? "Editar" : "Cadastrar"} preço de ${PRICING_CHANNEL_LABELS[channel]} para ${row.name}`}
                        className={`group flex min-h-20 w-full flex-col items-center justify-center rounded-xl border px-3 py-3 text-center shadow-sm transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc] focus-visible:ring-offset-2 active:scale-[0.97] ${isReadOnly ? "border-slate-300 bg-slate-200 text-slate-500 cursor-not-allowed" : activeRule ? "border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700" : "border-rose-700 bg-rose-600 text-white hover:bg-rose-700"}`}
                      >
                        <span className="text-base font-extrabold">{referenceRule ? reais(referenceRule.unitPriceMicros) : "Sem preço"}</span>
                        <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/90">
                          {activeRule ? <><CheckCircle2 className="size-3.5" /> Ativo</> : latestRule ? <><Clock3 className="size-3.5" /> Inativo</> : <><Pencil className="size-3.5" /> Cadastrar</>}
                        </span>
                      </button>
                    </TableCell>;
                  })}
                </TableRow>)}
              </TableBody>
            </Table>
          </div>
            : <div className="p-6"><div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><Building2 className="mx-auto size-8 text-slate-400" /><h3 className="mt-3 font-bold text-slate-800">Nenhum credor ativo no seu escopo</h3><p className="mt-1 text-sm text-slate-500">Cadastre ou ative um credor para configurar preços por canal.</p></div></div>}
    </section>

    <Dialog open={Boolean(selectedCell)} onOpenChange={open => { if (!open) closeDialog(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{selectedCell?.activeRule ? "Editar preço vigente" : "Cadastrar preço"}</DialogTitle>
          <DialogDescription>A alteração cria uma nova vigência e mantém o histórico anterior protegido.</DialogDescription>
        </DialogHeader>
        {selectedCell && <form className="space-y-5" onSubmit={submit}>
          <div className={`rounded-2xl border p-4 ${selectedCell.activeRule ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Credor</div>
                <div className="mt-1 font-extrabold text-slate-950">{selectedCell.row.name}</div>
                <div className="mt-1 text-sm text-slate-600">Canal: <strong>{PRICING_CHANNEL_LABELS[selectedCell.channel]}</strong></div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${selectedCell.activeRule ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>{selectedCell.activeRule ? "Ativo" : "Inativo"}</span>
            </div>
          </div>
          <Field label="Preço unitário (R$)">
            <Input autoFocus required inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)} placeholder="0,0850" />
          </Field>
          <Field label="Início da nova vigência">
            <Input required type="datetime-local" value={validFrom} onChange={event => setValidFrom(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button disabled={base.isPending || creditor.isPending} className="bg-[#0066cc] text-white hover:bg-[#004a99]">{selectedCell.activeRule ? "Salvar nova vigência" : "Ativar preço"}</Button>
          </div>
        </form>}
      </DialogContent>
    </Dialog>
  </div>;
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "slate" | "green" | "red" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-rose-200 bg-rose-50 text-rose-800",
  };
  return <div className={`rounded-2xl border px-3 py-3 text-center shadow-sm ${tones[tone]}`}><div className="text-xl font-extrabold">{value}</div><div className="mt-0.5 text-[11px] font-bold uppercase tracking-wide opacity-70">{label}</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
