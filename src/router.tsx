import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequireRecurso } from "@/components/layout/RequireRecurso";
import { Login } from "@/pages/Login";

// Páginas carregadas sob demanda (code-splitting) — reduz o bundle inicial.
const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Projetos = lazy(() => import("@/pages/Projetos").then((m) => ({ default: m.Projetos })));
const ProjetoDetail = lazy(() => import("@/pages/ProjetoDetail").then((m) => ({ default: m.ProjetoDetail })));
const EcList = lazy(() => import("@/pages/EcList").then((m) => ({ default: m.EcList })));
const EcForm = lazy(() => import("@/pages/EcForm").then((m) => ({ default: m.EcForm })));
const EcDetail = lazy(() => import("@/pages/EcDetail").then((m) => ({ default: m.EcDetail })));
const OsForm = lazy(() => import("@/pages/OsForm").then((m) => ({ default: m.OsForm })));
const OsList = lazy(() => import("@/pages/OsList").then((m) => ({ default: m.OsList })));
const Cronogramas = lazy(() => import("@/pages/Cronogramas").then((m) => ({ default: m.Cronogramas })));
const CronogramaPublico = lazy(() => import("@/pages/CronogramaPublico").then((m) => ({ default: m.CronogramaPublico })));
const CredenciamentoPublico = lazy(() => import("@/pages/CredenciamentoPublico").then((m) => ({ default: m.CredenciamentoPublico })));
const ImprimirEc = lazy(() => import("@/pages/Imprimir").then((m) => ({ default: m.ImprimirEc })));
const ImprimirOs = lazy(() => import("@/pages/Imprimir").then((m) => ({ default: m.ImprimirOs })));
const Fornecedores = lazy(() => import("@/pages/Fornecedores").then((m) => ({ default: m.Fornecedores })));
const Configuracoes = lazy(() => import("@/pages/Configuracoes").then((m) => ({ default: m.Configuracoes })));
const Logs = lazy(() => import("@/pages/Logs").then((m) => ({ default: m.Logs })));
const Guia = lazy(() => import("@/pages/Guia").then((m) => ({ default: m.Guia })));

/** Suspense para rotas públicas (fora da casca autenticada). */
function P({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen grid place-items-center text-ink-3 text-sm">Carregando…</div>}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/cronograma/:slug", element: <P><CronogramaPublico /></P> }, // público (sem login)
  { path: "/credenciamento/:token", element: <P><CredenciamentoPublico /></P> }, // público (sem login)
  { path: "/estimativas/:id/imprimir", element: <P><ImprimirEc /></P> },
  { path: "/ordens/:id/imprimir", element: <P><ImprimirOs /></P> },
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <RequireRecurso r="dashboard"><Dashboard /></RequireRecurso> },
      { path: "projetos", element: <RequireRecurso r="projetos"><Projetos /></RequireRecurso> },
      { path: "projetos/:id", element: <RequireRecurso r="projetos"><ProjetoDetail /></RequireRecurso> },
      { path: "estimativas", element: <RequireRecurso r="ecs"><EcList /></RequireRecurso> },
      { path: "estimativas/nova", element: <RequireRecurso r="ecs.editar"><EcForm /></RequireRecurso> },
      { path: "estimativas/:id", element: <RequireRecurso r="ecs"><EcDetail /></RequireRecurso> },
      { path: "estimativas/:id/editar", element: <RequireRecurso r="ecs.editar"><EcForm /></RequireRecurso> },
      { path: "ordens", element: <RequireRecurso r="oss"><OsList /></RequireRecurso> },
      { path: "estimativas/:ecId/os/nova", element: <RequireRecurso r="oss"><OsForm /></RequireRecurso> },
      { path: "ordens/:id", element: <RequireRecurso r="oss"><OsForm /></RequireRecurso> },
      { path: "cronogramas", element: <RequireRecurso r="cronogramas"><Cronogramas /></RequireRecurso> },
      { path: "fornecedores", element: <RequireRecurso r="fornecedores"><Fornecedores /></RequireRecurso> },
      { path: "configuracoes", element: <RequireRecurso r="configuracoes"><Configuracoes /></RequireRecurso> },
      { path: "logs", element: <RequireRecurso r="logs"><Logs /></RequireRecurso> },
      { path: "guia", element: <RequireRecurso r="guia"><Guia /></RequireRecurso> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
