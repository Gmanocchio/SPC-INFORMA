import { Button } from "@/components/ui/button";
import { useBrand } from "@/contexts/BrandContext";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  Mail,
  Menu,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const channels = [
  { label: "SMS", detail: "Mensagens objetivas", icon: Smartphone },
  { label: "E-mail", detail: "Comunicação completa", icon: Mail },
  { label: "WhatsApp", detail: "Relacionamento direto", icon: MessageCircle },
  { label: "RCS", detail: "Experiências enriquecidas", icon: Sparkles },
];

const benefits = [
  {
    title: "Gestão por organização",
    text: "Administre empresas, usuários e credores dentro do escopo seguro da Credits Brasil.",
    icon: UsersRound,
  },
  {
    title: "Operação multicanal",
    text: "Planeje campanhas, importe bases e acompanhe retornos de SMS, E-mail, WhatsApp e RCS.",
    icon: Zap,
  },
  {
    title: "Controle financeiro",
    text: "Consulte preços, saldos, consumo e indicadores consolidados para tomar decisões com clareza.",
    icon: CircleDollarSign,
  },
];

export default function CreditsHome() {
  const brand = useBrand();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F3F3F8] text-[#243871]" data-testid="credits-home">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#001565]/90 text-white backdrop-blur-xl">
        <div className="container flex h-20 items-center justify-between">
          <Link
            href={brand.homePath}
            className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED884A]"
          >
            <img src={brand.logoUrl} alt="Credits Brasil" className="h-auto w-[138px]" />
            <span className="hidden border-l border-white/25 pl-3 text-sm font-semibold tracking-wide sm:block">Informa</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Navegação principal Credits Informa">
            <a href="#solucao" className="text-sm font-medium text-white/75 transition-colors hover:text-white">Solução</a>
            <a href="#beneficios" className="text-sm font-medium text-white/75 transition-colors hover:text-white">Benefícios</a>
            <a href="#seguranca" className="text-sm font-medium text-white/75 transition-colors hover:text-white">Segurança</a>
            <Button asChild className="h-11 rounded-full bg-[#ED884A] px-6 font-bold text-white shadow-[0_10px_30px_rgba(237,136,74,.28)] hover:bg-[#f29a67]">
              <Link href={brand.accessPath}>Acessar Credits Informa</Link>
            </Button>
          </nav>

          <button
            type="button"
            className="rounded-lg p-2 text-white md:hidden"
            onClick={() => setMenuOpen(current => !current)}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-white/10 bg-[#001565] px-4 py-5 md:hidden">
            <nav className="container flex flex-col gap-4 text-white" aria-label="Navegação móvel Credits Informa">
              <a href="#solucao" onClick={() => setMenuOpen(false)}>Solução</a>
              <a href="#beneficios" onClick={() => setMenuOpen(false)}>Benefícios</a>
              <a href="#seguranca" onClick={() => setMenuOpen(false)}>Segurança</a>
              <Button asChild className="mt-2 bg-[#ED884A] font-bold text-white hover:bg-[#f29a67]">
                <Link href={brand.accessPath}>Acessar Credits Informa</Link>
              </Button>
            </nav>
          </div>
        )}
      </header>

      <main>
        <section id="solucao" className="relative overflow-hidden bg-gradient-to-br from-[#001565] via-[#243871] to-[#183A78] pb-24 pt-36 text-white lg:min-h-[760px] lg:pb-28 lg:pt-40">
          <div className="credits-dot-grid pointer-events-none absolute inset-0 opacity-45" />
          <div className="pointer-events-none absolute -right-32 top-28 h-[34rem] w-[34rem] rounded-full border-[64px] border-[#13BEE6]/20" />
          <div className="pointer-events-none absolute -bottom-56 right-[18%] h-[34rem] w-[34rem] rounded-full border-[74px] border-[#ED884A]/18" />

          <div className="container relative grid gap-14 lg:grid-cols-[1.08fr_.92fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90">
                <ShieldCheck className="h-4 w-4 text-[#13BEE6]" />
                Comunicação segura para o ciclo de vendas
              </div>
              <h1 className="mt-7 max-w-4xl text-balance text-4xl font-extrabold leading-[1.06] tracking-[-0.04em] sm:text-5xl lg:text-7xl">
                Credits Informa: operação multicanal com <span className="text-[#ED884A]">inteligência e controle.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/72 lg:text-xl">
                Gerencie campanhas, organizações, preços e resultados em uma experiência conectada à sua operação Credits Brasil.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="h-14 rounded-full bg-[#ED884A] px-8 text-base font-bold text-white shadow-[0_16px_44px_rgba(237,136,74,.3)] hover:bg-[#f29a67]">
                  <Link href={brand.accessPath}>Acessar Credits Informa <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
                <a href="#beneficios" className="inline-flex h-14 items-center justify-center rounded-full border border-white/25 px-8 font-semibold text-white transition-colors hover:bg-white/10">
                  Conhecer a solução
                </a>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-6 rounded-[2.75rem] bg-[#13BEE6]/10 blur-2xl" />
              <div className="relative overflow-hidden rounded-[2.25rem] border border-white/15 bg-white/10 p-5 shadow-[0_35px_90px_rgba(0,8,57,.45)] backdrop-blur-xl sm:p-7">
                <div className="flex items-start justify-between border-b border-white/10 pb-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.18em] text-[#13BEE6]">Visão operacional</p>
                    <h2 className="mt-2 text-xl font-bold">Jornada multicanal integrada</h2>
                  </div>
                  <span className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/75"><span className="h-2 w-2 rounded-full bg-[#13BEE6]" /> Operação monitorada</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {channels.map(({ label, detail, icon: Icon }) => (
                    <article key={label} className="rounded-2xl border border-white/10 bg-white/[.07] p-4 transition-transform duration-200 hover:-translate-y-0.5">
                      <div className="flex items-center justify-between"><Icon className="h-5 w-5 text-[#ED884A]" /><span className="h-2.5 w-2.5 rounded-full border-2 border-[#13BEE6]" /></div>
                      <h3 className="mt-7 font-bold">{label}</h3>
                      <p className="mt-1 text-xs text-white/50">{detail}</p>
                    </article>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-white p-5 text-[#243871] shadow-xl">
                  <div className="flex items-end justify-between gap-4">
                    <div><p className="text-xs font-semibold text-slate-500">Indicadores consolidados</p><p className="mt-1 text-lg font-extrabold">Gestão em tempo real</p></div>
                    <BarChart3 className="h-7 w-7 text-[#13BEE6]" />
                  </div>
                  <div className="mt-5 flex h-16 items-end gap-2" aria-label="Ilustração de evolução operacional">
                    {[38, 62, 48, 77, 58, 84, 69, 91].map((height, index) => <span key={index} className="flex-1 rounded-t-md bg-gradient-to-t from-[#243871] to-[#13BEE6]" style={{ height: `${height}%` }} />)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="beneficios" className="py-20 lg:py-24">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-extrabold uppercase tracking-[.18em] text-[#ED884A]">Você escolhe como operar</p>
              <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-[-.03em] text-[#243871] sm:text-4xl lg:text-5xl">Uma plataforma única para transformar comunicação em resultado.</h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">Ferramentas conectadas para organizar sua operação, acompanhar desempenho e manter governança do início ao fim.</p>
            </div>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {benefits.map(({ title, text, icon: Icon }, index) => (
                <article key={title} className="group relative overflow-hidden rounded-3xl border border-[#243871]/10 bg-white p-7 shadow-[0_20px_60px_-45px_rgba(36,56,113,.55)]">
                  <span className={`absolute inset-x-0 top-0 h-1.5 ${index === 1 ? "bg-[#13BEE6]" : index === 2 ? "bg-[#ED884A]" : "bg-[#243871]"}`} />
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#243871]/8 text-[#243871]"><Icon className="h-6 w-6" /></span>
                  <h3 className="mt-6 text-xl font-extrabold">{title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{text}</p>
                  <p className="mt-6 flex items-center gap-2 text-sm font-bold text-[#243871]"><CheckCircle2 className="h-4 w-4 text-[#13BEE6]" /> Dentro do seu escopo de acesso</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-20 lg:py-24">
          <div className="container grid gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[.18em] text-[#13BEE6]">Fluxo simples e rastreável</p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-.03em] text-[#243871] sm:text-4xl">Da base ao resultado, cada etapa fica sob controle.</h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">Crie campanhas, valide arquivos, confirme preços e acompanhe a entrega com dados centralizados e histórico auditável.</p>
              <Button asChild className="mt-8 h-12 rounded-full bg-[#243871] px-7 font-bold text-white hover:bg-[#001565]">
                <Link href={brand.accessPath}>Entrar na plataforma <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["01", "Configurar", "Defina canal, credor, template e período."],
                ["02", "Importar", "Carregue a base no layout validado."],
                ["03", "Revisar", "Confira registros, preço e alertas."],
                ["04", "Acompanhar", "Monitore entrega, interação e consumo."],
              ].map(([number, title, text]) => (
                <article key={number} className="rounded-3xl border border-slate-200 bg-[#F3F3F8] p-6">
                  <span className="text-sm font-extrabold tracking-[.16em] text-[#ED884A]">{number}</span>
                  <h3 className="mt-7 text-xl font-extrabold text-[#243871]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="seguranca" className="relative overflow-hidden bg-[#243871] py-20 text-white lg:py-24">
          <div className="credits-dot-grid pointer-events-none absolute inset-0 opacity-30" />
          <div className="container relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[.18em] text-[#13BEE6]">Segurança integrada</p>
              <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">Acesso por perfil, autenticação em duas etapas e rastreabilidade operacional.</h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/65">A sessão respeita a organização, o papel e as permissões já definidos para cada usuário autorizado.</p>
            </div>
            <Button asChild size="lg" className="h-14 rounded-full bg-[#ED884A] px-8 font-bold text-white hover:bg-[#f29a67]">
              <Link href={brand.accessPath}>Acessar Credits Informa <ArrowRight className="ml-2" /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="bg-[#001565] py-10 text-white/60">
        <div className="container flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><img src={brand.logoUrl} alt="Credits Brasil" className="h-auto w-32" /><span className="border-l border-white/20 pl-3 text-sm font-semibold text-white">Informa</span></div>
          <p className="flex items-center gap-2 text-sm"><FileCheck2 className="h-4 w-4 text-[#13BEE6]" /> Plataforma multicanal da sua operação Credits Brasil.</p>
        </div>
      </footer>
    </div>
  );
}
