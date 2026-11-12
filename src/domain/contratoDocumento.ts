/**
 * O CONTRATO como estrutura — antes de virar PDF.
 *
 * O gerador (`lib/pdf/contrato`) só sabe desenhar: caixa cinza, parágrafo, linha
 * de assinatura. Quem decide O QUE entra em cada lugar é este módulo, e ele é
 * função pura da OS — por isso o que o fornecedor vai assinar pode ser
 * conferido em teste, sem abrir o PDF.
 *
 * A divisão que o modelo da Pólobh pede está em `contratoModelo`: o que o
 * sistema lança sozinho, e o que fica editável. Aqui isso vira lista de
 * parágrafos: os automáticos montados da OS, os editáveis lidos do contrato.
 *
 * NEGRITO: o modelo destaca "CONTRATANTE" e "CONTRATADO(A)" toda vez que as
 * palavras aparecem no corpo das cláusulas, e mais alguns trechos que o texto
 * marca com `**assim**`. Como as cláusulas são campos de texto — e um campo de
 * texto não guarda negrito —, quem devolve o destaque é `partirEmDestaques`,
 * na hora de escrever o documento.
 */
import { nomeCompletoDoProjeto } from "@/domain/calc";
import type { Cliente, EmpresaGrupo, Os } from "@/data/types";
import { brl } from "@/lib/format";
import { MESES } from "@/domain/calendario";
import { dadosDoTomador, type DadosTomador } from "@/domain/tomadorOs";
import { incentivoDoContrato } from "@/domain/os";
import {
  formatarCnpjCpf,
  formatarInscricaoEstadual,
  formatarRazaoSocial,
  formatarTelefone,
  municipioDoEndereco,
} from "@/domain/formatosDocumento";
import { TESTEMUNHAS_PADRAO, type TestemunhaFixa } from "@/domain/testemunhasContrato";
import {
  clausulasPadrao,
  FECHO_CONTRATO,
  modeloDoContrato,
  RESSALVA_VALORES,
  textoDaClausula,
  type ChaveClausula,
  type ModeloContrato,
} from "@/domain/contratoModelo";

export { municipioDoEndereco };

/** Uma das duas partes, como sai na qualificação do alto do contrato. */
export interface ParteContrato {
  papel: "CONTRATANTE" | "CONTRATADO (A)";
  razaoSocial: string;
  cnpjCpf: string;
  inscricaoEstadual: string;
  telefone: string;
  endereco: string;
}

export interface ClausulaDoDocumento {
  chave: ChaveClausula;
  titulo: string;
  /** Parágrafos do corpo. Linha vazia é linha vazia — o modelo tem ar entre os blocos. */
  paragrafos: string[];
}

export interface ContratoDocumento {
  modelo: ModeloContrato;
  titulo: string;
  /**
   * O título do documento: o nome do arquivo e o cabeçalho de cada página
   * (11/11/2026). "Projeto – Item – Fornecedor – Contrato (01) em 10/11/26".
   */
  tituloDocumento: string;
  /** "OS 0031/26" — o modelo amarra o contrato ao número da OS, não ao nome do projeto. */
  os: string;
  /** "21 de setembro de 2026" */
  data: string;
  contratante: ParteContrato;
  contratado: ParteContrato;
  clausulas: ClausulaDoDocumento[];
  fecho: string;
  /** "Belo Horizonte, 21 de setembro de 2026." */
  cidadeData: string;
  assinaturas: { papel: string; nome: string }[];
  testemunhas: { nome: string; cpf: string }[];
}

/* ------------------------------ utilidades ------------------------------ */

/** "2026-09-21" → "21 de setembro de 2026". Data vazia não inventa o dia de hoje. */
export function dataPorExtenso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return "";
  const [, ano, mes, dia] = m;
  const nome = MESES[Number(mes) - 1];
  if (!nome) return "";
  return `${dia} de ${nome.toLowerCase()} de ${ano}`;
}

const RE_PARTES = /(CONTRATANTE|CONTRATADO\s*\(A\)|CONTRATADA|CONTRATADO)/g;

/** Os nomes das partes em negrito, onde quer que apareçam. */
function destacarPartes(texto: string): { texto: string; forte: boolean }[] {
  const saida: { texto: string; forte: boolean }[] = [];
  let fim = 0;
  RE_PARTES.lastIndex = 0;
  for (let m = RE_PARTES.exec(texto); m; m = RE_PARTES.exec(texto)) {
    if (m.index > fim) saida.push({ texto: texto.slice(fim, m.index), forte: false });
    saida.push({ texto: m[0], forte: true });
    fim = m.index + m[0].length;
  }
  if (fim < texto.length) saida.push({ texto: texto.slice(fim), forte: false });
  return saida;
}

