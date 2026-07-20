import { useAuth } from "@/_core/hooks/useAuth";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FAQ_CATEGORIES,
  filterFaqItems,
  getVisibleFaqItems,
  type FaqCategoryId,
  type FaqOrganizationType,
  type FaqRole,
  type FaqVisualId,
} from "@/lib/faq-content";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Building2,
  Check,
  CheckCircle2,
  CircleDollarSign,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  MailCheck,
  Megaphone,
  Network,
  Search,
  ShieldCheck,
  Tags,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const categoryIcons: Record<FaqCategoryId, typeof HelpCircle> = {
  ACCESS: ShieldCheck,
  DASHBOARD: LayoutDashboard,
  CAMPAIGNS: Megaphone,
  ORGANIZATIONS: Building2,
  USERS: Users,
  TEMPLATES: FileText,
  PRICING: Tags,
  BROKERS: Network,
  API_KEYS: KeyRound,
  DOMAINS: BookOpenCheck,
};

const roleLabels: Record<FaqRole, string> = {
  SPC_ADMIN: "Administrador SPC Brasil",
  ORG_ADMIN: "Administrador da organização",
  REQUESTER: "Solicitante",
};

const organizationLabels: Record<FaqOrganizationType, string> = {
  SPC_BRASIL: "SPC Brasil",
  CDL: "CDL",
  DISTRIBUTOR: "Distribuidora",
  CREDITOR: "Credor",
};

