import { describe, expect, it } from "vitest";
import {
  calcularTotais,
  normalizarTaxa,
  valorTaxa,
  numeroEc,
  numeroOs,
  versaoOs,
  apelidoFornecedor,
  opcaoNaoSeAplica,
  valorDaOpcao,
  descritivoConsolidado,
  descritivoFinanceiro,
  textoObjetoContrato,
  honorariosPadrao,
  encargosPadrao,
  HONORARIOS,
  limitarPercentual,
  analisarEmissaoOs,
  aprovarLinha,
  reverterAprovacaoLinha,
  tituloEc,
  ENCARGOS,
  bvVazio,
  faltasParaEmitirOs,
  bvDaLinha,
  bvExigeJustificativa,
  bvJustificativaFaltando,
  bvConsolidado,
  BV_PADRAO_PERCENTUAL,
} from "./calc";
import type { Ec, EcLinha, Os, Producao } from "@/data/types";
import { dataBR } from "@/lib/format";

const producaoZero: Producao = {
  despesasOperacionais: 0, equipeBH: 0, equipeViagem: 0, transporteBH: 0,
  transporteViagem: 0, alimentacaoBH: 0, alimentacaoViagem: 0,
  qtdDespesas: 0, qtdEquipeBH: 0, qtdEquipeViagem: 0, qtdTransporteBH: 0,
  qtdTransporteViagem: 0, qtdAlimentacaoBH: 0, qtdAlimentacaoViagem: 0,
};

function linha(p: Partial<EcLinha>): EcLinha {
  return {
    id: "l1", grupo: "G", item: "Item", descricao: "", descricaoCompleta: "",
    valorPolobh: 0, valorCliente: 0, valorGasto: 0,
    valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0,
    valoresNaoAplicaveis: [], bv: bvVazio(), statusAprovacao: "Pendente",
    fornecedorRazao: "", fornecedorCnpj: "", fornecedorContato: "", faturaNf: "",
    codigoServico: "", pedidoCompra: "", statusOs: "Pendente", contratoStatus: "Pendente",
    observacao: "", observacoes: [], oculto: false, ordem: 0, ...p,
  };
}

describe("valorTaxa", () => {
  it("percentual aplica a fração sobre a base", () => {
    expect(valorTaxa({ modo: "percentual", valor: 0.15 }, 1000)).toBe(150);
  });

  it("fixo ignora a base", () => {
    expect(valorTaxa({ modo: "fixo", valor: 500 }, 1000)).toBe(500);
  });
});

describe("calcularTotais", () => {
  const linhas = [
    linha({ id: "a", valorPolobh: 10_000 }),
    linha({ id: "b", valorCliente: 5_000 }),
  ];

  it("separa o lado Pólobh do lado Cliente", () => {
    const t = calcularTotais(linhas, producaoZero);
    expect(t.somaFornecedores).toBe(10_000);
    expect(t.somaCliente).toBe(5_000);
  });

  it("aplica honorários e encargos padrão sobre a soma de fornecedores", () => {
    const t = calcularTotais(linhas, producaoZero);
    expect(t.honorariosPolobh).toBe(10_000 * HONORARIOS);
    expect(t.encargos).toBeCloseTo(10_000 * ENCARGOS, 2);
    // honorários do cliente saem sobre o lado cliente, não sobre fornecedores
    expect(t.honorariosCliente).toBe(5_000 * HONORARIOS);
  });

  it("fecha a identidade: faturamento Pólobh + terceiros = valor total bruto", () => {
    const t = calcularTotais(linhas, producaoZero);
    expect(t.faturamentoPolobh + t.faturamentoTerceiros).toBeCloseTo(t.valorTotalBruto, 2);
  });

  it("mantém a identidade também com taxa fixa", () => {
    const t = calcularTotais(linhas, producaoZero, { modo: "fixo", valor: 900 }, { modo: "fixo", valor: 300 });
    expect(t.honorariosPolobh).toBe(900);
    expect(t.encargos).toBe(300);
    // no modo fixo não há honorário sobre o lado cliente
    expect(t.honorariosCliente).toBe(0);
    expect(t.faturamentoPolobh + t.faturamentoTerceiros).toBeCloseTo(t.valorTotalBruto, 2);
  });

  it("ignora itens ocultos nos totais", () => {
    const comOculto = [...linhas, linha({ id: "c", valorPolobh: 99_999, oculto: true })];
    const t = calcularTotais(comOculto, producaoZero);
    expect(t.somaFornecedores).toBe(10_000);
  });

  it("trata EC vazia sem quebrar", () => {
    const t = calcularTotais([], producaoZero);
    expect(t.valorTotalBruto).toBe(0);
    expect(t.faturamentoPolobh).toBe(0);
  });

  it("arredonda em duas casas a cada etapa", () => {
    const t = calcularTotais([linha({ valorPolobh: 33.333 })], producaoZero, honorariosPadrao(), encargosPadrao());
    for (const v of [t.somaFornecedores, t.honorariosPolobh, t.encargos, t.subTotalPolobh, t.valorTotalBruto]) {
      expect(Number.isInteger(Math.round(v * 100))).toBe(true);
      expect(v).toBeCloseTo(Number(v.toFixed(2)), 10);
    }
  });
});

