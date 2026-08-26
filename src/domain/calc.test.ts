import { describe, expect, it } from "vitest";
import {
  calcularTotais,
  valorTaxa,
  numeroEc,
  opcaoEscolhidaDoItem,
  opcaoNaoSeAplica,
  valorDaOpcao,
  descritivoConsolidado,
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
} from "./calc";
import type { EcLinha, Producao } from "@/data/types";
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
    valoresNaoAplicaveis: [], opcaoValor: "", statusAprovacao: "Pendente",
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

describe("opções de valor do item", () => {
  it("a opção escolhida sai com rótulo e valor", () => {
    const escolha = opcaoEscolhidaDoItem(linha({ valorComBvNf: 9000, opcaoValor: "comBvNf" }));
    expect(escolha).toMatchObject({ rotulo: "Valor com BV e NF", valor: 9000, naoSeAplica: false });
  });

  it("'Não se aplica' é resposta: zera o valor e se identifica", () => {
    // O número digitado antes continua guardado (dá para voltar atrás), mas não
    // vale mais nada — nem na planilha, nem em soma.
    const l = linha({ valorComBvNf: 9000, opcaoValor: "comBvNf", valoresNaoAplicaveis: ["comBvNf"] });
    expect(opcaoNaoSeAplica(l, "comBvNf")).toBe(true);
    expect(valorDaOpcao(l, "comBvNf")).toBe(0);
    expect(opcaoEscolhidaDoItem(l)).toMatchObject({ valor: 0, naoSeAplica: true });
    expect(l.valorComBvNf).toBe(9000);
  });

  it("marcar uma opção não afeta as outras", () => {
    const l = linha({ valorSemBvSemNf: 3600, opcaoValor: "semBvSemNf", valoresNaoAplicaveis: ["comBvNf"] });
    expect(opcaoNaoSeAplica(l, "semBvSemNf")).toBe(false);
    expect(valorDaOpcao(l, "semBvSemNf")).toBe(3600);
  });

  it("sem escolha nenhuma, não há opção para a OS imprimir", () => {
    expect(opcaoEscolhidaDoItem(linha({ valorComBvNf: 9000 }))).toBeNull();
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
      leiIncentivo: "Lei Rouanet",
      numeroProjetoIncentivado: "12345",
    });
    expect(txt).toContain("projeto Festival X");
    expect(txt).toContain("aprovado pela Lei Rouanet");
    expect(txt).toContain("sob o número 12345");
    expect(txt).toContain("CONTRATANTE");
  });

  it("marca visivelmente o que falta em vez de mentir", () => {
    const txt = textoObjetoContrato(base);
    expect(txt).toContain("[projeto incentivado]");
    expect(txt).toContain("[número do projeto incentivado]");
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
      expect.arrayContaining(["Fornecedor (razão social)", "CNPJ do fornecedor"])
    );
  });

  it("barra item sem campos fiscais obrigatórios e lista todos", () => {
    const r = analisarEmissaoOs([completo({ id: "a", faturaNf: "", codigoServico: "", pedidoCompra: "" })]);
    expect(r.bloqueados[0].faltas).toEqual(["Documento PG", "Código de Serviço", "Pedido de Compra"]);
  });

  it("separa prontos de bloqueados na mesma EC", () => {
    const r = analisarEmissaoOs([completo({ id: "ok" }), completo({ id: "nao", pedidoCompra: "" })]);
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
