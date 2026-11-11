import { describe, expect, it } from "vitest";
import type { Cliente, EmpresaGrupo, Os } from "@/data/types";
import {
  blocosDaClausula,
  dataPorExtenso,
  montarContrato,
  municipioDoEndereco,
  nomeArquivoContrato,
  partirEmDestaques,
} from "./contratoDocumento";
import { clausulasPadrao, modeloDoContrato, RESSALVA_VALORES } from "./contratoModelo";

const cliente = (): Cliente =>
  ({
    nome: "Banco X",
    razaoSocial: "BANCO X S.A.",
    cnpjCpf: "11.111.111/0001-11",
    endereco: "Av. do Cliente, 1 — Belo Horizonte/MG",
    inscricaoEstadual: "Isenta",
    inscricaoMunicipal: "9999",
  }) as Cliente;

const empresas = (): EmpresaGrupo[] => [
  {
    id: "polobh",
    nome: "Pólobh",
    razaoSocial: "PÓLOBH PROMOÇÕES LTDA",
    cnpj: "22.222.222/0001-22",
    endereco: "Rua da Casa, 2 — Belo Horizonte/MG",
    inscricaoEstadual: "Isenta",
    inscricaoMunicipal: "1234",
    ordem: 1,
    padrao: true,
  } as EmpresaGrupo,
];

const os = (p: Partial<Os> = {}): Os =>
  ({
    numero: "0031/26",
    fornecedor: {
      razaoSocial: "SOM E LUZ LTDA",
      nomeFantasia: "Som & Luz",
      cnpj: "33.333.333/0001-33",
      inscricaoEstadual: "Isenta",
      telefone: "(31) 99999-0000",
      endereco: "Rua do Fornecedor, 3 — Contagem/MG",
    },
    projeto: { modalidade: "Corporativo" },
    financeiro: {
      tomador: "polobh",
      descritivoNf: "Sonorização do evento",
      projetoIncentivado: "Festival de Inverno",
      leiIncentivo: "Lei Federal de Incentivo à Cultura (Rouanet)",
      codigoProjetoIncentivado: "PRONAC 26 1234",
    },
    contrato: {
      contratante: "",
      descritivoServicos: "Locação de sistema de som para o palco principal.",
      informacoesComplementares: "",
      valorUnitario: 10_000,
      valorTotal: 10_000,
      descontoNegociado: 500,
      valorAPagar: 9_500,
      formaPagamento: "À vista, no ato da emissão da nota fiscal",
      dataContrato: "2026-09-21",
      rubrica: "",
    },
    ...p,
  }) as Os;

const ctx = () => ({ cliente: cliente(), empresas: empresas() });
/**
 * O texto inteiro do contrato, com o espaço duro do "R$ 1.000,00" trocado por
 * espaço comum: o formatador de moeda usa U+00A0, e comparar com ele no teste
 * só faria a asserção falhar por um caractere que ninguém vê.
 */
const textoDe = (c: ReturnType<typeof montarContrato>) =>
  c.clausulas
    .flatMap((cl) => [cl.titulo, ...cl.paragrafos])
    .join("\n")
    .replace(/\u00a0/g, " ");

describe("qual modelo o projeto usa", () => {
  it("projeto cultural usa o modelo Cultural", () => {
    expect(modeloDoContrato("Cultural")).toBe("Cultural");
  });

  // Errar para o Corporativo é um contrato a que falta uma cláusula, e isso se
  // vê. Errar para o Cultural é um contrato que cita uma lei de incentivo que
  // aquele negócio não tem — e isso passa.
  it("projeto sem modalidade cai no Corporativo", () => {
    expect(modeloDoContrato("")).toBe("Corporativo");
    expect(modeloDoContrato("Corporativo")).toBe("Corporativo");
  });

  it("a escolha gravada na OS vence a modalidade do projeto", () => {
    const c = montarContrato(os({ contrato: { ...os().contrato, modelo: "Cultural" } }), ctx());
    expect(c.modelo).toBe("Cultural");
  });
});

