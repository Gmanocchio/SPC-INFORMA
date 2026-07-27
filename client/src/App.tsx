import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Route, Switch, useLocation } from "wouter";
import { useAuth } from "./_core/hooks/useAuth";
import DashboardLayout from "./components/DashboardLayout";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { protectedRouteDecision } from "./lib/route-access";

const Access = lazy(() => import("./pages/Access"));
const ApiKeys = lazy(() => import("./pages/ApiKeys"));
const Brokers = lazy(() => import("./pages/Brokers"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Domains = lazy(() => import("./pages/Domains"));
const Faq = lazy(() => import("./pages/Faq"));
const FirstAccess = lazy(() => import("./pages/FirstAccess"));
const Home = lazy(() => import("./pages/Home"));
const Manual = lazy(() => import("./pages/Manual"));
const ModulePlaceholder = lazy(() => import("./pages/ModulePlaceholder"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Organizations = lazy(() => import("./pages/Organizations"));
const Pricing = lazy(() => import("./pages/Pricing"));
const RecoverPassword = lazy(() => import("./pages/RecoverPassword"));
const Templates = lazy(() => import("./pages/Templates"));
const Users = lazy(() => import("./pages/Users"));

function ProtectedPage({ children, spcOnly = false }: { children: ReactNode; spcOnly?: boolean }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const access = protectedRouteDecision({ loading, user, spcOnly });
  const redirectPath = access.status === "redirect" ? access.path : null;

  useEffect(() => {
    if (redirectPath) navigate(redirectPath, { replace: true });
  }, [navigate, redirectPath]);

  if (access.status !== "allow") {
    return <DashboardLayoutSkeleton />;
  }
  return <DashboardLayout>{children}</DashboardLayout>;
}

function PasswordChangeRoute() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate("/acesso", { replace: true });
    else if (!user.user.mustChangePassword) navigate("/app", { replace: true });
  }, [loading, navigate, user]);

  if (loading || !user || !user.user.mustChangePassword) return <DashboardLayoutSkeleton />;
  return <FirstAccess />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/acesso" component={Access} />
      <Route path="/recuperar-senha" component={RecoverPassword} />
      <Route path="/app/primeiro-acesso" component={PasswordChangeRoute} />
      <Route path="/app">{() => <ProtectedPage><Dashboard /></ProtectedPage>}</Route>
      <Route path="/app/campanhas">{() => <ProtectedPage><Campaigns /></ProtectedPage>}</Route>
      <Route path="/app/empresas">{() => <ProtectedPage><Organizations /></ProtectedPage>}</Route>
      <Route path="/app/usuarios">{() => <ProtectedPage><Users /></ProtectedPage>}</Route>
      <Route path="/app/templates">{() => <ProtectedPage><Templates /></ProtectedPage>}</Route>
      <Route path="/app/precificacao">{() => <ProtectedPage><Pricing /></ProtectedPage>}</Route>
      <Route path="/app/brokers">{() => <ProtectedPage spcOnly><Brokers /></ProtectedPage>}</Route>
      <Route path="/app/chaves-api">{() => <ProtectedPage><ApiKeys /></ProtectedPage>}</Route>
      <Route path="/app/faq">{() => <ProtectedPage><Faq /></ProtectedPage>}</Route>
      <Route path="/app/manual">{() => <ProtectedPage><Manual /></ProtectedPage>}</Route>
      <Route path="/app/dominios">
        {() => (
          <ProtectedPage spcOnly>
            <Domains />
          </ProtectedPage>
        )}
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PageFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#F5F7FA] p-6" role="status" aria-live="polite">
      <div className="rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-slate-600 shadow-sm">
        Carregando conteúdo…
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<PageFallback />}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
