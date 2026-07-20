import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";

const LOGO_URL = "/manus-storage/logo-spcbrasil_2505cb7b.webp";

export default function RecoverPassword() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const request = trpc.auth.requestPasswordReset.useMutation({ onSuccess: result => setRequestId(result.requestId) });
  const reset = trpc.auth.resetPassword.useMutation({ onSuccess: () => setTimeout(() => navigate("/acesso"), 1600) });
  function submitRequest(event: FormEvent) { event.preventDefault(); request.mutate({ email }); }
  function submitReset(event: FormEvent) { event.preventDefault(); if (requestId) reset.mutate({ requestId, code, newPassword }); }
  const error = request.error?.message ?? reset.error?.message;
  return <div className="flex min-h-screen items-center justify-center bg-[#F5F7FA] p-5"><div className="w-full max-w-md"><Link href="/acesso" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#004A99]"><ArrowLeft className="h-4 w-4" /> Voltar ao acesso</Link><div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_70px_rgba(15,45,80,.09)] sm:p-10"><img src={LOGO_URL} alt="SPC Brasil" className="h-auto w-28" /><div className="mt-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0066CC]">{reset.isSuccess ? <CheckCircle2 /> : <KeyRound />}</div><h1 className="mt-6 text-3xl font-extrabold tracking-tight text-[#003B7A]">{reset.isSuccess ? "Senha atualizada" : requestId ? "Defina uma nova senha" : "Recupere seu acesso"}</h1><p className="mt-3 leading-7 text-slate-600">{reset.isSuccess ? "Você será direcionado para a tela de acesso." : requestId ? "Informe o código recebido por e-mail e escolha uma senha forte." : "Enviaremos instruções para o e-mail cadastrado, caso a conta esteja ativa."}</p>{error && <Alert variant="destructive" className="mt-6"><AlertDescription>{error}</AlertDescription></Alert>}{!reset.isSuccess && (!requestId ? <form className="mt-8 space-y-5" onSubmit={submitRequest}><div className="space-y-2"><Label htmlFor="recovery-email">E-mail corporativo</Label><div className="relative"><Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="recovery-email" type="email" value={email} onChange={event => setEmail(event.target.value)} className="h-12 pl-10" required /></div></div><Button className="h-12 w-full bg-[#0066CC] font-bold" disabled={request.isPending}>{request.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar instruções"}</Button></form> : <form className="mt-8 space-y-5" onSubmit={submitReset}><div className="space-y-2"><Label htmlFor="reset-code">Código de segurança</Label><Input id="reset-code" inputMode="numeric" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="h-12 text-center text-xl font-bold tracking-[.4em]" required /></div><div className="space-y-2"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" type="password" minLength={12} value={newPassword} onChange={event => setNewPassword(event.target.value)} className="h-12" required /><p className="text-xs text-slate-500">Use ao menos 12 caracteres, combinando maiúscula, minúscula, número e símbolo.</p></div><Button className="h-12 w-full bg-[#0066CC] font-bold" disabled={reset.isPending || code.length !== 6}>{reset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar senha"}</Button></form>)}</div></div></div>;
}
