// LOGS — helper das Edge Functions (padrão LSPRO, 24/11/2026).
//
// Grava em `log_evento` com a service role, origem 'edge' (ou 'rotina'), IP e user-agent lidos da
// requisição. Regras: nunca levanta erro (log não derruba a função), nunca grava senha/token/
// documento (as chaves proibidas saem do `detalhe` pelo nome, por CONTÉM; a mensagem tem CPF e
// valor de chave duplicada mascarados) e corta tudo no tamanho do banco. As ações de Edge
// (erro_edge, erro_rotina…) entram por aqui, com a service role — a RPC `registrar_log` da sessão
// só aceita as seis ações do app.
// As funções puras ficam exportadas para o teste do app (o vitest importa este arquivo direto:
// src/lib/logs/logsEdge.test.ts).
//
// ATENÇÃO: neste arquivo, como em todo `supabase/functions`, não escreva escape unicode (barra
// invertida seguida de u), nem em comentário: a publicação por MCP reescreve o escape e quebra a
// regex. Use classes como /\p{Cc}/gu.
//
// Uso nas funções do app: `comRegistroDeErros` (no fim do arquivo) embrulha o handler do
// `Deno.serve` — mudança de duas linhas por função, sem mexer no que ela faz.

// As MESMAS listas de `private.sanear_detalhe_no` (migration 20261124120000_logs_padrao.sql). O
// teste compara as duas: acrescentou um nome aqui, acrescente lá.
// Por CONTÉM, sem caixa (`senhaNova`, `x_token`, `cpfDoCliente`)...
export const CHAVES_CONTEM: readonly string[] = [
  "senha", "password", "token", "secret", "authorization", "cookie", "cpf", "salario", "apikey", "api_key",
  "cnpj", "documento",
];
// ...e as curtas demais para "contém" (pegariam palavra comum): só o nome inteiro.
export const CHAVES_EXATAS: readonly string[] = ["passwd", "rg", "pis", "ctps", "conta", "agencia", "pix", "banco", "chave_pix", "chavepix"];
export const CHAVES_PROIBIDAS: readonly string[] = [...CHAVES_CONTEM, ...CHAVES_EXATAS];

export function chaveProibida(chave: string): boolean {
  const minuscula = chave.toLowerCase();
  return CHAVES_EXATAS.includes(minuscula) || CHAVES_CONTEM.some((c) => minuscula.includes(c));
}

const LIMITE_DETALHE_BYTES = 4096;
const NIVEIS_MAX = 5;

/**
 * Corta no tamanho (antes, para texto enorme não custar CPU) e troca por espaço os caracteres de
 * controle e os invisíveis de formatação (bidi, largura zero), que inverteriam ou esconderiam
 * texto na tela. Não-texto vira "".
 */
export function cortar(valor: unknown, max: number): string {
  if (typeof valor !== "string") return "";
  return valor.slice(0, max).replace(/[\p{Cc}\p{Cf}]/gu, " ").slice(0, max);
}

/**
 * Mensagem de erro costuma carregar dado pessoal: CNPJ (14 dígitos) e CPF (11), com ou sem
 * pontuação, viram `***`; o `Key (coluna)=(valor)` do Postgres perde o valor (também com índice de
 * expressão, `Key (lower(email))=(…)`); e-mail vira `***`. A mesma regra mora no banco
 * (`private.mascarar_mensagem`).
 */
export function mascararMensagem(texto: string): string {
  return texto
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "***")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "***")
    .replace(/Key \((.*)\)=\((.*)\)/g, "Key ($1)=(***)")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "***");
}

/** Caminho da rota sem query string nem fragmento. */
export function telaSemQuery(tela: unknown): string {
  if (typeof tela !== "string") return "";
  return cortar(tela.split("?")[0].split("#")[0], 200);
}

/** "ab***@empresa.com.br": duas primeiras letras do usuário e o domínio. */
export function mascararEmail(email: unknown): string {
  if (typeof email !== "string") return "***";
  const limpo = email.trim();
  const arroba = limpo.indexOf("@");
  if (arroba < 1) return "***";
  const dominio = limpo.slice(arroba + 1).toLowerCase();
  // O domínio só entra se for domínio: senão vira texto livre no log.
  if (!/^[a-z0-9.-]{1,100}$/.test(dominio)) return "***";
  return `${limpo.slice(0, arroba).slice(0, 2).toLowerCase()}***@${dominio}`;
}

