/**
 * Os dois modelos de contrato da Pólobh — Corporativo e Cultural.
 *
 * Chegaram em 16/09/2026, nos dois .docx que faltavam ao check-list de 15/09.
 * Cada modelo é um documento anotado: o texto que vale, e à margem, em amarelo,
 * o que o sistema faz com cada pedaço. São três anotações, e só três:
 *
 *   · "O sistema lança automaticamente …" — o campo NÃO se digita aqui. Ele já
 *     existe na OS (o número, a data, o tomador, o fornecedor, os valores) e o
 *     contrato só o repete. Reeditar aqui seria criar uma segunda verdade para
 *     o mesmo dado, e a segunda é a que ninguém confere;
 *   · "Manter este campo editável." — o corpo daquela cláusula é texto da casa,
 *     e sai do padrão quando o negócio pede. Cada um vira um campo, com o texto
 *     do modelo já dentro;
 *   · os campos que o modelo deixa em branco — testemunhas, cidade e data.
 *
 * O QUE MUDA DE UM MODELO PARA O OUTRO é pouco, e é tudo de direito cultural:
 * a Cláusula Primeira do Cultural nomeia o projeto incentivado, a lei e o
 * código; a Segunda acrescenta, entre as obrigações do CONTRATANTE, receber e
 * administrar os recursos do incentivo; a Sexta acrescenta que serviço novo
 * pede contrato novo. O resto é palavra por palavra o mesmo, e é por isso que
 * os dois moram no mesmo arquivo: separados, a correção de uma vírgula na
 * vigência seria feita num e esquecida no outro.
 *
 * UMA LEITURA QUE EU PRECISEI FAZER: no cabeçalho dos dois modelos, tanto o
 * bloco do CONTRATANTE quanto o do CONTRATADO(A) trazem a mesma anotação — "os
 * dados do Tomador de Serviço da OS". O bloco de assinaturas do próprio modelo
 * desfaz o engano: "CONTRATADA – Sistema lança Razão Social do Fornecedor" e
 * "CONTRATANTE – Sistema lança Razão Social do Tomador". Então é assim que
 * está: CONTRATANTE é o tomador, CONTRATADO(A) é o fornecedor.
 */
import type { ModalidadeProjeto } from "@/data/types";

export type ModeloContrato = "Corporativo" | "Cultural";

/**
 * As sete cláusulas, na ordem do modelo. A chave é o que fica gravado na OS —
 * o título e o texto podem ser reescritos sem que o que já foi editado se
 * perca.
 */
export type ChaveClausula =
  | "objeto"
  | "obrigacoes"
  | "vigencia"
  | "inexecucao"
  | "confidencialidade"
  | "finais"
  | "foro";

export interface ClausulaContrato {
  chave: ChaveClausula;
  /** Como o título aparece na caixa cinza do documento. */
  titulo: string;
  /** O texto do modelo. É o que entra no campo, e o que o botão "voltar ao padrão" devolve. */
  padrao: string;
}

/* ------------------------------ os textos ------------------------------- */

const OBJETO_INTRO =
  "Entre as partes acima qualificadas, fica justo e acertado o presente Contrato, " +
  "que se regerá pelas cláusulas e condições seguintes:";

/** Obrigações — a parte que os dois modelos têm igual, antes das do CONTRATANTE. */
const OBRIGACOES_CONTRATADO = (culturais: boolean) =>
  [
    "São obrigações do(a) CONTRATADO(A):",
    "",
    "Fornecer, dentro dos prazos, especificações técnicas e de qualidade previamente acordados, " +
      "ao(à) CONTRATANTE os produtos e ou serviços descritos na Cláusula Primeira deste instrumento;",
    culturais
      ? "Fornecer notas e ou recibos fiscais válidos e devidamente preenchidos em conformidade com as " +
        "instruções da Legislação de Incentivo à Cultura por meio da qual serão efetuados os pagamentos " +
        "do(a) CONTRATANTE e com o que está estabelecido neste documento."
      : "Fornecer notas e ou recibos fiscais válidos e devidamente preenchidos em conformidade com as " +
        "instruções fornecidas, por meio da qual serão efetuados os pagamentos do(a) CONTRATADO(A), " +
        "e com o que está estabelecido neste documento.",
    "",
    "O(A) CONTRATADO(A) declara, para todos os fins de direito, que está regular com todas as suas " +
      "obrigações trabalhistas, estando com todos os seus funcionários devidamente contratados conforme " +
      "as normas de contrato de trabalho da CLT, ou respeitando a Legislação 6.019/1974, que prevê regras " +
      "para contratação de trabalho temporário, respondendo diretamente a qualquer passivo trabalhista que " +
      "tiver origem em suas ações ou omissões.",
    "Caso haja alguma autuação, referente a trabalhadores que sejam funcionários diretos, indiretos, " +
      "terceirizados, temporários, ou de qualquer natureza, do(a) CONTRATADO(A), o mesmo é o responsável " +
      "direto pela realização de defesas e justificativas, sendo ainda responsável por eventuais multas " +
      "aplicadas pelo Ministério do Trabalho e Emprego, ou qualquer ente fiscalizador da atividade realizada.",
    "",
    "São obrigações do(a) CONTRATANTE:",
    "",
  ].join("\n");

