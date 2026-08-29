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
import type { CampoLogistica, Ec, Logistica, Os } from "@/data/types";

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

/* --------------------- Logística do Fornecedor --------------------------- */

/**
 * Os itens de Logística, na ordem em que aparecem. Rótulo junto: é o MESMO na
 * tela, no documento impresso e na planilha.
 *
 * A lista existia em triplicata — uma cópia em cada um desses três lugares —, e
 * foi juntada aqui quando o "não se aplica" chegou: com três cópias, bastava um
 * deles esquecer de filtrar para o item some da tela e continuar no documento
 * que o fornecedor recebe.
 */
export const CAMPOS_LOGISTICA = [
  { campo: "transporteMaterial", rotulo: "Transporte Material" },
  { campo: "transporteEquipe", rotulo: "Transporte Equipe" },
  { campo: "hospedagem", rotulo: "Hospedagem Equipe" },
  { campo: "alimentacao", rotulo: "Alimentação Equipe" },
  { campo: "estacionamentoCarga", rotulo: "Estacionamento Carga" },
  { campo: "estacionamentoEquipe", rotulo: "Estacionamento Equipe" },
  { campo: "uniformizacao", rotulo: "Uniformização Equipe" },
] as const satisfies readonly { campo: CampoLogistica; rotulo: string }[];

/** Este item foi marcado como "não se aplica" nesta OS? */
export function logisticaNaoSeAplica(l: Logistica | undefined, campo: CampoLogistica): boolean {
  return !!l?.naoAplicaveis?.includes(campo);
}

/**
 * Os itens de logística que ENTRAM no documento e na planilha.
 *
 * O que não se aplica some — é o pedido. Item vazio CONTINUA aparecendo, com a
 * linha em branco para o fornecedor preencher: vazio é pergunta em aberto, e
 * escondê-la seria dar por respondida uma coisa que ninguém respondeu.
 */
export function logisticaVisivel(l: Logistica | undefined): { campo: CampoLogistica; rotulo: string; valor: string }[] {
  return CAMPOS_LOGISTICA
    .filter(({ campo }) => !logisticaNaoSeAplica(l, campo))
    .map(({ campo, rotulo }) => ({ campo, rotulo, valor: l?.[campo] ?? "" }));
}

/**
 * Marca/desmarca um item como "não se aplica".
 *
 * Não mexe no valor digitado: quem marcou por engano desmarca e encontra o que
 * tinha escrito, exatamente como nas opções de valor do item da EC.
 */
export function alternarLogisticaNaoSeAplica(l: Logistica, campo: CampoLogistica): Logistica {
  const atuais = l.naoAplicaveis ?? [];
  return {
    ...l,
    naoAplicaveis: atuais.includes(campo) ? atuais.filter((c) => c !== campo) : [...atuais, campo],
  };
}
