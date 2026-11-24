import type { Recurso } from "@/store/auth";

/* O cabeçalho geral (NAV) virou a barra lateral: ver src/config/navegacao.ts (24/11/2026). */

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
  /** Recursos alternativos (ver `NavItem.ou`). */
  ou?: Recurso[];
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
  { key: "checklist", label: "Check-list", rota: "/configuracoes?aba=checklist", recurso: "configuracoes", ou: ["checklists.padrao"] },
  // Só o Administrador e a Direção de Produção (13/11/2026): a chave é marcada à mão na área.
  { key: "contratos", label: "Contratos", rota: "/configuracoes?aba=contratos", recurso: "contratos.clausulas" },
  // "Áreas e permissões" e "Usuários" MUDARAM para a tela /acessos (padrão de Acessos, 24/11/2026).
  { key: "backup", label: "Back-up", rota: "/configuracoes?aba=backup", recurso: "configuracoes" },
  { key: "ia", label: "Consumo de IA", rota: "/configuracoes?aba=ia", recurso: "configuracoes" },
  { key: "logs", label: "Logs do sistema", rota: "/logs", recurso: "logs" },
];
