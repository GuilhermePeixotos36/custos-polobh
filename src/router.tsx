import { Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequireRecurso } from "@/components/layout/RequireRecurso";
import { Login } from "@/pages/Login";
import { ErroAplicacao } from "@/pages/ErroAplicacao";
import { lazyComRecuperacao } from "@/lib/lazyComRecuperacao";

// Páginas carregadas sob demanda (code-splitting) — reduz o bundle inicial.
const Projetos = lazyComRecuperacao(() => import("@/pages/Projetos").then((m) => ({ default: m.Projetos })));
const ProjetoDetail = lazyComRecuperacao(() => import("@/pages/ProjetoDetail").then((m) => ({ default: m.ProjetoDetail })));
const EcForm = lazyComRecuperacao(() => import("@/pages/EcForm").then((m) => ({ default: m.EcForm })));
const EcDetail = lazyComRecuperacao(() => import("@/pages/EcDetail").then((m) => ({ default: m.EcDetail })));
const OsForm = lazyComRecuperacao(() => import("@/pages/OsForm").then((m) => ({ default: m.OsForm })));
const OsList = lazyComRecuperacao(() => import("@/pages/OsList").then((m) => ({ default: m.OsList })));
const Agenda = lazyComRecuperacao(() => import("@/pages/Agenda").then((m) => ({ default: m.Agenda })));
const Calendario = lazyComRecuperacao(() => import("@/pages/Calendario").then((m) => ({ default: m.Calendario })));
const Cronogramas = lazyComRecuperacao(() => import("@/pages/Cronogramas").then((m) => ({ default: m.Cronogramas })));
const CronogramaPublico = lazyComRecuperacao(() => import("@/pages/CronogramaPublico").then((m) => ({ default: m.CronogramaPublico })));
const CredenciamentoPublico = lazyComRecuperacao(() => import("@/pages/CredenciamentoPublico").then((m) => ({ default: m.CredenciamentoPublico })));
const ImprimirEc = lazyComRecuperacao(() => import("@/pages/Imprimir").then((m) => ({ default: m.ImprimirEc })));
const ImprimirOs = lazyComRecuperacao(() => import("@/pages/Imprimir").then((m) => ({ default: m.ImprimirOs })));
const Fornecedores = lazyComRecuperacao(() => import("@/pages/Fornecedores").then((m) => ({ default: m.Fornecedores })));
const Configuracoes = lazyComRecuperacao(() => import("@/pages/Configuracoes").then((m) => ({ default: m.Configuracoes })));
const Logs = lazyComRecuperacao(() => import("@/pages/Logs").then((m) => ({ default: m.Logs })));
const Guia = lazyComRecuperacao(() => import("@/pages/Guia").then((m) => ({ default: m.Guia })));

/** Suspense para rotas públicas (fora da casca autenticada). */
function P({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen grid place-items-center text-ink-3 text-sm">Carregando…</div>}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  { path: "/login", element: <Login />, errorElement: <ErroAplicacao /> },
  { path: "/cronograma/:slug", element: <P><CronogramaPublico /></P>, errorElement: <ErroAplicacao /> }, // público (sem login)
  { path: "/credenciamento/:token", element: <P><CredenciamentoPublico /></P>, errorElement: <ErroAplicacao /> }, // público (sem login)
  { path: "/estimativas/:id/imprimir", element: <P><ImprimirEc /></P>, errorElement: <ErroAplicacao /> },
  { path: "/ordens/:id/imprimir", element: <P><ImprimirOs /></P>, errorElement: <ErroAplicacao /> },
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <ErroAplicacao />,
    children: [
      { index: true, element: <Navigate to="/projetos" replace /> },
      { path: "projetos", element: <RequireRecurso r="projetos"><Projetos /></RequireRecurso> },
      { path: "projetos/:id", element: <RequireRecurso r="projetos"><ProjetoDetail /></RequireRecurso> },
      { path: "estimativas", element: <Navigate to="/projetos" replace /> },
      { path: "estimativas/nova", element: <RequireRecurso r="ecs.editar"><EcForm /></RequireRecurso> },
      { path: "estimativas/:id", element: <RequireRecurso r="ecs"><EcDetail /></RequireRecurso> },
      { path: "estimativas/:id/editar", element: <RequireRecurso r="ecs.editar"><EcForm /></RequireRecurso> },
      { path: "ordens", element: <RequireRecurso r="oss"><OsList /></RequireRecurso> },
      { path: "estimativas/:ecId/os/nova", element: <RequireRecurso r="oss.editar"><OsForm /></RequireRecurso> },
      { path: "ordens/:id", element: <RequireRecurso r="oss"><OsForm /></RequireRecurso> },
      { path: "agenda", element: <RequireRecurso r="checklists"><Agenda /></RequireRecurso> },
      { path: "calendario", element: <RequireRecurso r="projetos"><Calendario /></RequireRecurso> },
      { path: "cronogramas", element: <RequireRecurso r="cronogramas"><Cronogramas /></RequireRecurso> },
      { path: "fornecedores", element: <RequireRecurso r="fornecedores"><Fornecedores /></RequireRecurso> },
      { path: "configuracoes", element: <RequireRecurso r="configuracoes"><Configuracoes /></RequireRecurso> },
      { path: "logs", element: <RequireRecurso r="logs"><Logs /></RequireRecurso> },
      { path: "guia", element: <RequireRecurso r="guia"><Guia /></RequireRecurso> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
