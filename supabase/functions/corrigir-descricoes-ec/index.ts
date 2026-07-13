/**
 * Revisa as descrições financeiras dos itens de uma EC com a mesma chave
 * OpenRouter já usada pelas demais funções de IA do projeto.
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
unidades, URLs, conteúdo técnico e todas as quebras de linha/parágrafos. Não resuma,
não acrescente informação e não mude o sentido. Retorne apenas JSON válido no formato:
{"descricoes":[{"id":"id original","descricao":"texto corrigido"}]}.`;

interface DescricaoEntrada {
  id: string;
  descricao: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) return json({ ok: false, erro: "OPENROUTER_API_KEY não configurada." }, 500);

    const payload = (await req.json()) as { descricoes?: DescricaoEntrada[] };
    const descricoes = (payload.descricoes ?? [])
      .filter((item) => typeof item?.id === "string" && typeof item?.descricao === "string")
      .slice(0, 500);
    if (!descricoes.length) return json({ ok: true, descricoes: [] });

    const conteudo = JSON.stringify({ descricoes }).slice(0, 100_000);
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
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) return json({ ok: false, erro: `OpenRouter ${resp.status}` }, 502);

    const data = await resp.json();
    const texto = data?.choices?.[0]?.message?.content;
    if (typeof texto !== "string") return json({ ok: false, erro: "Resposta vazia do revisor." }, 502);

    const revisado = JSON.parse(texto) as { descricoes?: DescricaoEntrada[] };
    if (!Array.isArray(revisado.descricoes)) return json({ ok: false, erro: "Resposta inválida do revisor." }, 502);

    const idsPermitidos = new Set(descricoes.map((item) => item.id));
    const resultado = revisado.descricoes.filter(
      (item) => idsPermitidos.has(item?.id) && typeof item?.descricao === "string"
    );
    return json({ ok: true, descricoes: resultado });
  } catch (erro) {
    return json({ ok: false, erro: String((erro as Error).message) }, 500);
  }
});
