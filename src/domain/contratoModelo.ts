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

/*
 * NEGRITO NOS TEXTOS (11/11/2026). As cláusulas são campos de texto, e um campo
 * de texto não guarda negrito — então o negrito é marcado com `**assim**`, e
 * quem desenha o documento (`partirEmDestaques`) o devolve. CONTRATANTE e
 * CONTRATADO(A) continuam em negrito sozinhos, onde quer que apareçam.
 *
 * Os textos abaixo seguem a "Solicitação de Revisão do Sistema de Geração de
 * Contratos", de 11/11/2026, e o modelo Corporativo que a Marisa enviou em
 * 12/11/2026. Os dois modelos são iguais, salvo onde o Cultural cita a lei de
 * incentivo e o projeto incentivado: está marcado em cada trecho.
 */

const OBJETO_INTRO =
  "Entre as partes acima qualificadas, fica justo e acertado o presente Contrato, " +
  "que se regerá pelas cláusulas e condições seguintes:";

const OBRIGACOES = (cultural: boolean) =>
  [
    "São obrigações do(a) CONTRATADO(A):",
    "",
    "Fornecer, dentro dos prazos, especificações técnicas e de qualidade previamente acordados, " +
      "ao(à) CONTRATANTE os produtos e ou serviços descritos na Cláusula Primeira deste instrumento;",
    cultural
      ? "Fornecer notas e/ou recibos fiscais válidos e devidamente preenchidos em conformidade com as " +
        "instruções da Legislação de Incentivo à Cultura, por meio da qual serão efetuados os pagamentos " +
        "do(a) CONTRATANTE, e com o que está estabelecido neste documento;"
      : // Corporativo (modelo da Marisa, 12/11/2026): as instruções vêm do CONTRATANTE.
        "Fornecer notas e/ou recibos fiscais válidos e devidamente preenchidos em conformidade com as " +
        "instruções fornecidas pelo(a) CONTRATANTE, por meio das quais serão efetuados os pagamentos " +
        "ao(à) CONTRATADO(A), e com o que está estabelecido neste documento;",
    "Assegurar, para todos os fins de direito, a regularidade de suas obrigações trabalhistas, mantendo " +
      "todos os seus funcionários devidamente contratados conforme as normas da CLT ou da Lei n.º 6.019/1974 " +
      "(que dispõe sobre o trabalho temporário). O(a) CONTRATADO(A) responderá diretamente por qualquer " +
      "passivo trabalhista decorrente de suas ações ou omissões.",
    "Assumir a responsabilidade direta pela apresentação de defesas e justificativas, bem como pelo " +
      "pagamento de eventuais multas aplicadas pelo Ministério do Trabalho e Emprego ou por qualquer outro " +
      "órgão fiscalizador da atividade, caso ocorra alguma autuação referente a trabalhadores — sejam eles " +
      "empregados diretos, indiretos, terceirizados, temporários ou vinculados a qualquer título ao(à) CONTRATADO(A).",
    "",
    "São obrigações do(a) CONTRATANTE:",
    "",
    // Nos dois modelos; só muda a legislação citada.
    "Receber e gerir os recursos financeiros destinados exclusivamente ao projeto identificado na " +
      "cláusula do **OBJETO** deste contrato, em conformidade com a legislação " +
      (cultural ? "de incentivo à cultura " : "") +
      "aplicável;",
    "Efetuar, nos prazos e condições acordados, os pagamentos referentes aos bens fornecidos e/ou serviços " +
      "prestados pelo(a) CONTRATADO(A), conforme estipulado neste instrumento;",
    "Assegurar ao(à) CONTRATADO(A) as condições e informações necessárias para a adequada entrega dos bens " +
      "e/ou execução dos serviços.",
  ].join("\n");

