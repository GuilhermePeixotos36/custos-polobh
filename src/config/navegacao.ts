/**
 * Itens de navegação do app — a barra lateral (computador) e o menu inferior (celular e tablet)
 * leem a MESMA lista, para os dois nunca divergirem (casca do design system LSPRO, 24/11/2026).
 *
 * - `noMenuInferior`: os destinos do dia a dia ganham botão próprio no menu inferior (até 4); o
 *   resto vai para o "Mais".
 * - `administracao`: o item entra no bloco "Administração" da barra lateral. Fica no fim da lista.
 * - `recurso` / `ou`: quem vê o item (a casca filtra com `useAuth().pode` antes de desenhar).
 * - `ativoEm`: outros caminhos em que o item fica aceso — a EC e a OS são páginas internas do
 *   projeto, então "Projetos" continua aceso dentro delas.
 * - `painel`: o item abre um painel sobre a tela em vez de navegar (Help Desk: quem pede ajuda está
 *   no meio de outra coisa e não pode perder de vista o que precisa descrever).
 * - `pendencias`: acende o contador de pendências daquele recurso.
 *
 * O CALENDÁRIO vem primeiro porque é por ele que o dia começa.
 */
import {
  BookOpen, CalendarDays, FolderKanban, LifeBuoy, ScrollText, Settings, ShieldCheck, Truck, Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Recurso } from "@/store/auth";

export type ItemDeNavegacao = {
  to: string;
  rotulo: string;
  /** Rótulo do menu inferior, onde cabem ~10 caracteres. */
  rotuloCurto: string;
  icone: LucideIcon;
  noMenuInferior: boolean;
  administracao?: boolean;
  recurso?: Recurso;
  ou?: Recurso[];
  ativoEm?: string[];
  painel?: "suporte";
  pendencias?: boolean;
  /** Preenchido pela casca: o número de pendências (só quando `pendencias`). */
  contador?: number;
  /** Preenchido pela casca: o que fazer no clique (item de `painel`). */
  aoClicar?: () => void;
};

export const ITENS_DE_NAVEGACAO: ItemDeNavegacao[] = [
  { to: "/calendario", rotulo: "Calendário Pólobh", rotuloCurto: "Calendário", icone: CalendarDays, noMenuInferior: true, recurso: "projetos" },
  { to: "/projetos", rotulo: "Projetos", rotuloCurto: "Projetos", icone: FolderKanban, noMenuInferior: true, recurso: "projetos", ativoEm: ["/estimativas", "/ordens"], pendencias: true },
  // Fornecedores ganha tela própria no menu (Módulo 1, 24/11/2026): cadastro unificado por CNPJ.
  { to: "/fornecedores", rotulo: "Fornecedores", rotuloCurto: "Fornec.", icone: Truck, noMenuInferior: true, recurso: "fornecedores" },
  { to: "/fluxograma", rotulo: "Fluxograma", rotuloCurto: "Fluxo", icone: Workflow, noMenuInferior: false, recurso: "guia" },
  { to: "/guia", rotulo: "Guia do Aplicativo", rotuloCurto: "Guia", icone: BookOpen, noMenuInferior: false, recurso: "guia" },
  { to: "/suporte", rotulo: "Help Desk", rotuloCurto: "Suporte", icone: LifeBuoy, noMenuInferior: false, recurso: "guia", painel: "suporte" },
  // A Coordenação não administra empresas e usuários, mas edita a lista padrão do check-list — por isso o `ou`.
  { to: "/configuracoes", rotulo: "Configurações", rotuloCurto: "Config.", icone: Settings, noMenuInferior: false, administracao: true, recurso: "configuracoes", ou: ["checklists.padrao", "contratos.clausulas"] },
  // Acessos (padrão de Acessos LSPRO, 24/11/2026): as antigas abas Áreas e Usuários de Configurações.
  { to: "/acessos", rotulo: "Acessos", rotuloCurto: "Acessos", icone: ShieldCheck, noMenuInferior: false, administracao: true, recurso: "acessos.usuarios", ou: ["acessos.grupos"] },
  { to: "/logs", rotulo: "Logs", rotuloCurto: "Logs", icone: ScrollText, noMenuInferior: false, administracao: true, recurso: "logs" },
];

export const rotaAtiva = (to: string, caminho: string, ativoEm: string[] = []) =>
  [to, ...ativoEm].some((r) => (r === "/" ? caminho === "/" : caminho === r || caminho.startsWith(`${r}/`)));