const OBRIGACOES = (culturais: boolean) =>
  OBRIGACOES_CONTRATADO(culturais) +
  [
    ...(culturais
      ? [
          "Receber e administrar os recursos financeiros destinados exclusivamente ao projeto identificado " +
            "no campo OBJETO deste termo em conformidade com as determinações da Legislação de Incentivo à Cultura;",
        ]
      : []),
    "Efetuar, dentro dos prazos previamente acordados, o(s) pagamento(s) dos produtos e ou serviços " +
      "fornecidos pelo(a) CONTRATADO(A) conforme determinado por este termo;",
    "Fornecer ao(à) CONTRATADO(A) condições necessárias para o bom fornecimento de produtos e ou serviços.",
  ].join("\n");

const VIGENCIA = [
  "A vigência do presente contrato terá início na data de sua assinatura e fim com o cumprimento " +
    "satisfatório, pelas partes, de todas as obrigações nele previstas;",
  "Em caso de descumprimento de quaisquer cláusulas do presente contrato por qualquer das partes, " +
    "a parte inocente poderá dar por encerrado o contrato, independentemente de aviso prévio ou " +
    "antecedência, arcando a parte culpada com as perdas e danos que se apurarem e ficando obrigada a " +
    "assegurar à parte inocente todos os direitos que lhe couberem em função do presente contrato;",
  "Em hipótese de caso fortuito ou de força maior, conforme definido pelo Código Civil Brasileiro, " +
    "o presente contrato poderá ser rescindido de pleno direito, sem qualquer ônus para as partes.",
  "Terá o(a) CONTRATADO(A), todavia, direito de receber proporcionalmente a remuneração prevista na " +
    "Cláusula Segunda pelos serviços já tenham sido prestados até a data do evento causador do " +
    "encerramento do contrato.",
].join("\n");

const INEXECUCAO =
  "A título de Cláusula Penal, a inexecução contratual total ou o inadimplemento das obrigações " +
  "contratuais assumidas e aqui acordadas pelas partes ensejará o pagamento de multa de 10% (dez por cento) " +
  "do valor total deste Termo à parte que der causa à inexecução. Quando a obrigação for cumprida em parte " +
  "pelo infrator a parte prejudicada poderá reduzir proporcionalmente a pena ora estipulada levando-se em " +
  "consideração o montante remanescente da obrigação não cumprida, nos termos do artigo 413 do Código Civil Brasileiro.";

const CONFIDENCIALIDADE = [
  "As partes concordam em manter sigilo e confidencialidade, ad eternum, de todas as informações " +
    "confidenciais trocadas entre elas incluindo, mas não se limitando, a dados financeiros, detalhes " +
    "desta negociação, e informações de propriedade intelectual.",
  "",
  "As partes concordam em não usar ou revelar quaisquer informações confidenciais a terceiros, exceto " +
    "com o consentimento prévio por escrito da outra parte ou como for exigido por lei.",
  "Cada parte responderá, perante a outra, pelos danos a que der causa por suas ações ou omissões, " +
    "violações contratuais e legais, indenizando por perdas e danos.",
  "As partes responderão, igualmente, por si, seus prepostos, empregados ou colaboradores, inclusive " +
    "pelo descumprimento da obrigação de sigilo e confidencialidade.",
].join("\n");

