import { autorizar, respostaAutorizacao } from "../_shared/auth.ts";
import { base64, buscarPublico } from "../_shared/fetch-publico.ts";
import { completarGratis } from "../_shared/openrouter.ts";

/**
 * Edge Function: resumo-proposta
 * Recebe orçamentos de fornecedores (imagens JPG/PNG, PDF, texto extraído de
 * Excel, ou um link) e usa um modelo multimodal do OpenRouter para sintetizar
 * um descritivo em tópicos com os valores individuais. A chave fica só aqui.
 * Desde 28/10/2026 usa só modelos GRATUITOS, trocando de um para outro quando
 * falham; com imagem, só os que leem imagem (ver `_shared/openrouter.ts`).
 *
 * Deploy:   supabase functions deploy resumo-proposta
 * Segredos: supabase secrets set OPENROUTER_API_KEY=...   (opcional: OPENROUTER_FREE_MODELS=...)
 *
 * Body (JSON):
 *   {
 *     textos?:  string[],                        // texto já extraído (Excel/link)
 *     imagens?: { mime: string, dataUrl: string }[],   // data URLs base64 — PDF
 *                                                       // também chega aqui (o
 *                                                       // cliente converte página
 *                                                       // por página antes de enviar,
 *                                                       // evitando a exigência de
 *                                                       // saldo do OpenRouter p/ arquivos)
 *     link?:    string                           // URL buscada no servidor
 *   }
 * Resposta: { ok: true, resumo: string } | { ok:false, erro:string }
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT =
  "Favor transformar o conteúdo do orçamento anexo em um texto em tópicos com os " +
  "descritivos e valores individuais. Não se atenha a informações do fornecedor ou " +
  "do cliente ou do projeto, relacione apenas os descritivos dos serviços a serem " +
  "prestados e seus seus valores individuais. Responda em português, em bullet points " +
  "(um item por linha, começando com '• '), sem introdução nem conclusão.";


interface Payload {
  textos?: string[];
  imagens?: { mime: string; dataUrl: string }[];
  link?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Parte = Record<string, any>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    await autorizar(req, ["Admin", "Direcao", "Producao"]);
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) return json({ ok: false, erro: "OPENROUTER_API_KEY não configurada na função." }, 500);

    const p = (await req.json()) as Payload;
    const partes: Parte[] = [{ type: "text", text: PROMPT }];
    let temConteudo = false;

    for (const t of (p.textos ?? []).slice(0, 12)) {
      if (t && t.trim()) {
        partes.push({ type: "text", text: "Conteúdo do orçamento:\n" + t.trim().slice(0, 60000) });
        temConteudo = true;
      }
    }
    for (const img of (p.imagens ?? []).slice(0, 8)) {
      if (img?.dataUrl && img.dataUrl.length <= 7_000_000 && /^data:image\/(png|jpe?g|webp);base64,/i.test(img.dataUrl)) {
        partes.push({ type: "image_url", image_url: { url: img.dataUrl } });
        temConteudo = true;
      }
    }
    // Link: busca no servidor. Imagem vira vision; o resto vira texto (HTML limpo).
    if (p.link && /^https?:\/\//i.test(p.link)) {
      try {
        const { bytes, contentType: ct } = await buscarPublico(p.link);
        if (ct.startsWith("image/")) {
          partes.push({ type: "image_url", image_url: { url: `data:${ct};base64,${base64(bytes)}` } });
        } else {
          const txt = new TextDecoder().decode(bytes).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 60000);
          if (txt) partes.push({ type: "text", text: "Conteúdo da página:\n" + txt });
        }
        temConteudo = true;
      } catch {
        // link inacessível — segue com o que houver
      }
    }

    if (!temConteudo) return json({ ok: false, erro: "Nenhum orçamento foi enviado." }, 400);

    const temImagem = partes.some((x) => x.type === "image_url");
    const resposta = await completarGratis(apiKey, {
      titulo: "Polobh EC",
      messages: [{ role: "user", content: partes }],
      temperature: 0.2,
      // Resumo é sempre curto (lista de tópicos).
      max_tokens: 3000,
      imagem: temImagem,
    });
    if (!resposta.ok) return json({ ok: false, erro: resposta.erro }, resposta.status === 429 ? 429 : 502);
    const resumo = resposta.texto;

    return json({ ok: true, resumo });
  } catch (e) {
    const resposta = respostaAutorizacao(e, cors);
    if (resposta) return resposta;
    return json({ ok: false, erro: String((e as Error).message) }, 500);
  }
});
