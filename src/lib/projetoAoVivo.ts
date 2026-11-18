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
import type { Ec, Os } from "@/data/types";
import { osEmitida } from "@/domain/faseOs";

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

/**
 * A OS com o cliente e os dados gerais do projeto COMO ESTÃO AGORA — enquanto
 * ela não foi emitida (18/11/2026).
 *
 * A foto (`Os.cliente`, `Os.projeto`) existe para a OS EMITIDA não mudar
 * sozinha. Antes disso ela é rascunho: o bloco "Dados do Cliente" do PDF e da
 * tela saía com o que o cadastro dizia quando a OS nasceu, e quem corrigia o
 * cliente no projeto não via a correção chegar à OS. Emitida, segue a foto.
 */
export function osComDadosAtuais(os: Os, viva: Ec): Os {
  if (osEmitida(os)) return os;
  return { ...os, cliente: viva.cliente ?? os.cliente, projeto: viva.projeto ?? os.projeto };
}
