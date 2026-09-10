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
import { EMAIL_TESTE, protegerDestinatarios } from "./seguranca";
import { supabase } from "@/lib/supabaseClient";
import { criarOsExcelBuffer } from "@/lib/excel/os";
import { criarEcExcelBuffer } from "@/lib/excel/ec";
import type { Ec, Os } from "@/data/types";
import {
  emailCredenciamento,
  emailDispararOs,
  emailEcParaAprovacao,
  emailCronogramaDoFornecedor,
  emailHelpDesk,
  emailRespostaChamado,
  type AnexoEmail,
  type Chamado,
  type MensagemEmail,
} from "./templates";

export type { Chamado, MensagemEmail, TipoChamado } from "./templates";

/** ArrayBuffer -> base64 (sem depender de FileReader, funciona também fora do DOM). */
function bufferParaBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

export interface ResultadoEmail {
  ok: boolean;
  simulado: boolean;
  /** Saiu, mas para a caixa de homologação em vez do destinatário real. */
  desviado?: boolean;
  motivo?: string;
  /** Quem o app QUERIA alcançar — não necessariamente quem recebeu. */
  destinatarios: string[];
}

/**
 * Envia uma mensagem já montada pela Edge Function `send-email` (que fala com o
 * Brevo). Usa `supabase.functions.invoke`, então o header de autenticação vai
 * automático (sessão do usuário / anon key). Não lança — devolve o resultado.
 */
export async function enviarEmail(bruta: MensagemEmail): Promise<ResultadoEmail> {
  // Quem o app QUERIA alcançar — é isso que a tela mostra de volta, mesmo
  // quando a trava desvia a mensagem para a caixa de homologação.
  const destinatarios = bruta.para.map((p) => p.email);

  if (destinatarios.length === 0) {
    return { ok: false, simulado: true, motivo: "Sem e-mail de destino.", destinatarios };
  }

  // A trava de homologação vem ANTES de qualquer envio, e é o último ponto por
  // onde toda mensagem passa: caminho novo escrito amanhã já nasce protegido.
  const msg = protegerDestinatarios(bruta);
  // Desviada é a que a trava REESCREVEU. A interna passa direto (Help Desk), e
  // dizer a ela "foi para a caixa de teste" seria mentir na tela.
  const desviado = msg.para[0]?.email !== bruta.para[0]?.email;

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
    return {
      ok: true,
      simulado: false,
      desviado,
      motivo: desviado ? `Homologação: a mensagem foi para ${EMAIL_TESTE}, não para o destinatário.` : undefined,
      destinatarios,
    };
  } catch (e) {
    return { ok: false, simulado: false, motivo: (e as Error).message, destinatarios };
  }
}

/**
 * O que dizer na tela depois de um envio.
 *
 * Importa porque a trava de homologação desvia a mensagem: avisar "link enviado
 * para o fornecedor" quando ela caiu na caixa de teste é pior do que não avisar
 * nada — a pessoa vai cobrar uma resposta que nunca vai chegar.
 */
export function resumoDoEnvio(r: ResultadoEmail, quantos = 1): string {
  const alvo = quantos > 1 ? `${quantos} fornecedor(es)` : r.destinatarios[0] || "o destinatário";
  if (!r.ok) return `Não foi possível enviar: ${r.motivo ?? "falha no envio"}.`;
  if (r.simulado) return `Envio simulado — nada saiu (destino seria ${alvo}).`;
  if (r.desviado) return `Enviado para a caixa de TESTE, não para ${alvo} — o sistema está em homologação.`;
  return `Enviado para ${alvo}.`;
}

/* ----------------------- Helpers de alto nível ----------------------- */
/* Cada um monta a mensagem do evento, anexa a planilha do escopo certo (se */
/* houver) e delega para enviarEmail. Geração do anexo é best-effort: se     */
/* falhar, o e-mail ainda assim sai, só sem o arquivo.                       */

/** Anexo da OS — SEM o bloco financeiro (BV/desconto negociado são internos da Pólobh, não vão ao fornecedor). */
async function anexoOs(os: Os, ec: Ec): Promise<AnexoEmail | undefined> {
  try {
    const { buffer, nome } = await criarOsExcelBuffer(os, ec, { incluirFinanceiro: false });
    return { nome, conteudoBase64: bufferParaBase64(buffer) };
  } catch {
    return undefined; // segue sem anexo em vez de bloquear o envio
  }
}

/** Anexo da EC — modelo "financeiro" (só Item/Pólobh/Cliente): o modelo "completa" traz CNPJ de
 *  fornecedores e status internos de OS/Contrato, que não devem ir para o cliente. */
async function anexoEc(ec: Ec): Promise<AnexoEmail | undefined> {
  try {
    const { buffer, nome } = await criarEcExcelBuffer(ec, "financeiro");
    return { nome, conteudoBase64: bufferParaBase64(buffer) };
  } catch {
    return undefined;
  }
}

export async function dispararOsPorEmail(os: Os, ec: Ec) {
  const msg = emailDispararOs(os, ec);
  const anexo = await anexoOs(os, ec);
  if (anexo) msg.anexos = [anexo];
  return enviarEmail(msg);
}

/** Credenciamento é só um link de formulário — sem planilha associada a este disparo. */
export const enviarCredenciamento = (os: Os, ec: Ec) => enviarEmail(emailCredenciamento(os, ec));

/** Chamado do Help Desk para o endereço de suporte configurado. */
export const enviarChamado = (chamado: Chamado, para: string, anexos: AnexoEmail[] = []) =>
  enviarEmail(emailHelpDesk(chamado, para, anexos));

/**
 * Arquivo do navegador -> anexo de e-mail.
 *
 * O print já está na mão da tela quando o chamado é aberto; converter aqui evita
 * baixá-lo de volta do bucket só para mandá-lo adiante.
 */
export async function arquivoParaAnexo(arquivo: File): Promise<AnexoEmail> {
  return { nome: arquivo.name, conteudoBase64: bufferParaBase64(await arquivo.arrayBuffer()) };
}

/**
 * Avisa quem abriu o chamado de que houve resposta.
 *
 * O e-mail AVISA; a conversa mora no app. Por isso ele leva um botão para a
 * tela em vez de convidar a responder por e-mail — resposta por e-mail cairia
 * na caixa do suporte e sumiria do chamado.
 */
export const enviarRespostaChamado = (opcoes: Parameters<typeof emailRespostaChamado>[0]) =>
  enviarEmail(emailRespostaChamado(opcoes));

/**
 * Manda ao fornecedor o cronograma DELE, com a OS em anexo.
 *
 * Um só caminho para os dois usos — o envio da aba Cronograma e o lembrete de
 * véspera: é a mesma informação, e dois textos fariam um deles envelhecer.
 */
export async function enviarCronogramaAoFornecedor(os: Os, ec: Ec) {
  const msg = emailCronogramaDoFornecedor(os, ec);
  const anexo = await anexoOs(os, ec);
  if (anexo) msg.anexos = [anexo];
  return enviarEmail(msg);
}

export async function enviarEcParaAprovacao(ec: Ec) {
  const msg = emailEcParaAprovacao(ec);
  const anexo = await anexoEc(ec);
  if (anexo) msg.anexos = [anexo];
  return enviarEmail(msg);
}
