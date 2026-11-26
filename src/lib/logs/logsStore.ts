// Padrão de Logs — leitura e regras puras da tela (26/11/2026).
//
// A tela só lê pela RPC `consultar_logs`: ela confere a permissão e faz filtro, página, ordenação
// e total no banco. Nada aqui é visual; os rótulos são texto e a cor fica com o design system do app.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { CATALOGO } from "@/config/acessos/catalogo";

export type AbaLogs = "atividades" | "acessos" | "erros";
export type NivelLog = "info" | "aviso" | "erro" | "critico";
export type ResultadoLog = "ok" | "negado" | "falha";
export type OrigemLog = "app" | "banco" | "edge" | "rotina";

export type ItemLog = {
  id: string;
  /** "log" = `log_evento`; outro valor = a trilha própria do app unida na consulta. */
  fonte: string;
  em: string;
  categoria: string;
  nivel: NivelLog | string;
  acao: string;
  resultado: ResultadoLog | string;
  atorId: string | null;
  atorNome: string | null;
  alvoTipo: string | null;
  alvoId: string | null;
  alvoRotulo: string | null;
  tela: string | null;
  origem: string | null;
  mensagem: string | null;
  detalhe: unknown;
  ip: string | null;
  userAgent: string | null;
  correlacao: string | null;
};

export const ABAS_LOGS: { value: AbaLogs; label: string }[] = [
  { value: "atividades", label: "Atividades" },
  { value: "acessos", label: "Acessos" },
  { value: "erros", label: "Erros" },
];

// --- Rótulos ----------------------------------------------------------------------------------

// Ação sem rótulo aparece como a chave (é o caso das da trilha antiga, como "os.atualizar").
const ROTULOS_ACAO: Record<string, string> = {
  login: "Entrou no app",
  logout: "Saiu do app",
  login_falhou: "Falha de login",
  acesso_negado: "Acesso negado",
  erro_requisicao: "Erro de requisição",
  erro_js: "Erro de JavaScript",
  erro_edge: "Erro de função do servidor",
  erro_rotina: "Falha de rotina",
  exportacao: "Exportação",
  usuario_criado: "Usuário criado",
  usuario_liberado: "Usuário liberado",
  usuario_inativado: "Usuário inativado",
  senha_definida: "Senha definida pelo administrador",
  senha_alterada: "Senha alterada pelo usuário",
  senha_troca_recusada: "Troca de senha recusada",
  grupo_alterado: "Grupo de permissão alterado",
  grupo_criado: "Grupo de permissão criado",
  usuario_ativado: "Usuário ativado",
  usuario_alterado: "Acesso do usuário alterado",
  // Da auditoria genérica (PARTE 2 do banco.sql):
  registro_criado: "Registro criado",
  registro_alterado: "Registro alterado",
  registro_excluido: "Registro excluído",
};

export const rotuloDaAcao = (acao: string): string => ROTULOS_ACAO[acao] ?? acao;

export const ROTULO_NIVEL: Record<string, string> = { info: "Info", aviso: "Aviso", erro: "Erro", critico: "Crítico" };
export const ROTULO_RESULTADO: Record<string, string> = { ok: "Ok", negado: "Negado", falha: "Falha" };
export const ROTULO_ORIGEM_LOG: Record<string, string> = { app: "App", banco: "Banco", edge: "Servidor", rotina: "Rotina" };

/**
 * As telas do app para o filtro "Tela" e para mostrar o nome no lugar do caminho.
 * O VALOR é o caminho da rota — o único formato que o log guarda.
 * Montadas a partir do catálogo de Acessos.
 */
export const TELAS_DO_APP: { valor: string; rotulo: string }[] = CATALOGO.flatMap((m) => m.telas)
  .filter((t) => t.rotas.length > 0)
  .map((t) => ({ valor: t.rotas[0], rotulo: t.chave.startsWith("acessos.") ? "Acessos" : t.rotulo }));

