import { Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequireRecurso } from "@/components/layout/RequireRecurso";
import { Login } from "@/pages/Login";
import { NovaSenha } from "@/pages/NovaSenha";
import { ErroAplicacao } from "@/pages/ErroAplicacao";
import { lazyComRecuperacao } from "@/lib/lazyComRecuperacao";

// Páginas carregadas sob demanda (code-splitting) — reduz o bundle inicial.
const Projetos = lazyComRecuperacao(() => import("@/pages/Projetos").then((m) => ({ default: m.Projetos })));
const ProjetoDetail = lazyComRecuperacao(() => import("@/pages/ProjetoDetail").then((m) => ({ default: m.ProjetoDetail })));
const EcForm = lazyComRecuperacao(() => import("@/pages/EcForm").then((m) => ({ default: m.EcForm })));
const EcDetail = lazyComRecuperacao(() => import("@/pages/EcDetail").then((m) => ({ default: m.EcDetail })));
const OsForm = lazyComRecuperacao(() => import("@/pages/OsForm").then((m) => ({ default: m.OsForm })));
const OsList = lazyComRecuperacao(() => import("@/pages/OsList").then((m) => ({ default: m.OsList })));
const Calendario = lazyComRecuperacao(() => import("@/pages/Calendario").then((m) => ({ default: m.Calendario })));
const Cronogramas = lazyComRecuperacao(() => import("@/pages/Cronogramas").then((m) => ({ default: m.Cronogramas })));
const CronogramaPublico = lazyComRecuperacao(() => import("@/pages/CronogramaPublico").then((m) => ({ default: m.CronogramaPublico })));
const CredenciamentoPublico = lazyComRecuperacao(() => import("@/pages/CredenciamentoPublico").then((m) => ({ default: m.CredenciamentoPublico })));
const ImprimirEc = lazyComRecuperacao(() => import("@/pages/Imprimir").then((m) => ({ default: m.ImprimirEc })));
const ImprimirOs = lazyComRecuperacao(() => import("@/pages/Imprimir").then((m) => ({ default: m.ImprimirOs })));
const Fornecedores = lazyComRecuperacao(() => import("@/pages/Fornecedores").then((m) => ({ default: m.Fornecedores })));
const Configuracoes = lazyComRecuperacao(() => import("@/pages/Configuracoes").then((m) => ({ default: m.Configuracoes })));
const Fluxograma = lazyComRecuperacao(() => import("@/pages/Fluxograma").then((m) => ({ default: m.Fluxograma })));
const Logs = lazyComRecuperacao(() => import("@/pages/Logs").then((m) => ({ default: m.Logs })));
const Guia = lazyComRecuperacao(() => import("@/pages/Guia").then((m) => ({ default: m.Guia })));
const Suporte = lazyComRecuperacao(() => import("@/pages/Suporte").then((m) => ({ default: m.Suporte })));

/** Suspense para rotas públicas (fora da casca autenticada). */
function P({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen grid place-items-center text-ink-3 text-sm">Carregando…</div>}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  { path: "/login", element: <Login />, errorElement: <ErroAplicacao /> },
  // Sem login: quem chega aqui vem do link do e-mail, com uma sessão de
  // recuperação aberta pelo Supabase (ver `NovaSenha`).
  { path: "/nova-senha", element: <NovaSenha />, errorElement: <ErroAplicacao /> },
  { path: "/cronograma/:slug", element: <P><CronogramaPublico /></P>, errorElement: <ErroAplicacao /> }, // público (sem login)
  { path: "/credenciamento/:token", element: <P><CredenciamentoPublico /></P>, errorElement: <ErroAplicacao /> }, // público (sem login)
  { path: "/estimativas/:id/imprimir", element: <P><ImprimirEc /></P>, errorElement: <ErroAplicacao /> },
  { path: "/ordens/:id/imprimir", element: <P><ImprimirOs /></P>, errorElement: <ErroAplicacao /> },
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <ErroAplicacao />,
    children: [
      // O Calendário é o primeiro item do aplicativo (revisão de 09/09/2026):
      // o dia começa em "o que acontece esta semana".
      { index: true, element: <Navigate to="/calendario" replace /> },
      { path: "projetos", element: <RequireRecurso r="projetos"><Projetos /></RequireRecurso> },
      { path: "projetos/:id", element: <RequireRecurso r="projetos"><ProjetoDetail /></RequireRecurso> },
      { path: "estimativas", element: <Navigate to="/projetos" replace /> },
      { path: "estimativas/nova", element: <RequireRecurso r="ecs.editar"><EcForm /></RequireRecurso> },
      { path: "estimativas/:id", element: <RequireRecurso r="ecs"><EcDetail /></RequireRecurso> },
      { path: "estimativas/:id/editar", element: <RequireRecurso r="ecs.editar"><EcForm /></RequireRecurso> },
      { path: "ordens", element: <RequireRecurso r="oss"><OsList /></RequireRecurso> },
      { path: "estimativas/:ecId/os/nova", element: <RequireRecurso r="oss.editar"><OsForm /></RequireRecurso> },
      { path: "ordens/:id", element: <RequireRecurso r="oss"><OsForm /></RequireRecurso> },
      // AGENDA saiu do aplicativo (10/09/2026, a pedido do Guilherme): não é uma
      // tela da casa. O acompanhamento das tarefas é o Check-list, dentro do
      // projeto. O arquivo `pages/Agenda.tsx` continua no repositório, sem rota
      // — nada o alcança.
      { path: "calendario", element: <RequireRecurso r="projetos"><Calendario /></RequireRecurso> },
      { path: "cronogramas", element: <RequireRecurso r="cronogramas"><Cronogramas /></RequireRecurso> },
      { path: "fornecedores", element: <RequireRecurso r="fornecedores"><Fornecedores /></RequireRecurso> },
      // O fluxo do processo da Pólobh (29/09/2026) — leitura para todo perfil,
      // como o Guia; a troca da imagem exige `configuracoes` dentro da tela.
      { path: "fluxograma", element: <RequireRecurso r="guia"><Fluxograma /></RequireRecurso> },
      { path: "configuracoes", element: <RequireRecurso r={["configuracoes", "checklists.padrao"]}><Configuracoes /></RequireRecurso> },
      { path: "logs", element: <RequireRecurso r="logs"><Logs /></RequireRecurso> },
      { path: "guia", element: <RequireRecurso r="guia"><Guia /></RequireRecurso> },
      // O Help Desk usa o mesmo recurso do Guia: pedir ajuda é para todo mundo
      // que consegue abrir o aplicativo.
      { path: "suporte", element: <RequireRecurso r="guia"><Suporte /></RequireRecurso> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
