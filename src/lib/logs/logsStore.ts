// LOGS — leitura e regras puras da tela (padrão LSPRO, 24/11/2026; modelo da skill
// `logs-padrao-lspro`).
//
// A tela só lê pela RPC `consultar_logs`: ela confere a permissão e faz filtro, página, ordenação
// e total no banco. Enquanto a migration 20261124120000_logs_padrao.sql não estiver aplicada (a
// RPC não existe), a tela cai para a leitura da trilha antiga, `audit_log`, com um aviso — a
// mesma tabela que a tela de Logs anterior lia, também filtrada e paginada no banco
// (`consultarTrilhaAntiga`). Nada aqui é visual.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export type AbaLogs = "atividades" | "acessos" | "erros";
export type NivelLog = "info" | "aviso" | "erro" | "critico";
export type ResultadoLog = "ok" | "negado" | "falha";
export type OrigemLog = "app" | "banco" | "edge" | "rotina";

export type ItemLog = {
  id: string;
  /** "log" = `log_evento`; "auditoria" = a trilha antiga (`audit_log`) unida na consulta. */
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
  grupo_alterado: "Grupo de permissão alterado",
  // Da trilha antiga (`audit_log`, gravada pelo `auditar()`): as chaves com ponto.
  "auth.login": "Entrou no app",
  "auth.logout": "Saiu do app",
  "auth.senha": "Senha alterada",
  "auth.senha.recusada": "Troca de senha recusada",
  "auth.senha.redefinicao": "Redefinição de senha pedida",
  "auth.senha.redefinida": "Senha redefinida pelo link",
  "acesso.negado": "Acesso negado",
};

export const rotuloDaAcao = (acao: string): string => ROTULOS_ACAO[acao] ?? acao;

export const ROTULO_NIVEL: Record<string, string> = { info: "Info", aviso: "Aviso", erro: "Erro", critico: "Crítico" };
export const ROTULO_RESULTADO: Record<string, string> = { ok: "Ok", negado: "Negado", falha: "Falha" };
export const ROTULO_ORIGEM_LOG: Record<string, string> = { app: "App", banco: "Banco", edge: "Servidor", rotina: "Rotina" };

/**
 * As telas do app para o filtro "Tela" e para mostrar o nome no lugar do caminho. O VALOR é o
 * caminho da rota — o único formato que o front grava. Montado a partir do `router.tsx` e do menu
 * (a Pólobh não tem catálogo de telas). As Edges gravam `edge/<função>`.
 */
export const TELAS_DO_APP: { valor: string; rotulo: string }[] = [
  { valor: "/calendario", rotulo: "Calendário" },
  { valor: "/projetos", rotulo: "Projetos" },
  { valor: "/estimativas", rotulo: "Estimativas de Custo" },
  { valor: "/ordens", rotulo: "Ordens de Serviço" },
  { valor: "/cronogramas", rotulo: "Cronogramas" },
  { valor: "/fornecedores", rotulo: "Fornecedores" },
  { valor: "/fluxograma", rotulo: "Fluxograma" },
  { valor: "/configuracoes", rotulo: "Configurações" },
  { valor: "/logs", rotulo: "Logs" },
  { valor: "/guia", rotulo: "Guia de uso" },
  { valor: "/suporte", rotulo: "Suporte" },
  { valor: "/login", rotulo: "Login" },
  { valor: "/nova-senha", rotulo: "Nova senha" },
];

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
 * O que o filtro "Tela" manda ao banco em `telas`. A Pólobh não tem catálogo de telas (não há
 * chave como `acessos.usuarios` para acrescentar): vai só o caminho. Quando o padrão de Acessos
 * trouxer o catálogo, acrescente aqui as chaves da rota.
 */
