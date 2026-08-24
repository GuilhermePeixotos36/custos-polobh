import type { ReactNode } from "react";
import type { Recurso } from "@/store/auth";
import {
  IcFolder,
  IcClipboard,
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

// Hierarquia project-centric: tudo parte do Projeto. EC, OS e Cronograma
// viram subguias dentro do projeto (não ficam no menu principal).
export const NAV: NavItem[] = [
  { to: "/projetos", label: "Projetos", icon: <IcFolder />, recurso: "projetos", grupo: "Operação" },
  // A agenda fica ao lado de Projetos de propósito: é a tela de "o que fazer
  // hoje", enquanto Projetos é a de "onde está cada coisa".
  { to: "/agenda", label: "Agenda", icon: <IcClipboard />, recurso: "checklists", grupo: "Operação" },
  { to: "/fornecedores", label: "Fornecedores", icon: <IcUsers />, recurso: "fornecedores", grupo: "Operação" },
  { to: "/configuracoes", label: "Configurações", icon: <IcGear />, recurso: "configuracoes", grupo: "Sistema" },
  { to: "/logs", label: "Logs do sistema", icon: <IcActivity />, recurso: "logs", grupo: "Sistema" },
  { to: "/guia", label: "Guia do app", icon: <IcHelp />, recurso: "guia", grupo: "Sistema" },
];
