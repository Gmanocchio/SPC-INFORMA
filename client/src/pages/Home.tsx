import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Mail,
  Menu,
  MessageCircle,
  MessagesSquare,
  ShieldCheck,
  Smartphone,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const LOGO_URL = "/manus-storage/logo-spcbrasil_2505cb7b.webp";

const channels = [
  { name: "SMS", detail: "Comunicação direta e objetiva", icon: Smartphone, color: "text-spc-blue" },
  { name: "E-mail", detail: "Mensagens completas e rastreáveis", icon: Mail, color: "text-spc-green" },
  { name: "WhatsApp", detail: "Contato em canal de alta proximidade", icon: MessageCircle, color: "text-emerald-600" },
  { name: "RCS", detail: "Experiências ricas em dispositivos compatíveis", icon: MessagesSquare, color: "text-amber-500" },
];

const benefits = [
  { title: "Governança multiorganizacional", text: "Controle de acesso por perfil e isolamento lógico entre SPC Brasil, CDLs, distribuidoras e credores.", icon: ShieldCheck },
  { title: "Operação centralizada", text: "Templates, campanhas, brokers e retornos de entrega reunidos em um fluxo operacional rastreável.", icon: Zap },
  { title: "Inteligência financeira", text: "Precificação por canal, controle pré e pós-pago e visão consolidada de consumo.", icon: CircleDollarSign },
  { title: "Decisões orientadas por dados", text: "Indicadores de volume, entrega, canal e valor com filtros aderentes ao escopo do usuário.", icon: BarChart3 },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#004A99]/95 text-white backdrop-blur-xl">
        <div className="container flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD54A]">
            <span className="flex h-12 w-28 items-center justify-center rounded-xl bg-white px-3 shadow-sm">
              <img src={LOGO_URL} alt="SPC Brasil" className="h-auto w-full" />
            </span>
            <span className="hidden border-l border-white/25 pl-3 text-sm font-semibold tracking-wide sm:block">SPC Informa</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Navegação principal">
            <a href="#solucao" className="text-sm font-medium text-white/80 transition-colors hover:text-white">Solução</a>
            <a href="#beneficios" className="text-sm font-medium text-white/80 transition-colors hover:text-white">Benefícios</a>
            <a href="#seguranca" className="text-sm font-medium text-white/80 transition-colors hover:text-white">Segurança</a>
            <Button asChild className="h-11 rounded-full bg-[#FFD54A] px-6 font-bold text-[#003B7A] shadow-[0_8px_24px_rgba(255,213,74,.22)] hover:bg-[#ffe073]">
              <Link href="/acesso">Acessar SPC Informa</Link>
            </Button>
          </nav>
          <button type="button" className="rounded-lg p-2 text-white md:hidden" onClick={() => setMenuOpen(value => !value)} aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-white/10 bg-[#004A99] px-4 py-5 md:hidden">
            <nav className="container flex flex-col gap-4" aria-label="Navegação móvel">
              <a href="#solucao" onClick={() => setMenuOpen(false)}>Solução</a>
              <a href="#beneficios" onClick={() => setMenuOpen(false)}>Benefícios</a>
              <a href="#seguranca" onClick={() => setMenuOpen(false)}>Segurança</a>
              <Button asChild className="mt-2 bg-[#FFD54A] font-bold text-[#003B7A] hover:bg-[#ffe073]"><Link href="/acesso">Acessar SPC Informa</Link></Button>
            </nav>
          </div>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#004A99] pb-24 pt-36 text-white lg:pb-32 lg:pt-44">
          <div className="hero-grid absolute inset-0 opacity-40" aria-hidden="true" />
          <div className="absolute -right-36 top-24 h-[30rem] w-[30rem] rounded-full bg-[#0066CC]/50 blur-3xl" aria-hidden="true" />
          <div className="container relative grid items-center gap-16 lg:grid-cols-[1.08fr_.92fr]">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90">
                <ShieldCheck className="h-4 w-4 text-[#FFD54A]" />
                Governança e eficiência para toda a operação
              </div>
              <h1 className="text-balance text-4xl font-extrabold leading-[1.06] tracking-[-0.035em] sm:text-5xl lg:text-7xl">
                SPC Informa: comunicação multicanal com <span className="text-[#FFD54A]">controle de ponta a ponta.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-blue-50/85 lg:text-xl">
                Uma plataforma concebida para o ecossistema SPC Brasil gerenciar comunicações, preços, organizações e resultados com segurança e clareza operacional.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="h-14 rounded-full bg-[#FFD54A] px-8 text-base font-bold text-[#003B7A] shadow-[0_14px_40px_rgba(255,213,74,.24)] hover:bg-[#ffe073]">
                  <Link href="/acesso">Acessar SPC Informa <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
                <a href="#solucao" className="inline-flex h-14 items-center justify-center rounded-full border border-white/25 px-8 font-semibold text-white transition-colors hover:bg-white/10">Conhecer a solução</a>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-8 rounded-[2.5rem] bg-gradient-to-br from-[#4DA3FF]/20 to-[#00B67A]/20 blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/[.08] p-5 shadow-2xl backdrop-blur-xl sm:p-7">
                <div className="flex items-center justify-between border-b border-white/10 pb-5">
                  <div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-100/60">Visão operacional</p><p className="mt-1 font-semibold">Jornada multicanal integrada</p></div>
                  <span className="flex items-center gap-2 text-xs font-semibold text-emerald-200"><span className="h-2 w-2 rounded-full bg-[#00B67A] shadow-[0_0_0_5px_rgba(0,182,122,.14)]" /> Operação monitorada</span>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {channels.map(({ name, icon: Icon }, index) => (
                    <div key={name} className="rounded-2xl border border-white/10 bg-white/[.07] p-4">
                      <div className="flex items-center justify-between"><Icon className="h-5 w-5 text-[#FFD54A]" /><CheckCircle2 className="h-4 w-4 text-[#00B67A]" /></div>
                      <p className="mt-5 text-sm font-bold">{name}</p><p className="mt-1 text-xs text-blue-100/60">Canal {index + 1} conectado</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-white p-5 text-slate-900">
                  <div className="flex items-end justify-between"><div><p className="text-xs font-semibold text-slate-500">Indicadores consolidados</p><p className="mt-1 text-xl font-extrabold text-[#004A99]">Gestão em tempo real</p></div><BarChart3 className="h-8 w-8 text-[#0066CC]" /></div>
                  <div className="mt-5 flex h-16 items-end gap-2" aria-hidden="true">{[45, 72, 55, 88, 67, 94, 78, 100].map((height, index) => <span key={index} className="flex-1 rounded-t-md bg-gradient-to-t from-[#0066CC] to-[#4DA3FF]" style={{ height: `${height}%` }} />)}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="solucao" className="bg-[#F5F7FA] py-24 lg:py-32">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center"><p className="section-kicker">Comunicação integrada</p><h2 className="section-title">Quatro canais, uma única governança.</h2><p className="section-copy">Escolha o canal adequado a cada jornada sem perder visibilidade operacional, financeira ou de entrega.</p></div>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{channels.map(({ name, detail, icon: Icon, color }) => <article key={name} className="group rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_12px_38px_rgba(15,45,80,.06)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(15,45,80,.11)]"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F7FA]"><Icon className={`h-6 w-6 ${color}`} /></span><h3 className="mt-7 text-xl font-bold text-[#003B7A]">{name}</h3><p className="mt-3 leading-7 text-slate-600">{detail}</p></article>)}</div>
          </div>
        </section>

        <section id="beneficios" className="py-24 lg:py-32">
          <div className="container grid gap-14 lg:grid-cols-[.78fr_1.22fr] lg:items-start">
            <div className="lg:sticky lg:top-28"><p className="section-kicker">Gestão completa</p><h2 className="section-title text-left">Estrutura preparada para operações exigentes.</h2><p className="section-copy text-left">Da configuração do acesso à análise dos resultados, cada etapa foi desenhada para reduzir riscos e ampliar a capacidade de gestão.</p></div>
            <div className="grid gap-5 sm:grid-cols-2">{benefits.map(({ title, text, icon: Icon }, index) => <article key={title} className="rounded-3xl border border-slate-200 bg-white p-7"><div className="flex items-center justify-between"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0066CC]"><Icon className="h-6 w-6" /></span><span className="text-sm font-black text-slate-200">0{index + 1}</span></div><h3 className="mt-8 text-xl font-bold text-[#003B7A]">{title}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p></article>)}</div>
          </div>
        </section>

        <section id="seguranca" className="bg-[#003B7A] py-20 text-white lg:py-24">
          <div className="container grid gap-12 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-sm font-extrabold uppercase tracking-[.18em] text-[#FFD54A]">Segurança por arquitetura</p><h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">Acesso por perfil, autenticação em duas etapas e rastreabilidade operacional.</h2><p className="mt-5 max-w-3xl text-lg leading-8 text-blue-100/75">Sessões protegidas, segregação organizacional e trilhas de auditoria ajudam a sustentar uma operação responsável e verificável.</p></div><Button asChild size="lg" className="h-14 rounded-full bg-[#00B67A] px-8 font-bold text-white hover:bg-[#00a66f]"><Link href="/acesso">Acessar SPC Informa <ArrowRight className="ml-2" /></Link></Button></div>
        </section>
      </main>
      <footer className="bg-[#002F62] py-10 text-blue-100/70"><div className="container flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex h-10 w-24 items-center justify-center rounded-lg bg-white px-2"><img src={LOGO_URL} alt="SPC Brasil" className="w-full" /></span><span className="text-sm font-semibold text-white">SPC Informa</span></div><p className="text-sm">Plataforma de gestão multicanal para o ecossistema SPC Brasil.</p></div></footer>
    </div>
  );
}
