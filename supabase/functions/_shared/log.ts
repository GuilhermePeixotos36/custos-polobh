// Padrão de Logs — helper das Edge Functions. Copie para `supabase/functions/_shared/log.ts`.
//
// Grava em `log_evento` com a service role, origem 'edge' (ou 'rotina'), IP e user-agent lidos da
// requisição. Regras: nunca levanta erro (log não derruba a função), nunca grava senha/token/
// documento (as chaves proibidas saem do `detalhe` pelo nome, por CONTÉM; a mensagem tem CPF e
// valor de chave duplicada mascarados) e corta tudo no tamanho do banco. As ações de banco e de
// Edge (usuario_criado, senha_definida, erro_edge…) entram por aqui, com a service role — a RPC
// `registrar_log` da sessão só aceita as seis ações do app.
// As funções puras ficam exportadas para o teste do app (vitest importa este arquivo direto).
//
// ATENÇÃO: neste arquivo, como em todo `supabase/functions`, não escreva escape unicode (barra
// invertida + u), nem em comentário: a publicação por MCP reescreve o escape e quebra a regex.
// Use classes como /\p{Cc}/gu.
//
// Exemplo de uso: no fim do arquivo.

// As MESMAS listas de `private.sanear_detalhe_no` (migração 20261126100100). Não tire nenhum dos de
// credencial. Pólobh: dados bancários do fornecedor também nunca entram.
// Por CONTÉM, sem caixa (`senhaNova`, `x_token`, `cpfDoCliente`)...
export const CHAVES_CONTEM: readonly string[] = [
  "senha", "password", "token", "secret", "authorization", "cookie", "cpf", "salario", "apikey", "api_key",
  "dadosbancarios", "dados_bancarios",
];
// ...e as curtas demais para "contém" (pegariam palavra comum): só o nome inteiro.
export const CHAVES_EXATAS: readonly string[] = ["passwd", "rg", "pis", "ctps", "conta", "agencia", "pix"];
export const CHAVES_PROIBIDAS: readonly string[] = [...CHAVES_CONTEM, ...CHAVES_EXATAS];

export function chaveProibida(chave: string): boolean {
  const minuscula = chave.toLowerCase();
  return CHAVES_EXATAS.includes(minuscula) || CHAVES_CONTEM.some((c) => minuscula.includes(c));
}

const LIMITE_DETALHE_BYTES = 4096;
const NIVEIS_MAX = 5;

/** Tira caracteres de controle (viram espaço) e corta no tamanho. Não-texto vira "". */
export function cortar(valor: unknown, max: number): string {
  if (typeof valor !== "string") return "";
  return valor.replace(/\p{Cc}/gu, " ").slice(0, max);
}

/**
 * Mensagem de erro costuma carregar dado pessoal: sequência de 11 dígitos (CPF, com ou sem
 * pontuação) vira `***` e o `Key (coluna)=(valor)` do Postgres perde o valor. A mesma regra mora
 * no banco (`private.mascarar_mensagem`).
 */
export function mascararMensagem(texto: string): string {
  return texto
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "***")
    .replace(/Key \(([^)]*)\)=\(([^)]*)\)/g, "Key ($1)=(***)");
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
  return `${limpo.slice(0, arroba).slice(0, 2).toLowerCase()}***@${limpo.slice(arroba + 1).toLowerCase().slice(0, 100)}`;
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
 * parecer IP: um valor torto derrubaria o insert na coluna `inet`.
 */
export function ipDaRequisicao(req: Request | null | undefined): string | null {
  const parece = (v: string) => /^[0-9a-fA-F:.]{3,45}$/.test(v);
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

// =================================================================================================
// EXEMPLO DE USO (apague ao copiar). A mudança em cada função é mínima: um import e uma linha no
// `catch` de nível superior. O `console.error` que já existia FICA.
//
//   import { clienteDeLogDoAmbiente, registrarErroDaEdge, registrarLog } from "../_shared/log.ts";
//
//   Deno.serve(async (req) => {
//     try {
//       // ... a função como já era ...
//     } catch (erro) {
//       await registrarErroDaEdge(clienteDeLogDoAmbiente(), req, "nome-da-funcao", erro);
//       console.error("[nome-da-funcao]", erro instanceof Error ? erro.message : "falha");
//       return json(req, { error: "Não foi possível concluir a operação." }, 500);
//     }
//   });
//
// Resposta com status >= 500 devolvida FORA do catch (um `return json(..., 502)` no meio do código)
// também registra, do mesmo jeito, antes do `return`.
//
// Ato de administração feito pela função (criou usuário, definiu senha) — com o cliente de serviço
// que a função já tem, e sem a senha em lugar nenhum:
//
//   await registrarLog(admin, req, {
//     categoria: "acesso", acao: "usuario_criado", atorId: chamador.id, atorNome: nomeDoChamador,
//     tela: "/acessos", alvoTipo: "usuario", alvoId: novoId, alvoRotulo: nome,
//     detalhe: { grupo: grupoId },
//   });
//
// Rotina sem usuário (cron): não há requisição de pessoa, então `req` é null e a origem é 'rotina'.
//
//   await registrarLog(clienteDeLogDoAmbiente(), null, {
//     categoria: "erro", nivel: "erro", acao: "erro_rotina", resultado: "falha", origem: "rotina",
//     tela: "edge/nome-da-rotina", mensagem: erro instanceof Error ? erro.message : "falha",
//     detalhe: { etapa: "leitura" },
//   });
// =================================================================================================