const VIGENCIA = [
  "O presente contrato entrará em vigor na data de sua assinatura e permanecerá válido até o cumprimento " +
    "integral e satisfatório de todas as obrigações nele previstas por ambas as partes.",
  "Em caso de descumprimento de qualquer obrigação prevista neste instrumento, a parte prejudicada poderá " +
    "rescindir o contrato imediatamente, independentemente de aviso ou notificação prévia. Nessa hipótese, a " +
    "parte infratora arcará com as perdas e danos apurados e deverá assegurar à parte inocente todos os " +
    "direitos decorrentes deste contrato.",
  "Na hipótese de caso fortuito ou força maior, nos termos do Código Civil Brasileiro, o contrato poderá " +
    "ser rescindido de pleno direito, sem ônus ou penalidades para as partes. Contudo, o(a) CONTRATADO(A) " +
    "terá o direito de receber a remuneração prevista na Cláusula Segunda de forma proporcional aos serviços " +
    "que já tenham sido efetivamente prestados até a data do evento.",
].join("\n");

const INEXECUCAO = [
  "A título de Cláusula Penal, a inexecução total ou o inadimplemento das obrigações assumidas neste " +
    "instrumento ensejará à parte infratora o pagamento de multa equivalente a 10% (dez por cento) do valor " +
    "total deste Termo, em favor da parte prejudicada.",
  "**Parágrafo Único**. Caso a obrigação seja cumprida parcialmente, a penalidade prevista no caput deverá " +
    "ser reduzida de forma proporcional ao montante remanescente não cumprido, nos termos do artigo 413 do " +
    "Código Civil Brasileiro.",
].join("\n");

const CONFIDENCIALIDADE = [
  "As Partes comprometem-se a manter o mais absoluto sigilo e confidencialidade sobre todas as informações " +
    "confidenciais trocadas entre si durante a vigência deste instrumento e pelo prazo de 5 (cinco) anos após " +
    "o seu término, independentemente do motivo, incluindo, mas não se limitando a dados financeiros, " +
    "estratégias comerciais, detalhes desta negociação e informações de propriedade intelectual.",
  "**Parágrafo Primeiro**. As Partes obrigam-se a não utilizar, reproduzir ou divulgar quaisquer informações " +
    "confidenciais a terceiros sem o consentimento prévio e expresso, por escrito, da Parte reveladora.",
  "**Parágrafo Segundo**. Não serão consideradas confidenciais as informações que: (i) já forem de domínio " +
    "público no momento da revelação ou tornarem-se públicas sem culpa da Parte receptora; (ii) já eram " +
    "legitimamente conhecidas pela Parte receptora antes de sua divulgação; ou (iii) tiverem sua divulgação " +
    "exigida por lei ou ordem judicial, hipótese em que a Parte receptora deverá notificar previamente a outra " +
    "Parte, sempre que legalmente possível, para que esta possa tomar as medidas cabíveis.",
  "**Parágrafo Terceiro**. Cada Parte responderá integralmente perante a outra por quaisquer perdas e danos " +
    "comprovados a que der causa decorrentes do descumprimento desta cláusula, inclusive por atos ou omissões " +
    "de seus sócios, administradores, empregados, prepostos, prestadores de serviços ou colaboradores, sem " +
    "prejuízo das demais sanções legais e contratuais aplicáveis.",
].join("\n");

const FINAIS = (cultural: boolean) =>
  [
    "**Tolerância e Novação:** A eventual tolerância ou omissão de qualquer das Partes quanto ao " +
      "descumprimento de obrigações aqui assumidas não constituirá novação, renúncia ou alteração do " +
      "pactuado, representando mera liberalidade que não impedirá a exigência futura do cumprimento " +
      "integral deste Contrato.",
    "**Serviços Adicionais:** A execução de qualquer outro serviço relacionado ao Projeto" +
      (cultural ? " Cultural" : "") +
      " não previsto expressamente no objeto deste instrumento dependerá de prévia negociação entre as " +
      "Partes e deverá ser formalizada por meio de termo aditivo ou novo contrato, mediante remuneração " +
      "específica a ser ajustada.",
    "**Alterações Contratuais:** As Partes concordam integralmente com os termos deste Contrato, o qual " +
      "somente poderá ser alterado, aditado ou complementado mediante instrumento escrito devidamente " +
      "assinado por ambas as Partes.",
    "**Sigilo do Instrumento:** Os termos e condições deste Contrato sujeitam-se integralmente às obrigações " +
      "de sigilo e confidencialidade previstas na Cláusula Quinta.",
  ].join("\n");

const FORO =
  "Fica eleito o foro da Comarca de Belo Horizonte, Estado de Minas Gerais, para dirimir quaisquer dúvidas " +
  "ou litígios oriundos do presente instrumento, com renúncia expressa a qualquer outro, por mais " +
  "privilegiado que seja.";

