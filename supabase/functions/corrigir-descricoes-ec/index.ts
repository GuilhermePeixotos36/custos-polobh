import { autorizar, respostaAutorizacao } from "../_shared/auth.ts";
import { completarGratis, extrairJson, ordemGratuitos } from "../_shared/openrouter.ts";

/**
 * O revisor de português do sistema.
 *
 * O nome ficou preso à origem (nasceu para as descrições da EC), mas desde
 * 25/09/2026 ele atende TODOS os textos livres do aplicativo — EC, OS,
 * check-list e os roteiros do projeto. O que chega aqui é sempre a mesma coisa:
 * uma lista de { id, descricao }, e quem sabe de onde cada id veio é a tela.
 *
 * Usa a mesma chave OpenRouter das demais funções de IA do projeto, e só
 * modelos GRATUITOS, trocando de um para outro quando falham (desde 28/10/2026,
 * ver `_shared/openrouter.ts`).
 *
 * Deploy: supabase functions deploy corrigir-descricoes-ec
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  // DIAGNÓSTICO (28/10/2026): GET ?diagnostico=1 mostra a chave, o saldo e a
  // ordem dos modelos gratuitos que serão tentados — sem gastar nada.
  if (req.method === "GET" && new URL(req.url).searchParams.get("diagnostico")) {
    const chave = Deno.env.get("OPENROUTER_API_KEY");
    if (!chave) return new Response(JSON.stringify({ ok: false, erro: "OPENROUTER_API_KEY não configurada." }), { headers: cors });
    const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${chave}` } });
    const d = (await r.json().catch(() => null))?.data ?? {};
    // ?diagnostico=teste faz uma correção de verdade (gasta 1 pedido gratuito do dia).
    const teste = new URL(req.url).searchParams.get("diagnostico") === "teste"
      ? await completarGratis(chave, {
        titulo: "Polobh EC - Diagnóstico",
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content: JSON.stringify({ descricoes: [{ id: "t", descricao: "<p>Saguão Predio</p><p>01 profssiinal x 01 diária de 04 horas</p>" }] }) },
        ],
        max_tokens: 2000,
        json: true,
        aceitar: (texto) => Array.isArray(extrairJson<{ descricoes?: unknown }>(texto)?.descricoes),
      })
      : null;
    return new Response(
      JSON.stringify({ ok: r.ok, status: r.status, uso: d.usage ?? null, gratuito: d.is_free_tier ?? null, limite: d.limit ?? null, modelos: await ordemGratuitos(), teste }),
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
    const resposta = await completarGratis(apiKey, {
      titulo: "Polobh EC - Correção ortográfica",
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: conteudo },
      ],
      temperature: 0,
      // Gratuito não consome saldo: a reserva só precisa caber o texto revisado.
      max_tokens: Math.min(16000, Math.ceil(conteudo.length / 2) + 2000),
      json: true,
      aceitar: (texto) => Array.isArray(extrairJson<{ descricoes?: unknown }>(texto)?.descricoes),
    });
    if (!resposta.ok) return json({ ok: false, erro: resposta.erro }, resposta.status === 429 ? 429 : 502);
    const revisado = extrairJson<{ descricoes?: DescricaoEntrada[] }>(resposta.texto) ?? {};

    const original = new Map(descricoes.map((item) => [item.id, item.descricao]));
    // Modelo gratuito às vezes reescreve demais ou perde tags: a correção só vale
    // se o texto continuar do mesmo tamanho (folga de 40%) e com as mesmas tags.
    const tags = (t: string) => (t.match(/<[^>]+>/g) ?? []).length;
    const resultado = (revisado.descricoes ?? []).filter((item) => {
      const antes = original.get(item?.id);
      if (antes === undefined || typeof item?.descricao !== "string") return false;
      const proporcao = item.descricao.length / Math.max(1, antes.length);
      return (proporcao > 0.6 && proporcao < 1.4) || Math.abs(item.descricao.length - antes.length) < 20
        ? tags(item.descricao) === tags(antes)
        : false;
    });
    return json({ ok: true, descricoes: resultado, modelo: resposta.modelo });
  } catch (erro) {
    const resposta = respostaAutorizacao(erro, cors);
    if (resposta) return resposta;
    return json({ ok: false, erro: String((erro as Error).message) }, 500);
  }
});