export function telasDoFiltro(caminho: string): string[] {
  return [caminho];
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

/** Últimos N dias (7 por padrão), hoje incluído. */
export function periodoPadrao(hoje: string, dias = DIAS_JANELA_PADRAO): { inicio: string; fim: string } {
  return { inicio: addDias(hoje, -(dias - 1)), fim: hoje };
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

/** Os filtros do painel zerados ("Limpar filtros"): período e busca ficam. */
export function semFiltrosDoPainel(f: FiltrosLogs): FiltrosLogs {
  return { ...f, usuarioId: "", nivel: "", resultado: "", tela: "", origem: "", correlacao: "", pagina: 1 };
}

/** Limites do período em ISO com fuso de Brasília (UTC−3, sem horário de verão desde 2019). */
function limitesDoPeriodo(f: FiltrosLogs): { de: string; ate: string } {
  const { inicio, fim } = limitarPeriodo(f.inicio, f.fim);
  return { de: `${inicio}T00:00:00-03:00`, ate: `${fim}T23:59:59.999-03:00` };
}

/**
 * Os parâmetros da RPC `consultar_logs`. Filtro vazio nem entra no corpo. A tela vai em `tela`
 * (o banco casa também a sub-rota: "/projetos" acha "/projetos/<id>") e em `telas`.
 */
export function parametrosDaConsulta(f: FiltrosLogs, porPagina = POR_PAGINA): Record<string, unknown> {
  const opcional = (valor: string) => (valor.trim() ? valor.trim() : undefined);
  const tela = opcional(f.tela);
  return {
    aba: f.aba,
    ...limitesDoPeriodo(f),
    usuarioId: opcional(f.usuarioId),
    nivel: opcional(f.nivel),
    resultado: opcional(f.resultado),
    tela,
    telas: tela ? telasDoFiltro(tela) : undefined,
    origem: opcional(f.origem),
    busca: opcional(f.busca),
    correlacao: opcional(f.correlacao),
    pagina: f.pagina,
    porPagina,
    ordem: f.ordem,
  };
}

/** Antes e depois de uma alteração, quando o detalhe os traz. */
export function antesEDepois(item: ItemLog): { antes: unknown; depois: unknown } | null {
  if (!item.detalhe || typeof item.detalhe !== "object") return null;
  const d = item.detalhe as { antes?: unknown; depois?: unknown };
  if (d.antes === undefined && d.depois === undefined) return null;
  return { antes: d.antes ?? null, depois: d.depois ?? null };
}

// --- Consulta ---------------------------------------------------------------------------------

// Cliente sem tipos: a função pode ainda não estar nos tipos gerados do banco.
const bd = supabase as unknown as SupabaseClient;

/** A migration dos logs não foi aplicada neste ambiente. */
export class LogsIndisponiveis extends Error {
  constructor() { super("Os logs ainda não estão disponíveis neste ambiente."); }
}

export function funcaoAusente(erro: { message?: string; code?: string; status?: number } | null | undefined): boolean {
  if (!erro) return false;
  return erro.code === "PGRST202" || erro.status === 404 || /could not find the function|schema cache/i.test(erro.message ?? "");
}

/**
 * O que a consulta devolve. `auditoriaIncluida` = `false` quando quem consulta não pode auditar e a
 * trilha antiga ficou de fora da aba Atividades (a tela avisa). `reserva` = a RPC não existe ainda
 * e a resposta veio da leitura direta da `audit_log` (a tela avisa).
 */
export type RespostaDeLogs = { total: number; itens: ItemLog[]; auditoriaIncluida?: boolean; reserva?: boolean };
export type Consultar = (filtros: FiltrosLogs, porPagina?: number) => Promise<RespostaDeLogs>;

export const consultarLogs: Consultar = async (filtros, porPagina = POR_PAGINA) => {
  const { data, error } = await bd.rpc("consultar_logs", { p: parametrosDaConsulta(filtros, porPagina) });
  if (error) {
    const e = error as { message?: string; code?: string; status?: number };
    if (funcaoAusente(e)) throw new LogsIndisponiveis();
    // 42501 (sem permissão) e 22023 (parâmetro inválido) trazem o motivo em português: vale a
    // mensagem do banco. O resto vira a frase genérica (o motivo técnico não ajuda quem lê).
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

// --- Reserva: a trilha antiga, enquanto a migration não sobe ------------------------------------

/** As categorias da `audit_log` que são de acesso (as demais vão para Atividades). */
export const CATEGORIAS_DE_ACESSO_ANTIGAS = ["Autenticação", "Acesso"] as const;

/**
 * A busca entra num filtro `or(...)` do PostgREST, onde vírgula, parêntese, aspas, asterisco e
 * barra mudam o sentido da expressão. Eles saem da busca (o resto é procurado como texto).
 */
export function buscaSeguraParaOr(busca: string): string {
  return busca.replace(/[,()*"'\\%_:]/g, " ").replace(/\s+/g, " ").trim();
}

type LinhaAntiga = {
  id: string; ts: string; nivel: string; categoria: string; acao: string; mensagem: string;
  usuario: string | null; papel: string | null; user_id: string | null; alvo_id: string | null;
};

/** Uma linha da `audit_log` no formato da tela — o mesmo mapeamento da união na RPC. */
export function itemDaTrilhaAntiga(l: LinhaAntiga, aba: AbaLogs): ItemLog {
  const nivel = ["info", "aviso", "erro"].includes(l.nivel) ? l.nivel : "info";
  const resultado = /negad|recusad/i.test(l.acao) ? "negado" : nivel === "erro" ? "falha" : "ok";
  const detalhe: Record<string, string> = {};
  if (l.categoria) detalhe.categoria = l.categoria;
  if (l.papel) detalhe.papel = l.papel;
  return {
    id: `auditoria:${l.id}`, fonte: "auditoria", em: l.ts,
    categoria: aba === "acessos" ? "acesso" : aba === "erros" ? "erro" : "atividade",
    nivel, acao: l.acao, resultado, atorId: l.user_id, atorNome: l.usuario ?? "",
    alvoTipo: l.categoria ?? null, alvoId: l.alvo_id, alvoRotulo: null, tela: null, origem: "app",
    mensagem: l.mensagem, detalhe: Object.keys(detalhe).length ? detalhe : null, ip: null, userAgent: null, correlacao: null,
  };
}

/**
 * A `audit_log` lida direto, com filtro, ordem e página no banco. As abas se dividem assim:
 * Erros = nível erro; Acessos = categorias "Autenticação" e "Acesso"; Atividades = o resto. Os
 * filtros que a trilha antiga não guarda (resultado, tela, origem, correlação) não se aplicam.
 * A RLS da `audit_log` só deixa o Administrador ler: para os demais a lista vem vazia.
 */
export const consultarTrilhaAntiga: Consultar = async (f, porPagina = POR_PAGINA) => {
  const { de, ate } = limitesDoPeriodo(f);
  const acessos = `(${CATEGORIAS_DE_ACESSO_ANTIGAS.map((c) => `"${c}"`).join(",")})`;
  let q = bd
    .from("audit_log")
    .select("id, ts, nivel, categoria, acao, mensagem, usuario, papel, user_id, alvo_id", { count: "exact" })
    .gte("ts", de)
    .lte("ts", ate);
  if (f.aba === "erros") q = q.eq("nivel", "erro");
  else {
    q = q.neq("nivel", "erro");
    q = f.aba === "acessos" ? q.in("categoria", [...CATEGORIAS_DE_ACESSO_ANTIGAS]) : q.not("categoria", "in", acessos);
  }
  if (f.usuarioId.trim()) q = q.eq("user_id", f.usuarioId.trim());
  if (f.nivel.trim()) q = q.eq("nivel", f.nivel.trim());
  const busca = buscaSeguraParaOr(f.busca);
  if (busca) {
    q = q.or(["mensagem", "acao", "usuario", "categoria"].map((c) => `${c}.ilike.*${busca}*`).join(","));
  }
  const pagina = Math.min(100000, Math.max(1, f.pagina));
  const desde = (pagina - 1) * porPagina;
  const { data, error, count } = await q
    .order("ts", { ascending: f.ordem === "em_asc" })
    .order("id", { ascending: true })
    .range(desde, desde + porPagina - 1);
  if (error) throw new Error("Não foi possível carregar os logs.");
  return {
    total: count ?? 0,
    itens: ((data ?? []) as LinhaAntiga[]).map((l) => itemDaTrilhaAntiga(l, f.aba)),
    reserva: true,
  };
};

/** Depois que a RPC respondeu "não existo", a sessão não pergunta de novo a cada filtro. */
let semRpcNestaSessao = false;

/** A consulta da tela: a RPC nova; sem ela (migration pendente), a trilha antiga. */
export const consultarComReserva: Consultar = async (filtros, porPagina = POR_PAGINA) => {
  if (!semRpcNestaSessao) {
    try {
      return await consultarLogs(filtros, porPagina);
    } catch (erro) {
      if (!(erro instanceof LogsIndisponiveis)) throw erro;
      semRpcNestaSessao = true;
    }
  }
  return consultarTrilhaAntiga(filtros, porPagina);
};

/**
 * Todas as páginas do filtro, até o teto de 5.000 linhas. `cortou` diz que havia mais — quem
 * exporta avisa, em vez de entregar um arquivo incompleto como se fosse inteiro.
 */
export async function coletarParaExportar(
  filtros: FiltrosLogs,
  consultar: Consultar = consultarComReserva,
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

/** Os usuários do app para o filtro (id → nome, A→Z). Falha = lista vazia: a busca acha pelo nome. */
export async function carregarUsuariosDoFiltro(): Promise<{ valor: string; rotulo: string }[]> {
  try {
    const { data, error } = await bd.from("perfis").select("id, nome").order("nome");
    if (error || !data) return [];
    return (data as { id: string; nome: string | null }[])
      .map((p) => ({ valor: p.id, rotulo: p.nome?.trim() || "Sem nome" }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  } catch {
    return [];
  }
}
