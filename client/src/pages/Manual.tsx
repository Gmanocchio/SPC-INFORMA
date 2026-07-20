import { useAuth } from "@/_core/hooks/useAuth";
import { ManualVisual } from "@/components/manual/ManualVisual";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  filterManualChapters,
  getManualReadingMinutes,
  getVisibleManualChapters,
  MANUAL_ORGANIZATION_LABELS,
  MANUAL_ROLE_LABELS,
  type ManualChapter,
  type ManualChapterId,
  type ManualOrganizationType,
  type ManualRole,
} from "@/lib/manual-content";
import {
  AlertTriangle,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Info,
  Lightbulb,
  ListChecks,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function Manual() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [openChapters, setOpenChapters] = useState<string[]>([]);
  const [readChapters, setReadChapters] = useState<Set<ManualChapterId>>(() => new Set());
  const role = (user?.user.role ?? "REQUESTER") as ManualRole;
  const organizationType = (user?.organization.type ?? "CREDITOR") as ManualOrganizationType;
  const hasSupportedIdentity = Boolean(
    user
    && Object.prototype.hasOwnProperty.call(MANUAL_ROLE_LABELS, user.user.role)
    && Object.prototype.hasOwnProperty.call(MANUAL_ORGANIZATION_LABELS, user.organization.type),
  );
  const visibleChapters = useMemo(() => getVisibleManualChapters({ role, organizationType }), [organizationType, role]);
  const filteredChapters = useMemo(() => filterManualChapters(visibleChapters, search), [search, visibleChapters]);
  const progress = visibleChapters.length ? Math.round((readChapters.size / visibleChapters.length) * 100) : 0;
  const isSpcScope = role === "SPC_ADMIN" || organizationType === "SPC_BRASIL";

  useEffect(() => {
    if (search.trim()) setOpenChapters(filteredChapters.map(chapter => chapter.id));
  }, [filteredChapters, search]);

  useEffect(() => {
    setOpenChapters(current => current.length ? current : visibleChapters.slice(0, 1).map(chapter => chapter.id));
  }, [visibleChapters]);

  const goToChapter = (id: ManualChapterId) => {
    setOpenChapters(current => current.includes(id) ? current : [...current, id]);
    window.requestAnimationFrame(() => document.getElementById(`manual-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const toggleRead = (id: ManualChapterId) => {
    setReadChapters(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (!hasSupportedIdentity) {
    return <ManualErrorState />;
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6" data-testid="manual-page">
      <section className="relative overflow-hidden rounded-3xl bg-[#003B7A] px-5 py-8 text-white shadow-[0_24px_70px_-38px_rgba(0,59,122,.9)] sm:px-8 lg:px-10 lg:py-10">
        <div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-[#11A8E2]/20 blur-2xl" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[.14em] text-blue-50"><BookOpenCheck className="size-4 text-[#FFD84D]" /> Manual do sistema</div>
            <h1 className="mt-5 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl lg:text-[2.65rem]">Aprenda a usar o SPC Informa, do acesso à operação</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100 sm:text-base">Consulte instruções completas, exemplos práticos e telas ilustradas. O conteúdo é adaptado às funcionalidades disponíveis para seu perfil.</p>
            <div className="relative mt-6 max-w-3xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <Input aria-label="Buscar no Manual" className="h-14 rounded-2xl border-white/20 bg-white pl-12 pr-12 text-base text-slate-900 shadow-xl placeholder:text-slate-400 focus-visible:ring-[#FFD84D]" placeholder="Busque por campanha, planilha, usuário, preço, chave…" value={search} onChange={event => setSearch(event.target.value)} />
              {search && <button type="button" aria-label="Limpar busca" className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={() => setSearch("")}><X className="size-4" /></button>}
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm" data-testid="manual-scope-card">
            <p className="text-xs font-extrabold uppercase tracking-[.14em] text-blue-200">Manual do seu acesso</p>
            <div className="mt-4 flex items-center gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#FFD84D] text-[#003B7A]"><ShieldCheck className="size-5" /></div><div className="min-w-0"><p className="truncate font-extrabold">{MANUAL_ORGANIZATION_LABELS[organizationType]}</p><p className="mt-0.5 text-sm text-blue-100">{MANUAL_ROLE_LABELS[role]}</p></div></div>
            <div className="mt-5 grid grid-cols-2 gap-3"><Metric value={visibleChapters.length} label="capítulos" /><Metric value={getManualReadingMinutes(visibleChapters)} label="minutos" /></div>
            <p className="mt-4 text-xs leading-5 text-blue-100">{isSpcScope ? "Visão integral de todos os níveis, módulos e orientações." : "Visão filtrada para as telas e ações permitidas ao seu acesso."}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start">
        <aside className="space-y-4 xl:sticky xl:top-6" aria-label="Sumário do Manual">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-[#0066CC]"><ListChecks className="size-5" /></div><div><h2 className="font-extrabold text-[#003B7A]">Sumário do perfil</h2><p className="text-xs text-slate-500">{filteredChapters.length} de {visibleChapters.length} capítulos</p></div></div>
            <nav className="mt-4 max-h-[46vh] space-y-1 overflow-y-auto pr-1" data-testid="manual-toc">
              {filteredChapters.map((chapter, index) => <button key={chapter.id} type="button" className="group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-blue-50" onClick={() => goToChapter(chapter.id)}><span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-black ${readChapters.has(chapter.id) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{readChapters.has(chapter.id) ? <Check className="size-3.5" /> : index + 1}</span><span className="text-sm font-bold leading-5 text-slate-600 group-hover:text-[#004A99]">{chapter.shortTitle}</span></button>)}
            </nav>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><div className="flex justify-between"><p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#004A99]">Seu progresso</p><span className="text-sm font-black text-[#003B7A]">{progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#0066CC] transition-[width]" style={{ width: `${progress}%` }} /></div><p className="mt-3 text-xs leading-5 text-slate-600">Marque os capítulos concluídos. O progresso vale para esta sessão.</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-[.12em] text-slate-400">Sobre as imagens</p><p className="mt-4 flex gap-2 text-sm leading-5 text-slate-600"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> A tela de acesso é uma captura real sem credenciais.</p><p className="mt-3 flex gap-2 text-sm leading-5 text-slate-600"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#0066CC]" /> As demais usam dados demonstrativos seguros.</p></div>
        </aside>

        <section className="min-w-0 space-y-5" aria-live="polite" data-testid="manual-results">
          {search && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-sm text-slate-600"><strong className="text-slate-900">{filteredChapters.length}</strong> resultado(s) para “{search}”.</p><Button type="button" variant="ghost" size="sm" onClick={() => setSearch("")}>Limpar busca</Button></div>}
          <Accordion type="multiple" value={openChapters} onValueChange={setOpenChapters} className="space-y-5">
            {filteredChapters.map((chapter, index) => <ChapterCard key={chapter.id} chapter={chapter} index={visibleChapters.findIndex(item => item.id === chapter.id) + 1 || index + 1} organizationType={organizationType} role={role} isRead={readChapters.has(chapter.id)} onToggleRead={() => toggleRead(chapter.id)} onNavigate={navigate} />)}
          </Accordion>
          {!filteredChapters.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center" data-testid="manual-empty-state"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Search className="size-5" /></div><h2 className="mt-4 font-extrabold text-slate-900">Nenhum capítulo encontrado</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Tente outro termo. O resultado continua limitado às funcionalidades do seu perfil.</p><Button type="button" className="mt-5 bg-[#0066CC] text-white hover:bg-[#004A99]" onClick={() => setSearch("")}>Limpar busca</Button></div>}
        </section>
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div className="rounded-xl bg-[#002F61]/65 p-3"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-xs text-blue-100">{label}</p></div>;
}

function ManualErrorState() {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center" role="alert" data-testid="manual-error-state">
      <div className="w-full rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600"><AlertTriangle className="size-6" /></div>
        <h1 className="mt-5 text-2xl font-black text-[#003B7A]">Não foi possível preparar o seu Manual</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">Não conseguimos identificar com segurança o perfil e a organização desta sessão. Atualize a página; se o problema continuar, encerre a sessão e entre novamente.</p>
        <Button type="button" className="mt-6 bg-[#0066CC] text-white hover:bg-[#004A99]" onClick={() => window.location.reload()}><RotateCcw className="size-4" /> Tentar novamente</Button>
      </div>
    </div>
  );
}

function ChapterCard({ chapter, index, organizationType, role, isRead, onToggleRead, onNavigate }: {
  chapter: ManualChapter;
  index: number;
  organizationType: ManualOrganizationType;
  role: ManualRole;
  isRead: boolean;
  onToggleRead: () => void;
  onNavigate: (path: string) => void;
}) {
  const profileNote = chapter.profileNotes?.[organizationType];
  const roleNote = chapter.roleNotes?.[role];

  return (
    <AccordionItem id={`manual-${chapter.id}`} value={chapter.id} className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid={`manual-chapter-${chapter.id}`}>
      <AccordionTrigger className="gap-4 px-4 py-5 text-left hover:no-underline sm:px-6">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-sm font-black ${isRead ? "bg-emerald-100 text-emerald-700" : "bg-blue-50 text-[#0066CC]"}`}>{isRead ? <Check className="size-5" /> : String(index).padStart(2, "0")}</span>
        <span className="min-w-0 flex-1"><span className="block text-lg font-black leading-6 text-[#003B7A]">{chapter.title}</span><span className="mt-1.5 block text-sm font-normal leading-5 text-slate-500">{chapter.summary}</span></span>
        <Badge variant="secondary" className="hidden shrink-0 bg-slate-100 text-slate-600 sm:inline-flex"><Clock3 className="mr-1 size-3" />{chapter.estimatedMinutes} min</Badge>
      </AccordionTrigger>
      <AccordionContent className="border-t border-slate-100 px-4 pb-6 pt-5 sm:px-6">
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
            <InfoCard title="Para que serve" icon={<Info className="size-5" />} tone="blue"><p>{chapter.purpose}</p></InfoCard>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <h3 className="text-xs font-extrabold uppercase tracking-[.12em] text-slate-500">Antes de começar</h3>
              {chapter.prerequisites.length ? <ul className="mt-3 space-y-2 text-sm leading-5 text-slate-600">{chapter.prerequisites.map(item => <li key={item} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{item}</li>)}</ul> : <p className="mt-3 text-sm text-slate-600">Nenhum pré-requisito adicional.</p>}
            </div>
          </div>

          {(profileNote || roleNote) && <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 sm:p-5" data-testid={`manual-profile-note-${chapter.id}`}><div className="flex gap-3"><Sparkles className="mt-0.5 size-5 shrink-0 text-violet-600" /><div><h3 className="font-extrabold text-violet-950">Como funciona no seu acesso</h3>{profileNote && <p className="mt-2 text-sm leading-6 text-violet-900/75">{profileNote}</p>}{roleNote && <p className="mt-2 text-sm leading-6 text-violet-900/75">{roleNote}</p>}</div></div></div>}

          <ManualVisual type={chapter.visual} />

          <div>
            <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-blue-50 text-[#0066CC]"><ListChecks className="size-4" /></div><div><h3 className="font-black text-slate-900">Passo a passo</h3><p className="text-xs text-slate-500">Siga a sequência e revise os alertas.</p></div></div>
            <ol className="mt-4 space-y-3">
              {chapter.steps.map((step, stepIndex) => <li key={`${chapter.id}-${step.title}`} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#0066CC] text-xs font-black text-white">{stepIndex + 1}</span><div className="min-w-0"><h4 className="font-extrabold text-slate-900">{step.title}</h4><p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p></div></div>
                {step.example && <div className="mt-3 flex gap-3 rounded-xl bg-blue-50 p-3 text-sm leading-5 text-blue-900"><Lightbulb className="mt-0.5 size-4 shrink-0 text-[#0066CC]" /><p><strong>Exemplo:</strong> {step.example}</p></div>}
                {step.warning && <div className="mt-3 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" /><p><strong>Atenção:</strong> {step.warning}</p></div>}
              </li>)}
            </ol>
          </div>

          <InfoCard title="Boas práticas" icon={<CheckCircle2 className="size-5" />} tone="green"><ul className="space-y-2">{chapter.bestPractices.map(item => <li key={item} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" />{item}</li>)}</ul></InfoCard>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant={isRead ? "secondary" : "outline"} className={isRead ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "bg-white text-slate-700"} onClick={onToggleRead}><Check className="size-4" /> {isRead ? "Capítulo lido" : "Marcar como lido"}</Button>
            {chapter.route && <Button type="button" className="bg-[#0066CC] text-white hover:bg-[#004A99]" onClick={() => onNavigate(chapter.route!)}>{chapter.routeLabel ?? "Abrir funcionalidade"} <ExternalLink className="size-4" /></Button>}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function InfoCard({ title, icon, tone, children }: { title: string; icon: React.ReactNode; tone: "blue" | "green"; children: React.ReactNode }) {
  const styles = tone === "blue" ? "border-blue-100 bg-blue-50 text-[#003B7A]" : "border-emerald-100 bg-emerald-50 text-emerald-950";
  return <div className={`rounded-2xl border p-4 sm:p-5 ${styles}`}><div className="flex gap-3"><span className="mt-0.5 shrink-0">{icon}</span><div className="min-w-0"><h3 className="font-extrabold">{title}</h3><div className="mt-2 text-sm leading-6 opacity-80">{children}</div></div></div></div>;
}