/**
 * Quebra um texto em pedaços, para o gerador dar negrito no que é negrito.
 *
 * Duas fontes de negrito: o que vem entre `**dois asteriscos**` no texto, e os
 * nomes das partes (CONTRATANTE, CONTRATADO(A)) em qualquer lugar. Asteriscos
 * desbalanceados — um número ímpar deles — são ignorados e removidos, para um
 * texto mal editado não sair com a metade do contrato em negrito.
 *
 * A ordem das alternativas na expressão das partes importa: "CONTRATADO(A)"
 * precisa ser testado antes de "CONTRATADO", senão o "(A)" ficaria fora.
 */
export function partirEmDestaques(texto: string): { texto: string; forte: boolean }[] {
  const pedacos = texto.split("**");
  if (pedacos.length % 2 === 0) {
    const limpo = pedacos.join("");
    const so = destacarPartes(limpo);
    return so.length ? so : [{ texto: limpo, forte: false }];
  }
  const saida: { texto: string; forte: boolean }[] = [];
  pedacos.forEach((trecho, i) => {
    if (!trecho) return;
    if (i % 2 === 1) saida.push({ texto: trecho, forte: true });
    else saida.push(...destacarPartes(trecho));
  });
  return saida.length ? saida : [{ texto, forte: false }];
}

const linhas = (t: string): string[] => (t ?? "").split("\n");

/* ------------------------ a estrutura de cada cláusula ------------------------ */

/**
 * Um pedaço do corpo de uma cláusula, já com a função que ele tem na página.
 *
 * As cláusulas são texto corrido — campos que a casa edita —, e o documento que
 * sai delas ficava todo igual: subtítulo, lista e parágrafo no mesmo peso. Quem
 * lê um contrato procura o que foi contratado, quanto custa e o que cada parte
 * deve, e a página precisa mostrar onde cada uma está.
 *
 * Isto é só LEITURA do texto que já existe: nada é acrescentado, nenhuma palavra
 * do contrato muda. O que o texto não deixa claro cai em `texto`.
 */
export type BlocoClausula =
  /** `antes`: ar a mais acima — o texto que vem depois de uma lista, separado dela por linha em branco. */
  | { tipo: "texto"; texto: string; antes?: boolean }
  /** Cabeçalho de uma parte da cláusula ("DESCRITIVO DOS SERVIÇOS…:", "São obrigações do(a) …:"). */
  | { tipo: "subtitulo"; texto: string }
  /** Item de lista — as obrigações de cada parte, ou a linha que começa com "- ". */
  | { tipo: "item"; texto: string };

const ehSubtitulo = (linha: string, chave: ChaveClausula): boolean => {
  const t = linha.trim();
  if (/^São obrigações d[oa]\(a\) .*:$/.test(t)) return chave === "obrigacoes";
  // Tudo em maiúsculas e terminado em dois-pontos: "VALORES E FORMA DE PAGAMENTO:".
  return t.length > 3 && t.endsWith(":") && t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t);
};

/**
 * Cláusulas em que TODO parágrafo é um item com bullet (12/11/2026): a Marisa
 * marcou, uma a uma, a falta do bullet no caput e nos "Parágrafo Único/Primeiro/
 * Segundo/Terceiro". A Primeira (o objeto) tem estrutura própria e a Segunda já
 * é lista.
 */
const COM_BULLET: ChaveClausula[] = ["vigencia", "inexecucao", "confidencialidade", "finais", "foro"];

export function blocosDaClausula(chave: ChaveClausula, paragrafos: string[]): BlocoClausula[] {
  const saida: BlocoClausula[] = [];
  const tudoEmItem = COM_BULLET.includes(chave);
  /** Depois de "São obrigações…:", o que vem até a linha em branco seguinte é lista. */
  let emLista = false;
  let listaComecou = false;
  let aposBranco = false;

  for (const bruta of paragrafos) {
    const linha = bruta.trim();
    if (!linha) {
      // A primeira linha em branco logo após o cabeçalho não encerra a lista.
      if (emLista && listaComecou) emLista = false;
      aposBranco = true;
      continue;
    }
    const anterior = saida[saida.length - 1];
    const respiro = aposBranco && anterior?.tipo === "item";
    aposBranco = false;

    if (ehSubtitulo(linha, chave)) {
      saida.push({ tipo: "subtitulo", texto: linha });
      emLista = chave === "obrigacoes" && /^São obrigações/.test(linha);
      listaComecou = false;
      continue;
    }

    const marcado = /^[-•–]\s+(.*)$/.exec(linha);
    if (marcado) {
      saida.push({ tipo: "item", texto: marcado[1] });
      continue;
    }

    if (emLista || tudoEmItem) {
      listaComecou = true;
      saida.push({ tipo: "item", texto: linha });
      continue;
    }
    saida.push(respiro ? { tipo: "texto", texto: linha, antes: true } : { tipo: "texto", texto: linha });
  }
  return saida;
}

