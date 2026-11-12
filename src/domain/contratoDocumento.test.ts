import { describe, expect, it } from "vitest";
import type { Cliente, EmpresaGrupo, Os } from "@/data/types";
import {
  blocosDaClausula,
  dataPorExtenso,
  montarContrato,
  partirEmDestaques,
  quantidadeDoContrato,
} from "./contratoDocumento";
import { clausulasPadrao, FECHO_CONTRATO, modeloDoContrato, RESSALVA_VALORES } from "./contratoModelo";

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
    razaoSocial: "Polobh Promoções LTDA",
    cnpj: "07128230000180",
    endereco: "Av. Aggeo Pio Sobrinho, 265 - Buritis, Belo Horizonte - MG, 30575-834",
    inscricaoEstadual: "003007740.00-11",
    inscricaoMunicipal: "1234",
    telefone: "(31) 3333-0000",
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
      endereco: "Rua do Fornecedor, 3 - Centro - Contagem - MG",
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

  it("os títulos novos da revisão de 11/11/2026", () => {
    const t = clausulasPadrao("Cultural").map((c) => c.titulo);
    expect(t[2]).toBe("CLÁUSULA TERCEIRA: DA VIGÊNCIA E DA RESCISÃO");
    expect(t[5]).toBe("CLÁUSULA SEXTA: DAS DISPOSIÇÕES GERAIS");
  });

  it("Cultural e Corporativo têm as mesmas cláusulas; o Cultural só acrescenta a lei de incentivo", () => {
    const cult = textoDe(montarContrato(os({ projeto: { modalidade: "Cultural" } } as Partial<Os>), ctx()));
    const corp = textoDe(montarContrato(os(), ctx()));
    // gestão dos recursos e serviços adicionais valem para os dois (modelo da Marisa, 12/11/2026)
    for (const t of [cult, corp]) {
      expect(t).toContain("Receber e gerir os recursos financeiros");
      expect(t).toContain("**Serviços Adicionais:**");
    }
    expect(cult).toContain("em conformidade com a legislação de incentivo à cultura aplicável;");
    expect(corp).toContain("em conformidade com a legislação aplicável;");
    expect(cult).toContain("relacionado ao Projeto Cultural não previsto");
    expect(corp).toContain("relacionado ao Projeto não previsto");
    expect(cult).toContain("Legislação de Incentivo à Cultura");
    expect(corp).not.toContain("Legislação de Incentivo à Cultura");
    // no Corporativo, as notas seguem as instruções do CONTRATANTE
    expect(corp).toContain("em conformidade com as instruções fornecidas pelo(a) CONTRATANTE, por meio das quais serão efetuados os pagamentos ao(à) CONTRATADO(A)");
  });

  it("os textos novos: parágrafos nomeados e prazo de confidencialidade", () => {
    const t = textoDe(montarContrato(os(), ctx()));
    expect(t).toContain("**Parágrafo Único**");
    expect(t).toContain("**Parágrafo Primeiro**");
    expect(t).toContain("**Parágrafo Segundo**");
    expect(t).toContain("**Parágrafo Terceiro**");
    expect(t).toContain("pelo prazo de 5 (cinco) anos");
    expect(t).toContain("foro da Comarca de Belo Horizonte, Estado de Minas Gerais");
    expect(t).not.toContain("[5 (cinco)]");
  });

  it("o fecho é o da assinatura eletrônica", () => {
    expect(montarContrato(os(), ctx()).fecho).toBe(FECHO_CONTRATO);
    expect(FECHO_CONTRATO).toContain("por meio eletrônico");
    expect(FECHO_CONTRATO).toContain("Lei nº 14.063/2020");
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
    expect(t).not.toContain("foro da Comarca de Belo Horizonte");
    expect(t).toContain("O presente contrato entrará em vigor na data de sua assinatura");
  });
});