describe("as sete cláusulas", () => {
  it("saem na ordem do modelo, nos dois", () => {
    for (const m of ["Corporativo", "Cultural"] as const) {
      expect(clausulasPadrao(m).map((c) => c.chave)).toEqual([
        "objeto", "obrigacoes", "vigencia", "inexecucao", "confidencialidade", "finais", "foro",
      ]);
    }
  });

  it("o Cultural acrescenta a administração dos recursos e o serviço novo", () => {
    const cult = textoDe(montarContrato(os({ projeto: { modalidade: "Cultural" } } as Partial<Os>), ctx()));
    const corp = textoDe(montarContrato(os(), ctx()));
    expect(cult).toContain("Receber e administrar os recursos financeiros");
    expect(corp).not.toContain("Receber e administrar os recursos financeiros");
    expect(cult).toContain("deverá ser objeto de novo contrato e nova remuneração");
    expect(corp).not.toContain("deverá ser objeto de novo contrato e nova remuneração");
  });

  // O texto reescrito na OS é o que vale; o campo apagado volta ao padrão, em
  // vez de deixar a cláusula em branco no documento que alguém vai assinar.
  it("cláusula reescrita vence o padrão, e cláusula apagada volta ao padrão", () => {
    const base = os();
    const c = montarContrato(
      os({ contrato: { ...base.contrato, clausulas: { foro: "Fica eleito o foro de São Paulo.", vigencia: "   " } } }),
      ctx()
    );
    const t = textoDe(c);
    expect(t).toContain("foro de São Paulo");
    expect(t).not.toContain("foro de Belo Horizonte");
    expect(t).toContain("A vigência do presente contrato terá início na data de sua assinatura");
  });
});

describe("a Cláusula Primeira", () => {
  it("o Cultural nomeia o projeto, a lei e o código", () => {
    const t = textoDe(montarContrato(os({ projeto: { modalidade: "Cultural" } } as Partial<Os>), ctx()));
    expect(t).toContain("viabilização do projeto Festival de Inverno");
    expect(t).toContain("no âmbito da Lei Federal de Incentivo à Cultura (Rouanet)");
    expect(t).toContain("sob o PRONAC 26 1234");
  });

  it("o Corporativo não cita incentivo nenhum", () => {
    const t = textoDe(montarContrato(os(), ctx()));
    expect(t).not.toContain("viabilização do projeto");
    expect(t).not.toContain("PRONAC");
  });

  it("os dois trazem o descritivo e os quatro valores", () => {
    const t = textoDe(montarContrato(os(), ctx()));
    expect(t).toContain("Locação de sistema de som para o palco principal.");
    expect(t).toContain("Valor unitário: R$ 10.000,00");
    expect(t).toContain("Desconto Negociado: R$ 500,00");
    expect(t).toContain("Valor Total a Pagar: R$ 9.500,00");
    expect(t).toContain("Forma de pagamento: À vista, no ato da emissão da nota fiscal");
  });

  // Sem descritivo, o contrato sairia com um espaço em branco onde deveria
  // estar o objeto — e o espaço em branco é o que ninguém percebe ao assinar.
  it("sem descritivo, o documento diz que ele falta", () => {
    const base = os();
    const c = montarContrato(
      os({ contrato: { ...base.contrato, descritivoServicos: "" }, financeiro: { ...base.financeiro, descritivoNf: "" } }),
      ctx()
    );
    expect(textoDe(c)).toContain("(descritivo não informado)");
  });
});

describe("as partes", () => {
  // O modelo repete, nos dois blocos, a nota "os dados do Tomador de Serviço";
  // é o bloco de assinaturas dele que desfaz o engano.
  it("CONTRATANTE é o tomador e CONTRATADO é o fornecedor", () => {
    const c = montarContrato(os(), ctx());
    expect(c.contratante.razaoSocial).toBe("PÓLOBH PROMOÇÕES LTDA");
    expect(c.contratado.razaoSocial).toBe("SOM E LUZ LTDA");
    expect(c.assinaturas.map((a) => a.nome)).toEqual(["SOM E LUZ LTDA", "PÓLOBH PROMOÇÕES LTDA"]);
  });

  it("sem contratante escolhido, segue o tomador do faturamento", () => {
    const base = os();
    const c = montarContrato(
      os({ contrato: { ...base.contrato, contratante: "" }, financeiro: { ...base.financeiro, tomador: "Cliente" } }),
      ctx()
    );
    expect(c.contratante.razaoSocial).toBe("BANCO X S.A.");
  });

  it("o contratante escolhido no contrato vence o tomador da nota", () => {
    const base = os();
    const c = montarContrato(
      os({ contrato: { ...base.contrato, contratante: "Cliente" }, financeiro: { ...base.financeiro, tomador: "polobh" } }),
      ctx()
    );
    expect(c.contratante.razaoSocial).toBe("BANCO X S.A.");
  });
});

