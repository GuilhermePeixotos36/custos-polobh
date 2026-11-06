/**
 * Edge Function: arquivar-documento
 * Salva um documento gerado pelo app (EC, OS, cronograma) na pasta Dropbox do
 * projeto — a do link informado em Dados Gerais (`projetos.docs_url`).
 *
 * O Dropbox NÃO aceita enviar arquivo "para um link": `files/upload` pede um
 * caminho. Então a função primeiro TRADUZ o link em caminho
 * (`sharing/get_shared_link_metadata` → `path_lower`, presente só quando a pasta
 * está no Dropbox da conta autorizada) e só então envia. Se o link não resolver
 * para um caminho, devolve erro claro em vez de gravar no lugar errado.
 *
 * POST (JSON) { projetoId, nomeArquivo, conteudoBase64 } — usuário logado com
 * papel Admin/Direcao/Producao/Administrativo. Segredos: os mesmos do backup-diario
 * (DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN).
 *
 * Nome: cada VERSÃO é um arquivo novo. Nada é sobrescrito; se o nome já existir,
 * o Dropbox acrescenta " (1)" (autorename).
 *
 * `seExistir: "pular"` (EC e OS, 06/11/2026): o nome da EC e da OS já carrega a
 * versão, então um arquivo com o mesmo nome é a MESMA versão. Nesse caso nada é
 * enviado e a resposta diz `jaExistia` — era o que gerava "OS (01) (1)", "(2)".
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { autorizar, respostaAutorizacao } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ascii = (o: unknown) =>
  JSON.stringify(o).replace(/[\u0080-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

/** Nome seguro: sem barras nem caracteres proibidos pelo Dropbox/Windows. */
const nomeSeguro = (n: string) => n.replace(/[\\/:*?"<>|\x00-\x1f]/g, "-").trim().slice(0, 150);

async function tokenDropbox(): Promise<string> {
  const r = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: Deno.env.get("DROPBOX_REFRESH_TOKEN") ?? "",
      client_id: Deno.env.get("DROPBOX_APP_KEY") ?? "",
      client_secret: Deno.env.get("DROPBOX_APP_SECRET") ?? "",
    }),
  });
  if (!r.ok) throw new Error(`Dropbox recusou o token (${r.status})`);
  return (await r.json()).access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, erro: "Method not allowed" }, 405);
  try {
    await autorizar(req, ["Admin", "Direcao", "Producao", "Administrativo"]);
  } catch (e) {
    const r = respostaAutorizacao(e, cors);
    if (r) return r;
    throw e;
  }

  const { projetoId, nomeArquivo, conteudoBase64, seExistir } = await req.json().catch(() => ({}));
  const pular = seExistir === "pular";
  if (!projetoId || !nomeArquivo || !conteudoBase64) return json({ ok: false, erro: "Dados incompletos." }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: projeto } = await sb.from("projetos").select("docs_url").eq("id", projetoId).maybeSingle();
  const link = (projeto?.docs_url ?? "").trim();
  if (!/^https:\/\/(www\.)?dropbox\.com\//i.test(link)) {
    return json({ ok: false, erro: "Este projeto não tem link de pasta do Dropbox em Dados Gerais." }, 422);
  }

  try {
    const token = await tokenDropbox();
    const meta = await fetch("https://api.dropboxapi.com/2/sharing/get_shared_link_metadata", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: link }),
    });
    if (!meta.ok) return json({ ok: false, erro: `Dropbox não reconheceu o link (${meta.status}).` }, 502);
    const m = await meta.json();
    if (m[".tag"] !== "folder") return json({ ok: false, erro: "O link informado não é de uma pasta." }, 422);
    if (!m.path_lower) {
      return json({
        ok: false,
        erro: "A pasta do link não está no Dropbox da conta autorizada — o app precisa ter acesso a ela.",
      }, 422);
    }

    const bytes = Uint8Array.from(atob(conteudoBase64), (c) => c.charCodeAt(0));
    const up = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": ascii({
          path: `${m.path_lower}/${nomeSeguro(nomeArquivo)}`,
          mode: "add",
          autorename: !pular,
          mute: true,
        }),
      },
      body: bytes,
    });
    if (pular && up.status === 409) {
      const corpo = await up.text();
      if (/conflict/i.test(corpo)) {
        return json({ ok: true, jaExistia: true, caminho: `${m.path_lower}/${nomeSeguro(nomeArquivo)}` });
      }
    }
    if (!up.ok) return json({ ok: false, erro: `Dropbox recusou o arquivo (${up.status}).` }, 502);
    const salvo = await up.json();
    return json({ ok: true, caminho: salvo.path_display });
  } catch (e) {
    return json({ ok: false, erro: (e as Error).message }, 502);
  }
});