/** O fecho, logo antes da cidade e da data. Não é cláusula, e não é editável. */
export const FECHO_CONTRATO =
  "E, por estarem assim justas e contratadas, as Partes firmam o presente instrumento por meio eletrônico, " +
  "reconhecendo como válida e plenamente eficaz a assinatura eletrônica utilizada, para todos os fins de " +
  "direito, nos termos dos artigos 107 e 219 do Código Civil, do art. 10 da Medida Provisória nº 2.200-2/2001, " +
  "do art. 411 do Código de Processo Civil e da Lei nº 14.063/2020, renunciando ao direito de impugnar sua " +
  "autenticidade, integridade e validade jurídica.";

/** A frase que fecha os valores — é o padrão do campo "Observações Gerais" do contrato. */
export const RESSALVA_VALORES =
  "Estes valores poderão ser revistos em caso de faltas ou execução parcial dos serviços ora contratados.";

/* ------------------------------ a montagem ------------------------------ */

/** A chave do ajuste (`config_app`) onde moram os textos padrão editados pela casa. */
export const CHAVE_CLAUSULAS_DA_CASA = "contrato_clausulas";

/**
 * Os TEXTOS PADRÃO editados pela casa (13/11/2026): Configurações › Contratos,
 * por modelo. Só guarda o que foi MUDADO — cláusula ausente segue o texto do
 * código, e corrigir o código mais tarde continua valendo para ela.
 */
export type ClausulasDaCasa = Partial<Record<ModeloContrato, Partial<Record<ChaveClausula, string>>>>;

export const MODELOS_CONTRATO: ModeloContrato[] = ["Corporativo", "Cultural"];
export const CHAVES_CLAUSULA: ChaveClausula[] = [
  "objeto",
  "obrigacoes",
  "vigencia",
  "inexecucao",
  "confidencialidade",
  "finais",
  "foro",
];

/** O que foi gravado, limpo: só modelos e cláusulas conhecidos, só texto não vazio. */
export function clausulasDaCasaDaConfig(gravado: unknown): ClausulasDaCasa {
  const saida: ClausulasDaCasa = {};
  if (!gravado || typeof gravado !== "object") return saida;
  for (const modelo of MODELOS_CONTRATO) {
    const dele = (gravado as Record<string, unknown>)[modelo];
    if (!dele || typeof dele !== "object") continue;
    const limpo: Partial<Record<ChaveClausula, string>> = {};
    for (const chave of CHAVES_CLAUSULA) {
      const t = (dele as Record<string, unknown>)[chave];
      if (typeof t === "string" && t.trim()) limpo[chave] = t;
    }
    if (Object.keys(limpo).length) saida[modelo] = limpo;
  }
  return saida;
}

/**
 * As cláusulas do modelo, com o texto padrão que vale HOJE: o que a casa
 * editou em Configurações › Contratos, ou o do código. O que uma OS escreveu
 * por cima (`textoDaClausula`) continua vencendo os dois.
 */
export function clausulasPadrao(modelo: ModeloContrato, casa?: ClausulasDaCasa): ClausulaContrato[] {
  return clausulasDoCodigo(modelo).map((c) => {
    const editado = casa?.[modelo]?.[c.chave];
    return editado && editado.trim() ? { ...c, padrao: editado } : c;
  });
}

/** Os textos de fábrica — o que "Voltar ao texto original" devolve na tela de Configurações. */
export function clausulasDoCodigo(modelo: ModeloContrato): ClausulaContrato[] {
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
    { chave: "vigencia", titulo: "CLÁUSULA TERCEIRA: DA VIGÊNCIA E DA RESCISÃO", padrao: VIGENCIA },
    { chave: "inexecucao", titulo: "CLÁUSULA QUARTA: DA INEXECUÇÃO DO CONTRATO", padrao: INEXECUCAO },
    { chave: "confidencialidade", titulo: "CLÁUSULA QUINTA: DA CONFIDENCIALIDADE", padrao: CONFIDENCIALIDADE },
    { chave: "finais", titulo: "CLÁUSULA SEXTA: DAS DISPOSIÇÕES GERAIS", padrao: FINAIS(cultural) },
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
