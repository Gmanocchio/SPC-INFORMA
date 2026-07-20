import { useMemo, useState } from "react";
import { Building2, CircleDollarSign, ImageUp, MapPin, Pencil, Plus, Search, ShieldCheck } from "lucide-react";
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
import {
  fromLinkedOrganizationSelectValue,
  SPC_BRASIL_LINK_VALUE,
  toLinkedOrganizationPayload,
  toLinkedOrganizationSelectValue,
} from "./organization-form-state";

const typeLabels = { SPC_BRASIL: "SPC Brasil", CDL: "CDL", DISTRIBUTOR: "Distribuidora", CREDITOR: "Credor" } as const;
const statusLabels = { ACTIVE: "Ativa", INACTIVE: "Inativa", SUSPENDED: "Suspensa" } as const;

function cents(value: string) {
  const normalized = Number(value.replace(",", "."));
  return Number.isFinite(normalized) ? Math.max(0, Math.round(normalized * 100)) : 0;
}

export default function Organizations() {
  const utils = trpc.useUtils();
  const { data: identity } = trpc.auth.me.useQuery();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ type: "CREDITOR" as "SPC_BRASIL" | "CDL" | "DISTRIBUTOR" | "CREDITOR", legalName: "", tradeName: "", cnpj: "", responsibleName: "", responsibleEmail: "", responsiblePhone: "", postalCode: "", street: "", streetNumber: "", addressExtra: "", district: "", city: "", state: "", billingModel: "PREPAID" as "PREPAID" | "POSTPAID", balance: "0", creditLimit: "0", status: "ACTIVE" as "ACTIVE" | "INACTIVE" | "SUSPENDED", linkedToOrganizationId: "" });
  const queryInput = useMemo(() => ({ search: search || undefined }), [search]);
  const organizations = trpc.admin.organizations.list.useQuery(queryInput);
  const isSpcAdmin = identity?.user.role === "SPC_ADMIN";
  const linkableOrganizations = organizations.data?.filter(org => org.type === "CDL" || org.type === "DISTRIBUTOR") ?? [];
  const hasUnavailableCurrentLink = Boolean(
    form.linkedToOrganizationId
      && !linkableOrganizations.some(org => String(org.id) === form.linkedToOrganizationId),
  );

  const create = trpc.admin.organizations.create.useMutation({
    onSuccess: async () => {
      await utils.admin.organizations.list.invalidate();
      toast.success("Empresa cadastrada e registrada na auditoria.");
      setOpen(false);
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.admin.organizations.update.useMutation({
    onSuccess: async () => {
      await utils.admin.organizations.list.invalidate();
      toast.success(editingId ? "Empresa atualizada e alteração registrada na auditoria." : "Situação da empresa atualizada.");
      if (editingId) { setOpen(false); setEditingId(null); }
    },
    onError: error => toast.error(error.message),
  });
  const uploadLogo = trpc.admin.organizations.uploadLogo.useMutation({
    onSuccess: async () => {
      await utils.admin.organizations.list.invalidate();
      toast.success("Logo armazenado com segurança.");
    },
    onError: error => toast.error(error.message),
  });

  function selectLogo(id: number, file?: File) {
    if (!file) return;
    if (file.size > 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Use uma imagem PNG, JPG ou WEBP com até 1 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      const base64 = value.includes(",") ? value.split(",")[1] : "";
      uploadLogo.mutate({ id, mimeType: file.type as "image/png" | "image/jpeg" | "image/webp", base64 });
    };
    reader.readAsDataURL(file);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (editingId) {
      update.mutate({
        id: editingId,
        data: {
          legalName: form.legalName,
          tradeName: form.tradeName,
          responsibleName: form.responsibleName,
          responsibleEmail: form.responsibleEmail,
          responsiblePhone: form.responsiblePhone || null,
          postalCode: form.postalCode || null,
          street: form.street || null,
          streetNumber: form.streetNumber || null,
          addressExtra: form.addressExtra || null,
          district: form.district || null,
          city: form.city || null,
          state: form.state || null,
          billingModel: form.billingModel,
          balanceCents: cents(form.balance),
          creditLimitCents: cents(form.creditLimit),
          status: form.status,
          linkedToOrganizationId: form.type === "CREDITOR" && isSpcAdmin
            ? toLinkedOrganizationPayload(form.linkedToOrganizationId)
            : undefined,
        },
      });
      return;
    }
    create.mutate({
      type: isSpcAdmin ? form.type : "CREDITOR",
      legalName: form.legalName,
      tradeName: form.tradeName,
      cnpj: form.cnpj,
      responsibleName: form.responsibleName,
      responsibleEmail: form.responsibleEmail,
      responsiblePhone: form.responsiblePhone || null,
      postalCode: form.postalCode || null,
      street: form.street || null,
      streetNumber: form.streetNumber || null,
      addressExtra: form.addressExtra || null,
      district: form.district || null,
      city: form.city || null,
      state: form.state || null,
      billingModel: form.billingModel,
      balanceCents: cents(form.balance),
      creditLimitCents: cents(form.creditLimit),
      linkedToOrganizationId: toLinkedOrganizationPayload(form.linkedToOrganizationId),
    });
  }

  function startEditing(org: NonNullable<typeof organizations.data>[number]) {
    setEditingId(org.id);
    setForm({
      type: org.type,
      legalName: org.legalName,
      tradeName: org.tradeName,
      cnpj: org.cnpj,
      responsibleName: org.responsibleName,
      responsibleEmail: org.responsibleEmail,
      responsiblePhone: org.responsiblePhone ?? "",
      postalCode: org.postalCode ?? "",
      street: org.street ?? "",
      streetNumber: org.streetNumber ?? "",
      addressExtra: org.addressExtra ?? "",
      district: org.district ?? "",
      city: org.city ?? "",
      state: org.state ?? "",
      billingModel: org.billingModel,
      balance: (org.balanceCents / 100).toFixed(2).replace(".", ","),
      creditLimit: (org.creditLimitCents / 100).toFixed(2).replace(".", ","),
      status: org.status,
      linkedToOrganizationId: org.linkedToOrganizationId?.toString() ?? "",
    });
    setOpen(true);
  }

  function startCreating() {
    setEditingId(null);
    const linkedId = isSpcAdmin ? "" : identity?.user.organizationId?.toString() ?? "";
    setForm({ type: "CREDITOR", legalName: "", tradeName: "", cnpj: "", responsibleName: "", responsibleEmail: "", responsiblePhone: "", postalCode: "", street: "", streetNumber: "", addressExtra: "", district: "", city: "", state: "", billingModel: "PREPAID", balance: "0", creditLimit: "0", status: "ACTIVE", linkedToOrganizationId: linkedId });
  }

  return (
      <div className="space-y-6">
        <section className="command-panel overflow-hidden p-6 md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div><div className="eyebrow"><Building2 className="size-4" /> Estrutura organizacional</div><h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Empresas</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Administre CDLs, distribuidoras e credores dentro do seu escopo. Alterações sensíveis são registradas na trilha de auditoria.</p></div>
            <Dialog open={open} onOpenChange={next => { setOpen(next); if (!next) setEditingId(null); }}>
              <DialogTrigger asChild><Button onClick={startCreating} className="h-11 bg-[#0066cc] px-5 text-white hover:bg-[#004a99]"><Plus className="size-4" /> Nova empresa</Button></DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader><DialogTitle>{editingId ? "Editar empresa" : "Cadastrar empresa"}</DialogTitle><DialogDescription>{editingId ? "Atualize os dados permitidos. Tipo e CNPJ permanecem vinculados ao cadastro original." : "Informe dados cadastrais, responsável e regime financeiro. Campos obrigatórios são validados no servidor."}</DialogDescription></DialogHeader>
                <form className="grid gap-4 pt-2 sm:grid-cols-2" onSubmit={submit}>
                  {isSpcAdmin && <Field label="Tipo"><Select disabled={Boolean(editingId)} value={form.type} onValueChange={value => setForm(current => ({ ...current, type: value as typeof form.type }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CDL">CDL</SelectItem><SelectItem value="DISTRIBUTOR">Distribuidora</SelectItem><SelectItem value="CREDITOR">Credor</SelectItem><SelectItem value="SPC_BRASIL">SPC Brasil</SelectItem></SelectContent></Select></Field>}
                  {form.type === "CREDITOR" && isSpcAdmin && organizations.data && <Field label="Vinculado a"><Select value={toLinkedOrganizationSelectValue(form.linkedToOrganizationId)} onValueChange={value => setForm(current => ({ ...current, linkedToOrganizationId: fromLinkedOrganizationSelectValue(value) }))}><SelectTrigger><SelectValue placeholder="Selecione uma CDL, Distribuidora ou o SPC Brasil" /></SelectTrigger><SelectContent><SelectItem value={SPC_BRASIL_LINK_VALUE}>SPC Brasil</SelectItem>{hasUnavailableCurrentLink && <SelectItem value={form.linkedToOrganizationId}>Vínculo atual indisponível (ID {form.linkedToOrganizationId})</SelectItem>}{linkableOrganizations.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.tradeName} ({typeLabels[o.type]})</SelectItem>)}</SelectContent></Select></Field>}
                  <Field label="CNPJ"><Input required disabled={Boolean(editingId)} value={form.cnpj} onChange={event => setForm({ ...form, cnpj: event.target.value })} placeholder="00.000.000/0000-00" /></Field>
                  <Field label="Razão social"><Input required value={form.legalName} onChange={event => setForm({ ...form, legalName: event.target.value })} /></Field>
                  <Field label="Nome fantasia"><Input required value={form.tradeName} onChange={event => setForm({ ...form, tradeName: event.target.value })} /></Field>
                  <Field label="Responsável"><Input required value={form.responsibleName} onChange={event => setForm({ ...form, responsibleName: event.target.value })} /></Field>
                  <Field label="E-mail do responsável"><Input required type="email" value={form.responsibleEmail} onChange={event => setForm({ ...form, responsibleEmail: event.target.value })} /></Field>
                  <Field label="Telefone"><Input value={form.responsiblePhone} onChange={event => setForm({ ...form, responsiblePhone: event.target.value })} /></Field>
                  <Field label="CEP"><Input value={form.postalCode} onChange={event => setForm({ ...form, postalCode: event.target.value })} /></Field>
                  <Field label="Logradouro"><Input value={form.street} onChange={event => setForm({ ...form, street: event.target.value })} /></Field>
                  <Field label="Número"><Input value={form.streetNumber} onChange={event => setForm({ ...form, streetNumber: event.target.value })} /></Field>
                  <Field label="Complemento"><Input value={form.addressExtra} onChange={event => setForm({ ...form, addressExtra: event.target.value })} /></Field>
                  <Field label="Bairro"><Input value={form.district} onChange={event => setForm({ ...form, district: event.target.value })} /></Field>
                  <Field label="Cidade"><Input value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} /></Field>
                  <Field label="UF"><Input maxLength={2} value={form.state} onChange={event => setForm({ ...form, state: event.target.value.toUpperCase() })} /></Field>
                  <Field label="Modelo financeiro"><Select value={form.billingModel} onValueChange={value => setForm(current => ({ ...current, billingModel: value as typeof form.billingModel }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PREPAID">Pré-pago</SelectItem><SelectItem value="POSTPAID">Pós-pago</SelectItem></SelectContent></Select></Field>
                  {form.billingModel === "PREPAID" ? <Field label="Saldo inicial (R$)"><Input inputMode="decimal" value={form.balance} onChange={event => setForm({ ...form, balance: event.target.value })} /></Field> : <Field label="Limite de crédito (R$)"><Input inputMode="decimal" value={form.creditLimit} onChange={event => setForm({ ...form, creditLimit: event.target.value })} /></Field>}
                  {editingId && <Field label="Situação"><Select value={form.status} onValueChange={value => setForm({ ...form, status: value as typeof form.status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Ativa</SelectItem><SelectItem value="INACTIVE">Inativa</SelectItem><SelectItem value="SUSPENDED">Suspensa</SelectItem></SelectContent></Select></Field>}
                  <div className="flex justify-end gap-3 border-t pt-4 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={create.isPending || update.isPending} className="bg-[#0066cc] text-white">{create.isPending || update.isPending ? "Salvando…" : editingId ? "Salvar alterações" : "Cadastrar empresa"}</Button></div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        <section className="command-panel p-4 md:p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="font-bold text-slate-950">Organizações no seu escopo</h2><p className="text-sm text-slate-500">Exibindo até 200 registros recentes.</p></div><div className="relative w-full md:w-80"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome ou CNPJ" /></div></div>
          {organizations.isLoading ? <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : organizations.isError ? <QueryErrorState message={organizations.error.message} onRetry={() => void organizations.refetch()} /> : organizations.data?.length ? (
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Tipo</TableHead><TableHead>Vinculado a</TableHead><TableHead>Localização</TableHead><TableHead>Financeiro</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{organizations.data.map(org => <TableRow key={org.id}><TableCell><div className="flex items-center gap-3">{org.logoUrl ? <img src={org.logoUrl} alt="" className="size-10 rounded-xl border bg-white object-contain p-1" /> : <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-[#0066cc]"><Building2 className="size-5" /></span>}<div><div className="font-semibold text-slate-900">{org.tradeName}</div><div className="text-xs text-slate-500">{org.cnpj}</div></div></div></TableCell><TableCell><Badge variant="secondary">{typeLabels[org.type]}</Badge></TableCell><TableCell><span className="text-sm text-slate-600">{org.linkedToOrganizationId ? organizations.data?.find(o => o.id === org.linkedToOrganizationId)?.tradeName || `ID ${org.linkedToOrganizationId}` : "SPC Brasil"}</span></TableCell><TableCell><span className="inline-flex items-center gap-1.5 text-sm text-slate-600"><MapPin className="size-3.5" />{org.city ? `${org.city}${org.state ? `/${org.state}` : ""}` : "Não informado"}</span></TableCell><TableCell><div className="inline-flex items-center gap-1.5 text-sm"><CircleDollarSign className="size-4 text-[#00a86b]" />{org.billingModel === "PREPAID" ? `Saldo ${(org.balanceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : "Pós-pago"}</div></TableCell><TableCell><Badge className={org.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>{statusLabels[org.status]}</Badge></TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button type="button" size="icon" variant="outline" className="bg-white" aria-label={`Editar ${org.tradeName}`} onClick={() => startEditing(org)}><Pencil className="size-4" /></Button><label className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border bg-white text-slate-600 hover:bg-slate-50" title="Enviar logo"><ImageUp className="size-4" /><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => selectLogo(org.id, event.target.files?.[0])} /></label><Select value={org.status} onValueChange={status => update.mutate({ id: org.id, data: { status: status as "ACTIVE" | "INACTIVE" | "SUSPENDED" } })}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Ativar</SelectItem><SelectItem value="INACTIVE">Inativar</SelectItem><SelectItem value="SUSPENDED">Suspender</SelectItem></SelectContent></Select></div></TableCell></TableRow>)}</TableBody></Table></div>
          ) : <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center"><ShieldCheck className="size-10 text-[#0066cc]" /><h3 className="mt-4 font-bold text-slate-900">Nenhuma empresa encontrada</h3><p className="mt-1 max-w-md text-sm text-slate-500">Cadastre uma organização ou ajuste o termo de busca para visualizar empresas no seu escopo.</p></div>}
        </section>
      </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