/* --------------------------- a Cláusula Primeira -------------------------- */

/**
 * A referência curta da OS para a caixa do título ("OS (01)"). O número da OS
 * é, no sistema, o título inteiro ("Projeto – Item – Fornecedor – OS (01) em
 * 09 11 26"), que não cabe numa linha: fica só a versão. Número num formato
 * antigo ("0031/26") segue como está.
 */
export function referenciaDaOs(numero: string): string {
  const m = /OS\s*\((\d+)\)/i.exec(numero ?? "");
  return m ? `(${m[1]})` : (numero ?? "");
}

/** A quantidade do contrato; sem valor, 1. */
export const quantidadeDoContrato = (ct: Pick<Os["contrato"], "quantidade">): number =>
  ct.quantidade && ct.quantidade > 0 ? ct.quantidade : 1;

/** "01", "02"…; quantidade fracionada sai com vírgula. */
const doisDigitos = (n: number) => (Number.isInteger(n) ? String(n).padStart(2, "0") : String(n).replace(".", ","));

/**
 * O corpo da Cláusula Primeira — a única que o sistema monta com dados da OS.
 *
 * A ordem é a da "Solicitação de Revisão" de 11/11/2026: a abertura (no Cultural,
 * nomeando o projeto incentivado, a lei e o código; no Corporativo, o projeto),
 * o descritivo e as informações complementares, os valores em lista, a
 * identificação do projeto em caixa alta, e por fim "Valores e forma de pagamento".
 */
function corpoDoObjeto(os: Os, modelo: ModeloContrato, intro: string, projetoCompleto: string): string[] {
  const f = os.financeiro;
  const ct = os.contrato;
  // Do bloco Dados para Contrato, com o faturamento e os Dados Gerais de reserva.
  const inc = incentivoDoContrato(os);
  const projeto = inc.projetoIncentivado;
  const lei = inc.leiIncentivo;
  const codigo = inc.codigoProjetoIncentivado;
  // "OBJETO:" é título fixo das duas versões (12/11/2026).
  const out: string[] = [intro, "", "OBJETO:", ""];
  // O nome COMPLETO do projeto — "Cliente – Projeto Ano", entre aspas e em caixa
  // alta — é o que o Corporativo cita no objeto e na linha que o identifica.
  const nomeProjeto = projetoCompleto ? `“${projetoCompleto.toUpperCase()}”` : "";

  if (modelo === "Corporativo") {
    out.push(
      `O objeto do presente é a viabilização do projeto ${nomeProjeto || "(nome do projeto não informado)"}, ` +
        "cuja gestão é de responsabilidade do(a) CONTRATANTE, sendo:",
      ""
    );
  }

  if (modelo === "Cultural") {
    out.push(
      `O objeto do presente é a viabilização do projeto ${projeto || "(projeto incentivado não informado)"}, ` +
        "inscrito e aprovado perante as instâncias competentes da administração pública, no âmbito da " +
        `${lei || "(lei de incentivo não informada)"}, sob o ${codigo || "(código do projeto não informado)"}, ` +
        "de autoria do(a) CONTRATANTE, sendo:",
      ""
    );
  }

  out.push("DESCRITIVO DOS SERVIÇOS E/OU PRODUTOS:", "");
  const descritivo = (ct.descritivoServicos || f.descritivoNf || "").trim();
  out.push(...(descritivo ? linhas(descritivo) : ["(descritivo não informado)"]));

  const complementares = (ct.informacoesComplementares ?? "").trim();
  if (complementares) out.push("", ...linhas(complementares));

  out.push(
    "",
    `- Valor unitário: ${brl(ct.valorUnitario)}`,
    `- Quantidade: ${doisDigitos(quantidadeDoContrato(ct))}`,
    `- Valor total: ${brl(ct.valorTotal)}`,
    `- Desconto Especial Negociado: ${brl(ct.descontoNegociado)}`,
    `- **Valor Total a Pagar: ${brl(ct.valorAPagar)}**`
  );

  // A linha que identifica o projeto junto do que foi contratado, em negrito e
  // caixa alta: no Cultural, o projeto incentivado, a lei e o código separados
  // por hífen; no Corporativo, o nome do projeto.
  const identificacao = modelo === "Cultural" ? [projeto, lei, codigo].filter(Boolean).join(" - ").toUpperCase() : nomeProjeto;
  if (identificacao) out.push("", `**${identificacao}**`);

  out.push(
    "",
    "VALORES E FORMA DE PAGAMENTO:",
    "",
    `**Valor Total a Pagar: ${brl(ct.valorAPagar)}**`,
    `**Forma de Pagamento:** ${(ct.formaPagamento ?? "").trim() || "(não informada)"}`,
    "",
    (ct.observacoesGerais ?? "").trim() || RESSALVA_VALORES
  );
  return out;
}

