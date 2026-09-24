import type { ReactNode } from "react";
import type { Recurso } from "@/store/auth";
import { IcCalendar, IcFolder, IcGear, IcHelp, IcSuporte } from "@/components/icons";

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  recurso: Recurso;
  /**
   * Acende a bolinha vermelha de pendências neste item do menu.
   *
   * É por ITEM, e não pelo `recurso`: Calendário e Projetos usam o mesmo
   * recurso de permissão, e por isso o Calendário herdava o número de Projetos
   * sem ter uma única pendência para mostrar dentro dele — o quadro do ano é
   * uma leitura de "quando cada projeto acontece", não uma lista de tarefas.
   * Quem não declara, não conta.
   */
  pendencias?: boolean;
  /**
   * Este item abre um PAINEL sobre a tela, em vez de navegar.
   *
   * O Help Desk é o caso: quem pede ajuda está no meio de outra coisa, e trocar
   * de tela faz a pessoa perder de vista justamente o que precisa descrever
   * (ver `components/suporte/PainelSuporte`). O `to` continua existindo porque
   * o e-mail de resposta aponta para ele — a rota abre o painel e devolve a
   * pessoa para a tela de onde ela veio.
   */
  painel?: "suporte";
}

/**
 * O CABEÇALHO GERAL — cinco botões, e só (revisão de 09/09/2026).
 *
 * A barra tinha sete itens e misturava duas coisas: o que se faz todo dia
 * (Projetos, Calendário) com o que se administra de vez em quando (Áreas,
 * Usuários, Logs) e com cadastros que já vivem dentro do projeto (Fornecedores).
 * Na largura de um notebook os rótulos sumiam e sobrava uma fileira de ícones
 * parecidos.
 *
 * Agora o topo diz só ONDE se está no aplicativo, e cada lugar tem a sua
 * própria barra logo abaixo (ver `NAV_PROJETO` e `NAV_CONFIG`).
 *
 * O CALENDÁRIO vem primeiro porque é por ele que o dia começa: "o que acontece
 * esta semana" antes de "onde está cada projeto".
 */
export const NAV: NavItem[] = [
  { to: "/calendario", label: "Calendário Pólobh", icon: <IcCalendar />, recurso: "projetos" },
  { to: "/projetos", label: "Projetos", icon: <IcFolder />, recurso: "projetos", pendencias: true },
  { to: "/configuracoes", label: "Configurações", icon: <IcGear />, recurso: "configuracoes" },
  { to: "/guia", label: "Guia do Aplicativo", icon: <IcHelp />, recurso: "guia" },
  { to: "/suporte", label: "Help Desk", icon: <IcSuporte />, recurso: "guia", painel: "suporte" },
];

/* ------------------------- os segundos cabeçalhos ------------------------- */

/**
 * Uma seção de um segundo cabeçalho: o rótulo e para onde ele leva.
 *
 * Diferente das subguias de uma tela só (que trocam estado local), estas
 * atravessam ROTAS: a barra do projeto é a mesma dentro do projeto, da EC e da
 * OS, e a de Configurações é a mesma em Agenda, Fornecedores e Logs. É o que
 * faz a pessoa continuar sabendo onde está depois de entrar num documento.
 */
export interface SecaoNav {
  key: string;
  label: string;
  recurso?: Recurso;
}

/**
 * O segundo cabeçalho do PROJETO — comum a todas as páginas internas dele.
 *
 * O check-list vem logo depois de Dados Gerais: é a aba de acompanhamento
 * diário, consultada muito mais vezes que EC e OS (pedido de 25/08/2026).
 */
export const NAV_PROJETO: SecaoNav[] = [
  { key: "dados", label: "Dados Gerais" },
  { key: "checklist", label: "Check-list" },
  { key: "ec", label: "EC" },
  { key: "os", label: "OS" },
  { key: "cronograma", label: "Cronograma" },
  // O credenciamento é do EVENTO: um painel de todos os fornecedores de uma vez,
  // e não uma pergunta repetida dentro de cada OS.
  { key: "credenciamento", label: "Credenciamento" },
  { key: "fornecedores", label: "Fornecedores" },
];

/** Para onde a barra do projeto leva — sempre o projeto, na aba pedida. */
export const rotaAbaProjeto = (projetoId: string, aba: string) => `/projetos/${projetoId}?aba=${aba}`;

/**
 * O segundo cabeçalho de CONFIGURAÇÕES — as seções da própria tela, mais os
 * Logs, que são a única outra coisa que se administra aqui.
 *
 * AGENDA e FORNECEDORES estiveram nesta barra por um dia e saíram (10/09/2026,
 * a pedido do Guilherme). Eles não pertencem a Configurações: fornecedor se vê
 * DENTRO do projeto, na aba Fornecedores dele, e a Agenda não é uma tela do
 * aplicativo. Pôr os dois aqui foi consequência de uma pergunta mal feita — ao
 * enxugar o cabeçalho geral para cinco botões, procurei ONDE guardar as telas
 * que sobravam em vez de perguntar SE elas deviam continuar existindo.
 */
export const NAV_CONFIG: (SecaoNav & { rota: string })[] = [
  { key: "geral", label: "Geral", rota: "/configuracoes?aba=geral", recurso: "configuracoes" },
  { key: "checklist", label: "Check-list", rota: "/configuracoes?aba=checklist", recurso: "configuracoes" },
  { key: "areas", label: "Áreas e permissões", rota: "/configuracoes?aba=areas", recurso: "configuracoes" },
  { key: "usuarios", label: "Usuários", rota: "/configuracoes?aba=usuarios", recurso: "configuracoes" },
  { key: "backup", label: "Back-up", rota: "/configuracoes?aba=backup", recurso: "configuracoes" },
  { key: "logs", label: "Logs do sistema", rota: "/logs", recurso: "logs" },
];