describe("numeroEc", () => {
  it("remove acentos e zera à esquerda a versão", () => {
    const n = numeroEc("BANCO MERCANTIL", "Convenção Anual de Lideranças", 2);
    expect(n).toContain("V02");
    expect(n).toContain("Convencao Anual de Liderancas");
    expect(n).not.toMatch(/[çãáéíóú]/i);
  });

  it("mantém o cliente quando o título do projeto não o traz", () => {
    expect(numeroEc("BANCO MERCANTIL", "Convencao Anual", 1)).toBe(
      "EC – BANCO MERCANTIL – Convencao Anual – V01"
    );
  });

  it("não repete o cliente quando o título já começa por ele", () => {
    // O título nasce como "{Apelido} – {Projeto} – {Ano}": repetir dava
    // "EC – Instituto Aurora – Instituto Aurora – Festival…", que parecia outra EC.
    expect(numeroEc("Instituto Aurora", "Instituto Aurora – Festival de Inverno – 2026", 4)).toBe(
      "EC – Instituto Aurora – Festival de Inverno – 2026 – V04"
    );
  });

  it("reconhece o apelido como pedaço do nome cadastrado", () => {
    expect(numeroEc("ACME Comércio Ltda", "ACME – Convenção – 2026", 1)).toBe(
      "EC – ACME – Convencao – 2026 – V01"
    );
  });
});

describe("formas de cobrar o item", () => {
  it("as três convivem: preencher uma não mexe nas outras", () => {
    // Na EC não há escolha — são três informações lado a lado, e quem decide a
    // condição de pagamento é a OS.
    const l = linha({ valorComBvNf: 9000, valorSemBvComNf: 9500, valorSemBvSemNf: 8000 });
    expect(valorDaOpcao(l, "comBvNf")).toBe(9000);
    expect(valorDaOpcao(l, "semBvComNf")).toBe(9500);
    expect(valorDaOpcao(l, "semBvSemNf")).toBe(8000);
  });

  it("'Não se aplica' é resposta: zera o valor sem apagar o que foi digitado", () => {
    // O número continua guardado (dá para voltar atrás), mas não vale mais nada
    // — nem na planilha, nem em soma.
    const l = linha({ valorComBvNf: 9000, valoresNaoAplicaveis: ["comBvNf"] });
    expect(opcaoNaoSeAplica(l, "comBvNf")).toBe(true);
    expect(valorDaOpcao(l, "comBvNf")).toBe(0);
    expect(l.valorComBvNf).toBe(9000);
  });

  it("marcar uma forma não afeta as outras", () => {
    const l = linha({ valorSemBvSemNf: 3600, valoresNaoAplicaveis: ["comBvNf"] });
    expect(opcaoNaoSeAplica(l, "semBvSemNf")).toBe(false);
    expect(valorDaOpcao(l, "semBvSemNf")).toBe(3600);
  });
});

