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
import { supabase } from "@/lib/supabaseClient";
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

/**
 * Envia uma mensagem já montada pela Edge Function `send-email` (que fala com o
 * Brevo). Usa `supabase.functions.invoke`, então o header de autenticação vai
 * automático (sessão do usuário / anon key). Não lança — devolve o resultado.
 */
export async function enviarEmail(msg: MensagemEmail): Promise<ResultadoEmail> {
  const destinatarios = msg.para.map((p) => p.email);

  if (destinatarios.length === 0) {
    return { ok: false, simulado: true, motivo: "Sem e-mail de destino.", destinatarios };
  }

  // Modo simulação: enquanto a flag estiver desligada, nada sai (útil em dev/testes).
  if (!flags.email) {
    console.info("[email:simulado]", { assunto: msg.assunto, para: destinatarios });
    return {
      ok: true,
      simulado: true,
      motivo: "Envio de e-mail desligado (VITE_FEATURE_EMAIL=false) — simulado, nada saiu.",
      destinatarios,
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke("send-email", { body: msg });
    if (error) {
      // tenta extrair a mensagem de erro devolvida pela função (corpo JSON)
      let detalhe = error.message;
      try {
        const corpo = await (error as unknown as { context?: Response }).context?.json();
        if (corpo?.erro) detalhe = corpo.erro;
      } catch { /* mantém error.message */ }
      return { ok: false, simulado: false, motivo: detalhe, destinatarios };
    }
    if (data && (data as { ok?: boolean }).ok === false) {
      return { ok: false, simulado: false, motivo: (data as { erro?: string }).erro ?? "Falha no envio.", destinatarios };
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
