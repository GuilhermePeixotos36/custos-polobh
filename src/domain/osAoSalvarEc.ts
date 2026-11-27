/**
 * O QUE ACONTECE COM AS OS QUANDO A EC É SALVA (27/11/2026).
 *
 * Até aqui, item com OS era intocável: a EC não deixava excluí-lo ("Resolva a
 * OS antes"), nem mesmo com a OS já arquivada — a trava olhava o status do
 * item, não a OS. E mudar o valor de um item com OS emitida não chegava a
 * lugar nenhum: a OS emitida é foto, e ninguém era avisado de que ela tinha
 * ficado diferente da EC.
 *
 * Agora a EC pode mexer, e a consequência para cada OS é uma só, decidida
 * aqui e dita à pessoa ANTES de ela confirmar:
 *
 *   EXCLUIR item que está numa OS viva
 *     · a OS fica sem item nenhum ............ é ARQUIVADA;
 *     · OS emitida que continua com outros ... NOVA VERSÃO (a emitida vai para
 *       o arquivo e nasce uma ativa, sem o item, com o preenchimento
 *       preservado, para revisar e emitir de novo);
 *     · OS ativa que continua com outros ..... só perde o item — ela ainda
 *       está sendo montada, não há documento na rua para substituir.
 *
 *   ALTERAR item que está numa OS EMITIDA ...... NOVA VERSÃO, se a pessoa
 *     quiser. Na OS ativa não precisa de nada: ela lê os valores da EC.
 *
 * OS arquivada não entra em conta nenhuma: é histórico, e é por isso que o
 * item dela pode ser excluído sem pergunta.
 */
import type { Ec, EcLinha, Os } from "@/data/types";

export const osViva = (o: Pick<Os, "status">): boolean => o.status !== "Arquivada";

/** As OS vivas que cobrem o item. */
export function ossVivasDoItem<T extends Pick<Os, "status" | "ecLinhaIds">>(linhaId: string, oss: T[]): T[] {
  return oss.filter((o) => osViva(o) && o.ecLinhaIds.includes(linhaId));
}

export type DestinoDaOs = "arquivar" | "nova-versao" | "perde-o-item";

/** O que acontece com UMA OS viva quando os itens `removidos` saem da EC. */
export function destinoDaOsAoExcluir(
  os: Pick<Os, "status" | "ecLinhaIds">,
  removidos: ReadonlySet<string>,
  /** Ids dos itens que continuam na EC — o que a OS cita e já não existe não conta. */
  existentes: ReadonlySet<string>
): DestinoDaOs | null {
  if (!osViva(os) || !os.ecLinhaIds.some((id) => removidos.has(id))) return null;
  const sobram = os.ecLinhaIds.filter((id) => !removidos.has(id) && existentes.has(id)).length;
  if (sobram === 0) return "arquivar";
  return os.status === "Emitida" ? "nova-versao" : "perde-o-item";
}

/** A frase que a confirmação mostra para cada OS afetada pela exclusão. */
export function fraseDoDestino(os: Pick<Os, "numero" | "status">, destino: DestinoDaOs): string {
  const quem = `A OS “${os.numero}” (${os.status})`;
  if (destino === "arquivar") return `${quem} fica sem itens e será ARQUIVADA.`;
  if (destino === "nova-versao")
    return `${quem} será arquivada e nasce uma nova versão dela, ATIVA, sem este item e com o preenchimento preservado, para revisar e emitir de novo.`;
  return `${quem} só perde este item; os outros itens dela continuam.`;
}

/**
 * Os campos do item que a OS IMPRIME. Status (Aprovação, OS, Contrato), grupo,
 * ordem e observações internas não entram: mudam o andamento, não o documento.
 */
const assinaturaDoItem = (l: EcLinha): string =>
  JSON.stringify([
    (l.item ?? "").trim(),
    (l.descricao ?? "").trim(),
    (l.descricaoCompleta ?? "").trim(),
    Number(l.valorPolobh) || 0,
    Number(l.valorCliente) || 0,
    (l.fornecedorRazao ?? "").trim(),
    (l.fornecedorCnpj ?? "").replace(/\D/g, ""),
    Number(l.valorComBvNf) || 0,
    Number(l.valorSemBvComNf) || 0,
    Number(l.valorSemBvSemNf) || 0,
    l.bv?.modo ?? "",
    Number(l.bv?.valor) || 0,
  ]);

export interface PlanoOsAoSalvarEc {
  /** OS vivas que ficam sem item nenhum: vão para o arquivo. */
  arquivar: Os[];
  /** OS emitidas que perderam item mas seguem com outros: nova versão, sem o item. */
  novaVersaoPorExclusao: Os[];
  /** OS emitidas com item alterado: nova versão, se a pessoa quiser. Traz os nomes dos itens. */
  novaVersaoPorEdicao: { os: Os; itens: string[] }[];
}

export function planoOsAoSalvarEc(antes: Pick<Ec, "linhas"> | null | undefined, depois: Pick<Ec, "linhas">, oss: Os[]): PlanoOsAoSalvarEc {
  const vazio: PlanoOsAoSalvarEc = { arquivar: [], novaVersaoPorExclusao: [], novaVersaoPorEdicao: [] };
  if (!antes) return vazio;
  const existentes = new Set(depois.linhas.map((l) => l.id));
  const removidos = new Set(antes.linhas.filter((l) => !existentes.has(l.id)).map((l) => l.id));
  const depoisPorId = new Map(depois.linhas.map((l) => [l.id, l]));
  const alterados = new Map<string, string>();
  for (const l of antes.linhas) {
    const novo = depoisPorId.get(l.id);
    if (novo && assinaturaDoItem(novo) !== assinaturaDoItem(l)) alterados.set(l.id, novo.item?.trim() || l.item?.trim() || "item sem nome");
  }

  const plano: PlanoOsAoSalvarEc = { arquivar: [], novaVersaoPorExclusao: [], novaVersaoPorEdicao: [] };
  for (const os of oss) {
    const destino = destinoDaOsAoExcluir(os, removidos, existentes);
    if (destino === "arquivar") {
      plano.arquivar.push(os);
      continue;
    }
    if (destino === "nova-versao") {
      plano.novaVersaoPorExclusao.push(os);
      continue; // a nova versão já leva as alterações dos itens que ficaram
    }
    if (os.status !== "Emitida") continue;
    const itens = os.ecLinhaIds.filter((id) => alterados.has(id)).map((id) => alterados.get(id)!);
    if (itens.length) plano.novaVersaoPorEdicao.push({ os, itens });
  }
  return plano;
}
