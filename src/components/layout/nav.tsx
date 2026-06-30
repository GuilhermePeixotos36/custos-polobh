import type { ReactNode } from "react";
import type { Recurso } from "@/store/auth";
import {
  IcGrid,
  IcDoc,
  IcClipboard,
  IcCalendar,
  IcUsers,
  IcGear,
  IcActivity,
  IcHelp,
} from "@/components/icons";

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  recurso: Recurso;
  grupo: "Operação" | "Sistema";
}

export const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <IcGrid />, recurso: "dashboard", grupo: "Operação" },
  { to: "/estimativas", label: "Estimativas (EC)", icon: <IcDoc />, recurso: "ecs", grupo: "Operação" },
  { to: "/ordens", label: "Ordens de Serviço", icon: <IcClipboard />, recurso: "oss", grupo: "Operação" },
  { to: "/cronogramas", label: "Cronogramas", icon: <IcCalendar />, recurso: "cronogramas", grupo: "Operação" },
  { to: "/fornecedores", label: "Fornecedores", icon: <IcUsers />, recurso: "fornecedores", grupo: "Operação" },
  { to: "/configuracoes", label: "Configurações", icon: <IcGear />, recurso: "configuracoes", grupo: "Sistema" },
  { to: "/logs", label: "Logs do sistema", icon: <IcActivity />, recurso: "logs", grupo: "Sistema" },
  { to: "/guia", label: "Guia do app", icon: <IcHelp />, recurso: "guia", grupo: "Sistema" },
];