/* -------------------------------- montagem ------------------------------- */

export interface ContextoContrato {
  cliente: Cliente;
  empresas: EmpresaGrupo[];
  /** As testemunhas fixas da casa (Configurações). Sem isto, as padrão. */
  testemunhas?: TestemunhaFixa[];
  /** O título do documento (nome do arquivo e cabeçalho). Sem isto, o número da OS. */
  titulo?: string;
}

/**
 * O contrato desta OS, pronto para ser desenhado.
 *
 * `empresas` e `cliente` entram porque o CONTRATANTE é o tomador do serviço, e
 * quem sabe resolver "tomador" em razão social é `domain/tomadorOs` — o mesmo
 * lugar de onde a OS impressa e a tela tiram a resposta.
 */
export function montarContrato(os: Os, { cliente, empresas, testemunhas, titulo }: ContextoContrato): ContratoDocumento {
  const modelo = os.contrato.modelo || modeloDoContrato(os.projeto.modalidade);
  const tomador: DadosTomador | null = dadosDoTomador(os.contrato.contratante || os.financeiro.tomador, {
    cliente,
    empresas,
    avulso: os.financeiro.tomadorAvulso,
  });

  const contratante: ParteContrato = {
    papel: "CONTRATANTE",
    razaoSocial: formatarRazaoSocial(tomador?.razaoSocial ?? ""),
    cnpjCpf: formatarCnpjCpf(tomador?.cnpjCpf ?? ""),
    inscricaoEstadual: formatarInscricaoEstadual(tomador?.inscricaoEstadual ?? ""),
    telefone: formatarTelefone(tomador?.telefone ?? ""),
    endereco: tomador?.endereco ?? "",
  };
  const contratado: ParteContrato = {
    papel: "CONTRATADO (A)",
    razaoSocial: formatarRazaoSocial(os.fornecedor.razaoSocial),
    cnpjCpf: formatarCnpjCpf(os.fornecedor.cnpj),
    inscricaoEstadual: formatarInscricaoEstadual(os.fornecedor.inscricaoEstadual),
    telefone: formatarTelefone(os.fornecedor.telefone),
    endereco: os.fornecedor.endereco,
  };

  const projetoCompleto =
    os.projeto.nomeProjeto || os.projeto.titulo ? nomeCompletoDoProjeto(os.projeto, cliente, os.contrato.dataContrato) : "";
  const editados = os.contrato.clausulas;
  const clausulas = clausulasPadrao(modelo).map((c): ClausulaDoDocumento => {
    const texto = textoDaClausula(editados, c);
    return {
      chave: c.chave,
      titulo: c.titulo,
      paragrafos: c.chave === "objeto" ? corpoDoObjeto(os, modelo, texto, projetoCompleto) : linhas(texto),
    };
  });

  const cidade = (os.contrato.cidade ?? "").trim() || "Belo Horizonte";
  const data = dataPorExtenso(os.contrato.dataContrato);

  // As testemunhas são FIXAS (11/11/2026) e editáveis em Configurações; o que
  // foi digitado numa OS antiga continua valendo para ela.
  const fixas = testemunhas?.length ? testemunhas : TESTEMUNHAS_PADRAO;
  const daOs = [os.contrato.testemunha1, os.contrato.testemunha2];
  const testemunhasDoContrato = [0, 1].map((i) => {
    const propria = daOs[i];
    if (propria && (propria.nome?.trim() || propria.cpf?.trim())) return { nome: propria.nome ?? "", cpf: propria.cpf ?? "" };
    const fixa = fixas[i] ?? { nome: "", cpf: "" };
    return { nome: fixa.nome, cpf: fixa.cpf };
  });

  return {
    modelo,
    titulo: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
    tituloDocumento: titulo || `Contrato OS ${os.numero}`,
    os: referenciaDaOs(os.numero),
    data,
    contratante,
    contratado,
    clausulas,
    fecho: FECHO_CONTRATO,
    cidadeData: data ? `${cidade}, ${data}.` : `${cidade}, ____ de ____________ de ______.`,
    assinaturas: [
      { papel: "CONTRATADO (A)", nome: contratado.razaoSocial },
      { papel: "CONTRATANTE", nome: contratante.razaoSocial },
    ],
    testemunhas: testemunhasDoContrato,
  };
}