const FINAIS = (culturais: boolean) =>
  [
    "Qualquer ato de tolerância ou omissão de qualquer das partes não constituirá novação, renúncia ou " +
      "modificação do pactuado, ficando convencionado para todos os fins de direito que o ato será de mera liberalidade;",
    "",
    ...(culturais
      ? [
          "Qualquer outro serviço relacionado ao Projeto Cultural deverá ser objeto de novo contrato e nova remuneração;",
          "",
        ]
      : []),
    "As partes concordam com os termos deste contrato que não poderá receber emendas, complementações, " +
      "a não ser que tais alterações sejam feitas através de novo documento escrito;",
    "",
    "O presente instrumento é firmado em caráter de absoluto sigilo e confidencialidade, estando ajustado " +
      "entre as partes que seu teor não poderá ser levado ao conhecimento de terceiros, salvo nos casos " +
      "obrigatórios previstos em lei.",
  ].join("\n");

const FORO =
  "Fica eleito o foro de Belo Horizonte, para reger o presente instrumento e dirimir eventuais dúvidas a ele relacionadas.";

/** O fecho, logo antes da cidade e da data. Não é cláusula, e não é editável. */
export const FECHO_CONTRATO =
  "E por estarem assim justas e contratadas, assinam as partes o presente instrumento em 02 (duas) vias " +
  "de igual teor e forma, na presença das testemunhas abaixo.";

/** A frase que fecha a Cláusula Primeira nos dois modelos, depois dos valores. */
export const RESSALVA_VALORES =
  "Estes valores poderão ser revistos em caso de faltas ou execução parcial dos serviços ora contratados.";

/* ------------------------------ a montagem ------------------------------ */

export function clausulasPadrao(modelo: ModeloContrato): ClausulaContrato[] {
  const cultural = modelo === "Cultural";
  return [
    {
      chave: "objeto",
      titulo:
        "CLÁUSULA PRIMEIRA - DO OBJETO, DA DISCRIMINAÇÃO DOS SERVIÇOS E OU PRODUTOS, " +
        "DOS PRAZOS E DAS CONDIÇÕES COMERCIAIS",
      padrao: OBJETO_INTRO,
    },
    { chave: "obrigacoes", titulo: "CLÁUSULA SEGUNDA: DAS OBRIGAÇÕES DAS PARTES", padrao: OBRIGACOES(cultural) },
    { chave: "vigencia", titulo: "CLÁUSULA TERCEIRA: DA VIGÊNCIA", padrao: VIGENCIA },
    { chave: "inexecucao", titulo: "CLÁUSULA QUARTA: DA INEXECUÇÃO DO CONTRATO", padrao: INEXECUCAO },
    { chave: "confidencialidade", titulo: "CLÁUSULA QUINTA: DA CONFIDENCIALIDADE", padrao: CONFIDENCIALIDADE },
    { chave: "finais", titulo: "CLÁUSULA SEXTA: DAS CONSIDERAÇÕES FINAIS", padrao: FINAIS(cultural) },
    { chave: "foro", titulo: "CLÁUSULA SÉTIMA: DO FORO", padrao: FORO },
  ];
}

/**
 * Qual modelo este projeto usa.
 *
 * É a modalidade do projeto que decide — a mesma que já escolhe o modelo da EC
 * e do check-list. Projeto sem modalidade cai no Corporativo, que é o contrato
 * sem as cláusulas de incentivo: por engano, é o que se corrige escrevendo; o
 * contrário sairia citando uma lei de incentivo que não existe naquele negócio.
 */
export const modeloDoContrato = (modalidade: ModalidadeProjeto): ModeloContrato =>
  modalidade === "Cultural" ? "Cultural" : "Corporativo";

/**
 * O texto que vale para uma cláusula: o que a pessoa escreveu, ou o do modelo.
 *
 * String vazia conta como "não editado" de propósito. Quem apaga o campo
 * inteiro quer o padrão de volta, não uma cláusula em branco no contrato — e o
 * botão de voltar ao padrão existe justamente para o outro caso.
 */
export function textoDaClausula(
  editados: Partial<Record<ChaveClausula, string>> | undefined,
  clausula: ClausulaContrato
): string {
  const escrito = editados?.[clausula.chave];
  return escrito && escrito.trim() ? escrito : clausula.padrao;
}
