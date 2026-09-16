/**
 * Dados Úteis: a folha de contatos do evento.
 *
 * No dia da montagem ninguém abre a OS para descobrir o telefone do
 * cenógrafo — é uma folha só, com quem está no projeto, o que cada um
 * entrega e como se fala com ele. Era o que a aba Fornecedores do projeto NÃO
 * dava: razão social, CNPJ e e-mail, sem telefone, sem nome de gente e sem
 * dizer o que aquele fornecedor faz ali.
 *
 * A linha é por FORNECEDOR, não por OS: o mesmo fornecedor pode ter duas OSs
 * no projeto (som e iluminação, por exemplo), e quem procura o telefone dele
 * quer um lugar só, com os dois serviços listados.
 *
 * O nome que aparece é o CURTO — apelido, fantasia, e razão social só em
 * último caso. Numa folha lida com pressa, "SOM & LUZ PRODUÇÕES LTDA" custa
 * mais para achar do que "Som & Luz".
 */
import { itensDaOs } from "./os";
import type { Ec, Os } from "@/data/types";
import { nomeCurtoFornecedor } from "@/domain/fornecedor";

/** OS encerrada não vai para a folha: o fornecedor não está mais no evento. */
const OS_ENCERRADA = ["Cancelada", "Arquivada"];

export interface LinhaDadosUteis {
  /** Nome curto do fornecedor — como a equipe o chama. */
  fornecedor: string;
  /** O que ele entrega neste projeto, pelos itens da EC. */
  itens: string[];
  /** Pessoa de contato (o representante do cadastro). */
  contato: string;
  telefone: string;
  email: string;
  /** As OSs em que ele aparece — o rastro para quem quiser conferir. */
  oss: string[];
}

/**
 * A folha de contatos do projeto, em ordem alfabética — é assim que se procura
 * alguém numa lista impressa.
 */
export function dadosUteisDosFornecedores(oss: Os[], ecs: Ec[]): LinhaDadosUteis[] {
  const porFornecedor = new Map<string, LinhaDadosUteis>();

  for (const os of oss) {
    if (OS_ENCERRADA.includes(os.status)) continue;
    const f = os.fornecedor;
    // A chave é o CNPJ quando existe: o mesmo fornecedor pode ter sido digitado
    // com razão social diferente em duas OSs, e viraria duas linhas.
    const chave = (f.cnpj || nomeCurtoFornecedor(f)).trim();
    if (!chave) continue;

    const atual = porFornecedor.get(chave) ?? {
      fornecedor: nomeCurtoFornecedor(f) || "Fornecedor",
      itens: [],
      contato: "",
      telefone: "",
      email: "",
      oss: [],
    };

    for (const item of itensDaOs(os, ecs)) {
      if (!atual.itens.includes(item.item)) atual.itens.push(item.item);
    }
    if (os.numero && !atual.oss.includes(os.numero)) atual.oss.push(os.numero);
    // Primeiro valor preenchido vence: OS antiga sem telefone não apaga o que a
    // OS seguinte trouxe.
    atual.contato ||= (f.representante ?? "").trim();
    atual.telefone ||= (f.telefone ?? "").trim();
    atual.email ||= (f.email ?? "").trim();

    porFornecedor.set(chave, atual);
  }

  return [...porFornecedor.values()].sort((a, b) => a.fornecedor.localeCompare(b.fornecedor, "pt-BR"));
}
