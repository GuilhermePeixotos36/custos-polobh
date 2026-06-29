/**
 * Cliente do Brevo (API transacional de e-mail). Roda no servidor (Deno/Edge
 * Function) — a chave BREVO_API_KEY nunca vai para o navegador.
 * Docs: https://developers.brevo.com/reference/sendtransacemail
 */

export interface Destinatario {
  email: string;
  nome?: string;
}

export interface EmailBrevo {
  para: Destinatario[];
  assunto: string;
  html: string;
  responderPara?: Destinatario;
}

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export async function enviarPeloBrevo(msg: EmailBrevo): Promise<{ messageId?: string }> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) throw new Error("BREVO_API_KEY não configurada.");

  const remetenteEmail = Deno.env.get("BREVO_SENDER_EMAIL") ?? "contato@polobh.com.br";
  const remetenteNome = Deno.env.get("BREVO_SENDER_NAME") ?? "Pólobh Eventos";

  const resp = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: remetenteEmail, name: remetenteNome },
      to: msg.para.map((d) => ({ email: d.email, name: d.nome })),
      replyTo: msg.responderPara
        ? { email: msg.responderPara.email, name: msg.responderPara.nome }
        : undefined,
      subject: msg.assunto,
      htmlContent: msg.html,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Brevo ${resp.status}: ${txt}`);
  }
  return await resp.json();
}
