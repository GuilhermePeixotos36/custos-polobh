/**
 * IA SÓ COM MODELOS GRATUITOS, trocando de modelo quando um falha (28/10/2026).
 *
 * A conta OpenRouter ficou sem créditos e a revisão de texto parou. A Pólobh
 * decidiu usar só os modelos ":free". Eles mudam com frequência (entram e saem
 * da OpenRouter), então a lista NÃO é fixa: é lida da própria OpenRouter e
 * guardada por uma hora. A ordem segue a preferência abaixo (os melhores em
 * português primeiro); o resto dos gratuitos vem depois.
 *
 * Se um modelo recusa (limite por minuto, fora do ar, resposta inválida), o
 * pedido vai para o próximo. O limite DIÁRIO dos gratuitos é da conta inteira
 * (50/dia sem créditos comprados; 1.000/dia depois de comprar US$ 10 uma vez):
 * quando ele acaba, trocar de modelo não adianta e a função para na hora.
 *
 * Para forçar outra ordem sem publicar código: segredo OPENROUTER_FREE_MODELS
 * com os ids separados por vírgula.
 */

const PREFERIDOS = [
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "thinkingmachines/inkling:free",
  "nvidia/nemotron-3.5-super-vl:free",
  "google/gemma-4-26b-a4b-it:free",
];

/**
 * MODELO PAGO QUANDO HÁ CRÉDITO (05/11/2026). Os gratuitos ficaram instáveis
 * (os do Google bloqueados por excesso de uso compartilhado, os da Nvidia
 * respondendo vazio). Se a conta tiver crédito comprado, um modelo pago e
 * barato vai na frente — uma revisão custa frações de centavo — e os gratuitos
 * ficam de reserva. Sem crédito, nada muda. Trocar o modelo sem publicar
 * código: segredo OPENROUTER_PAID_MODELS (ids separados por vírgula).
 */
const PAGOS_PADRAO = ["openai/gpt-4.1-mini", "google/gemini-2.5-flash-lite"];

let cacheConta: { em: number; paga: boolean } | null = null;

/** A conta tem crédito comprado e saldo? (lido da OpenRouter, guardado por 10 min) */
async function contaComCredito(apiKey: string): Promise<boolean> {
  if (cacheConta && Date.now() - cacheConta.em < 10 * 60 * 1000) return cacheConta.paga;
  let paga = false;
  try {
    const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(5000) });
    const d = (await r.json())?.data ?? {};
    const restante = d.limit_remaining;
    paga = d.is_free_tier === false && (restante === null || restante === undefined || Number(restante) > 0.05);
  } catch {
    paga = false;
  }
  cacheConta = { em: Date.now(), paga };
  return paga;
}