describe("numeroOs", () => {
  const comProjeto = (p: Partial<Ec["projeto"]>): Ec =>
    ({
      id: "ec1", cliente: { apelido: "BM", nome: "Banco Mercantil" },
      projeto: { clienteAbreviado: "BM", nomeProjeto: "Convenção de Vendas", anoProjeto: "2027", ...p },
      linhas: [
        { id: "l1", item: "Cenografia", descricao: "" },
        { id: "l2", item: "Iluminação", descricao: "" },
      ],
    }) as unknown as Ec;

  it("OS – projeto – item – fornecedor (versão) em data", () => {
    const n = numeroOs(comProjeto({}), { apelido: "Âmbar", razaoSocial: "AMBAR CENOGRAFIA LTDA" }, 1, "2026-10-27T10:00:00.000Z", ["l1"]);
    expect(n).toBe("OS – BM – Convenção de Vendas 2027 – Cenografia – Âmbar (01) em 27 10 26");
  });

  it("mais de um item na OS: Diversos", () => {
    const n = numeroOs(comProjeto({}), "Âmbar", 2, "2026-10-27T10:00:00.000Z", ["l1", "l2"]);
    expect(n).toBe("OS – BM – Convenção de Vendas 2027 – Diversos – Âmbar (02) em 27 10 26");
  });

  it("sem apelido no cadastro, o sistema gera a partir do nome", () => {
    // A redução mora em `domain/fornecedor` e tem os casos reais lá.
    expect(apelidoFornecedor({ razaoSocial: "SOM & LUZ PRODUÇÕES LTDA" })).toBe("Som & Luz");
    expect(apelidoFornecedor({ nomeFantasia: "Sonora AV", razaoSocial: "Sonora Áudio e Iluminação Ltda" }))
      .toBe("Sonora AV");
    expect(numeroOs(comProjeto({}), { razaoSocial: "MONTA TUDO ESTRUTURAS LTDA" }, 2, "2026-08-27T10:00:00.000Z", ["l1"]))
      .toContain("– Monta Tudo (02) em");
  });

  it("apelido preenchido à mão vence a geração automática", () => {
    expect(apelidoFornecedor({ apelido: "Som&Luz BH", razaoSocial: "SOM & LUZ PRODUÇÕES LTDA" }))
      .toBe("Som&Luz BH");
  });

  it("EC antiga, sem cliente/projeto/ano separados, usa o título do projeto", () => {
    const antiga = comProjeto({ clienteAbreviado: "", nomeProjeto: "", anoProjeto: "", titulo: "BM – Convenção de Vendas – 2027" });
    const n = numeroOs(antiga, "Âmbar", 1, "2026-10-27T10:00:00.000Z", ["l2"]);
    expect(n).toBe("OS – BM – Convenção de Vendas – 2027 – Iluminação – Âmbar (01) em 27 10 26");
  });
});

describe("versaoOs", () => {
  const os = (ecId: string, cnpj: string, razao = ""): Os =>
    ({ ecId, fornecedor: { cnpj, razaoSocial: razao } }) as unknown as Os;

  it("a primeira OS do fornecedor é a versão 1", () => {
    expect(versaoOs([], "ec1", "12.345.678/0001-90", "SOM & LUZ")).toBe(1);
  });

  it("conta as anteriores do MESMO fornecedor, inclusive as arquivadas", () => {
    const existentes = [os("ec1", "12345678000190"), os("ec1", "12345678000190")];
    expect(versaoOs(existentes, "ec1", "12.345.678/0001-90", "SOM & LUZ")).toBe(3);
  });

  it("não conta outro fornecedor nem outra EC", () => {
    const existentes = [os("ec1", "99999999000199"), os("ec2", "12345678000190")];
    expect(versaoOs(existentes, "ec1", "12.345.678/0001-90", "SOM & LUZ")).toBe(1);
  });

  it("sem CNPJ dos dois lados, compara a razão social", () => {
    const existentes = [os("ec1", "", "Som & Luz Produções")];
    expect(versaoOs(existentes, "ec1", "", "SOM & LUZ PRODUÇÕES")).toBe(2);
  });
});

