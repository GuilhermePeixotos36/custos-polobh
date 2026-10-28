import { autorizar, respostaAutorizacao } from "../_shared/auth.ts";

/**
 * O revisor de português do sistema.
 *
 * O nome ficou preso à origem (nasceu para as descrições da EC), mas desde
 * 25/09/2026 ele atende TODOS os textos livres do aplicativo — EC, OS,
 * check-list e os roteiros do projeto. O que chega aqui é sempre a mesma coisa:
 * uma lista de { id, descricao }, e quem sabe de onde cada id veio é a tela.
 *
 * Usa a mesma chave OpenRouter das demais funções de IA do projeto.
 *
 * Deploy: supabase functions deploy corrigir-descricoes-ec
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = Deno.env.get("OPENROUTER_MODEL") || "google/gemini-2.5-flash";
const PROMPT = `Você é um revisor de português brasileiro. Corrija somente ortografia,
acentuação, concordância, pontuação e maiúsculas iniciais nas descrições recebidas.
Preserve rigorosamente IDs, nomes próprios, siglas, marcas, códigos, números, valores,
unidades, URLs, conteúdo técnico, tags HTML e todas as quebras de linha/parágrafos. Se
o texto contiver HTML, preserve rigorosamente todas as tags e altere apenas o texto. Não resuma,
não acrescente informação e não mude o sentido. Retorne apenas JSON válido no formato:
{"descricoes":[{"id":"id original","descricao":"texto corrigido"}]}.`;

interface DescricaoEntrada {
  id: string;
  descricao: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // DIAGNÓSTICO (28/10/2026): GET ?diagnostico=1 diz se a conta de IA responde
  // e quanto saldo resta — sem expor a chave e sem gastar créditos. Foi assim
  // que se achou a revisão parada desde 27/10: créditos da OpenRouter no fim.
  if (req.method === "GET" && new URL(req.url).searchParams.get("diagnostico")) {
    const chave = Deno.env.get("OPENROUTER_API_KEY");
    if (!chave) return new Response(JSON.stringify({ ok: false, erro: "OPENROUTER_API_KEY não configurada." }), { headers: cors });
    const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${chave}` } });
    const corpo = await r.json().catch(() => null);
    const d = corpo?.data ?? {};
    // Saldo da conta inteira (não só da chave): é ele que acaba e derruba a revisão.
    const c = await fetch("https://openrouter.ai/api/v1/credits", { headers: { Authorization: `Bearer ${chave}` } });
    const creditos = (await c.json().catch(() => null))?.data ?? {};
    return new Response(
      JSON.stringify({ ok: r.ok, status: r.status, modelo: MODEL, limite: d.limit ?? null, uso: d.usage ?? null, restante: d.limit_remaining ?? null, erro: corpo?.error?.message ?? null, creditosTotais: creditos.total_credits ?? null, usoTotal: creditos.total_usage ?? null }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    // O Administrativo entrou em 25/09/2026, junto com a revisão da OS e do
    // check-list: ele edita a OS na fase do financeiro, e sem isto a revisão
    // dele voltaria 403 — o texto gravava, mas com um aviso de "IA
    // indisponível" a cada salvamento, que é o pior dos dois mundos.
    await autorizar(req, ["Admin", "Direcao", "Producao", "Administrativo"]);
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) return json({ ok: false, erro: "OPENROUTER_API_KEY não configurada." }, 500);

    const payload = (await req.json()) as { descricoes?: DescricaoEntrada[] };
    const descricoes = (payload.descricoes ?? [])
      .filter((item) => typeof item?.id === "string" && item.id.length <= 100 && typeof item?.descricao === "string");
    if (!descricoes.length) return json({ ok: true, descricoes: [] });
    if (descricoes.length > 30 || descricoes.some((item) => item.descricao.length > 40_000)) {
      return json({ ok: false, erro: "Lote de revisão acima do limite permitido." }, 413);
    }

    const conteudo = JSON.stringify({ descricoes });
    if (conteudo.length > 45_000) return json({ ok: false, erro: "Lote de revisão acima do limite permitido." }, 413);
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Polobh EC - Correção ortográfica",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content: conteudo },
        ],
        temperature: 0,
        // Reserva de saída PROPORCIONAL ao texto (28/10/2026). A OpenRouter recusa
        // (402) quando o saldo não cobre o máximo pedido — com 12.000 fixos, um
        // saldo baixo derrubava até a revisão de uma linha. O texto revisado tem
        // o tamanho do original: ~1 token a cada 3 caracteres, com folga.
        max_tokens: Math.min(12000, Math.ceil(conteudo.length / 2) + 400),
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      // O motivo vai para o log da função (sem a chave): 402 = sem saldo,
      // 401 = chave inválida, 429 = limite de uso.
      const detalhe = (await resp.text().catch(() => "")).slice(0, 300);
      console.error(`revisor: OpenRouter ${resp.status} ${detalhe}`);
      return json({ ok: false, erro: `OpenRouter ${resp.status}` }, 502);
    }

    const data = await resp.json();
    const texto = data?.choices?.[0]?.message?.content;
    if (typeof texto !== "string") {
      console.error(`revisor: resposta vazia ${JSON.stringify(data).slice(0, 300)}`);
      return json({ ok: false, erro: "Resposta vazia do revisor." }, 502);
    }

    const revisado = JSON.parse(texto) as { descricoes?: DescricaoEntrada[] };
    if (!Array.isArray(revisado.descricoes)) return json({ ok: false, erro: "Resposta inválida do revisor." }, 502);

    const idsPermitidos = new Set(descricoes.map((item) => item.id));
    const resultado = revisado.descricoes.filter(
      (item) => idsPermitidos.has(item?.id) && typeof item?.descricao === "string"
    );
    return json({ ok: true, descricoes: resultado });
  } catch (erro) {
    const resposta = respostaAutorizacao(erro, cors);
    if (resposta) return resposta;
    return json({ ok: false, erro: String((erro as Error).message) }, 500);
  }
});
