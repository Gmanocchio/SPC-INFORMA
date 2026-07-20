import { Badge } from "@/components/ui/badge";
import type { ManualVisualId } from "@/lib/manual-content";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  FileSpreadsheet,
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
import type { ReactNode } from "react";

const ACCESS_SCREENSHOT_URL = "/manus-storage/manual-tela-acesso_6fda9b5e.png";

const visualLabels: Record<ManualVisualId, string> = {
  ACCESS: "Tela real de acesso",
  DASHBOARD: "Exemplo do Dashboard",
  CAMPAIGN: "Exemplo do fluxo de campanha",
  ORGANIZATION: "Exemplo do cadastro de empresa",
  USER: "Exemplo da gestão de usuários",
  TEMPLATE: "Exemplo do editor de template",
  PRICING: "Exemplo da matriz de preços",
  BROKER: "Exemplo da configuração de broker",
  API_KEY: "Exemplo da emissão de chave",
  HELP: "Exemplo da central de ajuda",
};

export function ManualVisual({ type }: { type: ManualVisualId }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm" data-testid={`manual-visual-${type}`}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
        <span className="text-xs font-extrabold uppercase tracking-[.12em] text-slate-500">{visualLabels[type]}</span>
        <Badge variant="outline" className="bg-slate-50 text-[10px] font-bold text-slate-500">
          {type === "ACCESS" ? "Captura sem credenciais" : "Dados demonstrativos"}
        </Badge>
      </figcaption>
      <div className={type === "ACCESS" ? "bg-slate-100" : "p-4 sm:p-6"}>
        {type === "ACCESS" && <AccessVisual />}
        {type === "DASHBOARD" && <DashboardVisual />}
        {type === "CAMPAIGN" && <CampaignVisual />}
        {type === "ORGANIZATION" && <OrganizationVisual />}
        {type === "USER" && <UserVisual />}
        {type === "TEMPLATE" && <TemplateVisual />}
        {type === "PRICING" && <PricingVisual />}
        {type === "BROKER" && <BrokerVisual />}
        {type === "API_KEY" && <ApiKeyVisual />}
        {type === "HELP" && <HelpVisual />}
      </div>
    </figure>
  );
}

function AccessVisual() {
  return (
    <div className="aspect-[16/9] overflow-hidden">
      <img
        src={ACCESS_SCREENSHOT_URL}
        alt="Tela real de acesso do SPC Informa, sem credenciais preenchidas"
        className="h-[106%] w-full object-cover object-top"
        loading="lazy"
      />
    </div>
  );
}

function ScreenShell({ title, icon: Icon, children }: { title: string; icon: typeof LayoutDashboard; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-4 py-3">
        <div className="grid size-8 place-items-center rounded-lg bg-blue-50 text-[#0066CC]"><Icon className="size-4" /></div>
        <p className="text-sm font-extrabold text-[#003B7A]">{title}</p>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" /> Sessão protegida</span>
      </div>
      <div className="bg-[#F5F7FA] p-3 sm:p-4">{children}</div>
    </div>
  );
}

