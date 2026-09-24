/**
 * Cliente do Brevo (API transacional de e-mail). Roda no servidor (Deno/Edge
 * Function) — a chave BREVO_API_KEY nunca vai para o navegador.
 * Docs: https://developers.brevo.com/reference/sendtransacemail
 */

export interface Destinatario {
  email: string;
  nome?: string;
}

/** Um arquivo junto da mensagem. O Brevo recebe o conteúdo em base64. */
export interface AnexoBrevo {
  nome: string;
  conteudoBase64: string;
}

export interface EmailBrevo {
  para: Destinatario[];
  assunto: string;
  html: string;
  responderPara?: Destinatario;
  /**
   * Anexos. O Brevo recusa mensagens grandes, e quem chama é que decide o que
   * cabe — aqui não há corte automático de propósito: um anexo silenciosamente
   * descartado é pior do que um envio que falha e aparece no log.
   */
  anexos?: AnexoBrevo[];
}

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export async function enviarPeloBrevo(msg: EmailBrevo): Promise<{ messageId?: string }> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) throw new Error("BREVO_API_KEY não configurada.");

  // Remetente autenticado no domínio da Pólobh (registrado pelo TI).
  const remetenteEmail = Deno.env.get("BREVO_SENDER_EMAIL") ?? "noreply@polobh.com.br";
  const remetenteNome = Deno.env.get("BREVO_SENDER_NAME") ?? "Pólobh Promoções";
  // Como o envio sai de "noreply@", as respostas são direcionadas a uma caixa real
  // (BREVO_REPLY_TO) — a menos que a mensagem já especifique um "responderPara".
  const replyToPadrao = Deno.env.get("BREVO_REPLY_TO");
  const replyTo = msg.responderPara
    ? { email: msg.responderPara.email, name: msg.responderPara.nome }
    : replyToPadrao
    ? { email: replyToPadrao, name: remetenteNome }
    : undefined;

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