describe("descritivoConsolidado", () => {
  it("junta os itens em bullets e descarta linha sem conteúdo", () => {
    const txt = descritivoConsolidado([
      linha({ id: "a", item: "Som", descricao: "PA line array" }),
      linha({ id: "b", item: "", descricao: "" }),
    ]);
    expect(txt).toBe("• Som — PA line array");
  });

  it("traz os DOIS descritivos: o do financeiro e o detalhado da produção", () => {
    const txt = descritivoConsolidado([
      linha({
        id: "a",
        item: "Comunicação visual",
        descricao: "Banners e backdrop",
        descricaoCompleta: "<ul><li>Backdrop 6x3m em lona</li><li>2 roll-ups</li></ul>",
      }),
    ]);
    expect(txt).toBe("• Comunicação visual — Banners e backdrop\n  • Backdrop 6x3m em lona\n  • 2 roll-ups");
  });

  it("o detalhamento fica recuado sob o item, para a OS com vários itens não embaralhar", () => {
    const txt = descritivoConsolidado([
      linha({ id: "a", item: "Som", descricao: "PA", descricaoCompleta: "<p>8 caixas</p>" }),
      linha({ id: "b", item: "Luz", descricao: "Refletores" }),
    ]);
    expect(txt.split("\n")).toEqual(["• Som — PA", "  8 caixas", "• Luz — Refletores"]);
  });

  it("item só com detalhamento não vira marcador vazio", () => {
    const txt = descritivoConsolidado([
      linha({ id: "a", item: "", descricao: "", descricaoCompleta: "<p>Montagem no dia anterior</p>" }),
    ]);
    expect(txt).toBe("Montagem no dia anterior");
  });
});

describe("textoObjetoContrato", () => {
  const base = {
    tomador: "" as const, descritivoNf: "", cnae: "", codigoServico: "",
    valorUnitario: 0, valorTotal: 0, descontoNegociado: 0, valorAPagar: 0,
    bvPercentual: 0, bvValor: 0, bvJustificativa: "", acertoFinanceiro: "",
  };

  it("usa os dados de faturamento quando preenchidos", () => {
    const txt = textoObjetoContrato({
      ...base,
      projetoIncentivado: "Festival X",
      leiIncentivo: "Lei Federal de Incentivo à Cultura (Rouanet) — PRONAC 26 1234",
    });
    expect(txt).toContain("projeto Festival X");
    // A lei e o número saem juntos, do jeito que foram digitados: um campo só.
    expect(txt).toContain("aprovado pela Lei Federal de Incentivo à Cultura (Rouanet) — PRONAC 26 1234");
    expect(txt).toContain("CONTRATANTE");
  });

  it("marca visivelmente o que falta em vez de mentir", () => {
    const txt = textoObjetoContrato(base);
    expect(txt).toContain("[projeto incentivado]");
  });

  it("sem lei preenchida, cai no texto padrão em vez de deixar buraco na frase", () => {
    expect(textoObjetoContrato(base)).toContain("aprovado pela Lei de Incentivo à Cultura");
  });
});

