import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { Building2, FileKey2, FileText, Gauge, Globe2, HelpCircle, LayoutDashboard, LogOut, Megaphone, Network, PanelLeft, Tags, Users } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const LOGO_URL = "/manus-storage/logo-spcbrasil_2505cb7b.webp";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/app", roles: ["SPC_ADMIN", "ORG_ADMIN", "REQUESTER"] },
  { icon: Megaphone, label: "Campanhas", path: "/app/campanhas", roles: ["SPC_ADMIN", "ORG_ADMIN", "REQUESTER"] },
  { icon: Building2, label: "Empresas", path: "/app/empresas", roles: ["SPC_ADMIN", "ORG_ADMIN"] },
  { icon: Users, label: "Usuários", path: "/app/usuarios", roles: ["SPC_ADMIN", "ORG_ADMIN"] },
  { icon: FileText, label: "Templates", path: "/app/templates", roles: ["SPC_ADMIN"] },
  { icon: Tags, label: "Precificação", path: "/app/precificacao", roles: ["SPC_ADMIN", "ORG_ADMIN"] },
  { icon: Network, label: "Brokers", path: "/app/brokers", roles: ["SPC_ADMIN"] },
  { icon: FileKey2, label: "Chaves de API", path: "/app/chaves-api", roles: ["SPC_ADMIN", "ORG_ADMIN"] },
  { icon: Globe2, label: "Gestão de Domínios", path: "/app/dominios", roles: ["SPC_ADMIN"] },
  { icon: HelpCircle, label: "FAQ", path: "/app/faq", roles: ["SPC_ADMIN", "ORG_ADMIN", "REQUESTER"] },
];

const roleLabels = { SPC_ADMIN: "Administrador SPC Brasil", ORG_ADMIN: "Administrador da organização", REQUESTER: "Solicitante" } as const;

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Acesso necessário
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Entre com suas credenciais corporativas para acessar a plataforma.
            </p>
          </div>
          <Button
            onClick={() => window.location.assign("/acesso")}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Ir para o acesso
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth} sidebarWidth={sidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
  sidebarWidth: number;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  sidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const role = user?.user.role;
  const visibleItems = menuItems.filter(item => role && item.roles.includes(role));
  const activeMenuItem = visibleItems.find(item => item.path === location || (item.path !== "/app" && location.startsWith(item.path)));
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <a
        href="#conteudo-principal"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-[#003B7A] px-4 py-2 text-sm font-bold text-white shadow-lg transition-transform focus:translate-y-0"
      >
        Pular para o conteúdo principal
      </a>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-slate-200 bg-white"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-20 justify-center border-b border-slate-100">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label={isCollapsed ? "Expandir navegação" : "Recolher navegação"}
                aria-expanded={!isCollapsed}
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <img src={LOGO_URL} alt="SPC Brasil" className="h-auto w-20" />
                  <span className="border-l border-slate-200 pl-2 text-xs font-bold text-[#004A99]">SPC Informa</span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {visibleItems.map(item => {
                const isActive = location === item.path || (item.path !== "/app" && location.startsWith(item.path));
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      aria-current={isActive ? "page" : undefined}
                      className="h-11 rounded-xl font-semibold text-slate-600 transition-all data-[active=true]:bg-blue-50 data-[active=true]:text-[#0066CC]"
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="Abrir menu da conta" className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.user.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.user.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {role ? roleLabels[role] : "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair com segurança</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const delta = event.key === "ArrowRight" ? 16 : -16;
            setSidebarWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, sidebarWidth + delta)));
          }}
          role="separator"
          aria-label="Redimensionar menu lateral"
          aria-orientation="vertical"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={sidebarWidth}
          tabIndex={isCollapsed ? -1 : 0}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-16 items-center justify-between bg-white/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        {!isMobile && <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-7"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">{user?.organization.tradeName}</p><p className="mt-1 font-bold text-[#003B7A]">{activeMenuItem?.label ?? "SPC Informa"}</p></div><div role="status" className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Sessão protegida</div></header>}
        <main id="conteudo-principal" tabIndex={-1} className="flex-1 bg-[#F5F7FA] p-4 sm:p-6 lg:p-7">{children}</main>
      </SidebarInset>
    </>
  );
}