describe("cidade, data e testemunhas", () => {
  it("a data sai por extenso", () => {
    expect(dataPorExtenso("2026-09-21")).toBe("21 de setembro de 2026");
    expect(montarContrato(os(), ctx()).cidadeData).toBe("Belo Horizonte, 21 de setembro de 2026.");
  });

  // Data vazia não pode virar "hoje": o contrato é datado do dia em que a OS
  // saiu, e um documento que se redata sozinho a cada download não confere.
  it("sem data, deixa a linha para preencher à mão", () => {
    const base = os();
    const c = montarContrato(os({ contrato: { ...base.contrato, dataContrato: "" } }), ctx());
    expect(dataPorExtenso("")).toBe("");
    expect(c.cidadeData).toContain("____");
  });

  it("a cidade da assinatura é editável", () => {
    const base = os();
    const c = montarContrato(os({ contrato: { ...base.contrato, cidade: "São Paulo" } }), ctx());
    expect(c.cidadeData).toBe("São Paulo, 21 de setembro de 2026.");
  });

  it("as duas testemunhas saem sempre, preenchidas ou não", () => {
    const base = os();
    const c = montarContrato(
      os({ contrato: { ...base.contrato, testemunha1: { nome: "Ana", cpf: "000.000.000-00" } } }),
      ctx()
    );
    expect(c.testemunhas).toHaveLength(2);
    expect(c.testemunhas[0]).toEqual({ nome: "Ana", cpf: "000.000.000-00" });
    expect(c.testemunhas[1]).toEqual({ nome: "", cpf: "" });
  });
});

describe("negrito das partes no corpo da cláusula", () => {
  it("destaca CONTRATANTE e CONTRATADO(A), e só eles", () => {
    const partes = partirEmDestaques("São obrigações do(a) CONTRATADO(A): pagar ao CONTRATANTE o devido.");
    expect(partes.filter((x) => x.forte).map((x) => x.texto)).toEqual(["CONTRATADO(A)", "CONTRATANTE"]);
    expect(partes.map((x) => x.texto).join("")).toBe(
      "São obrigações do(a) CONTRATADO(A): pagar ao CONTRATANTE o devido."
    );
  });

  it("texto sem as partes sai inteiro, sem negrito", () => {
    expect(partirEmDestaques("Fica eleito o foro de Belo Horizonte.")).toEqual([
      { texto: "Fica eleito o foro de Belo Horizonte.", forte: false },
    ]);
  });
});

describe("nome do arquivo", () => {
  it("a barra da numeração não vai para o nome do arquivo", () => {
    expect(nomeArquivoContrato(os())).toBe("Contrato 0031-26 Som & Luz.docx");
  });
});

describe("a linha Municipio do modelo", () => {
  it("sai do endereço, quando ele traz cidade e UF", () => {
    expect(municipioDoEndereco("Rua X, 123 - Centro - Belo Horizonte - MG - CEP: 30000-000")).toBe(
      "Belo Horizonte - MG"
    );
    const c = montarContrato(os(), ctx());
    expect(c.contratado.municipio).toBe("");
  });

  // Endereço fora do formato não pode virar palpite: melhor a linha em branco,
  // que alguém completa à mão, do que a cidade errada num documento assinado.
  it("endereço sem UF deixa a linha em branco", () => {
    expect(municipioDoEndereco("Rua sem cidade, 10")).toBe("");
    expect(municipioDoEndereco("")).toBe("");
    expect(municipioDoEndereco("MG")).toBe("");
  });
});