describe("taxa mínima dos honorários", () => {
  const so = (valorPolobh: number) => [linha({ id: "a", valorPolobh })];

  it("usa o percentual quando ele supera a taxa mínima", () => {
    // 15% de 100.000 = 15.000 > mínimo de 5.000.
    const t = calcularTotais(so(100_000), producaoZero, { modo: "percentual", valor: 0.15, minimo: 5_000 }, encargosPadrao());
    expect(t.honorariosPolobh).toBe(15_000);
    expect(t.honorariosMinimoAplicado).toBe(false);
  });

  it("usa a taxa mínima quando o percentual fica abaixo dela", () => {
    // 15% de 10.000 = 1.500 < mínimo de 5.000 → cobra o mínimo.
    const t = calcularTotais(so(10_000), producaoZero, { modo: "percentual", valor: 0.15, minimo: 5_000 }, encargosPadrao());
    expect(t.honorariosPolobh).toBe(5_000);
    expect(t.honorariosMinimoAplicado).toBe(true);
  });

  it("considera os dois lados (Pólobh e Cliente) ao comparar com o mínimo", () => {
    // 10% de 10.000 (Pólobh) + 10% de 20.000 (Cliente) = 3.000 → já passa do mínimo de 2.500.
    const linhas = [linha({ id: "a", valorPolobh: 10_000 }), linha({ id: "b", valorCliente: 20_000 })];
    const t = calcularTotais(linhas, producaoZero, { modo: "percentual", valor: 0.1, minimo: 2_500 }, encargosPadrao());
    expect(t.honorariosPolobh).toBe(1_000);
    expect(t.honorariosCliente).toBe(2_000);
    expect(t.honorariosMinimoAplicado).toBe(false);
  });

  it("mantém a identidade faturamento Pólobh + terceiros = valor total bruto com o mínimo aplicado", () => {
    const linhas = [linha({ id: "a", valorPolobh: 8_000 }), linha({ id: "b", valorCliente: 3_000 })];
    const t = calcularTotais(linhas, producaoZero, { modo: "percentual", valor: 0.15, minimo: 9_000 }, encargosPadrao());
    expect(t.honorariosMinimoAplicado).toBe(true);
    expect(Math.round((t.faturamentoPolobh + t.faturamentoTerceiros) * 100) / 100).toBe(t.valorTotalBruto);
  });

  it("ignora a taxa mínima quando a taxa está em valor fixo", () => {
    const t = calcularTotais(so(10_000), producaoZero, { modo: "fixo", valor: 800, minimo: 5_000 }, encargosPadrao());
    expect(t.honorariosPolobh).toBe(800);
    expect(t.honorariosMinimoAplicado).toBe(false);
  });
});

describe("limitarPercentual", () => {
  it("trava em 100% e não aceita negativo", () => {
    expect(limitarPercentual(1.5)).toBe(1);
    expect(limitarPercentual(-0.2)).toBe(0);
    expect(limitarPercentual(0.1633)).toBe(0.1633);
  });
});

describe("analisarEmissaoOs", () => {
  const completo = (p: Partial<EcLinha>) =>
    linha({
      statusAprovacao: "OK", statusOs: "Emitir", fornecedorRazao: "Fornecedor X",
      fornecedorCnpj: "12.345.678/0001-95", faturaNf: "Nota Fiscal",
      codigoServico: "1401", pedidoCompra: "PC-01", ...p,
    });

  it("ignora linhas que não estão marcadas para emitir", () => {
    const r = analisarEmissaoOs([completo({ id: "a", statusOs: "Pendente" }), completo({ id: "b", statusOs: "OK" })]);
    expect(r.prontos).toHaveLength(0);
    expect(r.bloqueados).toHaveLength(0);
  });

  it("aceita item aprovado, com fornecedor e marcado para emitir", () => {
    const r = analisarEmissaoOs([completo({ id: "a" }), completo({ id: "b", statusOs: "Emitir Nova Versão" })]);
    expect(r.prontos.map((l) => l.id)).toEqual(["a", "b"]);
    expect(r.bloqueados).toHaveLength(0);
  });

  it("barra item ainda não aprovado", () => {
    const r = analisarEmissaoOs([completo({ id: "a", statusAprovacao: "Pendente" })]);
    expect(r.prontos).toHaveLength(0);
    expect(r.bloqueados[0].faltas).toContain("Aprovação (item ainda pendente)");
  });

  it("barra item sem fornecedor identificado", () => {
    const r = analisarEmissaoOs([completo({ id: "a", fornecedorRazao: "", fornecedorCnpj: "123" })]);
    expect(r.bloqueados[0].faltas).toEqual(
      expect.arrayContaining(["Fornecedor (razão social)", "CPF ou CNPJ do fornecedor"])
    );
  });

  it("fornecedor pessoa física: CPF vale no lugar do CNPJ", () => {
    const r = analisarEmissaoOs([completo({ id: "a", fornecedorRazao: "Carolina", fornecedorCnpj: "055.650.834-35" })]);
    expect(r.prontos.map((l) => l.id)).toEqual(["a"]);
  });

  // Documento PG, Código de Serviço e Pedido de Compra NASCEM NA OS
  // (15/09/2026). Exigi-los aqui era pedir à EC o que só o documento seguinte
  // produz — e era o que impedia a emissão de qualquer OS.
  it("emite o item mesmo sem os campos que vêm da OS", () => {
    const r = analisarEmissaoOs([completo({ id: "a", faturaNf: "", codigoServico: "", pedidoCompra: "" })]);
    expect(r.prontos.map((l) => l.id)).toEqual(["a"]);
    expect(r.bloqueados).toHaveLength(0);
  });

  it("separa prontos de bloqueados na mesma EC", () => {
    const r = analisarEmissaoOs([completo({ id: "ok" }), completo({ id: "nao", fornecedorCnpj: "" })]);
    expect(r.prontos.map((l) => l.id)).toEqual(["ok"]);
    expect(r.bloqueados.map((b) => b.linha.id)).toEqual(["nao"]);
  });
});