function sanearNo(valor: unknown, nivel: number): unknown {
  if (nivel > NIVEIS_MAX) return null;
  if (Array.isArray(valor)) return valor.map((v) => sanearNo(v, nivel + 1));
  if (valor && typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
      if (chaveProibida(chave)) continue;
      saida[chave] = sanearNo(v, nivel + 1);
    }
    return saida;
  }
  // O valor também passa pela máscara (a pilha de um erro repete a mensagem na primeira linha).
  if (typeof valor === "string") return mascararMensagem(valor);
  return valor;
}

/** `detalhe` só pode ser objeto; sem chaves proibidas; acima de 4 KB vira {"cortado": true}. */
export function sanearDetalhe(detalhe: unknown): Record<string, unknown> | null {
  if (!detalhe || typeof detalhe !== "object" || Array.isArray(detalhe)) return null;
  const limpo = sanearNo(detalhe, 1) as Record<string, unknown>;
  const bytes = new TextEncoder().encode(JSON.stringify(limpo)).length;
  return bytes > LIMITE_DETALHE_BYTES ? { cortado: true } : limpo;
}

/**
 * IP de quem chamou: `cf-connecting-ip` quando existe; senão a ÚLTIMA entrada do `x-forwarded-for`
 * (a que o proxy acrescenta; as anteriores o cliente pode forjar), nunca a primeira. Só vale se
 * for IP de verdade (IPv4 com quatro partes de 0 a 255, ou IPv6): um valor torto derrubaria o
 * insert na coluna `inet` e o evento inteiro sumiria.
 */
