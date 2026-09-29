/**
 * Os dados gerais do projeto COMO ESTÃO AGORA, para o documento que vai nascer.
 *
 * EC e OS guardam uma foto dos dados do evento (`Ec.projeto`, `Os.projeto`), e
 * essa foto não muda sozinha — é o que protege o que já foi emitido. Mas o
 * documento NOVO tem de sair com o que o projeto diz hoje (regra de
 * 29/09/2026): uma OS gerada de uma EC antiga não pode carregar o local e a
 * produtora de antes da edição. Aqui a EC recebe os dados vivos do projeto só
 * para servir de base a esse documento novo; a EC gravada não é tocada.
 *
 * Sem projeto (EC avulsa) ou com falha de leitura, devolve a própria EC.
 */
import { repo } from "@/data";
import { sincronizarCamposLegados } from "@/domain/projeto";
import type { Ec } from "@/data/types";

export async function comDadosAtuaisDoProjeto(ec: Ec): Promise<Ec> {
  if (!ec.projetoId) return ec;
  try {
    const projeto = await repo.projetos.obter(ec.projetoId);
    if (!projeto) return ec;
    return { ...ec, projeto: sincronizarCamposLegados(projeto.info), cliente: projeto.cliente };
  } catch {
    return ec;
  }
}