describe("formato de data do sistema", () => {
  it("apresenta DD MM AA sem barras nem hífens", () => {
    expect(dataBR("2026-02-22")).toBe("22 02 26");
    expect(dataBR("2026-12-05T14:30:00.000Z")).toMatch(/^\d{2} \d{2} \d{2}$/);
  });

  it("devolve vazio para data ausente e o próprio texto para data inválida", () => {
    expect(dataBR("")).toBe("");
    expect(dataBR(null)).toBe("");
    expect(dataBR("texto")).toBe("texto");
  });

  it("usa o mesmo formato no título automático da EC", () => {
    expect(tituloEc({ versao: 3, projeto: { titulo: "Convenção" }, criadoEm: "2026-02-22" } as never))
      .toBe("EC – Convenção (03) em 22 02 26");
  });
});

describe("aprovarLinha", () => {
  it("aprova o item pendente e manda a OS para Emitir", () => {
    const r = aprovarLinha(linha({ statusAprovacao: "Pendente", statusOs: "Pendente" }));
    expect(r.statusAprovacao).toBe("OK");
    expect(r.statusOs).toBe("Emitir");
  });

  it("não reaprova item já aprovado — devolve o mesmo objeto", () => {
    const l = linha({ statusAprovacao: "OK", statusOs: "OK" });
    expect(aprovarLinha(l)).toBe(l);
  });

  it("não mexe na OS que já saiu de Pendente", () => {
    for (const os of ["Emitir", "Emitir Nova Versão", "OK", "Não se Aplica"] as const) {
      expect(aprovarLinha(linha({ statusAprovacao: "Pendente", statusOs: os })).statusOs).toBe(os);
    }
  });
});

describe("aprovação pelo campo do item (mesma regra do botão em bloco)", () => {
  it("marcar Aprovação como OK já pede a OS", () => {
    // É o que a tela faz no onChange do campo Aprovação (ver EcGrupos).
    const r = aprovarLinha(linha({ statusAprovacao: "Pendente", statusOs: "Pendente" }));
    expect(r.statusAprovacao).toBe("OK");
    expect(r.statusOs).toBe("Emitir");
  });

  it("voltar para Pendente desfaz só a OS que a aprovação criou", () => {
    const r = reverterAprovacaoLinha(linha({ statusAprovacao: "OK", statusOs: "Emitir" }));
    expect(r.statusOs).toBe("Pendente");
    // OS já emitida não volta atrás por causa de um clique na aprovação.
    expect(reverterAprovacaoLinha(linha({ statusAprovacao: "OK", statusOs: "OK" })).statusOs).toBe("OK");
  });
});

