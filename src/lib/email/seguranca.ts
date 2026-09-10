/**
 * A trava que impede o app em homologação de escrever para gente de verdade.
 *
 * O sistema já está na mão da equipe para conferência de dados, e as telas de
 * fornecedor têm botões de envio em lote. Um clique errado ali não é um bug de
 * tela: é um e-mail no caixa de entrada de um fornecedor, com um link de
 * credenciamento ou um cronograma que ainda não vale.
 *
 * Por isso o desvio acontece no ÚLTIMO ponto antes do envio, e não nas telas:
 * qualquer caminho novo que alguém escreva amanhã — uma tela nova, um lembrete
 * automático, um retry — passa por aqui de graça. Enquanto
 * `flags.emailDestinoReal` estiver desligada (o padrão), toda mensagem vai para
 * o endereço de teste, com o destinatário original preservado no assunto e no
 * corpo, para dar para conferir o que teria saído e para quem.
 *
 * A trava é de PUBLICAÇÃO, não de perfil: nenhum usuário, nem o Admin, liga ou
 * desliga isso pela interface. Sai do ar no dia da virada, com
 * `VITE_EMAIL_DESTINO_REAL=true`.
 */
import { flags } from "@/lib/flags";
import type { MensagemEmail } from "./templates";

/** Caixa de entrada que recebe tudo durante a homologação. */
export const EMAIL_TESTE = "gpxautomacao@outlook.com";
const NOME_TESTE = "Homologação Pólobh";

/** O envio pode chegar ao destinatário real? */
export const destinoRealLiberado = (): boolean => flags.emailDestinoReal;

/**
 * Esta mensagem escapa da trava?
 *
 * Sim quando a virada já aconteceu, e sim quando ela é INTERNA — da Pólobh para
 * a Pólobh. A trava existe para proteger fornecedor e cliente de receberem algo
 * que ainda não vale; o chamado de Help Desk vai para o suporte da casa e
 * responde para quem o abriu, e não há terceiro nenhum nessa conversa.
 */
const podeSairDireto = (msg: MensagemEmail): boolean => destinoRealLiberado() || !!msg.interna;

/**
 * Desvia a mensagem para a caixa de teste, deixando à vista o que teria
 * acontecido: o assunto ganha o destino real e o corpo ganha uma tarja no topo.
 *
 * Devolve a mensagem intacta quando o destino real está liberado.
 */
export function protegerDestinatarios(msg: MensagemEmail): MensagemEmail {
  if (podeSairDireto(msg)) return msg;

  const reais = msg.para.map((p) => (p.nome ? `${p.nome} <${p.email}>` : p.email));
  const lista = reais.join(", ") || "(sem destinatário)";

  return {
    ...msg,
    para: [{ email: EMAIL_TESTE, nome: NOME_TESTE }],
    assunto: `[TESTE → ${msg.para.map((p) => p.email).join(", ") || "sem destino"}] ${msg.assunto}`,
    html: `${tarja(lista)}${msg.html}`,
  };
}

/** A tarja que abre o e-mail de teste — em vermelho, para ninguém confundir com o real. */
const tarja = (destinatarios: string): string => `
  <div style="margin:0 0 16px;padding:12px 14px;border:2px solid #9C0006;background:#FFC7CE;
              border-radius:8px;font:600 13px/1.5 Arial,Helvetica,sans-serif;color:#9C0006">
    <b>MENSAGEM DE TESTE — o sistema está em homologação.</b><br />
    Este e-mail <b>não</b> foi enviado ao destinatário real. Com o app liberado, ele iria para:
    <b>${destinatarios}</b>.
  </div>`;
