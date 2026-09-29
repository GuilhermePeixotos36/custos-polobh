/**
 * A trava de PRESENÇA, do lado da tela: quem está com o documento, desde
 * quando, e se o sinal dele ainda vale.
 *
 * A Pólobh pediu que o sistema "não permita que um documento seja editado,
 * substituído, arquivado, cancelado ou emitido se outro usuário estiver com ele
 * aberto em modo de edição". O verbo é PERMITIR: é bloqueio, não aviso.
 *
 * A trava otimista (a que recusa o segundo salvamento) continua embaixo desta,
 * e as duas fazem trabalhos diferentes. A de baixo é a rede: pega o caso em que
 * a posse caducou por engano, em que alguém editou por outro caminho, em que
 * duas abas do mesmo navegador se cruzaram. A de cima é o que evita o trabalho
 * perdido — ela chega antes da primeira letra digitada, não depois de meia hora
 * de trabalho.
 */

/** O que o banco devolve sobre a posse de um documento. */
export interface PosseDeEdicao {
  /** A posse é minha — posso editar. */
  meu: boolean;
  usuarioId: string;
  usuarioNome: string;
  /** Desde quando esta pessoa está com o documento. */
  desde: string;
  /** Último sinal de vida do navegador dela. */
  vistoEm: string;
}

/** De quanto em quanto tempo o navegador avisa que ainda está lá. */
export const INTERVALO_SINAL_MS = 30_000;

/**
 * Quanto silêncio derruba a posse. Precisa bater com `edicao_prazo()` no banco
 * — quem decide de verdade é ele; aqui o número serve para a tela saber o que
 * dizer antes de perguntar de novo.
 */
export const PRAZO_SEM_SINAL_MS = 90_000;

/** O endereço do documento na trava. É a chave primária da tabela. */
export const chaveDocumento = (tipo: "ec" | "os" | "projeto", id: string): string => `${tipo}:${id}`;

/**
 * A posse ainda vale?
 *
 * Uma posse sem sinal há mais de 90 segundos é de alguém que fechou o notebook,
 * perdeu a rede ou simplesmente foi embora. Sem esta regra, a trava que protege
 * o trabalho da casa viraria o motivo de um telefonema pedindo para alguém
 * "sair do documento".
 */
export function posseAtiva(posse: PosseDeEdicao | null, agora: Date = new Date()): boolean {
  if (!posse) return false;
  return agora.getTime() - new Date(posse.vistoEm).getTime() < PRAZO_SEM_SINAL_MS;
}

/** "desde as 14h20" — como a pessoa lê a hora, não como o banco a guarda. */
export function desdeQuando(posse: PosseDeEdicao): string {
  const d = new Date(posse.desde);
  return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * O aviso que a tela mostra. Devolve vazio quando não há nada a dizer — ou
 * porque ninguém está com o documento, ou porque quem está sou eu.
 *
 * O texto muda quando o sinal está velho: aí a mensagem deixa de ser "espere" e
 * passa a ser "pode assumir", que é a informação útil naquele momento.
 */
export function avisoDePosse(posse: PosseDeEdicao | null, agora: Date = new Date()): string {
  if (!posse || posse.meu) return "";
  const nome = posse.usuarioNome.trim() || "Outra pessoa";
  if (!posseAtiva(posse, agora)) {
    return `${nome} abriu este documento para edição às ${desdeQuando(posse)} e está sem sinal. Você já pode assumir.`;
  }
  return `${nome} está editando este documento desde as ${desdeQuando(posse)}. Enquanto isso, ele fica em leitura.`;
}
