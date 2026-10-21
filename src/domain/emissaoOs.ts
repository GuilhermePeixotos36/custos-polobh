/**
 * O PLANO DA EMISSÃO: quais OSs nascem, e quais deixam de valer (21/10/2026).
 *
 * Regra da Pólobh: é UMA OS POR FORNECEDOR. Três itens, dois de um fornecedor e
 * um de outro, viram duas OSs — nunca uma com os dois.
 *
 * E um item só vale numa OS viva por vez. Pedir a emissão de um item que já
 * está numa OS viva (Rascunho, Em revisão, Emitida…) é pedir uma nova versão
 * dela: a anterior é ARQUIVADA. Antes isso só acontecia quando o status do item
 * era "Emitir Nova Versão" — com "Emitir", a OS velha continuava viva ao lado da
 * nova, e o mesmo item aparecia em duas OSs do mesmo fornecedor.
 *
 * Itens da OS arquivada que NÃO estão sendo emitidos agora voltam para
 * "Emitir": eles perderam a OS e precisam de outra (a mesma regra do
 * cancelamento, `oss_cancelada_libera_itens`).
 */
import type { EcLinha, Os } from "@/data/types";
import { agruparPorFornecedor, type LinhaFornecedorGrupo } from "@/domain/calc";

export interface PlanoEmissao {
  /** Uma entrada por OS que vai nascer — um fornecedor cada. */
  grupos: LinhaFornecedorGrupo[];
  /** OSs vivas que cobrem itens desta emissão: viram "Arquivada". */
  arquivar: Os[];
  /** Itens dessas OSs que ficam sem OS viva e voltam a "Emitir". */
  liberar: string[];
}

const viva = (o: Os) => o.status !== "Cancelada" && o.status !== "Arquivada";

export function planoDeEmissao(prontos: EcLinha[], oss: Os[]): PlanoEmissao {
  const grupos = agruparPorFornecedor(prontos);
  const emitidos = new Set(prontos.map((l) => l.id));
  const arquivar = oss.filter((o) => viva(o) && o.ecLinhaIds.some((id) => emitidos.has(id)));
  const arquivadas = new Set(arquivar.map((o) => o.id));

  // Quem continua coberto: os itens emitidos agora e os de OSs vivas que ficam.
  const cobertos = new Set(emitidos);
  for (const o of oss) if (viva(o) && !arquivadas.has(o.id)) o.ecLinhaIds.forEach((id) => cobertos.add(id));
  const liberar = [...new Set(arquivar.flatMap((o) => o.ecLinhaIds))].filter((id) => !cobertos.has(id));

  return { grupos, arquivar, liberar };
}
