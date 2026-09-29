/**
 * O CONTRATO como estrutura — antes de virar Word.
 *
 * O gerador de .docx (`lib/docx/contrato`) só sabe desenhar: caixa cinza,
 * parágrafo, linha de assinatura. Quem decide O QUE entra em cada lugar é este
 * módulo, e ele é função pura da OS — por isso o que o fornecedor vai assinar
 * pode ser conferido em teste, sem abrir o Word.
 *
 * A divisão que o modelo da Pólobh pede está em `contratoModelo`: o que o
 * sistema lança sozinho, e o que fica editável. Aqui isso vira lista de
 * parágrafos: os automáticos montados da OS, os editáveis lidos do contrato.
 *
 * NEGRITO: o modelo destaca "CONTRATANTE" e "CONTRATADO(A)" toda vez que as
 * palavras aparecem no corpo das cláusulas. Como as cláusulas são campos de
 * texto — e um campo de texto não guarda negrito —, quem devolve o destaque é
 * `partirEmDestaques`, na hora de escrever o documento. É regra fixa e não
 * inventa ênfase: só estas duas palavras, e só quando aparecem inteiras.
 */
import type { Cliente, EmpresaGrupo, Os } from "@/data/types";
import { brl } from "@/lib/format";
import { MESES } from "@/domain/calendario";
import { dadosDoTomador, type DadosTomador } from "@/domain/tomadorOs";
import {
  clausulasPadrao,
  FECHO_CONTRATO,
  modeloDoContrato,
  RESSALVA_VALORES,
  textoDaClausula,
  type ChaveClausula,
  type ModeloContrato,
} from "@/domain/contratoModelo";

/** Uma das duas partes, como sai na qualificação do alto do contrato. */
export interface ParteContrato {
  papel: "CONTRATANTE" | "CONTRATADO (A)";
  razaoSocial: string;
  cnpjCpf: string;
  inscricaoEstadual: string;
  telefone: string;
  endereco: string;
  municipio: string;
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

/**
 * Quebra um texto nos nomes das partes, para o gerador dar negrito neles.
 *
 * Devolve pedaços em ordem; `forte` marca o que sai em negrito. A ordem das
 * alternativas na expressão importa: "CONTRATADO(A)" precisa ser testado antes
 * de "CONTRATADO", senão o "(A)" ficaria fora do destaque.
 */
export function partirEmDestaques(texto: string): { texto: string; forte: boolean }[] {
  const re = /(CONTRATANTE|CONTRATADO\s*\(A\)|CONTRATADA|CONTRATADO)/g;
  const saida: { texto: string; forte: boolean }[] = [];
  let fim = 0;
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    if (m.index > fim) saida.push({ texto: texto.slice(fim, m.index), forte: false });
    saida.push({ texto: m[0], forte: true });
    fim = m.index + m[0].length;
  }
  if (fim < texto.length) saida.push({ texto: texto.slice(fim), forte: false });
  return saida.length ? saida : [{ texto, forte: false }];
}

const linhas = (t: string): string[] => (t ?? "").split("\n");

/**
 * "Belo Horizonte - MG", a partir do endereço completo.
 *
 * O modelo tem a linha "Municipio:" separada, e o sistema guarda o endereço
 * inteiro num campo só — é assim que a consulta de CNPJ o devolve
 * ("Rua X, 123 - Bairro - Belo Horizonte - MG - CEP: 30000-000"). Em vez de
 * pedir a cidade de novo num campo novo, ela é lida do que já está lá: o par
 * cidade + UF é o único trecho do endereço com duas letras maiúsculas
 * sozinhas. Quando o endereço não segue esse formato — foi digitado à mão de
 * outro jeito —, a linha sai em branco, para ser completada à mão, e não com
 * um palpite errado no documento que alguém assina.
 */
export function municipioDoEndereco(endereco: string): string {
  const partes = (endereco ?? "").split(" - ").map((x) => x.trim()).filter(Boolean);
  const i = partes.findIndex((x) => /^[A-Z]{2}$/.test(x));
  if (i <= 0) return "";
  return `${partes[i - 1]} - ${partes[i]}`;
}

/* --------------------------- a Cláusula Primeira -------------------------- */

/**
 * O corpo da Cláusula Primeira — a única que o sistema monta com dados da OS.
 *
 * O Cultural abre nomeando o projeto incentivado, a lei e o código, porque é
 * disso que depende a prestação de contas do incentivo. O Corporativo não tem
 * o quê nomear, e entra direto no descritivo. Do descritivo em diante os dois
 * são iguais: o que foi contratado, e por quanto.
 */
