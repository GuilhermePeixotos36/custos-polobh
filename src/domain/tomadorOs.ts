/**
 * Quem figura como TOMADOR do serviço (ou como CONTRATANTE, no contrato).
 *
 * Três lugares do sistema respondiam a esta mesma pergunta com três cópias da
 * resposta — a tela da OS, a OS impressa e o contrato —, e as três só conheciam
 * duas opções: "Pólobh" e "Cliente". O check-list de 15/09/2026 pediu mais duas:
 *
 *   · MF — a outra empresa do grupo. Ela já existia no cadastro (Configurações ›
 *     Empresas do Grupo) e não tinha como ser escolhida aqui: quem faturava pela
 *     MF corrigia a razão social à mão, dentro do documento, toda vez;
 *   · Outro — o tomador que não é do grupo nem é o cliente (a coligada, o
 *     patrocinador, a empresa que paga pelo cliente), com os dados lançados à
 *     mão e a consulta de CNPJ preenchendo o que dá.
 *
 * Com quatro opções e três cópias, a divergência era questão de tempo. A regra
 * passa a viver aqui, e as três saídas leem daqui.
 *
 * COMPATIBILIDADE: as OS gravadas antes disto têm `tomador: "Polobh"`, com P
 * maiúsculo — não é o id de empresa nenhuma. Ele continua valendo e significa
 * "a empresa padrão do grupo", que é exatamente o que significava.
 */
import type { Cliente, EmpresaGrupo, FinanceiroOs } from "@/data/types";

export interface DadosTomador {
  /** Como o tomador se apresenta na tela ("Pólobh — Promoções", "Cliente"). */
  rotulo: string;
  razaoSocial: string;
  endereco: string;
  cnpjCpf: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
}

/** O valor de `tomador` que significa "lanço os dados à mão". */
export const TOMADOR_OUTRO = "Outro";
/** O valor de `tomador` que significa "o cliente do projeto". */
export const TOMADOR_CLIENTE = "Cliente";
/** Valor legado: a empresa padrão do grupo, antes de as empresas terem id aqui. */
const TOMADOR_POLOBH_LEGADO = "Polobh";

/** As opções do seletor, na ordem em que aparecem. */
export function opcoesDeTomador(empresas: EmpresaGrupo[]): { valor: string; rotulo: string }[] {
  return [
    ...[...empresas]
      .sort((a, b) => a.ordem - b.ordem)
      .map((e) => ({ valor: e.id, rotulo: e.nome || e.razaoSocial })),
    { valor: TOMADOR_CLIENTE, rotulo: "Cliente" },
    { valor: TOMADOR_OUTRO, rotulo: "Outro (lançar os dados)" },
  ];
}

/**
 * Resolve os dados fiscais de quem foi escolhido. `null` quando ninguém foi.
 *
 * `avulso` é passado só para o tomador da nota — o contratante do contrato usa
 * a mesma função sem ele, e aí "Outro" cai em `null`, que é o que a tela já
 * trata ("selecione o contratante para carregar os dados").
 */
export function dadosDoTomador(
  quem: string,
  { cliente, empresas, avulso }: { cliente: Cliente; empresas: EmpresaGrupo[]; avulso?: FinanceiroOs["tomadorAvulso"] }
): DadosTomador | null {
  if (!quem) return null;

  if (quem === TOMADOR_CLIENTE) {
    return {
      rotulo: "Cliente",
      razaoSocial: cliente.razaoSocial || cliente.nome,
      endereco: cliente.endereco,
      cnpjCpf: cliente.cnpjCpf,
      inscricaoEstadual: cliente.inscricaoEstadual,
      inscricaoMunicipal: cliente.inscricaoMunicipal,
    };
  }

  if (quem === TOMADOR_OUTRO) {
    if (!avulso) return null;
    return {
      rotulo: avulso.razaoSocial || "Outro tomador",
      razaoSocial: avulso.razaoSocial,
      endereco: avulso.endereco,
      cnpjCpf: avulso.cnpjCpf,
      inscricaoEstadual: avulso.inscricaoEstadual,
      inscricaoMunicipal: avulso.inscricaoMunicipal,
    };
  }

  // Empresa do grupo, pelo id — ou o valor legado, que quer dizer "a padrão".
  const empresa =
    quem === TOMADOR_POLOBH_LEGADO
      ? empresas.find((e) => e.padrao) ?? empresas[0]
      : empresas.find((e) => e.id === quem);
  if (!empresa) return null;
  return {
    rotulo: empresa.nome || empresa.razaoSocial,
    razaoSocial: empresa.razaoSocial,
    endereco: empresa.endereco,
    cnpjCpf: empresa.cnpj,
    inscricaoEstadual: empresa.inscricaoEstadual,
    inscricaoMunicipal: empresa.inscricaoMunicipal,
  };
}

/**
 * O texto padrão das RETENÇÕES FISCAIS (15/09/2026).
 *
 * Escrito pela Pólobh, palavra por palavra, e é o padrão de toda OS: o
 * fornecedor que emite a nota sem reter o ISSQN devolve dinheiro depois, e a
 * cobrança dessa correção é sempre pior do que o aviso. A alternativa é
 * responder "Não se aplica" — as duas são resposta; o campo em branco não.
 */
export const RETENCOES_PADRAO =
  "Ao emitir a nota fiscal, destaque todos os impostos a serem retidos na fonte, conforme a legislação vigente: " +
  "ISSQN, retido obrigatoriamente pelo tomador do serviço, na condição de substituto tributário, salvo exceções legais; " +
  "e tributos federais (PIS, COFINS, CSLL, IRRF e INSS), quando aplicável. " +
  "Em caso de dúvida, consulte a Pólobh antes da emissão.";
