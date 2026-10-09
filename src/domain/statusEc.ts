/**
 * Mudar só os STATUS dos itens da EC (Aprovação, OS e Contrato), sem editar a EC.
 *
 * A visualização da EC deixa mudar estes três campos direto, num item ou em
 * vários marcados — é o gesto de "aprovar e mandar emitir a OS". Quem faz isso
 * nem sempre edita grupos e itens; por isso a regra mora aqui, separada da
 * edição, e só toca nestes três campos.
 */
import { aprovarLinha, reverterAprovacaoLinha } from "@/domain/calc";
import type { EcLinha, StatusAprovacao, StatusOs } from "@/data/types";

/** Opções de status de OS e de Contrato — a mesma lista nos dois campos. */
export const OPCOES_STATUS_OS: StatusOs[] = ["Pendente", "Emitir", "Emitir Nova Versão", "OK", "Não se Aplica"];

export interface MudancaDeStatus {
  aprovacao?: StatusAprovacao;
  os?: StatusOs;
  contrato?: StatusOs;
}

/**
 * Aplica a mudança nas linhas de `ids` e devolve as linhas todas.
 *
 * A Aprovação passa pela regra da casa (aprovar já pede a OS; reverter desfaz só
 * a OS que a aprovação criou). OS e Contrato são escolhidos como estão.
 */
export function aplicarMudancaDeStatus(linhas: EcLinha[], ids: Iterable<string>, m: MudancaDeStatus): EcLinha[] {
  const alvo = new Set(ids);
  return linhas.map((l) => {
    if (!alvo.has(l.id)) return l;
    let r = l;
    if (m.aprovacao === "OK") r = aprovarLinha(r);
    else if (m.aprovacao === "Pendente") r = reverterAprovacaoLinha(r);
    if (m.os) r = { ...r, statusOs: m.os };
    if (m.contrato) r = { ...r, contratoStatus: m.contrato };
    return r;
  });
}
