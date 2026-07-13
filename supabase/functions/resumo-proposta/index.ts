/**
 * Edge Function: resumo-proposta
 * Recebe orçamentos de fornecedores (imagens JPG/PNG, PDF, texto extraído de
 * Excel, ou um link) e usa um modelo multimodal do OpenRouter para sintetizar
 * um descritivo em tópicos com os valores individuais. A chave fica só aqui.
 *
 * Deploy:   supabase functions deploy resumo-proposta
 * Segredos: supabase secrets set OPENROUTER_API_KEY=...   (opcional: OPENROUTER_MODEL=...)
 *
 * Body (JSON):
 *   {
 *     textos?:  string[],                        // texto já extraído (Excel/link)
 *     imagens?: { mime: string, dataUrl: string }[],   // data URLs base64
 *     pdfs?:    { filename: string, dataUrl: string }[], // data URLs base64
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

const MODEL = Deno.env.get("OPENROUTER_MODEL") || "google/gemini-2.5-flash";

interface Payload {
  textos?: string[];
  imagens?: { mime: string; dataUrl: string }[];
  pdfs?: { filename: string; dataUrl: string }[];
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
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) return json({ ok: false, erro: "OPENROUTER_API_KEY não configurada na função." }, 500);

    const p = (await req.json()) as Payload;
    const partes: Parte[] = [{ type: "text", text: PROMPT }];
    let temConteudo = false;

    for (const t of p.textos ?? []) {
      if (t && t.trim()) {
        partes.push({ type: "text", text: "Conteúdo do orçamento:\n" + t.trim().slice(0, 60000) });
        temConteudo = true;
      }
    }
    for (const img of p.imagens ?? []) {
      if (img?.dataUrl) {
        partes.push({ type: "image_url", image_url: { url: img.dataUrl } });
        temConteudo = true;
      }
    }
    let usaPdf = false;
    for (const pdf of p.pdfs ?? []) {
      if (pdf?.dataUrl) {
        partes.push({ type: "file", file: { filename: pdf.filename || "orcamento.pdf", file_data: pdf.dataUrl } });
        usaPdf = true;
        temConteudo = true;
      }
    }
    // Link: busca no servidor. Imagem vira vision; o resto vira texto (HTML limpo).
    if (p.link && /^https?:\/\//i.test(p.link)) {
      try {
        const r = await fetch(p.link);
        const ct = r.headers.get("content-type") || "";
        if (ct.startsWith("image/")) {
          const buf = new Uint8Array(await r.arrayBuffer());
          const b64 = btoa(String.fromCharCode(...buf));
          partes.push({ type: "image_url", image_url: { url: `data:${ct};base64,${b64}` } });
        } else {
          const txt = (await r.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 60000);
          if (txt) partes.push({ type: "text", text: "Conteúdo da página:\n" + txt });
        }
        temConteudo = true;
      } catch {
        // link inacessível — segue com o que houver
      }
    }

    if (!temConteudo) return json({ ok: false, erro: "Nenhum orçamento foi enviado." }, 400);

    const bodyReq: Parte = {
      model: MODEL,
      messages: [{ role: "user", content: partes }],
      temperature: 0.2,
    };
    if (usaPdf) bodyReq.plugins = [{ id: "file-parser", pdf: { engine: "pdf-text" } }];

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Polobh EC",
      },
      body: JSON.stringify(bodyReq),
    });
    if (!resp.ok) {
      const detalhe = await resp.text();
      return json({ ok: false, erro: `OpenRouter ${resp.status}: ${detalhe.slice(0, 500)}` }, 502);
    }
    const data = await resp.json();
    const resumo = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!resumo) return json({ ok: false, erro: "O modelo não retornou conteúdo." }, 502);

    return json({ ok: true, resumo });
  } catch (e) {
    return json({ ok: false, erro: String((e as Error).message) }, 500);
  }
});
