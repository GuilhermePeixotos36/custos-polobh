import { autorizar, respostaAutorizacao } from "../_shared/auth.ts";

/**
 * Edge Function: send-email
 *
 * Recebe a mensagem { para, assunto, html, responderPara?, anexos? }, envia pelo
 * Brevo e registra na tabela `emails` (best-effort). A chave BREVO_API_KEY fica
 * só aqui, no servidor — nunca vai para o navegador.
 *
 * Deploy (CLI): supabase functions deploy send-email
 *
 * Segredos (no Supabase):
 *   BREVO_API_KEY=...            (obrigatório — chave do Brevo)
 *   BREVO_SENDER_EMAIL=noreply@polobh.com.br
 *   BREVO_SENDER_NAME="Pólobh Eventos"
 *   BREVO_REPLY_TO=contato@polobh.com.br   (opcional — respostas; noreply não recebe)
 */

interface Destinatario {
  email: string;
  nome?: string;
}
interface AnexoEmail {
  nome: string;
  conteudoBase64: string;
}
interface EmailBrevo {
  para: Destinatario[];
  assunto: string;
  html: string;
  responderPara?: Destinatario;
  anexos?: AnexoEmail[];
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;
// Brevo recusa e-mails grandes; limitamos por anexo e no total para nunca chegar perto do teto.
const MAX_ANEXO_BASE64 = 8_000_000; // ~6 MB de arquivo por anexo
const MAX_ANEXOS_BASE64_TOTAL = 12_000_000; // ~9 MB somando todos os anexos

function payloadValido(msg: EmailBrevo): boolean {
  const anexosValidos =
    msg.anexos === undefined ||
    (Array.isArray(msg.anexos) &&
      msg.anexos.length <= 3 &&
      msg.anexos.every(
        (a) =>
          Boolean(a) &&
          typeof a.nome === "string" &&
          a.nome.length > 0 &&
          a.nome.length <= 150 &&
          typeof a.conteudoBase64 === "string" &&
          a.conteudoBase64.length > 0 &&
          a.conteudoBase64.length <= MAX_ANEXO_BASE64 &&
          BASE64_RE.test(a.conteudoBase64)
      ) &&
      msg.anexos.reduce((soma, a) => soma + a.conteudoBase64.length, 0) <= MAX_ANEXOS_BASE64_TOTAL);

  return Boolean(
    Array.isArray(msg?.para) &&
    msg.para.length > 0 &&
    msg.para.length <= 10 &&
    msg.para.every((destinatario) => Boolean(destinatario) && typeof destinatario.email === "string" && EMAIL_RE.test(destinatario.email) && (destinatario.nome?.length ?? 0) <= 120) &&
    typeof msg.assunto === "string" &&
    msg.assunto.trim().length > 0 &&
    msg.assunto.length <= 200 &&
    typeof msg.html === "string" &&
    msg.html.length > 0 &&
    msg.html.length <= 200_000 &&
    (!msg.responderPara || EMAIL_RE.test(msg.responderPara.email)) &&
    anexosValidos
  );
}

/** Envia pelo Brevo (API transacional). Lança em caso de erro. */
async function enviarPeloBrevo(msg: EmailBrevo): Promise<{ messageId?: string }> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) throw new Error("BREVO_API_KEY não configurada.");

  const remetenteEmail = Deno.env.get("BREVO_SENDER_EMAIL") ?? "noreply@polobh.com.br";
  const remetenteNome = Deno.env.get("BREVO_SENDER_NAME") ?? "Pólobh Eventos";
  const replyToPadrao = Deno.env.get("BREVO_REPLY_TO");
  const replyTo = msg.responderPara
    ? { email: msg.responderPara.email, name: msg.responderPara.nome }
    : replyToPadrao
    ? { email: replyToPadrao, name: remetenteNome }
    : undefined;

  const resp = await fetch(BREVO_URL, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { email: remetenteEmail, name: remetenteNome },
      to: msg.para.map((d) => ({ email: d.email, name: d.nome })),
      replyTo,
      subject: msg.assunto,
      htmlContent: msg.html,
      attachment: msg.anexos?.length
        ? msg.anexos.map((a) => ({ name: a.nome, content: a.conteudoBase64 }))
        : undefined,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Brevo ${resp.status}: ${txt}`);
  }
  return await resp.json();
}

/** Registra o envio na tabela `emails` (best-effort, via PostgREST — não bloqueia). */
async function registrarLog(row: Record<string, unknown>): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/emails`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
  } catch (_) {
    // best-effort; nunca falha o envio.
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Method not allowed" }, 405);

  try {
    await autorizar(req, ["Admin", "Direcao", "Producao", "Administrativo"]);
  } catch (erro) {
    return respostaAutorizacao(erro, cors) ?? json({ ok: false, erro: "Falha ao validar a sessão." }, 500);
  }

  let msg: EmailBrevo;
  try {
    msg = (await req.json()) as EmailBrevo;
  } catch {
    return json({ ok: false, erro: "JSON inválido." }, 400);
  }

  if (!payloadValido(msg)) {
    return json({ ok: false, erro: "Payload de e-mail inválido ou acima dos limites permitidos (o anexo pode estar grande demais)." }, 400);
  }

  try {
    const r = await enviarPeloBrevo(msg);
    await registrarLog({
      assunto: msg.assunto,
      destinatarios: msg.para.map((p) => p.email),
      provider_id: r.messageId ?? null,
      status: "enviado",
    });
    return json({ ok: true, messageId: r.messageId });
  } catch (e) {
    const erro = String((e as Error).message);
    await registrarLog({
      assunto: msg.assunto,
      destinatarios: msg.para.map((p) => p.email),
      status: "erro",
      erro,
    });
    return json({ ok: false, erro }, 500);
  }
});
