import { useState } from "react";
import { Check, Copy, KeyRound, Plus, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QueryErrorState } from "@/components/QueryErrorState";
import { trpc } from "@/lib/trpc";

type Scope = "campaigns:read" | "campaigns:write" | "reports:read";
type ApiKeyRow = { id: number; organizationId: number; name: string; scopes: string[]; revokedAt: Date | null };
const scopes: Array<{ value: Scope; label: string }> = [{ value: "campaigns:read", label: "Consultar campanhas" }, { value: "campaigns:write", label: "Criar campanhas" }, { value: "reports:read", label: "Consultar relatórios" }];
const emptyForm = () => ({ organizationId: "", name: "", scopes: ["campaigns:read"] as Scope[], expiresAt: "" });

export default function ApiKeys() {
  const utils = trpc.useUtils();
  const { data: identity } = trpc.auth.me.useQuery();
  const [open, setOpen] = useState(false);
  const [rotatingId, setRotatingId] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const list = trpc.commercial.apiKeys.list.useQuery(undefined);
  const organizations = trpc.admin.organizations.list.useQuery({}, { enabled: identity?.user.role === "SPC_ADMIN" });
  const closeDialog = () => { setOpen(false); setRotatingId(null); setForm(emptyForm()); };
  const onIssued = async (result: { key: string }, message: string) => { await utils.commercial.apiKeys.list.invalidate(); setRevealed(result.key); closeDialog(); toast.success(message); };
  const create = trpc.commercial.apiKeys.create.useMutation({ onSuccess: result => onIssued(result, "Chave emitida. Copie agora: ela não será exibida novamente."), onError: error => toast.error(error.message) });
  const rotate = trpc.commercial.apiKeys.rotate.useMutation({ onSuccess: result => onIssued(result, "Chave substituída. A credencial anterior foi revogada imediatamente."), onError: error => toast.error(error.message) });
  const revoke = trpc.commercial.apiKeys.revoke.useMutation({ onSuccess: async () => { await utils.commercial.apiKeys.list.invalidate(); toast.success("Chave revogada imediatamente."); }, onError: error => toast.error(error.message) });
  const isSpc = identity?.user.role === "SPC_ADMIN";

  function toggle(scope: Scope) { setForm(current => ({ ...current, scopes: current.scopes.includes(scope) ? current.scopes.filter(item => item !== scope) : [...current.scopes, scope] })); }
  function startNewKey() { setRotatingId(null); setForm(emptyForm()); }
  function startRotation(key: ApiKeyRow) {
    setRotatingId(key.id);
    setForm({ organizationId: String(key.organizationId), name: key.name, scopes: key.scopes.filter((scope): scope is Scope => scopes.some(item => item.value === scope)), expiresAt: "" });
    setOpen(true);
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const data = { name: form.name, scopes: form.scopes, expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`) : null };
    if (rotatingId) rotate.mutate({ id: rotatingId, ...data });
    else create.mutate({ organizationId: isSpc && form.organizationId ? Number(form.organizationId) : undefined, ...data });
  }
  async function copy() { if (!revealed) return; await navigator.clipboard.writeText(revealed); toast.success("Chave copiada para a área de transferência."); }

  return <div className="space-y-6">
    <section className="command-panel p-6 md:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><div className="eyebrow"><KeyRound className="size-4" /> Credenciais de integração</div><h1 className="mt-3 text-3xl font-extrabold text-slate-950">Chaves de API</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Emita, substitua e revogue credenciais com menor privilégio, expiração opcional e hash irreversível.</p></div>
        <Dialog open={open} onOpenChange={value => value ? setOpen(true) : closeDialog()}>
          <DialogTrigger asChild><Button onClick={startNewKey} className="h-11 bg-[#0066cc] px-5 text-white"><Plus className="size-4" /> Emitir chave</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{rotatingId ? "Substituir chave de API" : "Nova chave de API"}</DialogTitle><DialogDescription>{rotatingId ? "A credencial atual será revogada assim que a nova chave for emitida. O novo segredo será exibido uma única vez." : "O segredo completo será mostrado uma única vez após a emissão."}</DialogDescription></DialogHeader>
            <form className="space-y-4" onSubmit={submit}>
              {isSpc && !rotatingId && <Field label="Organização"><Select value={form.organizationId} onValueChange={value => setForm({ ...form, organizationId: value })}><SelectTrigger><SelectValue placeholder="Organização atual" /></SelectTrigger><SelectContent>{organizations.data?.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.tradeName}</SelectItem>)}</SelectContent></Select></Field>}
              <Field label="Identificação"><Input required minLength={3} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Integração ERP produção" /></Field>
              <div className="space-y-2"><Label>Permissões</Label><div className="space-y-2 rounded-xl border p-3">{scopes.map(scope => <label key={scope.value} className="flex cursor-pointer items-center gap-3 text-sm"><Checkbox checked={form.scopes.includes(scope.value)} onCheckedChange={() => toggle(scope.value)} />{scope.label}</label>)}</div></div>
              <Field label="Expiração opcional"><Input type="date" value={form.expiresAt} onChange={event => setForm({ ...form, expiresAt: event.target.value })} /></Field>
              <div className="flex justify-end gap-3 border-t pt-4"><Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button><Button disabled={!form.scopes.length || create.isPending || rotate.isPending} className="bg-[#0066cc] text-white">{rotatingId ? "Substituir e revogar anterior" : "Emitir chave"}</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </section>
    {revealed && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-700" /><div className="min-w-0 flex-1"><h2 className="font-bold text-amber-950">Copie a chave agora</h2><p className="mt-1 text-sm text-amber-800">Por segurança, este segredo não poderá ser recuperado posteriormente.</p><div className="mt-3 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 text-sm text-slate-800">{revealed}</code><Button variant="outline" onClick={copy}><Copy className="size-4" /> Copiar</Button></div></div></div></section>}
    <section className="command-panel p-4 md:p-6">{list.isLoading ? <Skeleton className="h-48 w-full" /> : list.isError ? <QueryErrorState message={list.error.message} onRetry={() => void list.refetch()} /> : list.data?.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Identificador</TableHead><TableHead>Escopos</TableHead><TableHead>Expiração</TableHead><TableHead>Último uso</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{list.data.map(key => <TableRow key={key.id}><TableCell><div className="font-semibold text-slate-900">{key.name}</div><div className="text-xs text-slate-500">Org. #{key.organizationId}</div></TableCell><TableCell><code className="text-xs">{key.prefix}••••{key.lastFour}</code></TableCell><TableCell><div className="flex flex-wrap gap-1">{key.scopes.map(scope => <Badge key={scope} variant="secondary">{scope}</Badge>)}</div></TableCell><TableCell>{key.expiresAt ? new Date(key.expiresAt).toLocaleDateString("pt-BR") : "Sem expiração"}</TableCell><TableCell>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString("pt-BR") : "Nunca"}</TableCell><TableCell className="text-right">{key.revokedAt ? <Badge className="bg-slate-100 text-slate-600"><XCircle className="mr-1 size-3" />Revogada</Badge> : <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => startRotation(key)}><RefreshCw className="size-4" /> Substituir</Button><Button size="sm" variant="outline" onClick={() => revoke.mutate({ id: key.id })}>Revogar</Button></div>}</TableCell></TableRow>)}</TableBody></Table></div> : <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed bg-slate-50 p-8 text-center"><Check className="size-10 text-[#00a86b]" /><h3 className="mt-4 font-bold text-slate-900">Nenhuma chave ativa</h3><p className="mt-1 text-sm text-slate-500">Emita apenas quando uma integração realmente precisar de acesso.</p></div>}</section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
