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
import type { Ec, Fornecedor, Os } from "@/data/types";
import { osEmitida } from "@/domain/faseOs";
import { doCadastro } from "@/domain/fornecedor";

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
 * cliente no projeto não via a correção chegar à OS. Emitida, segue a foto —
 * com o projeto incentivado em branco completado (ver `completarIncentivo`).
 */
export function osComDadosAtuais(os: Os, viva: Ec): Os {
  if (osEmitida(os)) return { ...os, projeto: completarIncentivo(os.projeto, viva.projeto) };
  return { ...os, cliente: viva.cliente ?? os.cliente, projeto: viva.projeto ?? os.projeto };
}

/** Os três dados do projeto incentivado, como os Dados Gerais os guardam. */
const CAMPOS_INCENTIVO = ["projetoIncentivado", "codigoProjetoIncentivado", "leiIncentivo"] as const;

/**
 * Na OS EMITIDA, o projeto incentivado que ficou EM BRANCO vem dos Dados Gerais
 * de agora (23/11/2026).
 *
 * A emitida segue a foto do dia da emissão — mas a foto de uma OS emitida antes
 * de o código (ou o nome, ou a lei) ser lançado nos Dados Gerais mostrava "—"
 * para sempre, na tela e no PDF. "Tem que vir automático": o que a emissão
 * gravou continua valendo; só o que está vazio é completado.
 */
export function completarIncentivo(foto: Os["projeto"], viva: Ec["projeto"] | undefined): Os["projeto"] {
  if (!foto || !viva) return foto;
  const completo = { ...foto };
  for (const k of CAMPOS_INCENTIVO) {
    if (!(completo[k] ?? "").trim() && (viva[k] ?? "").trim()) completo[k] = viva[k];
  }
  return completo;
}

/**
 * A OS com o FORNECEDOR como o cadastro diz agora — enquanto ela não foi
 * emitida (24/11/2026, Módulo 1).
 *
 * O bloco do fornecedor da OS virou leitura do cadastro: a tela já abre com o
 * cadastro de hoje, e o PDF tem de sair igual — sem depender do texto que a OS
 * gravou da última vez. Campo vazio no cadastro não apaga o que a OS tem
 * (`doCadastro`). Emitida, segue a foto do dia da emissão; sem cadastro (OS
 * antiga de fornecedor não cadastrado), segue o que a OS guardou.
 */
export function osComFornecedorDoCadastro(os: Os, cadastro: Fornecedor | undefined): Os {
  if (!cadastro || osEmitida(os)) return os;
  return { ...os, fornecedor: { ...os.fornecedor, ...doCadastro(cadastro) } };
}