describe("a estrutura de cada cláusula (formatação do Word)", () => {
  const blocos = (chave: Parameters<typeof blocosDaClausula>[0], linhas: string[]) => blocosDaClausula(chave, linhas);

  it("os quatro valores do objeto viram uma tabela, e o resto fica à parte", () => {
    const b = blocos("objeto", [
      "Valor unitário: R$ 10.000,00",
      "Valor Total: R$ 10.000,00",
      "Desconto Negociado: R$ 500,00",
      "Valor Total a Pagar: R$ 9.500,00",
      "",
      "VALORES E FORMA DE PAGAMENTO:",
      "",
      "Valor total a pagar: R$ 9.500,00",
      "Forma de pagamento: À vista",
      "",
      RESSALVA_VALORES,
    ]);
    expect(b[0]).toEqual({
      tipo: "valores",
      linhas: [
        { rotulo: "Valor unitário", valor: "R$ 10.000,00" },
        { rotulo: "Valor Total", valor: "R$ 10.000,00" },
        { rotulo: "Desconto Negociado", valor: "R$ 500,00" },
        { rotulo: "Valor Total a Pagar", valor: "R$ 9.500,00" },
      ],
    });
    expect(b[1]).toEqual({ tipo: "subtitulo", texto: "VALORES E FORMA DE PAGAMENTO:" });
    expect(b[2]).toEqual({ tipo: "campo", rotulo: "Valor total a pagar", valor: "R$ 9.500,00" });
    expect(b[3]).toEqual({ tipo: "campo", rotulo: "Forma de pagamento", valor: "À vista" });
    expect(b[4]).toEqual({ tipo: "nota", texto: RESSALVA_VALORES });
  });

  it("nas obrigações, o que vem depois de 'São obrigações…:' é lista; a declaração segue parágrafo", () => {
    const [obrigacoes] = clausulasPadrao("Corporativo").filter((c) => c.chave === "obrigacoes");
    const b = blocos("obrigacoes", obrigacoes.padrao.split("\n"));
    const tipos = b.map((x) => x.tipo);
    expect(tipos).toEqual([
      "subtitulo", "item", "item", // CONTRATADO(A): fornecer + notas
      "texto", "texto",            // a declaração trabalhista e a autuação
      "subtitulo", "item", "item", // CONTRATANTE: pagar + condições
    ]);
  });

  it("o Cultural tem um item a mais nas obrigações do CONTRATANTE", () => {
    const [obrigacoes] = clausulasPadrao("Cultural").filter((c) => c.chave === "obrigacoes");
    const itens = blocos("obrigacoes", obrigacoes.padrao.split("\n")).filter((x) => x.tipo === "item");
    expect(itens).toHaveLength(5);
  });

  it("nenhuma palavra do contrato se perde na classificação", () => {
    for (const m of ["Corporativo", "Cultural"] as const) {
      for (const c of clausulasPadrao(m)) {
        const original = c.padrao.split("\n").filter((l) => l.trim());
        const depois = blocos(c.chave, c.padrao.split("\n")).map((x) =>
          x.tipo === "valores" ? x.linhas.map((l) => `${l.rotulo}: ${l.valor}`).join("\n")
          : x.tipo === "campo" ? `${x.rotulo}: ${x.valor}`
          : x.texto
        );
        expect(depois.join("\n")).toBe(original.join("\n"));
      }
    }
  });

  it("linha com '- ' no descritivo vira item, sem o traço", () => {
    expect(blocos("objeto", ["Locação de som", "- Line array", "- Mesa digital"])).toEqual([
      { tipo: "texto", texto: "Locação de som" },
      { tipo: "item", texto: "Line array" },
      { tipo: "item", texto: "Mesa digital" },
    ]);
  });

  it("fora das obrigações, um texto que termina em dois-pontos não vira lista", () => {
    const b = blocos("vigencia", ["Ficam acordadas as seguintes condições:", "A primeira condição."]);
    expect(b.map((x) => x.tipo)).toEqual(["texto", "texto"]);
  });
});