function modelosPagos(): ModeloInfo[] {
  const fixos = (Deno.env.get("OPENROUTER_PAID_MODELS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return (fixos.length ? fixos : PAGOS_PADRAO).map((id) => ({ id, imagem: true, params: [], pago: true }));
}

/** Gratuitos que não servem para texto em português (código, moderação, minúsculos). */
const DESCARTAR = /safety|code|coder|laguna|lfm-|nano|-xs-|tiny/i;

interface ModeloInfo {
  id: string;
  imagem: boolean;
  params: string[];
  pago?: boolean;
}

let cache: { em: number; modelos: ModeloInfo[] } | null = null;

async function modelosGratuitos(): Promise<ModeloInfo[]> {
  if (cache && Date.now() - cache.em < 60 * 60 * 1000) return cache.modelos;
  let lista: ModeloInfo[] = [];
  try {
    const r = await fetch("https://openrouter.ai/api/v1/models");
    const corpo = await r.json();
    // deno-lint-ignore no-explicit-any
    lista = (corpo?.data ?? []).filter((m: any) => String(m?.id ?? "").endsWith(":free")).map((m: any) => ({
      id: String(m.id),
      imagem: (m?.architecture?.input_modalities ?? []).includes("image"),
      params: m?.supported_parameters ?? [],
    }));
  } catch {
    // Sem a lista, tenta os preferidos às cegas.
    lista = PREFERIDOS.map((id) => ({ id, imagem: true, params: [] }));
  }
  cache = { em: Date.now(), modelos: lista };
  return lista;
}

function ordenar(lista: ModeloInfo[]): ModeloInfo[] {
  const fixos = (Deno.env.get("OPENROUTER_FREE_MODELS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ordem = fixos.length ? fixos : PREFERIDOS;
  const peso = (id: string) => {
    const i = ordem.indexOf(id);
    return i === -1 ? ordem.length : i;
  };
  return lista.filter((m) => !DESCARTAR.test(m.id) || ordem.includes(m.id)).sort((a, b) => peso(a.id) - peso(b.id));
}

export interface PedidoIa {
  // deno-lint-ignore no-explicit-any
  messages: any[];
  max_tokens: number;
  temperature?: number;
  /** Pede JSON ao modelo (só nos que aceitam o parâmetro). */
  json?: boolean;
  /** Algum conteúdo é imagem: só modelos que leem imagem. */
  imagem?: boolean;
  titulo: string;
  /** Descarta a resposta e tenta o próximo modelo quando devolve false. */
  aceitar?: (texto: string) => boolean;
  /** Quantos modelos tentar no máximo. */
  tentativas?: number;
  /**
   * Tempo total máximo (ms) somando todas as tentativas. Antes não havia: com
   * cinco modelos falhando em fila, a pessoa esperava 1,5 min para ver o erro.
   */
  prazoMs?: number;
}

export type RespostaIa = { ok: true; texto: string; modelo: string } | { ok: false; erro: string; status: number };

export async function completarGratis(apiKey: string, p: PedidoIa): Promise<RespostaIa> {
  const gratuitos = ordenar(await modelosGratuitos()).filter((m) => !p.imagem || m.imagem);
  const pagos = (await contaComCredito(apiKey)) ? modelosPagos() : [];
  const candidatos = [...pagos, ...gratuitos.slice(0, p.tentativas ?? 5)];
  if (!candidatos.length) return { ok: false, status: 503, erro: "Nenhum modelo gratuito disponível na OpenRouter." };

  const inicio = Date.now();
  const prazo = p.prazoMs ?? 35_000;
  let ultimo = "sem resposta";
  let status = 502;
  for (const m of candidatos) {
    const resta = prazo - (Date.now() - inicio);
    if (resta < 4000) {
      ultimo = `tempo esgotado depois de ${Math.round((Date.now() - inicio) / 1000)} s (${ultimo})`;
      status = 504;
      break;
    }
    const aceita = (param: string) => !m.params.length || m.params.includes(param);
    const corpo: Record<string, unknown> = {
      model: m.id,
      messages: p.messages,
      temperature: p.temperature ?? 0,
      max_tokens: p.max_tokens,
    };
    if (p.json && aceita("response_format")) corpo.response_format = { type: "json_object" };
    // Modelos que "pensam" antes de responder: pensamento curto e fora do texto.
    if (!m.pago && aceita("reasoning")) corpo.reasoning = { effort: "low", exclude: true };

    let resp: Response;
    try {
      resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": p.titulo },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(Math.min(25_000, resta)),
      });
    } catch (e) {
      ultimo = `${m.id}: ${(e as Error).message}`;
      continue;
    }
    if (!resp.ok) {
      const detalhe = (await resp.text().catch(() => "")).slice(0, 300);
      ultimo = `${m.id}: ${resp.status} ${detalhe}`;
      status = resp.status;
      console.error(`ia: ${ultimo}`);
      // Limite diário da conta: todos os gratuitos param juntos.
      if (resp.status === 429 && /per-day|per day|free-models-per-day/i.test(detalhe)) {
        return { ok: false, status: 429, erro: "Limite diário dos modelos gratuitos atingido." };
      }
      continue;
    }
    const data = await resp.json().catch(() => null);
    const escolha = data?.choices?.[0];
    const texto = String(escolha?.message?.content ?? "").trim();
    if (!texto || (p.aceitar && !p.aceitar(texto))) {
      ultimo = `${m.id}: resposta vazia ou inválida (fim: ${escolha?.finish_reason ?? "?"})`;
      console.error(`ia: ${ultimo} ${texto.slice(0, 150)}`);
      continue;
    }
    return { ok: true, texto, modelo: m.id };
  }
  return { ok: false, status, erro: `Nenhum modelo de IA respondeu (${ultimo}).` };
}

/** Tira cercas ```json e texto em volta: modelos gratuitos nem sempre devolvem JSON puro. */
export function extrairJson<T>(texto: string): T | null {
  const limpo = texto.replace(/```(?:json)?/gi, "").trim();
  const ini = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (ini === -1 || fim <= ini) return null;
  try {
    return JSON.parse(limpo.slice(ini, fim + 1)) as T;
  } catch {
    return null;
  }
}

/** Lista dos gratuitos na ordem em que serão tentados (para o diagnóstico). */
export async function ordemGratuitos(imagem = false): Promise<string[]> {
  return ordenar(await modelosGratuitos()).filter((m) => !imagem || m.imagem).map((m) => m.id);
}
