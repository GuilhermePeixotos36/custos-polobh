/**
 * A REVISÃO POR IA PASSA A SER PERGUNTADA (28/10/2026).
 *
 * Antes, todo "Salvar" mandava os textos alterados para a IA sem avisar, e o
 * botão "Revisar" só padronizava maiúsculas. Agora:
 *
 *  · "Revisar" manda à IA os textos ALTERADOS que ainda não foram revisados e
 *    mostra o comparativo — nunca o documento inteiro;
 *  · "Salvar" com textos alterados ainda não revisados PERGUNTA se a pessoa quer
 *    a revisão antes de gravar;
 *  · se a IA falhar, aparece um aviso claro — o texto é gravado como foi
 *    escrito (só com a regra de maiúsculas da casa).
 *
 * "Já revisado" é lembrado por texto: um campo revisado e depois reescrito
 * volta a contar como pendente.
 */
import { confirmar } from "@/store/confirm";
import { corrigirMaiusculas, corrigirMaiusculasHtml, emTopicos, revisarCampos } from "@/lib/correcaoOrtografica";
import { retratoDeTextos, type CampoRevisavel } from "@/domain/revisaoTexto";

/** Textos alterados desde a gravação que ainda não passaram pela revisão. */
export function pendentesDeRevisao(
  atual: CampoRevisavel[],
  gravado: CampoRevisavel[],
  jaRevisados: Map<string, string>,
): CampoRevisavel[] {
  const antes = retratoDeTextos(gravado);
  return atual.filter((c) => antes.get(c.id) !== c.texto && jaRevisados.get(c.id) !== c.texto);
}

/** Só a regra de maiúsculas, sem IA — o que vale quando não há revisão. */
export function somenteMaiusculas(campos: CampoRevisavel[]): Map<string, string> {
  return new Map(campos.map((c) => [c.id, c.topicos ? emTopicos(corrigirMaiusculasHtml(c.texto)) : c.html ? corrigirMaiusculasHtml(c.texto) : corrigirMaiusculas(c.texto)]));
}

/**
 * Manda os pendentes à IA. Devolve os textos revisados (com as maiúsculas
 * sempre aplicadas) e se a IA falhou em algum.
 */
export async function revisarPendentes(
  pendentes: CampoRevisavel[],
): Promise<{ textos: Map<string, string>; falhou: boolean }> {
  if (!pendentes.length) return { textos: new Map(), falhou: false };
  try {
    const { textos, revisaoCompleta } = await revisarCampos(pendentes);
    const tudo = somenteMaiusculas(pendentes);
    textos.forEach((v, k) => tudo.set(k, v));
    return { textos: tudo, falhou: !revisaoCompleta };
  } catch {
    return { textos: somenteMaiusculas(pendentes), falhou: true };
  }
}

/** Lembra o texto final de cada campo revisado, para não perguntar de novo. */
export function lembrarRevisados(
  jaRevisados: Map<string, string>,
  pendentes: CampoRevisavel[],
  textos: Map<string, string>,
): Map<string, string> {
  const novo = new Map(jaRevisados);
  for (const c of pendentes) novo.set(c.id, textos.get(c.id) ?? c.texto);
  return novo;
}

/** O pequeno diálogo do "Salvar": revisar os textos alterados antes de gravar? */
export function perguntarRevisao(quantos: number): Promise<boolean> {
  return confirmar({
    titulo: "Revisar os textos alterados?",
    mensagem:
      `${quantos === 1 ? "1 texto alterado ainda não foi revisado" : `${quantos} textos alterados ainda não foram revisados`}. ` +
      "Quer que o sistema corrija a ortografia antes de salvar? Só os textos alterados são revisados.",
    confirmarTexto: "Revisar e salvar",
    cancelarTexto: "Salvar sem revisar",
  });
}

/** O aviso de que a IA não respondeu. */
export function avisarFalhaRevisao(): Promise<boolean> {
  return confirmar({
    titulo: "A revisão por IA falhou",
    mensagem:
      "Não foi possível revisar a ortografia agora — o serviço de IA não respondeu ou o limite do dia foi atingido. " +
      "Os textos ficam como você escreveu (só com o ajuste de maiúsculas). Você pode tentar de novo pelo botão Revisar.",
    confirmarTexto: "Entendi",
    somenteOk: true,
  });
}
