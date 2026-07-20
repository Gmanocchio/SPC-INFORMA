import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { useLocation } from "wouter";

export default function FirstAccess() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const change = trpc.auth.changeFirstAccessPassword.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); navigate("/app", { replace: true }); } });
  function submit(event: FormEvent) { event.preventDefault(); if (newPassword !== confirmPassword) return; change.mutate({ currentPassword, newPassword }); }
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  return <div className="flex min-h-screen items-center justify-center bg-[#004A99] p-5"><div className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-2xl sm:p-10"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#0066CC]"><KeyRound /></span><h1 className="mt-7 text-3xl font-extrabold tracking-tight text-[#003B7A]">Proteja seu primeiro acesso</h1><p className="mt-3 leading-7 text-slate-600">Por segurança, substitua a senha provisória antes de acessar qualquer módulo da plataforma.</p>{change.error && <Alert variant="destructive" className="mt-6"><AlertDescription>{change.error.message}</AlertDescription></Alert>}<form className="mt-8 space-y-5" onSubmit={submit}><div className="space-y-2"><Label htmlFor="current">Senha provisória</Label><Input id="current" type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="h-12" required /></div><div className="space-y-2"><Label htmlFor="new">Nova senha</Label><Input id="new" type="password" minLength={12} value={newPassword} onChange={event => setNewPassword(event.target.value)} className="h-12" required /></div><div className="space-y-2"><Label htmlFor="confirm">Confirme a nova senha</Label><Input id="confirm" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="h-12" aria-invalid={mismatch} required />{mismatch && <p className="text-sm text-destructive">As senhas não coincidem.</p>}</div><div className="rounded-2xl bg-[#F5F7FA] p-4 text-sm leading-6 text-slate-600"><p className="flex items-center gap-2 font-semibold text-[#003B7A]"><CheckCircle2 className="h-4 w-4 text-[#00B67A]" /> Requisitos da senha</p><p className="mt-1">Mínimo de 12 caracteres, com maiúscula, minúscula, número e símbolo.</p></div><Button className="h-12 w-full bg-[#0066CC] font-bold" disabled={change.isPending || mismatch}>{change.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Atualizando...</> : "Salvar e acessar a plataforma"}</Button></form></div></div>;
}