export function ipDaRequisicao(req: Request | null | undefined): string | null {
  const ipv4 = (v: string) => /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(v) && v.split(".").every((p) => Number(p) <= 255);
  const ipv6 = (v: string) => /^[0-9a-fA-F:.]{2,45}$/.test(v) && (v.match(/:/g) ?? []).length >= 2 && (v.match(/::/g) ?? []).length <= 1;
  const parece = (v: string) => ipv4(v) || ipv6(v);
  const cloudflare = (req?.headers.get("cf-connecting-ip") ?? "").trim();
  if (cloudflare) return parece(cloudflare) ? cloudflare : null;
  const entradas = (req?.headers.get("x-forwarded-for") ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  const ultimo = entradas[entradas.length - 1] ?? "";
  return parece(ultimo) ? ultimo : null;
}

export type EventoDeLog = {
  categoria: "atividade" | "acesso" | "erro";
  nivel?: "info" | "aviso" | "erro" | "critico";
  /** Chave curta: minúsculas e `_`, até 40 caracteres. */
  acao: string;
  resultado?: "ok" | "negado" | "falha";
  atorId?: string | null;
  atorNome?: string;
  /** Caminho da rota (sem query) ou `edge/<nome-da-funcao>`. */
  tela?: string;
  mensagem?: string;
  detalhe?: unknown;
  alvoTipo?: string;
  alvoId?: string;
  alvoRotulo?: string;
  correlacao?: string;
  /** 'rotina' para o que roda sem usuário (cron). */
  origem?: "edge" | "rotina";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Linha de `log_evento` já saneada; null quando o evento não vale (ação fora do padrão). */
export function linhaDoLog(evento: EventoDeLog, req: Request | null | undefined): Record<string, unknown> | null {
  if (!/^[a-z_]{1,40}$/.test(evento.acao ?? "")) return null;
  if (!["atividade", "acesso", "erro"].includes(evento.categoria)) return null;
  const nivel = evento.nivel && ["info", "aviso", "erro", "critico"].includes(evento.nivel) ? evento.nivel : "info";
  const resultado = evento.resultado && ["ok", "negado", "falha"].includes(evento.resultado) ? evento.resultado : "ok";
  return {
    categoria: evento.categoria,
    nivel,
    acao: evento.acao,
    resultado,
    ator_id: evento.atorId && UUID.test(evento.atorId) ? evento.atorId : null,
    ator_nome: cortar(evento.atorNome, 200),
    alvo_tipo: evento.alvoTipo ? cortar(evento.alvoTipo, 60) : null,
    alvo_id: evento.alvoId ? cortar(evento.alvoId, 200) : null,
    alvo_rotulo: evento.alvoRotulo ? cortar(evento.alvoRotulo, 300) : null,
    tela: evento.tela ? telaSemQuery(evento.tela) : null,
    origem: evento.origem === "rotina" ? "rotina" : "edge",
    mensagem: mascararMensagem(cortar(evento.mensagem, 500)).slice(0, 500),
    detalhe: sanearDetalhe(evento.detalhe),
    ip: ipDaRequisicao(req),
    user_agent: req ? cortar(req.headers.get("user-agent"), 300) || null : null,
    correlacao: evento.correlacao && UUID.test(evento.correlacao) ? evento.correlacao : null,
  };
}

/** O mínimo do cliente de serviço que o log usa (o supabase-js com a service role serve). */
export interface ClienteDeLog {
  from(tabela: string): { insert(valor: unknown): PromiseLike<{ error: unknown }> };
}

// Freio por instância: uma Edge em loop de erro não enche a tabela.
const JANELA_MS = 60_000;
const MAX_POR_JANELA = 60;
let janelaInicio = 0;
let naJanela = 0;

/** Grava o evento. Nunca relança: qualquer falha vira um `console.error` sem dados. */
export async function registrarLog(
  admin: ClienteDeLog | null | undefined,
  req: Request | null | undefined,
  evento: EventoDeLog,
): Promise<void> {
  try {
    if (!admin) return;
    const agora = Date.now();
    if (agora - janelaInicio > JANELA_MS) { janelaInicio = agora; naJanela = 0; }
    if (++naJanela > MAX_POR_JANELA) return;
    const linha = linhaDoLog(evento, req);
    if (!linha) return;
    const { error } = await admin.from("log_evento").insert(linha);
    // Só no console: registrar no log a falha do log seria um laço.
    if (error) console.error("[log] insert", (error as { message?: string }).message ?? "falha");
  } catch (falha) {
    console.error("[log]", falha instanceof Error ? falha.message : "falha");
  }
}

/** Para o `catch` de nível superior de cada função: erro inesperado -> categoria erro / erro_edge. */
export async function registrarErroDaEdge(
  admin: ClienteDeLog | null | undefined,
  req: Request | null | undefined,
  funcao: string,
  erro: unknown,
  ator?: { id?: string | null; nome?: string },
  detalhe?: Record<string, unknown>,
): Promise<void> {
  const mensagem = erro instanceof Error ? erro.message : typeof erro === "string" ? erro : "Erro inesperado";
  await registrarLog(admin, req, {
    categoria: "erro", nivel: "erro", acao: "erro_edge", resultado: "falha",
    atorId: ator?.id ?? null, atorNome: ator?.nome, tela: `edge/${funcao}`,
    mensagem, detalhe: { funcao, tipo: erro instanceof Error ? erro.name : typeof erro, ...(detalhe ?? {}) },
  });
}

/** Falha de rotina agendada (cron): sem pessoa, sem requisição de pessoa, origem 'rotina'. */
export async function registrarErroDaRotina(
  admin: ClienteDeLog | null | undefined,
  funcao: string,
  erro: unknown,
  detalhe?: Record<string, unknown>,
): Promise<void> {
  const mensagem = erro instanceof Error ? erro.message : typeof erro === "string" ? erro : "Erro inesperado";
  await registrarLog(admin, null, {
    categoria: "erro", nivel: "erro", acao: "erro_rotina", resultado: "falha", origem: "rotina",
    tela: `edge/${funcao}`, mensagem,
    detalhe: { funcao, tipo: erro instanceof Error ? erro.name : typeof erro, ...(detalhe ?? {}) },
  });
}

/**
 * Cliente de log pelo PostgREST com a service role do ambiente, sem depender do supabase-js: o
 * `catch` de qualquer função consegue registrar o erro sem ter criado cliente antes. Null sem
 * `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (os dois já existem em toda Edge Function do
 * Supabase: não há segredo novo a configurar).
 */
export function clienteDeLogDoAmbiente(): ClienteDeLog | null {
  const ambiente = (globalThis as unknown as { Deno?: { env: { get(nome: string): string | undefined } } }).Deno?.env;
  const url = (ambiente?.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  const chave = ambiente?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !chave) return null;
  return {
    from: (tabela: string) => ({
      insert: async (valor: unknown) => {
        const resposta = await fetch(`${url}/rest/v1/${tabela}`, {
          method: "POST",
          headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(valor),
          // 1,5 s: o log não pode somar segundos a uma resposta de erro que já está atrasada.
          signal: AbortSignal.timeout(1500),
        });
        // O corpo é lido/cancelado para a conexão voltar ao pool.
        await resposta.body?.cancel().catch(() => undefined);
        return { error: resposta.ok ? null : { message: `PostgREST ${resposta.status}` } };
      },
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// Embrulho do handler (o jeito de ligar o log nas funções da Pólobh)

/**
 * O motivo de uma resposta de erro que a própria função montou (`json({ erro: "…" }, 502)`): os
 * handlers do app devolvem `erro` ou `error`. Lê uma CÓPIA da resposta — o corpo original segue
 * intacto para quem chamou — e desiste em 500 ms (nenhuma função do app responde erro em
 * streaming, mas o log não pode prender a resposta se um dia responder). O texto guardado é
 * cortado depois, em `linhaDoLog`.
 */
export async function motivoDaResposta(resposta: Response): Promise<string> {
  const reserva = `Resposta ${resposta.status}`;
  try {
    const texto = await Promise.race([
      resposta.clone().text(),
      new Promise<string>((resolver) => setTimeout(() => resolver(""), 500)),
    ]);
    try {
      const corpo = JSON.parse(texto) as Record<string, unknown>;
      const motivo = corpo?.erro ?? corpo?.error ?? corpo?.message;
      if (typeof motivo === "string" && motivo.trim()) return motivo.slice(0, 2000);
    } catch { /* não era JSON: vale o texto */ }
    return texto.trim().slice(0, 2000) || reserva;
  } catch {
    return reserva;
  }
}

type Handler = (req: Request) => Response | Promise<Response>;

const RESPOSTA_GENERICA = () =>
  new Response(JSON.stringify({ ok: false, erro: "Não foi possível concluir a operação." }), {
    status: 500,
    // Com o CORS aberto, como as funções do app: o navegador mostra o JSON, não um erro de CORS.
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

/**
 * Embrulha o handler do `Deno.serve` para que TODO erro da função chegue ao log, sem reescrever a
 * função:
 *  · exceção que escapou do handler (não havia `catch` de nível superior) → registra, escreve no
 *    console e devolve 500 com mensagem genérica (antes o Deno devolvia um 500 cru);
 *  · resposta com status >= 500 que a própria função montou (o `catch` dela, ou um
 *    `return json(..., 502)` no meio do código) → registra com o motivo que ela devolveu e entrega
 *    a mesma resposta, sem mudar nada para quem chamou.
 * Os `console.error` que as funções já tinham continuam onde estão. O registro espera no máximo
 * 1,5 s (o `fetch` do cliente de log) e nunca falha.
 *
 * `rotina: true` para as funções chamadas pelo pg_cron: a falha vai como `erro_rotina`, origem
 * 'rotina', sem IP (quem chama é o próprio banco).
 *
 *   Deno.serve(comRegistroDeErros("nome-da-funcao", async (req) => { ... }));
 */
export function comRegistroDeErros(funcao: string, handler: Handler, opcoes: { rotina?: boolean } = {}): Handler {
  const registrar = (erro: unknown, req: Request, detalhe?: Record<string, unknown>) =>
    opcoes.rotina
      ? registrarErroDaRotina(clienteDeLogDoAmbiente(), funcao, erro, detalhe)
      : registrarErroDaEdge(clienteDeLogDoAmbiente(), req, funcao, erro, undefined, detalhe);

  return async (req: Request) => {
    let resposta: Response;
    try {
      resposta = await handler(req);
    } catch (erro) {
      await registrar(erro, req);
      console.error(`[${funcao}]`, erro instanceof Error ? erro.message : "falha");
      return RESPOSTA_GENERICA();
    }
    try {
      if (resposta.status >= 500) {
        await registrar(await motivoDaResposta(resposta), req, { status: resposta.status });
      }
    } catch { /* log nunca derruba a resposta */ }
    return resposta;
  };
}