function corpoDoObjeto(os: Os, modelo: ModeloContrato, intro: string): string[] {
  const f = os.financeiro;
  const ct = os.contrato;
  const projeto = (f.projetoIncentivado ?? "").trim();
  const lei = (f.leiIncentivo ?? "").trim();
  const codigo = (f.codigoProjetoIncentivado ?? "").trim();
  const out: string[] = [intro, ""];

  if (modelo === "Cultural") {
    out.push(
      `O objeto do presente é a viabilização do projeto ${projeto || "(projeto incentivado não informado)"}, ` +
        "inscrito e aprovado perante as instâncias competentes da administração pública, no âmbito da " +
        `${lei || "(lei de incentivo não informada)"}, sob o ${codigo || "(código do projeto não informado)"} ` +
        "de autoria do(a) CONTRATANTE, sendo",
      ""
    );
  }

  out.push("DESCRITIVO DOS SERVIÇOS E/OU PRODUTOS:", "");
  const descritivo = (ct.descritivoServicos || f.descritivoNf || "").trim();
  out.push(...(descritivo ? linhas(descritivo) : ["(descritivo não informado)"]));

  const complementares = (ct.informacoesComplementares ?? "").trim();
  if (complementares) out.push("", ...linhas(complementares));

  if (modelo === "Cultural") {
    // A linha que identifica o incentivo junto do que foi contratado. No modelo
    // ela vem escrita como três campos somados; aqui eles se juntam com travessão.
    const identificacao = [projeto, lei, codigo].filter(Boolean).join(" — ");
    if (identificacao) out.push("", identificacao);
  }

  out.push(
    "",
    `Valor unitário: ${brl(ct.valorUnitario)}`,
    `Valor Total: ${brl(ct.valorTotal)}`,
    `Desconto Negociado: ${brl(ct.descontoNegociado)}`,
    `Valor Total a Pagar: ${brl(ct.valorAPagar)}`,
    "",
    "VALORES E FORMA DE PAGAMENTO:",
    "",
    `Valor total a pagar: ${brl(ct.valorAPagar)}`,
    `Forma de pagamento: ${(ct.formaPagamento ?? "").trim() || "(não informada)"}`,
    "",
    RESSALVA_VALORES
  );
  return out;
}

/* -------------------------------- montagem ------------------------------- */

/**
 * O contrato desta OS, pronto para ser desenhado.
 *
 * `empresas` e `cliente` entram porque o CONTRATANTE é o tomador do serviço, e
 * quem sabe resolver "tomador" em razão social é `domain/tomadorOs` — o mesmo
 * lugar de onde a OS impressa e a tela tiram a resposta.
 */
export function montarContrato(
  os: Os,
  { cliente, empresas }: { cliente: Cliente; empresas: EmpresaGrupo[] }
): ContratoDocumento {
  const modelo = os.contrato.modelo || modeloDoContrato(os.projeto.modalidade);
  const tomador: DadosTomador | null = dadosDoTomador(
    os.contrato.contratante || os.financeiro.tomador,
    { cliente, empresas, avulso: os.financeiro.tomadorAvulso }
  );

  const contratante: ParteContrato = {
    papel: "CONTRATANTE",
    razaoSocial: tomador?.razaoSocial ?? "",
    cnpjCpf: tomador?.cnpjCpf ?? "",
    inscricaoEstadual: tomador?.inscricaoEstadual ?? "",
    telefone: "",
    endereco: tomador?.endereco ?? "",
    municipio: municipioDoEndereco(tomador?.endereco ?? ""),
  };
  const contratado: ParteContrato = {
    papel: "CONTRATADO (A)",
    razaoSocial: os.fornecedor.razaoSocial,
    cnpjCpf: os.fornecedor.cnpj,
    inscricaoEstadual: os.fornecedor.inscricaoEstadual,
    telefone: os.fornecedor.telefone,
    endereco: os.fornecedor.endereco,
    municipio: municipioDoEndereco(os.fornecedor.endereco),
  };

  const editados = os.contrato.clausulas;
  const clausulas = clausulasPadrao(modelo).map((c): ClausulaDoDocumento => {
    const texto = textoDaClausula(editados, c);
    return {
      chave: c.chave,
      titulo: c.titulo,
      paragrafos: c.chave === "objeto" ? corpoDoObjeto(os, modelo, texto) : linhas(texto),
    };
  });

  const cidade = (os.contrato.cidade ?? "").trim() || "Belo Horizonte";
  const data = dataPorExtenso(os.contrato.dataContrato);

  return {
    modelo,
    titulo: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
    os: os.numero,
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
    testemunhas: [
      { nome: os.contrato.testemunha1?.nome ?? "", cpf: os.contrato.testemunha1?.cpf ?? "" },
      { nome: os.contrato.testemunha2?.nome ?? "", cpf: os.contrato.testemunha2?.cpf ?? "" },
    ],
  };
}

/**
 * O nome do arquivo que o fornecedor recebe.
 *
 * Mesmo padrão do resto do sistema: o que identifica vem primeiro, e a barra da
 * numeração da OS não pode ir para um nome de arquivo.
 */
export const nomeArquivoContrato = (os: Os): string =>
  `Contrato ${os.numero.replace(/\//g, "-")} ${os.fornecedor.nomeFantasia || os.fornecedor.razaoSocial}`
    .trim()
    .replace(/\s+/g, " ") + ".docx";
