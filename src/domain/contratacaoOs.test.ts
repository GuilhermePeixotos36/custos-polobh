import { describe, expect, it } from "vitest";
import {
  bvDaContratacao,
  bvDoItem,
  exigeJustificativa,
  itemContratacaoVazio,
  itemDaLinhaEc,
  justificativasFaltando,
  resumoContratacao,
  sincronizarContratacao,
} from "./contratacaoOs";
import { bvVazio } from "./calc";
import type { EcLinha, ItemContratacaoOs } from "@/data/types";

const linha = (p: Partial<EcLinha>): EcLinha =>
  ({
    id: "l1", grupo: "PRODUÇÃO", item: "Buffet", descricao: "", descricaoCompleta: "",
    valorPolobh: 0, valorCliente: 0, valorGasto: 0,
    valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0,
    valoresNaoAplicaveis: [], bv: bvVazio(),
    statusAprovacao: "Pendente", fornecedorRazao: "", fornecedorCnpj: "", fornecedorContato: "",
    faturaNf: "", codigoServico: "", pedidoCompra: "", statusOs: "Pendente", contratoStatus: "Pendente",
    observacao: "", observacoes: [], oculto: false, ordem: 0,
    ...p,
  }) as EcLinha;

const item = (p: Partial<ItemContratacaoOs> = {}): ItemContratacaoOs => ({ ...itemContratacaoVazio("l1"), ...p });

describe("a contratação nasce do que a EC levantou", () => {
  it("traz valores, 'não se aplica' e o BV do item", () => {
    const i = itemDaLinhaEc(
      linha({
        valorComBvNf: 10000,
        valorSemBvComNf: 9500,
        valorSemBvSemNf: 8000,
        valoresNaoAplicaveis: ["semBvSemNf"],
        bv: { modo: "percentual", valor: 15, justificativa: "combinado com o fornecedor" },
      })
    );
    expect(i.comBvNf).toMatchObject({ valor: 10000, naoSeAplica: false });
    expect(i.semBvComNf).toMatchObject({ valor: 9500, naoSeAplica: false });
    expect(i.semBvSemNf.naoSeAplica).toBe(true);
    expect(i.bv).toEqual({ modo: "percentual", valor: 15 });
    // A justificativa da EC pertence à forma COM BV — é dela que ela falava.
    expect(i.comBvNf.justificativaBv).toBe("combinado com o fornecedor");
  });
});

/**
 * A OS ganha e perde itens depois de aberta (reemissão, mudança de escopo), e o
 * que já foi negociado não pode se perder no caminho.
 */
describe("quando os itens da OS mudam", () => {
  it("mantém o que já foi decidido e traz da EC só o que entrou agora", () => {
    const decidido = item({ ecLinhaId: "l1", comBvNf: { naoSeAplica: false, valor: 7777, justificativaBv: "" } });
    const linhas = [linha({ id: "l1", valorComBvNf: 10000 }), linha({ id: "l2", valorComBvNf: 2000 })];
    const sincronizado = sincronizarContratacao([decidido], linhas);
    // O que já valia continua valendo — 7777, e não os 10000 da EC.
    expect(sincronizado[0].comBvNf.valor).toBe(7777);
    // O item novo entra com o que a EC diz.
    expect(sincronizado[1].comBvNf.valor).toBe(2000);
  });

  it("item que saiu da OS some da contratação", () => {
    const itens = [item({ ecLinhaId: "l1" }), item({ ecLinhaId: "l2" })];
    expect(sincronizarContratacao(itens, [linha({ id: "l2" })]).map((i) => i.ecLinhaId)).toEqual(["l2"]);
  });

  it("segue a ordem da EC, para a tabela sair na sequência da estimativa", () => {
    const itens = [item({ ecLinhaId: "l2" }), item({ ecLinhaId: "l1" })];
    const linhas = [linha({ id: "l1" }), linha({ id: "l2" })];
    expect(sincronizarContratacao(itens, linhas).map((i) => i.ecLinhaId)).toEqual(["l1", "l2"]);
  });
});