describe("a Cláusula Primeira", () => {
  const cultural = () => montarContrato(os({ projeto: { modalidade: "Cultural" } } as Partial<Os>), ctx());

  it("o Cultural nomeia o projeto, a lei e o código — com vírgula depois do código e dois-pontos no fim", () => {
    const t = textoDe(cultural());
    expect(t).toContain("viabilização do projeto Festival de Inverno");
    expect(t).toContain("no âmbito da Lei Federal de Incentivo à Cultura (Rouanet)");
    expect(t).toContain("sob o PRONAC 26 1234, de autoria do(a) CONTRATANTE, sendo:");
  });

  it("o Corporativo cita o projeto e a gestão do CONTRATANTE, sem lei de incentivo", () => {
    const base = os();
    const t = textoDe(montarContrato(os({ projeto: { modalidade: "Corporativo", nomeProjeto: "Convenção Anual" } } as Partial<Os>), ctx()));
    expect(t).toContain("O objeto do presente é a viabilização do projeto Convenção Anual, cuja gestão é de responsabilidade do(a) CONTRATANTE, sendo:");
    expect(t).toContain("**CONVENÇÃO ANUAL**");
    expect(t).not.toContain("PRONAC");
    expect(t).not.toContain("inscrito e aprovado");
    expect(base.projeto.modalidade).toBe("Corporativo");
  });

  it("o Corporativo sem nome de projeto avisa que falta, em vez de sair em branco", () => {
    const t = textoDe(montarContrato(os(), ctx()));
    expect(t).toContain("(nome do projeto não informado)");
  });

  it("descritivo e informações complementares, nessa ordem, com um espaço entre os dois", () => {
    const base = os();
    const c = montarContrato(
      os({ contrato: { ...base.contrato, informacoesComplementares: "Pagamento após o relatório." } }),
      ctx()
    );
    const linhas = c.clausulas[0].paragrafos;
    const i = linhas.indexOf("Locação de sistema de som para o palco principal.");
    expect(i).toBeGreaterThan(0);
    expect(linhas[i + 1]).toBe("");
    expect(linhas[i + 2]).toBe("Pagamento após o relatório.");
  });

  it("os valores saem em lista, na ordem do contrato, com o total a pagar em negrito", () => {
    const base = os();
    const t = textoDe(montarContrato(os({ contrato: { ...base.contrato, quantidade: 2 } }), ctx()));
    const ordem = [
      "- Valor unitário: R$ 10.000,00",
      "- Quantidade: 02",
      "- Valor total: R$ 10.000,00",
      "- Desconto Especial Negociado: R$ 500,00",
      "- **Valor Total a Pagar: R$ 9.500,00**",
    ].map((x) => t.indexOf(x));
    expect(ordem.every((n) => n >= 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
  });

  it("sem quantidade gravada, é 1", () => {
    expect(quantidadeDoContrato({})).toBe(1);
    expect(quantidadeDoContrato({ quantidade: 0 })).toBe(1);
    expect(quantidadeDoContrato({ quantidade: 3 })).toBe(3);
  });

  it("a identificação do incentivo: os três dados com hífen, em negrito e caixa alta, depois dos valores", () => {
    const t = textoDe(cultural());
    const id = "**FESTIVAL DE INVERNO - LEI FEDERAL DE INCENTIVO À CULTURA (ROUANET) - PRONAC 26 1234**";
    expect(t).toContain(id);
    expect(t.indexOf(id)).toBeGreaterThan(t.indexOf("- **Valor Total a Pagar"));
  });

  it("Valores e forma de pagamento: total em negrito, forma com o rótulo em negrito e as observações gerais", () => {
    const base = os();
    const t = textoDe(montarContrato(os({ contrato: { ...base.contrato, observacoesGerais: "" } }), ctx()));
    expect(t).toContain("VALORES E FORMA DE PAGAMENTO:");
    expect(t).toContain("**Valor Total a Pagar: R$ 9.500,00**");
    expect(t).toContain("**Forma de Pagamento:** À vista, no ato da emissão da nota fiscal");
    expect(t).toContain(RESSALVA_VALORES);
    const outra = textoDe(montarContrato(os({ contrato: { ...base.contrato, observacoesGerais: "Texto próprio." } }), ctx()));
    expect(outra).toContain("Texto próprio.");
    expect(outra).not.toContain(RESSALVA_VALORES);
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
    expect(c.contratante.razaoSocial).toBe("Polobh Promoções Ltda.");
    expect(c.contratado.razaoSocial).toBe("SOM E LUZ Ltda.");
    expect(c.assinaturas.map((a) => a.nome)).toEqual(["SOM E LUZ Ltda.", "Polobh Promoções Ltda."]);
  });

  it("CNPJ e Inscrição Estadual saem com a pontuação completa, e o telefone e o município são lançados", () => {
    const { contratante, contratado } = montarContrato(os(), ctx());
    expect(contratante.cnpjCpf).toBe("07.128.230/0001-80");
    expect(contratante.inscricaoEstadual).toBe("003.007.740/0011");
    expect(contratante.telefone).toBe("(31) 3333-0000");
    expect(contratante.municipio).toBe("Belo Horizonte - MG");
    expect(contratado.municipio).toBe("Contagem - MG");
    expect(contratado.inscricaoEstadual).toBe("Isenta");
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

  it("as testemunhas são fixas: o Tiago e a Viviane", () => {
    const c = montarContrato(os(), ctx());
    expect(c.testemunhas).toEqual([
      { nome: "Tiago Alkimim Resende", cpf: "057.704.986-09" },
      { nome: "Viviane Barreiros dos Santos", cpf: "082.218.156-83" },
    ]);
  });

  it("as testemunhas editadas em Configurações valem para todos os contratos", () => {
    const c = montarContrato(os(), { ...ctx(), testemunhas: [{ nome: "Ana", cpf: "1" }, { nome: "Bia", cpf: "2" }] });
    expect(c.testemunhas.map((t) => t.nome)).toEqual(["Ana", "Bia"]);
  });

  it("o que foi digitado numa OS antiga continua valendo para ela", () => {
    const base = os();
    const c = montarContrato(os({ contrato: { ...base.contrato, testemunha1: { nome: "Carlos", cpf: "9" } } }), ctx());
    expect(c.testemunhas[0]).toEqual({ nome: "Carlos", cpf: "9" });
    expect(c.testemunhas[1].nome).toBe("Viviane Barreiros dos Santos");
  });
});

describe("o título do documento", () => {
  it("vem do contexto e vira o cabeçalho; sem ele, o número da OS", () => {
    expect(montarContrato(os(), { ...ctx(), titulo: "Projeto – Item – Forn – Contrato (01) em 21 09 26" }).tituloDocumento).toBe(
      "Projeto – Item – Forn – Contrato (01) em 21 09 26"
    );
    expect(montarContrato(os(), ctx()).tituloDocumento).toContain("0031/26");
  });
});

describe("negrito no corpo da cláusula", () => {
  it("destaca CONTRATANTE e CONTRATADO(A) sozinhos", () => {
    const partes = partirEmDestaques("São obrigações do(a) CONTRATADO(A): pagar ao CONTRATANTE o devido.");
    expect(partes.filter((x) => x.forte).map((x) => x.texto)).toEqual(["CONTRATADO(A)", "CONTRATANTE"]);
    expect(partes.map((x) => x.texto).join("")).toBe("São obrigações do(a) CONTRATADO(A): pagar ao CONTRATANTE o devido.");
  });

  it("texto sem as partes sai inteiro, sem negrito", () => {
    expect(partirEmDestaques("Fica eleito o foro de Belo Horizonte.")).toEqual([
      { texto: "Fica eleito o foro de Belo Horizonte.", forte: false },
    ]);
  });

  it("o que está entre dois asteriscos sai em negrito, e os asteriscos somem", () => {
    const partes = partirEmDestaques("**Parágrafo Único**. Caso a obrigação seja cumprida.");
    expect(partes).toEqual([
      { texto: "Parágrafo Único", forte: true },
      { texto: ". Caso a obrigação seja cumprida.", forte: false },
    ]);
  });

  it("negrito marcado e partes no mesmo parágrafo", () => {
    const partes = partirEmDestaques("**Tolerância e Novação:** A tolerância do(a) CONTRATANTE não é novação.");
    expect(partes.filter((x) => x.forte).map((x) => x.texto)).toEqual(["Tolerância e Novação:", "CONTRATANTE"]);
    expect(partes.map((x) => x.texto).join("")).toBe("Tolerância e Novação: A tolerância do(a) CONTRATANTE não é novação.");
  });

  // Um asterisco esquecido não pode pôr a metade do contrato em negrito.
  it("asteriscos desbalanceados são ignorados", () => {
    const partes = partirEmDestaques("Texto **sem fechar o negrito");
    expect(partes.every((x) => !x.forte)).toBe(true);
    expect(partes.map((x) => x.texto).join("")).toBe("Texto sem fechar o negrito");
  });
});

describe("a estrutura de cada cláusula", () => {
  const blocos = (chave: Parameters<typeof blocosDaClausula>[0], linhas: string[]) => blocosDaClausula(chave, linhas);

  it("nas obrigações, o que vem depois de 'São obrigações…:' é lista", () => {
    const [obrigacoes] = clausulasPadrao("Corporativo").filter((c) => c.chave === "obrigacoes");
    const tipos = blocos("obrigacoes", obrigacoes.padrao.split("\n")).map((x) => x.tipo);
    expect(tipos).toEqual([
      "subtitulo", "item", "item", "item", "item", // CONTRATADO(A): fornecer, notas, trabalhista, autuação
      "subtitulo", "item", "item", "item",          // CONTRATANTE: gerir recursos, pagar, condições
    ]);
  });

  it("os dois modelos têm os mesmos 7 itens de obrigações", () => {
    for (const m of ["Corporativo", "Cultural"] as const) {
      const [obrigacoes] = clausulasPadrao(m).filter((c) => c.chave === "obrigacoes");
      const itens = blocos("obrigacoes", obrigacoes.padrao.split("\n")).filter((x) => x.tipo === "item");
      expect(itens).toHaveLength(7);
    }
  });

  it("os valores do objeto são itens, e o resto do texto não vira lista", () => {
    const b = blocos("objeto", [
      "Locação de som",
      "",
      "- Valor unitário: R$ 1,00",
      "- **Valor Total a Pagar: R$ 1,00**",
      "",
      "VALORES E FORMA DE PAGAMENTO:",
      "",
      "**Forma de Pagamento:** À vista",
    ]);
    expect(b.map((x) => x.tipo)).toEqual(["texto", "item", "item", "subtitulo", "texto"]);
  });

  it("nenhuma palavra do contrato se perde na classificação", () => {
    for (const m of ["Corporativo", "Cultural"] as const) {
      for (const c of clausulasPadrao(m)) {
        const original = c.padrao.split("\n").filter((l) => l.trim());
        const depois = blocos(c.chave, c.padrao.split("\n")).map((x) => x.texto);
        expect(depois.join("\n")).toBe(original.join("\n"));
      }
    }
  });

  it("fora das obrigações, um texto que termina em dois-pontos não vira lista", () => {
    const b = blocos("vigencia", ["Ficam acordadas as seguintes condições:", "A primeira condição."]);
    expect(b.map((x) => x.tipo)).toEqual(["texto", "texto"]);
  });
});