export default function Faq() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<FaqCategoryId | "ALL">("ALL");

  const role = (user?.user.role ?? "REQUESTER") as FaqRole;
  const organizationType = (user?.organization.type ?? "CREDITOR") as FaqOrganizationType;
  const visibleItems = useMemo(
    () => getVisibleFaqItems({ role, organizationType }),
    [organizationType, role],
  );
  const availableCategories = useMemo(
    () => FAQ_CATEGORIES.filter(item => visibleItems.some(question => question.category === item.id)),
    [visibleItems],
  );
  const filteredItems = useMemo(
    () => filterFaqItems(visibleItems, search, category),
    [category, search, visibleItems],
  );
  const groupedItems = useMemo(
    () => availableCategories
      .map(item => ({ ...item, questions: filteredItems.filter(question => question.category === item.id) }))
      .filter(item => item.questions.length > 0),
    [availableCategories, filteredItems],
  );
  const isSpcScope = role === "SPC_ADMIN" || organizationType === "SPC_BRASIL";

  return (
    <div className="mx-auto max-w-[1480px] space-y-6" data-testid="faq-page">
      <section className="relative overflow-hidden rounded-3xl bg-[#003B7A] px-5 py-8 text-white shadow-[0_24px_70px_-38px_rgba(0,59,122,.9)] sm:px-8 lg:px-10 lg:py-10">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#11A8E2]/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#FFD84D]/10 blur-2xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_340px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-blue-50">
              <BookOpenCheck className="size-4 text-[#FFD84D]" /> Central de ajuda
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">Como podemos ajudar?</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100 sm:text-base">
              Encontre respostas, orientações passo a passo e exemplos visuais das funcionalidades disponíveis para o seu nível de acesso.
            </p>
            <div className="relative mt-6 max-w-3xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="Buscar no FAQ"
                className="h-14 rounded-2xl border-white/20 bg-white pl-12 pr-12 text-base text-slate-900 shadow-xl placeholder:text-slate-400 focus-visible:ring-[#FFD84D]"
                placeholder="Busque por campanha, senha, planilha, preço…"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              {search && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
                  onClick={() => setSearch("")}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm" data-testid="faq-scope-card">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-blue-200">Conteúdo do seu acesso</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#FFD84D] text-[#003B7A]"><ShieldCheck className="size-5" /></div>
              <div className="min-w-0">
                <p className="truncate font-bold">{organizationLabels[organizationType]}</p>
                <p className="mt-0.5 text-sm text-blue-100">{roleLabels[role]}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#002F61]/65 p-3"><p className="text-2xl font-extrabold">{visibleItems.length}</p><p className="mt-1 text-xs text-blue-100">respostas disponíveis</p></div>
              <div className="rounded-xl bg-[#002F61]/65 p-3"><p className="text-2xl font-extrabold">{availableCategories.length}</p><p className="mt-1 text-xs text-blue-100">categorias do perfil</p></div>
            </div>
            <p className="mt-4 text-xs leading-5 text-blue-100">
              {isSpcScope
                ? "Visão completa: inclui orientações de todos os níveis e módulos."
                : "O conteúdo foi filtrado para exibir somente telas disponíveis ao seu perfil."}
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Categorias do FAQ" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div><h2 className="font-bold text-[#003B7A]">Explore por categoria</h2><p className="mt-1 text-sm text-slate-500">Selecione um assunto para reduzir as respostas exibidas.</p></div>
          {category !== "ALL" && <Button type="button" variant="ghost" size="sm" onClick={() => setCategory("ALL")}>Ver todas</Button>}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap" data-testid="faq-category-list">
          <CategoryButton active={category === "ALL"} label="Todas" count={visibleItems.length} icon={BookOpenCheck} onClick={() => setCategory("ALL")} />
          {availableCategories.map(item => (
            <CategoryButton
              key={item.id}
              active={category === item.id}
              label={item.label}
              count={visibleItems.filter(question => question.category === item.id).length}
              icon={categoryIcons[item.id]}
              onClick={() => setCategory(item.id)}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <section className="space-y-5" aria-live="polite" data-testid="faq-results">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">Perguntas e respostas</h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredItems.length} {filteredItems.length === 1 ? "resultado encontrado" : "resultados encontrados"}{search ? ` para “${search}”` : ""}.
              </p>
            </div>
          </div>

          {groupedItems.map(group => {
            const Icon = categoryIcons[group.id];
            return (
              <article key={group.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid={`faq-category-${group.id}`}>
                <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-5">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#0066CC]"><Icon className="size-5" /></div>
                  <div><h3 className="font-bold text-[#003B7A]">{group.label}</h3><p className="mt-1 text-sm text-slate-500">{group.description}</p></div>
                  <Badge variant="secondary" className="ml-auto shrink-0 bg-white">{group.questions.length}</Badge>
                </div>
                <Accordion type="multiple" className="divide-y divide-slate-100">
                  {group.questions.map(item => (
                    <AccordionItem key={item.id} value={item.id} className="border-0 px-4 sm:px-5" data-testid={`faq-item-${item.id}`}>
                      <AccordionTrigger className="py-5 text-left text-[15px] font-bold leading-6 text-slate-900 hover:no-underline">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="pb-5">
                        <div className="max-w-4xl space-y-4 text-sm leading-6 text-slate-600">
                          <p>{item.answer}</p>
                          {item.steps && (
                            <ol className="grid gap-2" aria-label="Passo a passo">
                              {item.steps.map((step, index) => (
                                <li key={step} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#0066CC] text-xs font-extrabold text-white">{index + 1}</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                          )}
                          {item.note && (
                            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                              <HelpCircle className="mt-0.5 size-4 shrink-0" /><p><strong>Atenção:</strong> {item.note}</p>
                            </div>
                          )}
                          {item.visual && <FaqVisual type={item.visual} />}
                          {item.route && (
                            <Button type="button" variant="outline" className="bg-white text-[#004A99]" onClick={() => navigate(item.route!)}>
                              {item.routeLabel ?? "Abrir funcionalidade"} <ArrowRight className="size-4" />
                            </Button>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </article>
            );
          })}

          {!filteredItems.length && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center" data-testid="faq-empty-state">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Search className="size-5" /></div>
              <h3 className="mt-4 font-bold text-slate-900">Nenhuma resposta encontrada</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Tente uma palavra diferente ou limpe os filtros para consultar todas as orientações disponíveis ao seu perfil.</p>
              <Button type="button" className="mt-5 bg-[#0066CC] text-white hover:bg-[#004A99]" onClick={() => { setSearch(""); setCategory("ALL"); }}>Limpar busca e filtros</Button>
            </div>
          )}
        </section>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <div className="grid size-10 place-items-center rounded-xl bg-white text-[#0066CC] shadow-sm"><CheckCircle2 className="size-5" /></div>
            <h2 className="mt-4 font-bold text-[#003B7A]">Dica para encontrar respostas</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Pesquise pela ação que deseja executar, como “criar campanha”, “trocar senha”, “planilha” ou “preço”.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">Legenda dos exemplos</p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> As telas ilustrativas usam dados fictícios.</p>
              <p className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#0066CC]" /> Nenhuma credencial ou dado pessoal é exibido.</p>
              <p className="flex gap-2"><BookOpenCheck className="mt-0.5 size-4 shrink-0 text-amber-500" /> Botões no FAQ levam à funcionalidade quando ela está disponível.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CategoryButton({ active, label, count, icon: Icon, onClick }: {
  active: boolean;
  label: string;
  count: number;
  icon: typeof HelpCircle;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${active ? "border-[#0066CC] bg-[#0066CC] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50"}`}
      onClick={onClick}
    >
      <Icon className="size-4" /> {label}
      <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"}`}>{count}</span>
    </button>
  );
}

function FaqVisual({ type }: { type: FaqVisualId }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50" data-testid={`faq-visual-${type}`}>
      <figcaption className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <span className="text-xs font-bold uppercase tracking-[.12em] text-slate-500">Exemplo visual</span>
        <Badge variant="outline" className="bg-slate-50 text-[10px]">Dados demonstrativos</Badge>
      </figcaption>
      <div className="p-4 sm:p-5">
        {type === "SECURITY" && <SecurityVisual />}
        {type === "DASHBOARD" && <DashboardVisual />}
        {type === "CAMPAIGN_FLOW" && <CampaignFlowVisual />}
        {type === "IMPORT_VALIDATION" && <ImportVisual />}
        {type === "ORGANIZATION_FORM" && <OrganizationVisual />}
        {type === "USER_SECURITY" && <UserVisual />}
        {type === "TEMPLATE_EDITOR" && <TemplateVisual />}
        {type === "PRICING_MATRIX" && <PricingVisual />}
        {type === "BROKER_CARD" && <BrokerVisual />}
        {type === "API_KEY" && <ApiKeyVisual />}
      </div>
    </figure>
  );
}

function SecurityVisual() {
  return <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-[#0066CC]"><LockKeyhole className="size-5" /></div><div><p className="font-bold text-slate-900">Validação de acesso</p><p className="text-xs text-slate-500">Código enviado ao e-mail cadastrado</p></div></div><div className="mt-4 grid grid-cols-6 gap-2">{[4, 1, 8, 6, 3, 9].map((value, index) => <div key={index} className="grid aspect-square place-items-center rounded-lg border border-blue-200 bg-blue-50 font-bold text-[#004A99]">{value}</div>)}</div><div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><MailCheck className="mr-1.5 inline size-4" />Código válido por uma tentativa segura</div></div>;
}

function DashboardVisual() {
  return <div className="grid gap-3 sm:grid-cols-[1fr_1.3fr]"><div className="grid grid-cols-2 gap-2">{[["Envios", "12.480"], ["Entregues", "11.932"], ["Taxa", "95,6%"], ["Valor", "R$ 812"]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-lg font-extrabold text-[#003B7A]">{value}</p></div>)}</div><div className="rounded-xl bg-[#003B7A] p-4 text-white"><div className="flex items-center justify-between"><div><p className="text-xs text-blue-200">Volume diário</p><p className="mt-1 font-bold">Últimos 14 dias</p></div><BarChart3 className="size-5 text-[#FFD84D]" /></div><div className="mt-5 flex h-20 items-end gap-2">{[42, 65, 48, 80, 62, 91, 72, 88].map((height, index) => <div key={index} className="flex-1 rounded-t bg-gradient-to-t from-[#138DE0] to-[#55B9F3]" style={{ height: `${height}%` }} />)}</div></div></div>;
}

function CampaignFlowVisual() {
  const steps = [["1", "Configurar"], ["2", "Importar"], ["3", "Validar"], ["4", "Confirmar"]];
  return <div className="grid gap-2 sm:grid-cols-4">{steps.map(([number, label], index) => <div key={label} className="relative rounded-xl border border-slate-200 bg-white p-3 text-center"><span className="mx-auto grid size-8 place-items-center rounded-full bg-[#0066CC] text-xs font-bold text-white">{number}</span><p className="mt-2 text-xs font-bold text-slate-700">{label}</p>{index < steps.length - 1 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden size-4 -translate-y-1/2 text-slate-300 sm:block" />}</div>)}</div>;
}

function ImportVisual() {
  return <div className="grid gap-3 sm:grid-cols-[1fr_220px]"><div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/70 p-5 text-center"><FileSpreadsheet className="mx-auto size-8 text-[#0066CC]" /><p className="mt-2 font-bold text-[#003B7A]">destinatarios.xlsx</p><p className="mt-1 text-xs text-slate-500">CSV, XLSX ou TXT • até 8 MB</p></div><div className="space-y-2"><div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="mr-1.5 inline size-4" />1.248 linhas válidas</div><div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"><X className="mr-1.5 inline size-4" />3 linhas para corrigir</div></div></div>;
}

function OrganizationVisual() {
  return <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2"><VisualField label="Tipo" value="Credor" /><VisualField label="Vinculado a" value="Distribuidora Exemplo" /><VisualField label="Modelo financeiro" value="Pré-pago" /><VisualField label="Situação" value="Ativa" /></div>;
}

function UserVisual() {
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="grid grid-cols-[1.5fr_1fr_1fr] gap-3 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400"><span>Usuário</span><span>Perfil</span><span>Segurança</span></div><div className="grid grid-cols-[1.5fr_1fr_1fr] items-center gap-3 px-3 py-3 text-xs"><div><p className="font-bold text-slate-800">Usuário Exemplo</p><p className="text-slate-400">usuario@exemplo.com</p></div><span>Solicitante</span><Badge className="w-fit bg-amber-100 text-amber-800 hover:bg-amber-100">Troca pendente</Badge></div></div>;
}

function TemplateVisual() {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-700">Conteúdo do SMS</p><p className="mt-1 text-[10px] text-slate-400">Insira variáveis da planilha</p></div><Badge variant="outline">112/164</Badge></div><div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-600">SPC INFORMA: Olá {"{{nome_cliente}}"}, consulte sua comunicação em {"{{link}}"}.</div><div className="mt-3 flex flex-wrap gap-2"><Badge className="bg-blue-50 text-[#0066CC] hover:bg-blue-50">{"{{nome_cliente}}"}</Badge><Badge className="bg-blue-50 text-[#0066CC] hover:bg-blue-50">{"{{link}}"}</Badge></div></div>;
}

function PricingVisual() {
  const values = [["SMS", "R$ 0,10", true], ["E-mail", "R$ 0,04", true], ["WhatsApp", "—", false], ["RCS", "R$ 0,22", true]] as const;
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{values.map(([channel, value, active]) => <div key={channel} className={`rounded-xl border p-3 ${active ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><p className="text-[10px] font-bold uppercase text-slate-500">{channel}</p><p className={`mt-2 font-extrabold ${active ? "text-emerald-700" : "text-red-700"}`}>{value}</p><p className="mt-1 text-[10px] text-slate-500">{active ? "Ativo" : "Não cadastrado"}</p></div>)}</div>;
}

function BrokerVisual() {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center gap-2"><div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-[#0066CC]"><Network className="size-5" /></div><div className="mr-auto"><p className="font-bold text-slate-900">Provedor SMS Exemplo</p><p className="text-xs text-slate-500">https://api.exemplo.com</p></div><Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Ativo</Badge><Badge variant="outline">Preferencial</Badge></div><div className="mt-4 flex flex-wrap gap-2 text-[10px]"><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">API key configurada</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">Webhook protegido</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">Timeout 10s</span></div></div>;
}

function ApiKeyVisual() {
  return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-white text-amber-700"><KeyRound className="size-5" /></div><div><p className="font-bold text-amber-950">Copie o segredo agora</p><p className="text-xs text-amber-800">Ele não será exibido novamente.</p></div></div><div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-white p-3"><code className="min-w-0 flex-1 truncate text-xs text-slate-600">spci_live_••••••••••••A7K9</code><Badge variant="outline">Copiar</Badge></div></div>;
}

function VisualField({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{value}</div></div>;
}
