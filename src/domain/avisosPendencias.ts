/**
 * A decisão do aviso do navegador, separada do React para poder ser testada.
 *
 * Correção de 11/11/2026: a memória do que já foi avisado guardava
 * `[...jáAvisadas, ...atuais]` e cortava pelo FIM ao passar de 500. Uma
 * pendência avisada há muito tempo e ainda aberta ficava no começo da lista,
 * era cortada, e na rodada seguinte voltava a ser avisada como "nova" — o aviso
 * fantasma de quem tem muita pendência acumulada. Agora as abertas vêm sempre
 * primeiro e nunca são esquecidas.
 */

/** Teto do que fica guardado: evita a memória crescer para sempre. */
export const MAX_LEMBRADAS = 500;

export function decidirAvisos(entrada: {
  jaAvisadas: string[];
  atuais: string[];
  /** Primeira carga desta pessoa nesta sessão: o que existe vira marco zero, calado. */
  primeiraCarga: boolean;
}): { novas: string[]; memoria: string[] } {
  const { jaAvisadas, atuais, primeiraCarga } = entrada;
  const lembradas = new Set(jaAvisadas);
  const novas = primeiraCarga ? [] : atuais.filter((id) => !lembradas.has(id));
  const abertas = new Set(atuais);
  const memoria = [...abertas, ...jaAvisadas.filter((id) => !abertas.has(id))].slice(0, MAX_LEMBRADAS);
  return { novas, memoria };
}
