import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequireRecurso } from "@/components/layout/RequireRecurso";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { EcList } from "@/pages/EcList";
import { EcForm } from "@/pages/EcForm";
import { EcDetail } from "@/pages/EcDetail";
import { OsForm } from "@/pages/OsForm";
import { OsList } from "@/pages/OsList";
import { Cronogramas } from "@/pages/Cronogramas";
import { CronogramaPublico } from "@/pages/CronogramaPublico";
import { CredenciamentoPublico } from "@/pages/CredenciamentoPublico";
import { ImprimirEc, ImprimirOs } from "@/pages/Imprimir";
import { Fornecedores } from "@/pages/Fornecedores";
import { Configuracoes } from "@/pages/Configuracoes";
import { Logs } from "@/pages/Logs";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/cronograma/:slug", element: <CronogramaPublico /> }, // público (sem login)
  { path: "/credenciamento/:token", element: <CredenciamentoPublico /> }, // público (sem login)
  { path: "/estimativas/:id/imprimir", element: <ImprimirEc /> },
  { path: "/ordens/:id/imprimir", element: <ImprimirOs /> },
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <RequireRecurso r="dashboard"><Dashboard /></RequireRecurso> },
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
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
