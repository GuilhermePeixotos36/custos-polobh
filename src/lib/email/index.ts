/**
 * Serviço de e-mail (provider-agnóstico, pronto para o Brevo).
 *
 * Arquitetura de segurança: o frontend NUNCA fala direto com o Brevo (a chave
 * de API não pode ir para o navegador, e há CORS). O app envia a mensagem para
 * uma **Supabase Edge Function** (`VITE_EMAIL_ENDPOINT`), que guarda a
 * `BREVO_API_KEY` no servidor e chama a API transacional do Brevo.
 *
 * Enquanto a função não existe (flag desligada ou sem endpoint), os envios são
 * **simulados**: nada sai, mas a UI funciona e registra no console. Assim dá
 * para construir e testar todo o fluxo antes de plugar o Brevo.
 */
import { flags } from "@/lib/flags";
import type { Ec, Os } from "@/data/types";
import {
  emailCredenciamento,
  emailDispararOs,
  emailEcParaAprovacao,
  emailLembreteCronograma,
  type MensagemEmail,
} from "./templates";

export type { MensagemEmail } from "./templates";

export interface ResultadoEmail {
  ok: boolean;
  simulado: boolean;
  motivo?: string;
  destinatarios: string[];
}

const endpoint = () => import.meta.env.VITE_EMAIL_ENDPOINT as string | undefined;

/** Envia uma mensagem já montada. Não lança — devolve o resultado. */
export async function enviarEmail(msg: MensagemEmail): Promise<ResultadoEmail> {
  const destinatarios = msg.para.map((p) => p.email);

  if (destinatarios.length === 0) {
    return { ok: false, simulado: true, motivo: "Sem e-mail de destino.", destinatarios };
  }

  // Modo simulação: flag desligada ou endpoint ausente.
  if (!flags.email || !endpoint()) {
    console.info("[email:simulado]", { assunto: msg.assunto, para: destinatarios });
    return {
      ok: true,
      simulado: true,
      motivo: "Aguardando conexão com o e-mail da Pólobh (Brevo) — envio simulado, nada saiu.",
      destinatarios,
    };
  }

  try {
    const resp = await fetch(endpoint()!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });
    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      return { ok: false, simulado: false, motivo: `Falha no envio (${resp.status}). ${texto}`.trim(), destinatarios };
    }
    return { ok: true, simulado: false, destinatarios };
  } catch (e) {
    return { ok: false, simulado: false, motivo: (e as Error).message, destinatarios };
  }
}

/* ----------------------- Helpers de alto nível ----------------------- */
/* Cada um monta a mensagem do evento e delega para enviarEmail.        */

export const dispararOsPorEmail = (os: Os, ec: Ec) => enviarEmail(emailDispararOs(os, ec));
export const enviarCredenciamento = (os: Os, ec: Ec) => enviarEmail(emailCredenciamento(os, ec));
export const enviarLembreteCronograma = (os: Os, ec: Ec) => enviarEmail(emailLembreteCronograma(os, ec));
export const enviarEcParaAprovacao = (ec: Ec) => enviarEmail(emailEcParaAprovacao(ec));