function DashboardVisual() {
  const cards = [["Base incluída", "12.480"], ["Entregues", "11.932"], ["Abertos", "4.816"], ["Cliques", "1.240"]];
  return (
    <ScreenShell title="Dashboard" icon={LayoutDashboard}>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {cards.map(([label, value], index) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1.5 text-lg font-black text-[#003B7A]">{value}</p>
            <p className="mt-1 text-[9px] font-semibold text-emerald-600">+{index + 2},4% no período</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.35fr_.85fr]">
        <div className="rounded-xl bg-[#003B7A] p-4 text-white">
          <div className="flex items-center justify-between"><div><p className="text-[10px] text-blue-200">Volume diário</p><p className="text-sm font-bold">Últimos 14 dias</p></div><BarChart3 className="size-5 text-[#FFD84D]" /></div>
          <div className="mt-4 flex h-24 items-end gap-2">{[42, 65, 48, 80, 62, 91, 72, 88, 68, 96].map((height, index) => <div key={index} className="flex-1 rounded-t bg-gradient-to-t from-[#138DE0] to-[#67C7F1]" style={{ height: `${height}%` }} />)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Resumo financeiro</p><p className="mt-2 text-2xl font-black text-[#003B7A]">R$ 812,40</p><p className="text-xs text-slate-500">Consumo no período</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[64%] rounded-full bg-[#11A8E2]" /></div><p className="mt-2 text-[10px] text-slate-500">64% do limite utilizado</p></div>
      </div>
    </ScreenShell>
  );
}

function CampaignVisual() {
  const stages = [["1", "Configurar"], ["2", "Importar"], ["3", "Validar"], ["4", "Confirmar"]];
  return (
    <ScreenShell title="Nova campanha" icon={Megaphone}>
      <div className="grid gap-2 sm:grid-cols-4">
        {stages.map(([number, label], index) => <div key={label} className="relative rounded-xl border border-blue-100 bg-white p-3 text-center"><span className={`mx-auto grid size-7 place-items-center rounded-full text-[10px] font-black ${index < 2 ? "bg-[#0066CC] text-white" : "bg-slate-100 text-slate-400"}`}>{number}</span><p className="mt-1.5 text-[10px] font-bold text-slate-600">{label}</p>{index < 3 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden size-4 -translate-y-1/2 text-slate-300 sm:block" />}</div>)}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_240px]">
        <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/70 p-5 text-center"><FileSpreadsheet className="mx-auto size-8 text-[#0066CC]" /><p className="mt-2 text-sm font-extrabold text-[#003B7A]">destinatarios-julho.xlsx</p><p className="mt-1 text-[10px] text-slate-500">CSV, XLSX ou TXT • até 8 MB</p></div>
        <div className="space-y-2"><div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><CheckCircle2 className="mr-1.5 inline size-4" />1.248 linhas válidas</div><div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700"><X className="mr-1.5 inline size-4" />3 linhas para corrigir</div><div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"><CalendarClock className="mr-1.5 inline size-4" />Agendada: 22/07, 09h</div></div>
      </div>
    </ScreenShell>
  );
}

function OrganizationVisual() {
  return (
    <ScreenShell title="Cadastrar empresa" icon={Building2}>
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <VisualField label="CNPJ" value="00.000.000/0001-00" />
        <VisualField label="Tipo" value="Credor" />
        <VisualField label="Razão social" value="Empresa Demonstrativa S.A." />
        <VisualField label="Vinculado a" value="Distribuidora Exemplo" />
        <VisualField label="Modelo financeiro" value="Pré-pago" />
        <VisualField label="Situação" value="Ativa" />
      </div>
    </ScreenShell>
  );
}

function UserVisual() {
  return (
    <ScreenShell title="Usuários" icon={Users}>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_.7fr] gap-2 bg-slate-50 px-3 py-2 text-[9px] font-black uppercase tracking-wide text-slate-400"><span>Usuário</span><span>Perfil</span><span>Segurança</span><span>Situação</span></div>
        {[["Marina Exemplo", "Administrador", "Protegido", "Ativo"], ["Carlos Exemplo", "Solicitante", "Troca pendente", "Ativo"]].map(([name, role, security, status], index) => <div key={name} className={`grid grid-cols-[1.5fr_1fr_1fr_.7fr] items-center gap-2 px-3 py-3 text-[10px] ${index ? "border-t border-slate-100" : ""}`}><div><p className="font-bold text-slate-800">{name}</p><p className="truncate text-slate-400">usuario{index + 1}@exemplo.com</p></div><span>{role}</span><span className={security === "Protegido" ? "text-emerald-700" : "text-amber-700"}>{security}</span><Badge className="w-fit bg-emerald-100 text-[9px] text-emerald-800 hover:bg-emerald-100">{status}</Badge></div>)}
      </div>
    </ScreenShell>
  );
}

function TemplateVisual() {
  return (
    <ScreenShell title="Editor de template" icon={MailCheck}>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between"><div><p className="text-xs font-extrabold text-slate-700">Conteúdo do SMS</p><p className="mt-1 text-[10px] text-slate-400">Insira variáveis da planilha</p></div><Badge variant="outline">112/164</Badge></div>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-600">SPC INFORMA: Olá {"{{nome_cliente}}"}, consulte sua comunicação em {"{{link}}"}.</div>
        <div className="mt-3 flex flex-wrap gap-2"><Badge className="bg-blue-50 text-[#0066CC] hover:bg-blue-50">{"{{nome_cliente}}"}</Badge><Badge className="bg-blue-50 text-[#0066CC] hover:bg-blue-50">{"{{link}}"}</Badge><span className="ml-auto text-[10px] font-bold text-emerald-600"><Check className="mr-1 inline size-3" />Variáveis válidas</span></div>
      </div>
    </ScreenShell>
  );
}

function PricingVisual() {
  const rows = [["Base SPC Brasil", "R$ 0,04", "R$ 0,10", "R$ 0,18", "R$ 0,22"], ["Credor Exemplo", "R$ 0,05", "R$ 0,12", "—", "R$ 0,24"]];
  return (
    <ScreenShell title="Matriz de preços" icon={Tags}>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><div className="min-w-[560px]"><div className="grid grid-cols-[1.35fr_repeat(4,1fr)] bg-slate-50 px-3 py-2 text-[9px] font-black uppercase text-slate-400"><span>Base / Credor</span><span>E-mail</span><span>SMS</span><span>WhatsApp</span><span>RCS</span></div>{rows.map((row, rowIndex) => <div key={row[0]} className={`grid grid-cols-[1.35fr_repeat(4,1fr)] items-center gap-1 px-3 py-3 text-[10px] ${rowIndex ? "border-t border-slate-100" : ""}`}><span className="font-bold text-slate-700">{row[0]}</span>{row.slice(1).map((value, index) => <span key={index} className={`mr-1 rounded-lg px-2 py-1.5 text-center font-bold ${value === "—" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{value}</span>)}</div>)}</div></div>
    </ScreenShell>
  );
}

function BrokerVisual() {
  return (
    <ScreenShell title="Brokers" icon={Network}>
      <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-[#0066CC]"><Network className="size-5" /></div><div className="mr-auto"><p className="text-sm font-extrabold text-slate-900">Provedor SMS Exemplo</p><p className="text-[10px] text-slate-500">https://api.exemplo.com/envios</p></div><Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Ativo</Badge><Badge variant="outline">Preferencial</Badge></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><VisualPill text="API key configurada" /><VisualPill text="Webhook protegido" /><VisualPill text="Timeout 10s" /></div></div>
    </ScreenShell>
  );
}

function ApiKeyVisual() {
  return (
    <ScreenShell title="Chaves de API" icon={KeyRound}>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-white text-amber-700"><KeyRound className="size-5" /></div><div><p className="font-extrabold text-amber-950">Copie o segredo agora</p><p className="text-xs text-amber-800">Ele não será exibido novamente.</p></div></div><div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-white p-3"><code className="min-w-0 flex-1 truncate text-xs text-slate-600">spci_live_••••••••••••A7K9</code><Badge variant="outline">Copiar</Badge></div><div className="mt-3 flex flex-wrap gap-2"><VisualPill text="Consultar campanhas" /><VisualPill text="Criar campanhas" /></div></div>
    </ScreenShell>
  );
}

function HelpVisual() {
  return (
    <ScreenShell title="Central de ajuda" icon={ShieldCheck}>
      <div className="rounded-xl bg-[#003B7A] p-4 text-white"><p className="text-lg font-black">Como podemos ajudar?</p><div className="relative mt-3"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><div className="rounded-xl bg-white py-3 pl-10 pr-4 text-xs text-slate-400">Busque por campanha, senha, planilha, preço…</div></div></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">{[[LockKeyhole, "Acesso seguro"], [Megaphone, "Campanhas"], [Tags, "Precificação"]].map(([Icon, label]) => { const HelpIcon = Icon as typeof LockKeyhole; return <div key={label as string} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-700"><HelpIcon className="size-4 text-[#0066CC]" />{label as string}</div>; })}</div>
    </ScreenShell>
  );
}

function VisualField({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p><div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-700">{value}</div></div>;
}

function VisualPill({ text }: { text: string }) {
  return <span className="rounded-lg bg-slate-100 px-3 py-2 text-[10px] font-semibold text-slate-600">{text}</span>;
}