describe("reverterAprovacaoLinha", () => {
  it("volta a aprovação e desfaz a OS que a aprovação tinha criado", () => {
    const r = reverterAprovacaoLinha(linha({ statusAprovacao: "OK", statusOs: "Emitir" }));
    expect(r.statusAprovacao).toBe("Pendente");
    expect(r.statusOs).toBe("Pendente");
  });

  it("preserva OS já emitida ou fora do fluxo", () => {
    for (const os of ["OK", "Emitir Nova Versão", "Não se Aplica"] as const) {
      const r = reverterAprovacaoLinha(linha({ statusAprovacao: "OK", statusOs: os }));
      expect(r.statusAprovacao).toBe("Pendente");
      expect(r.statusOs).toBe(os);
    }
  });

  it("ignora item que já está pendente — devolve o mesmo objeto", () => {
    const l = linha({ statusAprovacao: "Pendente", statusOs: "Pendente" });
    expect(reverterAprovacaoLinha(l)).toBe(l);
  });

  it("aprovar e reverter em seguida devolve o item ao estado original", () => {
    const l = linha({ statusAprovacao: "Pendente", statusOs: "Pendente" });
    expect(reverterAprovacaoLinha(aprovarLinha(l))).toEqual(l);
  });
});

/**
 * BV por item: a bonificação é combinada junto com o valor, no item da EC, e a
 * OS soma o dos itens que consolida.
 */
describe("BV do item da EC", () => {
  const comBv = (p: Partial<EcLinha["bv"]>, resto: Partial<EcLinha> = {}) =>
    linha({ valorComBvNf: 10000, bv: { ...bvVazio(), ...p }, ...resto });

  it("percentual vira reais sobre o valor com BV do item", () => {
    expect(bvDaLinha(comBv({ modo: "percentual", valor: 15 }))).toEqual({
      base: 10000, valor: 1500, percentual: 15,
    });
  });

  it("valor fixo vira percentual, para os dois lados da conta ficarem à vista", () => {
    expect(bvDaLinha(comBv({ modo: "fixo", valor: 1200 }))).toEqual({
      base: 10000, valor: 1200, percentual: 12,
    });
  });

  it("sem valor com BV não há base: o cálculo zera", () => {
    const semBv = linha({ valorSemBvComNf: 9000, bv: { modo: "percentual", valor: 15, justificativa: "" } });
    expect(bvDaLinha(semBv).valor).toBe(0);
  });

  it("\"não se aplica\" na cobrança com BV também zera — o item não é pago assim", () => {
    const naoSeAplica = comBv({ modo: "percentual", valor: 15 }, { valoresNaoAplicaveis: ["comBvNf"] });
    expect(bvDaLinha(naoSeAplica).valor).toBe(0);
  });

  it("o BV conta assim que há valor com BV, sem esperar ninguém eleger a forma", () => {
    // O seletor saiu da EC: o BV é combinado junto com o preço, e não depois de
    // fechada a condição de pagamento.
    expect(bvDaLinha(comBv({ modo: "percentual", valor: 15 })).valor).toBe(1500);
  });

  describe("quando a justificativa é exigida", () => {
    it("BV no padrão da casa não pede explicação", () => {
      expect(bvExigeJustificativa(comBv({ modo: "percentual", valor: BV_PADRAO_PERCENTUAL }))).toBe(false);
    });

    it("BV abaixo do padrão pede", () => {
      expect(bvExigeJustificativa(comBv({ modo: "percentual", valor: 10 }))).toBe(true);
    });

    it("\"não se aplica\" na cobrança com BV pede — é o caso que mais precisa de motivo", () => {
      // A produção respondeu que o item sai sem BV; o porquê fica escrito.
      expect(bvExigeJustificativa(linha({ valorSemBvSemNf: 8000, valoresNaoAplicaveis: ["comBvNf"] }))).toBe(true);
    });

    it("campo com BV ainda em branco NÃO pede nada", () => {
      // Em branco é pergunta sem resposta — senão toda linha recém-criada
      // nasceria com um alerta vermelho.
      expect(bvExigeJustificativa(linha({ valorSemBvSemNf: 8000 }))).toBe(false);
      expect(bvExigeJustificativa(linha({}))).toBe(false);
    });

    it("exigida e em branco é o que trava a emissão da OS", () => {
      const semMotivo = linha({ valorSemBvSemNf: 8000, valoresNaoAplicaveis: ["comBvNf"] });
      expect(bvJustificativaFaltando(semMotivo)).toBe(true);
      const comMotivo = linha({
        valorSemBvSemNf: 8000,
        valoresNaoAplicaveis: ["comBvNf"],
        bv: { ...bvVazio(), justificativa: "Fornecedor não trabalha com BV." },
      });
      expect(bvJustificativaFaltando(comMotivo)).toBe(false);
    });

    it("a falta entra na lista que a EC mostra item a item", () => {
      const pronto = linha({
        statusAprovacao: "OK", fornecedorRazao: "SOM & LUZ LTDA", fornecedorCnpj: "12.345.678/0001-90",
        faturaNf: "Nota Fiscal", codigoServico: "03.01", pedidoCompra: "PC-1",
        valorSemBvSemNf: 8000, valoresNaoAplicaveis: ["comBvNf"],
      });
      expect(faltasParaEmitirOs(pronto)).toEqual(["Justificativa do BV"]);
    });
  });
});

