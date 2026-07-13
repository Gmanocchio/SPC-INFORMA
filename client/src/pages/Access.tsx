import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

const LOGO_URL = "/manus-storage/logo-spcbrasil_2505cb7b.webp";

export default function Access() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [step, setStep] = useState<"credentials" | "two-factor">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<{ id: string; hint: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  useEffect(() => {
    if (me.data?.user) navigate(me.data.user.mustChangePassword ? "/app/primeiro-acesso" : "/app", { replace: true });
  }, [me.data, navigate]);

  const login = trpc.auth.login.useMutation({
    onSuccess: result => {
      setChallenge({ id: result.challengeId, hint: result.emailHint });
      setStep("two-factor");
    },
  });
  const verify = trpc.auth.verifyTwoFactor.useMutation({
    onSuccess: async result => {
      await utils.auth.me.invalidate();
      navigate(result.mustChangePassword ? "/app/primeiro-acesso" : "/app", { replace: true });
    },
  });

  function submitCredentials(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email, password });
  }
  function submitCode(event: FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    verify.mutate({ challengeId: challenge.id, code });
  }

  const activeError = login.error?.message ?? verify.error?.message;
  return (
    <div className="min-h-screen bg-[#F5F7FA] lg:grid lg:grid-cols-[.92fr_1.08fr]">
      <aside className="relative hidden overflow-hidden bg-[#004A99] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="hero-grid absolute inset-0 opacity-30" />
        <div className="relative"><Link href="/" className="inline-flex h-14 w-32 items-center rounded-xl bg-white px-3 shadow-lg"><img src={LOGO_URL} alt="SPC Brasil" /></Link></div>
        <div className="relative max-w-xl"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10"><ShieldCheck className="h-7 w-7 text-[#FFD54A]" /></span><h1 className="mt-8 text-4xl font-extrabold leading-tight tracking-tight">Governança e segurança para sua operação multicanal.</h1><p className="mt-5 text-lg leading-8 text-blue-100/75">Acesse campanhas, indicadores e configurações de acordo com o seu perfil e organização.</p><div className="mt-10 grid gap-4 text-sm text-blue-50/85"><p className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#00B67A]" /> Autenticação em duas etapas por e-mail</p><p className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#00B67A]" /> Isolamento lógico entre organizações</p><p className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#00B67A]" /> Sessões seguras e acesso por perfil</p></div></div>
        <p className="relative text-xs text-blue-100/50">Acesso restrito a usuários previamente autorizados.</p>
      </aside>
      <main className="flex min-h-screen items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#004A99]"><ArrowLeft className="h-4 w-4" /> Voltar ao início</Link>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_70px_rgba(15,45,80,.09)] sm:p-10">
            <div className="mb-8 flex items-center gap-4 lg:hidden"><span className="flex h-12 w-28 items-center rounded-xl border border-slate-100 bg-white px-2 shadow-sm"><img src={LOGO_URL} alt="SPC Brasil" /></span><span className="text-sm font-bold text-[#004A99]">Notificadora</span></div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0066CC]">{step === "credentials" ? <LockKeyhole className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}</div>
            <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-[#003B7A]">{step === "credentials" ? "Acesse sua conta" : "Confirme seu acesso"}</h2>
            <p className="mt-3 leading-7 text-slate-600">{step === "credentials" ? "Informe suas credenciais corporativas para continuar." : `Enviamos um código de 6 dígitos para ${challenge?.hint ?? "seu e-mail"}.`}</p>
            {activeError && <Alert variant="destructive" className="mt-6"><AlertDescription>{activeError}</AlertDescription></Alert>}
            {step === "credentials" ? (
              <form className="mt-8 space-y-5" onSubmit={submitCredentials}>
                <div className="space-y-2"><Label htmlFor="email">E-mail corporativo</Label><div className="relative"><Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="h-12 pl-10" placeholder="nome@empresa.com.br" required /></div></div>
                <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="password">Senha</Label><Link href="/recuperar-senha" className="text-sm font-semibold text-[#0066CC] hover:underline">Esqueci minha senha</Link></div><div className="relative"><LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="h-12 px-10" required /><button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                <Button className="h-12 w-full bg-[#0066CC] font-bold hover:bg-[#004A99]" disabled={login.isPending}>{login.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validando...</> : "Continuar"}</Button>
              </form>
            ) : (
              <form className="mt-8 space-y-5" onSubmit={submitCode}>
                <div className="space-y-2"><Label htmlFor="code">Código de segurança</Label><Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="h-14 text-center text-2xl font-bold tracking-[.5em]" placeholder="000000" required /></div>
                <Button className="h-12 w-full bg-[#0066CC] font-bold hover:bg-[#004A99]" disabled={verify.isPending || code.length !== 6}>{verify.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirmando...</> : "Confirmar acesso"}</Button>
                <button type="button" onClick={() => { setStep("credentials"); setCode(""); }} className="w-full text-sm font-semibold text-slate-500 hover:text-[#0066CC]">Voltar e revisar credenciais</button>
              </form>
            )}
          </div>
          <p className="mt-6 text-center text-xs leading-5 text-slate-500">Não é permitido criar contas nesta tela. O acesso é liberado por administradores autorizados.</p>
        </div>
      </main>
    </div>
  );
}
