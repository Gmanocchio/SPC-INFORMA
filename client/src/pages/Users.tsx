import { useMemo, useState } from "react";
import { KeyRound, Pencil, Plus, Search, Shield, UserRoundCheck, UsersRound } from "lucide-react";
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
import { useBrand } from "@/contexts/BrandContext";
import { trpc } from "@/lib/trpc";
import { creditsRequesterOrganizationOptions } from "@/lib/user-organization-scope";

const roleLabels = { SPC_ADMIN: "Administrador SPC", ORG_ADMIN: "Administrador da organização", REQUESTER: "Solicitante" } as const;
const statusLabels = { INVITED: "Primeiro acesso", ACTIVE: "Ativo", INACTIVE: "Inativo", LOCKED: "Bloqueado" } as const;

export default function Users() {
  const brand = useBrand();
  const utils = trpc.useUtils();
  const { data: identity } = trpc.auth.me.useQuery();
  const isSpcAdmin = identity?.user.role === "SPC_ADMIN";
  const isCreditsOrgAdmin = brand.isCredits && identity?.user.role === "ORG_ADMIN";
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ organizationId: "", name: "", cpf: "", email: "", phone: "", initialPassword: "", role: "REQUESTER" as "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER" });
  const [editingUser, setEditingUser] = useState<null | {
    id: number;
    organizationId: number;
    name: string;
    cpf: string;
    email: string;
    phone: string | null;
    role: "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER";
    status: "INVITED" | "ACTIVE" | "INACTIVE" | "LOCKED";
  }>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", role: "REQUESTER" as "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER", status: "ACTIVE" as "INVITED" | "ACTIVE" | "INACTIVE" | "LOCKED" });
  const queryInput = useMemo(() => ({ search: search || undefined, includeManagedOrganizations: isCreditsOrgAdmin || undefined }), [isCreditsOrgAdmin, search]);
  const users = trpc.admin.users.list.useQuery(queryInput);
  const organizations = trpc.admin.organizations.list.useQuery({}, { enabled: Boolean(identity) });
  const currentOrganizationId = identity?.user.organizationId;
  const requesterOrganizations = useMemo(
    () => creditsRequesterOrganizationOptions(organizations.data, currentOrganizationId),
    [currentOrganizationId, organizations.data],
  );
  const organizationOptions = isSpcAdmin ? organizations.data ?? [] : requesterOrganizations;
  const requiresOrganizationSelection = isSpcAdmin || (isCreditsOrgAdmin && form.role === "REQUESTER");

  const create = trpc.admin.users.create.useMutation({
    onSuccess: async () => { await utils.admin.users.list.invalidate(); toast.success("Usuário criado com troca de senha obrigatória."); setOpen(false); },
    onError: error => toast.error(error.message),
  });
  const update = trpc.admin.users.update.useMutation({
    onSuccess: async () => { await utils.admin.users.list.invalidate(); toast.success(editingUser ? "Usuário atualizado e alteração registrada na auditoria." : "Situação do usuário atualizada."); setEditingUser(null); },
    onError: error => toast.error(error.message),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const organizationId = requiresOrganizationSelection ? Number(form.organizationId) : currentOrganizationId;
    if (!organizationId) { toast.error("Selecione a organização do usuário."); return; }
    if (isCreditsOrgAdmin && form.role === "REQUESTER" && !requesterOrganizations.some(organization => organization.id === organizationId)) {
      toast.error("Selecione uma organização ativa vinculada à Credits.");
      return;
    }
    create.mutate({ organizationId, name: form.name, cpf: form.cpf, email: form.email, phone: form.phone || null, initialPassword: form.initialPassword, role: form.role });
  }

  function startEditing(user: NonNullable<typeof users.data>[number]) {
    setEditingUser({ id: user.id, organizationId: user.organizationId, name: user.name, cpf: user.cpf, email: user.email, phone: user.phone, role: user.role, status: user.status });
    setEditForm({ name: user.name, email: user.email, phone: user.phone ?? "", role: user.role, status: user.status });
  }

  function submitEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingUser) return;
    update.mutate({ id: editingUser.id, data: { name: editForm.name, email: editForm.email, phone: editForm.phone || null, role: editForm.role, status: editForm.status } });
  }

  return (
      <div className="space-y-6">
        <section className="command-panel p-6 md:p-8"><div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end"><div><div className="eyebrow"><UsersRound className="size-4" /> Controle de identidade</div><h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Usuários</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Cadastre operadores e administradores no escopo autorizado. Todo novo usuário inicia com troca de senha obrigatória e 2FA por e-mail.</p></div>
          <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="h-11 bg-[#0066cc] px-5 text-white hover:bg-[#004a99]"><Plus className="size-4" /> Novo usuário</Button></DialogTrigger><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Cadastrar usuário</DialogTitle><DialogDescription>A senha inicial não é exibida novamente. Oriente o usuário a trocá-la no primeiro acesso.</DialogDescription></DialogHeader><form className="grid gap-4 pt-2 sm:grid-cols-2" onSubmit={submit}>
            {requiresOrganizationSelection && <Field label={isCreditsOrgAdmin ? "Organização do solicitante" : "Organização"}><Select value={form.organizationId} disabled={organizations.isLoading || organizationOptions.length === 0} onValueChange={value => setForm({ ...form, organizationId: value })}><SelectTrigger aria-label={isCreditsOrgAdmin ? "Organização do solicitante" : "Organização"}><SelectValue placeholder={organizations.isLoading ? "Carregando organizações…" : "Selecione"} /></SelectTrigger><SelectContent>{organizationOptions.map(org => <SelectItem key={org.id} value={String(org.id)}>{org.tradeName}</SelectItem>)}</SelectContent></Select>{isCreditsOrgAdmin && !organizations.isLoading && organizationOptions.length === 0 && <p className="text-xs text-amber-700">Nenhuma organização ativa está vinculada à Credits.</p>}</Field>}
            <Field label="Perfil"><Select value={form.role} onValueChange={value => setForm({ ...form, role: value as typeof form.role, organizationId: isCreditsOrgAdmin && value !== "REQUESTER" ? "" : form.organizationId })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{isSpcAdmin && <SelectItem value="SPC_ADMIN">Administrador SPC</SelectItem>}<SelectItem value="ORG_ADMIN">Administrador da organização</SelectItem><SelectItem value="REQUESTER">Solicitante</SelectItem></SelectContent></Select></Field>
            <Field label="Nome completo"><Input aria-label="Nome completo" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="CPF"><Input aria-label="CPF" required value={form.cpf} onChange={event => setForm({ ...form, cpf: event.target.value })} placeholder="000.000.000-00" /></Field>
            <Field label="E-mail"><Input aria-label="E-mail" required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></Field>
            <Field label="Telefone"><Input aria-label="Telefone" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Senha inicial"><Input aria-label="Senha inicial" required type="password" minLength={12} value={form.initialPassword} onChange={event => setForm({ ...form, initialPassword: event.target.value })} placeholder="Mínimo 12 caracteres, maiúscula, minúscula, número e símbolo" /></Field><p className="mt-2 text-xs text-slate-500">A senha será protegida com scrypt e nunca armazenada em texto aberto.</p></div>
            <div className="flex justify-end gap-3 border-t pt-4 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={create.isPending} className="bg-[#0066cc] text-white">{create.isPending ? "Criando…" : "Criar usuário"}</Button></div>
          </form></DialogContent></Dialog>
          <Dialog open={Boolean(editingUser)} onOpenChange={next => { if (!next) setEditingUser(null); }}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>Editar usuário</DialogTitle><DialogDescription>Altere os dados permitidos. CPF e organização permanecem vinculados ao cadastro original.</DialogDescription></DialogHeader>
              {editingUser && <form className="grid gap-4 pt-2 sm:grid-cols-2" onSubmit={submitEdit}>
                <Field label="Organização"><Input disabled value={organizations.data?.find(org => org.id === editingUser.organizationId)?.tradeName ?? String(editingUser.organizationId)} /></Field>
                <Field label="CPF"><Input disabled value={editingUser.cpf} /></Field>
                <Field label="Nome completo"><Input required minLength={2} value={editForm.name} onChange={event => setEditForm({ ...editForm, name: event.target.value })} /></Field>
                <Field label="E-mail"><Input required type="email" value={editForm.email} onChange={event => setEditForm({ ...editForm, email: event.target.value })} /></Field>
                <Field label="Telefone"><Input value={editForm.phone} onChange={event => setEditForm({ ...editForm, phone: event.target.value })} /></Field>
                <Field label="Perfil"><Select value={editForm.role} onValueChange={value => setEditForm({ ...editForm, role: value as typeof editForm.role })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{isSpcAdmin && <SelectItem value="SPC_ADMIN">Administrador SPC</SelectItem>}<SelectItem value="ORG_ADMIN">Administrador da organização</SelectItem><SelectItem value="REQUESTER">Solicitante</SelectItem></SelectContent></Select></Field>
                <Field label="Situação"><Select value={editForm.status} disabled={editingUser.id === identity?.user.id} onValueChange={value => setEditForm({ ...editForm, status: value as typeof editForm.status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Ativo</SelectItem><SelectItem value="INACTIVE">Inativo</SelectItem><SelectItem value="LOCKED">Bloqueado</SelectItem><SelectItem value="INVITED">Primeiro acesso</SelectItem></SelectContent></Select></Field>
                <div className="flex justify-end gap-3 border-t pt-4 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button><Button disabled={update.isPending} className="bg-[#0066cc] text-white">{update.isPending ? "Salvando…" : "Salvar alterações"}</Button></div>
              </form>}
            </DialogContent>
          </Dialog>
        </div></section>

        <section className="command-panel p-4 md:p-6"><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="font-bold text-slate-950">Identidades autorizadas</h2><p className="text-sm text-slate-500">Perfis e situações são impostos também no servidor.</p></div><div className="relative w-full md:w-80"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome, CPF ou e-mail" /></div></div>
          {users.isLoading ? <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : users.isError ? <QueryErrorState message={users.error.message} onRetry={() => void users.refetch()} /> : users.data?.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Perfil</TableHead><TableHead>Segurança</TableHead><TableHead>Situação</TableHead><TableHead>Último acesso</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{users.data.map(user => <TableRow key={user.id}><TableCell><div className="font-semibold text-slate-900">{user.name}</div><div className="text-xs text-slate-500">{user.email}</div></TableCell><TableCell><span className="inline-flex items-center gap-1.5 text-sm"><Shield className="size-3.5 text-[#0066cc]" />{roleLabels[user.role]}</span></TableCell><TableCell>{user.mustChangePassword ? <Badge className="bg-amber-50 text-amber-700"><KeyRound className="mr-1 size-3" />Troca pendente</Badge> : <Badge className="bg-emerald-50 text-emerald-700"><UserRoundCheck className="mr-1 size-3" />Verificado</Badge>}</TableCell><TableCell><Badge variant="secondary">{statusLabels[user.status]}</Badge></TableCell><TableCell className="text-sm text-slate-500">{user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleString("pt-BR") : "Nunca"}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button type="button" size="icon" variant="outline" className="bg-white" aria-label={`Editar ${user.name}`} onClick={() => startEditing(user)}><Pencil className="size-4" /></Button><Select value={user.status} disabled={user.id === identity?.user.id} onValueChange={status => update.mutate({ id: user.id, data: { status: status as "INVITED" | "ACTIVE" | "INACTIVE" | "LOCKED" } })}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Ativar</SelectItem><SelectItem value="INACTIVE">Inativar</SelectItem><SelectItem value="LOCKED">Bloquear</SelectItem><SelectItem value="INVITED">Primeiro acesso</SelectItem></SelectContent></Select></div></TableCell></TableRow>)}</TableBody></Table></div> : <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center"><UsersRound className="size-10 text-[#0066cc]" /><h3 className="mt-4 font-bold text-slate-900">Nenhum usuário encontrado</h3><p className="mt-1 max-w-md text-sm text-slate-500">Cadastre o primeiro usuário deste escopo ou ajuste a busca.</p></div>}
        </section>
      </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