describe("Resumo dos Custos", () => {
  const linhas = [linha({ id: "l1", item: "Som" }), linha({ id: "l2", item: "Luz" })];
  const contratacao = [
    item({
      ecLinhaId: "l1",
      comBvNf: { naoSeAplica: false, valor: 10000, justificativaBv: "" },
      semBvComNf: { naoSeAplica: true, valor: 0, justificativaBv: "" },
      semBvSemNf: { naoSeAplica: false, valor: 8000, justificativaBv: "x" },
    }),
    item({
      ecLinhaId: "l2",
      comBvNf: { naoSeAplica: false, valor: 5000, justificativaBv: "" },
      semBvComNf: { naoSeAplica: true, valor: 0, justificativaBv: "" },
      semBvSemNf: { naoSeAplica: false, valor: 4000, justificativaBv: "x" },
    }),
  ];

  it("soma cada coluna; 'não se aplica' não entra em soma nenhuma", () => {
    const r = resumoContratacao(contratacao, linhas);
    expect(r.totais).toEqual({ comBvNf: 15000, semBvComNf: 0, semBvSemNf: 12000 });
    expect(r.linhas[0].semBvComNf).toBeNull();
  });

  it("o nome do item vem da EC; o valor, da contratação", () => {
    expect(resumoContratacao(contratacao, linhas).linhas.map((l) => l.item)).toEqual(["Som", "Luz"]);
  });

  it("coluna sem valor nenhum não vai ao documento do fornecedor", () => {
    // Uma coluna inteira zerada não é informação numa tabela que ele confere
    // linha a linha.
    const r = resumoContratacao(contratacao, linhas);
    expect(r.colunas).toEqual({ comBvNf: true, semBvComNf: false, semBvSemNf: true });
  });

  it("separa o que gera nota do que não gera", () => {
    // Os dados de emissão falam só das duas colunas "com NF".
    const r = resumoContratacao(contratacao, linhas);
    expect(r.totalComNota).toBe(15000);
    expect(r.totalSemNota).toBe(12000);
  });

  it("zero preenchido continua sendo zero, e não \"não se aplica\"", () => {
    // Zero é uma resposta ("sai de graça"); "não se aplica" é outra. A tabela
    // do fornecedor imprime as duas de jeitos diferentes.
    const r = resumoContratacao([item({ comBvNf: { naoSeAplica: false, valor: 0, justificativaBv: "" } })], linhas);
    expect(r.linhas[0].comBvNf).toBe(0);
  });

  it("item sem nome se identifica pela descrição, e em último caso se anuncia", () => {
    const semNome = [linha({ id: "l1", item: "", descricao: "Locação de praticáveis" }), linha({ id: "l2", item: "", descricao: "" })];
    const r = resumoContratacao([item({ ecLinhaId: "l1" }), item({ ecLinhaId: "l2" })], semNome);
    expect(r.linhas.map((l) => l.item)).toEqual(["Locação de praticáveis", "(item sem nome)"]);
  });

  it("OS sem item nenhum não quebra nem inventa coluna", () => {
    const r = resumoContratacao([], []);
    expect(r.linhas).toEqual([]);
    expect(r.totais).toEqual({ comBvNf: 0, semBvComNf: 0, semBvSemNf: 0 });
    expect(r.colunas).toEqual({ comBvNf: false, semBvComNf: false, semBvSemNf: false });
  });
});

describe("BV da contratação", () => {
  const comBv = (valor: number, bv: ItemContratacaoOs["bv"]) =>
    item({ comBvNf: { naoSeAplica: false, valor, justificativaBv: "" }, bv });

  it("percentual e valor fixo dão os dois lados da conta", () => {
    expect(bvDoItem(comBv(10000, { modo: "percentual", valor: 15 })))
      .toEqual({ base: 10000, valor: 1500, percentual: 15 });
    expect(bvDoItem(comBv(10000, { modo: "fixo", valor: 1200 })))
      .toEqual({ base: 10000, valor: 1200, percentual: 12 });
  });

  it("incide sobre o valor NEGOCIADO na OS, não sobre o estimado na EC", () => {
    // A OS fechou por 8.000 onde a EC estimava 10.000: o BV acompanha.
    expect(bvDoItem(comBv(8000, { modo: "percentual", valor: 15 })).valor).toBe(1200);
  });

  it("'não se aplica' na forma com BV zera o cálculo", () => {
    const naoSeAplica = item({
      comBvNf: { naoSeAplica: true, valor: 10000, justificativaBv: "" },
      bv: { modo: "percentual", valor: 15 },
    });
    expect(bvDoItem(naoSeAplica).valor).toBe(0);
  });

  it("a OS soma o BV dos itens que consolida", () => {
    const total = bvDaContratacao([
      comBv(10000, { modo: "percentual", valor: 15 }),
      comBv(5000, { modo: "percentual", valor: 10 }),
    ]);
    expect(total).toEqual({ base: 15000, valor: 2000, percentual: 13.33 });
  });
});

/**
 * A justificativa é uma POR FORMA (na EC era uma por item): ali só uma valia,
 * aqui as três convivem na mesma tabela e cada uma responde por si.
 */
describe("quando a justificativa do BV é exigida", () => {
  it("forma sem BV que vale sempre pede motivo escrito", () => {
    const i = item({ semBvSemNf: { naoSeAplica: false, valor: 8000, justificativaBv: "" } });
    expect(exigeJustificativa(i, "semBvSemNf")).toBe(true);
    expect(exigeJustificativa(i, "semBvComNf")).toBe(false); // sem valor, não pede
  });

  it("forma com BV só pede quando o BV fica abaixo do padrão da casa", () => {
    const noPadrao = item({
      comBvNf: { naoSeAplica: false, valor: 10000, justificativaBv: "" },
      bv: { modo: "percentual", valor: 15 },
    });
    const abaixo = item({
      comBvNf: { naoSeAplica: false, valor: 10000, justificativaBv: "" },
      bv: { modo: "percentual", valor: 10 },
    });
    expect(exigeJustificativa(noPadrao, "comBvNf")).toBe(false);
    expect(exigeJustificativa(abaixo, "comBvNf")).toBe(true);
  });

  it("'não se aplica' não pede nada — a forma não vale para este item", () => {
    const i = item({ semBvSemNf: { naoSeAplica: true, valor: 8000, justificativaBv: "" } });
    expect(exigeJustificativa(i, "semBvSemNf")).toBe(false);
  });

  it("aponta exatamente quais formas estão devendo o motivo", () => {
    const i = item({
      comBvNf: { naoSeAplica: false, valor: 10000, justificativaBv: "" },
      bv: { modo: "percentual", valor: 5 },
      semBvSemNf: { naoSeAplica: false, valor: 8000, justificativaBv: "fornecedor não trabalha com BV" },
    });
    expect(justificativasFaltando(i)).toEqual(["comBvNf"]);
  });
});