describe("BV consolidado na OS", () => {
  const item = (valor: number, bv: Partial<EcLinha["bv"]>) =>
    linha({ valorComBvNf: valor, bv: { ...bvVazio(), ...bv } });

  it("soma os reais e recompõe o percentual sobre o total", () => {
    // 15% de 10.000 = 1.500 · R$ 500 fixos sobre 5.000 = 10%. Juntos: 2.000/15.000.
    const r = bvConsolidado([
      item(10000, { modo: "percentual", valor: 15 }),
      item(5000, { modo: "fixo", valor: 500 }),
    ]);
    expect(r.valor).toBe(2000);
    expect(r.percentual).toBeCloseTo(13.33, 2);
  });

  it("junta as justificativas distintas — cada uma explica um item", () => {
    const r = bvConsolidado([
      item(10000, { modo: "percentual", valor: 10, justificativa: "Negociado a 10%." }),
      item(5000, { modo: "percentual", valor: 10, justificativa: "Negociado a 10%." }),
      item(2000, { modo: "percentual", valor: 0, justificativa: "Fornecedor sem BV." }),
    ]);
    expect(r.justificativa).toBe("Negociado a 10%. · Fornecedor sem BV.");
  });

  it("OS sem nenhum item com BV não inventa percentual", () => {
    expect(bvConsolidado([linha({ valorSemBvComNf: 900 })])).toEqual({
      valor: 0, percentual: 0, justificativa: "",
    });
  });
});


describe("normalizarTaxa — EC gravada no formato antigo", () => {
  it("usa o percentual antigo quando o valor está zerado ou ausente", () => {
    expect(normalizarTaxa({ modo: "percentual", valor: 0, percentual: 0.1633 }, encargosPadrao()).valor).toBe(0.1633);
    expect(normalizarTaxa({ modo: "percentual", percentual: 0.15 }, honorariosPadrao()).valor).toBe(0.15);
  });

  it("não devolve o campo antigo — um zero digitado depois continua sendo zero", () => {
    const t = normalizarTaxa({ modo: "percentual", valor: 0, percentual: 0.1633 }, encargosPadrao());
    expect("percentual" in t).toBe(false);
    expect(normalizarTaxa({ modo: "percentual", valor: 0 }, encargosPadrao()).valor).toBe(0);
  });

  it("mantém o que está certo e o mínimo, e cai no padrão sem nada", () => {
    expect(normalizarTaxa({ modo: "percentual", valor: 0.15, minimo: 5999 }, honorariosPadrao())).toEqual({ modo: "percentual", valor: 0.15, minimo: 5999 });
    expect(normalizarTaxa({ modo: "fixo", valor: 1200 }, honorariosPadrao())).toEqual({ modo: "fixo", valor: 1200 });
    expect(normalizarTaxa(undefined, encargosPadrao())).toEqual(encargosPadrao());
  });
});

describe("descritivoFinanceiro", () => {
  it("leva só a descrição financeira, sem a completa", () => {
    const txt = descritivoFinanceiro([
      { item: "A", descricao: "Locação de som", descricaoCompleta: "<p>Detalhe longo</p>" },
      { item: "B", descricao: "", descricaoCompleta: "" },
    ] as never);
    expect(txt).toBe("• Locação de som");
  });
});
