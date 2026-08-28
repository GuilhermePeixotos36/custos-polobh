/**
 * Quais itens da EC cada OS carrega.
 *
 * A OS consolida VÁRIAS linhas da EC do mesmo fornecedor — é isso que ela é —,
 * mas a lista de OSs só mostrava número, fornecedor e status. Para saber o que
 * tinha dentro de cada uma era preciso abrir uma a uma.
 *
 * O vínculo já existe no dado (`os.ecLinhaIds`); aqui ele vira nome de item,
 * na ordem em que os itens aparecem na EC — a mesma ordem da planilha, para
 * quem lê os dois lados não precisar reconciliar nada.
 */
import type { Ec, Os } from "@/data/types";

export interface ItemDaOs {
  id: string;
  grupo: string;
  item: string;
}

/**
 * Itens da EC consolidados nesta OS.
 *
 * Devolve lista vazia quando a EC não está entre as carregadas ou quando os
 * vínculos não batem — a tela some com o indicador em vez de mostrar caixa
 * vazia. Item sem nome aparece pelo grupo, e só em último caso como "(item sem
 * nome)": sumir com ele daria a impressão de que a OS tem menos do que tem.
 */
export function itensDaOs(os: Pick<Os, "ecId" | "ecLinhaIds">, ecs: Ec[]): ItemDaOs[] {
  const ids = new Set(os.ecLinhaIds ?? []);
  if (!ids.size) return [];
  const ec = ecs.find((e) => e.id === os.ecId);
  if (!ec) return [];
  return [...ec.linhas]
    .filter((l) => ids.has(l.id))
    .sort((a, b) => a.ordem - b.ordem)
    .map((l) => ({
      id: l.id,
      grupo: l.grupo?.trim() ?? "",
      item: l.item?.trim() || l.descricao?.trim() || "(item sem nome)",
    }));
}