export function opcoesDeTela(telas: { valor: string; rotulo: string }[] = TELAS_DO_APP): { valor: string; rotulo: string }[] {
  return telas
    .filter((t, i, todas) => todas.findIndex((o) => o.valor === t.valor) === i)
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** Caminho → nome da tela (o caminho filho também casa); o que não é conhecido volta como está. */
export function rotuloDaTela(tela: string | null | undefined, telas: { valor: string; rotulo: string }[] = TELAS_DO_APP): string {
  if (!tela) return "";
  const exata = telas.find((t) => t.valor === tela);
  if (exata) return exata.rotulo;
  const pai = telas
    .filter((t) => tela.startsWith(`${t.valor}/`))
    .sort((a, b) => b.valor.length - a.valor.length)[0];
  return pai?.rotulo ?? tela;
}

/**
 * O que o filtro "Tela" manda ao banco (`telas`): o caminho e, se o app tem catálogo de telas, as
 * CHAVES do catálogo daquela rota. O log tem os dois vocabulários — o front grava o caminho, e o
 * banco e a Edge às vezes gravam a chave (`acessos.usuarios`) —, e o banco casa por esta lista.
 */
export function telasDoFiltro(caminho: string): string[] {
  const chaves = CATALOGO.flatMap((m) => m.telas).filter((t) => t.rotas.includes(caminho)).map((t) => t.chave);
  return [caminho, ...chaves];
}

// --- Filtros → RPC ----------------------------------------------------------------------------

export const DIAS_JANELA_PADRAO = 7;
export const DIAS_JANELA_MAXIMA = 90;
export const POR_PAGINA = 50;
export const TETO_EXPORTACAO = 5000;
/** O máximo que a RPC aceita por página — a exportação anda de 200 em 200. */
export const POR_PAGINA_EXPORTACAO = 200;

export type FiltrosLogs = {
  aba: AbaLogs;
  /** Datas ISO (aaaa-mm-dd), inclusive nas duas pontas. */
  inicio: string;
  fim: string;
  usuarioId: string;
  nivel: string;
  resultado: string;
  tela: string;
  origem: string;
  busca: string;
  correlacao: string;
  pagina: number;
  ordem: "em_desc" | "em_asc";
};

/** Soma dias a uma data ISO (aaaa-mm-dd), em UTC para não escorregar com fuso. */
export function addDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Hoje (aaaa-mm-dd) no horário de Brasília. */
export function hojeISO(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

/** Últimos 7 dias, hoje incluído. */
export function periodoPadrao(hoje: string): { inicio: string; fim: string } {
  return { inicio: addDias(hoje, -(DIAS_JANELA_PADRAO - 1)), fim: hoje };
}

export function filtrosIniciais(hoje: string, aba: AbaLogs = "atividades"): FiltrosLogs {
  return { aba, ...periodoPadrao(hoje), usuarioId: "", nivel: "", resultado: "", tela: "", origem: "", busca: "", correlacao: "", pagina: 1, ordem: "em_desc" };
}

/** O período escolhido não passa de 90 dias: o fim vence e o início sobe (o banco faria o mesmo). */
export function limitarPeriodo(inicio: string, fim: string): { inicio: string; fim: string } {
  const maisAntigo = addDias(fim, -(DIAS_JANELA_MAXIMA - 1));
  return { inicio: inicio < maisAntigo ? maisAntigo : inicio, fim };
}

/** Quantos filtros do painel estão ligados (a busca e o período ficam à vista e não contam). */
export function filtrosAtivos(f: FiltrosLogs): number {
  return [f.usuarioId, f.nivel, f.resultado, f.tela, f.origem, f.correlacao].filter(Boolean).length;
}

/**
 * Os parâmetros da RPC `consultar_logs`. O dia vai de 00:00 a 23:59:59 no horário de Brasília
 * (UTC−3, sem horário de verão desde 2019); filtro vazio nem entra no corpo.
 */
export function parametrosDaConsulta(f: FiltrosLogs, porPagina = POR_PAGINA): Record<string, unknown> {
  const { inicio, fim } = limitarPeriodo(f.inicio, f.fim);
  const opcional = (valor: string) => (valor.trim() ? valor.trim() : undefined);
  return {
    aba: f.aba,
    de: `${inicio}T00:00:00-03:00`,
    ate: `${fim}T23:59:59.999-03:00`,
    usuarioId: opcional(f.usuarioId),
    nivel: opcional(f.nivel),
    resultado: opcional(f.resultado),
    telas: opcional(f.tela) ? telasDoFiltro(f.tela.trim()) : undefined,
    origem: opcional(f.origem),
    busca: opcional(f.busca),
    correlacao: opcional(f.correlacao),
    pagina: f.pagina,
    porPagina,
    ordem: f.ordem,
  };
}

/** Antes e depois de uma alteração, quando o detalhe os traz (auditoria genérica ou trilha do app). */
export function antesEDepois(item: ItemLog): { antes: unknown; depois: unknown } | null {
  if (!item.detalhe || typeof item.detalhe !== "object") return null;
  const d = item.detalhe as { antes?: unknown; depois?: unknown };
  if (d.antes === undefined && d.depois === undefined) return null;
  return { antes: d.antes ?? null, depois: d.depois ?? null };
}

// --- Consulta ---------------------------------------------------------------------------------

// Cliente sem tipos: a função pode ainda não estar nos tipos gerados do banco.
const bd = supabase as unknown as SupabaseClient;

/** A migration dos logs não foi aplicada neste ambiente: a tela avisa em vez de falhar. */
export class LogsIndisponiveis extends Error {
  constructor() { super("Os logs ainda não estão disponíveis neste ambiente."); }
}

export function funcaoAusente(erro: { message?: string; code?: string; status?: number } | null | undefined): boolean {
  if (!erro) return false;
  return erro.code === "PGRST202" || erro.status === 404 || /could not find the function|schema cache/i.test(erro.message ?? "");
}

/**
 * O que a RPC devolve. `auditoriaIncluida` só vem como boolean no app que une uma trilha própria
 * na aba Atividades: `false` = quem consulta não pode auditar e a trilha ficou de fora (a tela avisa).
 */
export type RespostaDeLogs = { total: number; itens: ItemLog[]; auditoriaIncluida?: boolean };
export type Consultar = (filtros: FiltrosLogs, porPagina?: number) => Promise<RespostaDeLogs>;

export const consultarLogs: Consultar = async (filtros, porPagina = POR_PAGINA) => {
  const { data, error } = await bd.rpc("consultar_logs", { p: parametrosDaConsulta(filtros, porPagina) });
  if (error) {
    const e = error as { message?: string; code?: string; status?: number };
    if (funcaoAusente(e)) throw new LogsIndisponiveis();
    // 42501 (sem permissão) e 22023 (parâmetro inválido) trazem o motivo em português: vale a
    // mensagem do banco. No resto, a mensagem genérica.
    throw new Error((e.code === "42501" || e.code === "22023") && e.message ? e.message : "Não foi possível carregar os logs.");
  }
  const bruto = (data ?? { total: 0, itens: [] }) as Partial<RespostaDeLogs>;
  return {
    total: Number(bruto.total ?? 0),
    itens: Array.isArray(bruto.itens) ? bruto.itens : [],
    // Banco que não devolve o campo (ou devolve null): não afirma nada — só `false` explícito mostra o aviso.
    auditoriaIncluida: typeof bruto.auditoriaIncluida === "boolean" ? bruto.auditoriaIncluida : undefined,
  };
};

/**
 * Todas as páginas do filtro, até o teto de 5.000 linhas. `cortou` diz que havia mais — quem
 * exporta avisa, em vez de entregar um arquivo incompleto como se fosse inteiro.
 */
export async function coletarParaExportar(
  filtros: FiltrosLogs,
  consultar: Consultar = consultarLogs,
  teto = TETO_EXPORTACAO,
): Promise<{ itens: ItemLog[]; total: number; cortou: boolean }> {
  const itens: ItemLog[] = [];
  let total = 0;
  for (let pagina = 1; itens.length < teto; pagina++) {
    const r = await consultar({ ...filtros, pagina }, POR_PAGINA_EXPORTACAO);
    total = r.total;
    itens.push(...r.itens);
    if (r.itens.length < POR_PAGINA_EXPORTACAO || itens.length >= total) break;
  }
  return { itens: itens.slice(0, teto), total, cortou: total > teto };
}
