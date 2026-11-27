import { describe, expect, it } from "vitest";
import { destinoDaOsAoExcluir, ossVivasDoItem, planoOsAoSalvarEc } from "@/domain/osAoSalvarEc";
import type { Ec, EcLinha, Os } from "@/data/types";

const linha = (id: string, extra: Partial<EcLinha> = {}) =>
  ({ id, item: `Item ${id}`, descricao: "", descricaoCompleta: "", valorPolobh: 100, valorCliente: 0, statusOs: "OK", ...extra }) as EcLinha;
const os = (id: string, status: Os["status"], ecLinhaIds: string[]) =>
  ({ id, numero: `OS ${id}`, status, ecLinhaIds }) as Os;
const ec = (...linhas: EcLinha[]) => ({ linhas }) as Pick<Ec, "linhas">;

describe("OS vivas do item", () => {
  it("a arquivada não conta: o item dela pode sair sem pergunta", () => {
    const oss = [os("a", "Arquivada", ["1"]), os("b", "Emitida", ["1"]), os("c", "Ativa", ["2"])];
    expect(ossVivasDoItem("1", oss).map((o) => o.id)).toEqual(["b"]);
    expect(ossVivasDoItem("3", oss)).toEqual([]);
  });
});

describe("destino da OS quando um item é excluído", () => {
  const existentes = new Set(["2"]);
  it("fica sem itens: arquivar, emitida ou ativa", () => {
    expect(destinoDaOsAoExcluir(os("a", "Emitida", ["1"]), new Set(["1"]), existentes)).toBe("arquivar");
    expect(destinoDaOsAoExcluir(os("a", "Ativa", ["1"]), new Set(["1"]), existentes)).toBe("arquivar");
  });
  it("emitida que continua com outros itens: nova versão", () => {
    expect(destinoDaOsAoExcluir(os("a", "Emitida", ["1", "2"]), new Set(["1"]), existentes)).toBe("nova-versao");
  });
  it("ativa que continua com outros itens: só perde o item", () => {
    expect(destinoDaOsAoExcluir(os("a", "Ativa", ["1", "2"]), new Set(["1"]), existentes)).toBe("perde-o-item");
  });
  it("arquivada, ou que não cobre o item: nada", () => {
    expect(destinoDaOsAoExcluir(os("a", "Arquivada", ["1"]), new Set(["1"]), existentes)).toBeNull();
    expect(destinoDaOsAoExcluir(os("a", "Emitida", ["2"]), new Set(["1"]), existentes)).toBeNull();
  });
  it("item que a OS cita e já não existe na EC não segura a OS", () => {
    expect(destinoDaOsAoExcluir(os("a", "Emitida", ["1", "fantasma"]), new Set(["1"]), existentes)).toBe("arquivar");
  });
});

describe("plano das OS ao salvar a EC", () => {
  it("sem versão anterior (EC nova), não há o que fazer", () => {
    expect(planoOsAoSalvarEc(null, ec(linha("1")), [os("a", "Emitida", ["1"])])).toEqual({
      arquivar: [], novaVersaoPorExclusao: [], novaVersaoPorEdicao: [],
    });
  });

  it("excluir o único item de uma OS emitida: arquiva", () => {
    const plano = planoOsAoSalvarEc(ec(linha("1"), linha("2")), ec(linha("2")), [os("a", "Emitida", ["1"])]);
    expect(plano.arquivar.map((o) => o.id)).toEqual(["a"]);
    expect(plano.novaVersaoPorExclusao).toEqual([]);
  });

  it("excluir um de dois itens de uma OS emitida: nova versão, sem pedir de novo pela edição", () => {
    const antes = ec(linha("1"), linha("2"));
    const depois = ec(linha("2", { valorPolobh: 999 }));
    const plano = planoOsAoSalvarEc(antes, depois, [os("a", "Emitida", ["1", "2"])]);
    expect(plano.novaVersaoPorExclusao.map((o) => o.id)).toEqual(["a"]);
    expect(plano.novaVersaoPorEdicao).toEqual([]);
  });

  it("alterar o valor de um item com OS EMITIDA pede nova versão; com OS ATIVA, não", () => {
    const antes = ec(linha("1"), linha("2"));
    const depois = ec(linha("1", { valorPolobh: 250 }), linha("2", { valorPolobh: 250 }));
    const plano = planoOsAoSalvarEc(antes, depois, [os("a", "Emitida", ["1"]), os("b", "Ativa", ["2"])]);
    expect(plano.novaVersaoPorEdicao).toEqual([{ os: os("a", "Emitida", ["1"]), itens: ["Item 1"] }]);
  });

  it("mudar só o status (Aprovação, OS, Contrato) ou a ordem não mexe em OS nenhuma", () => {
    const antes = ec(linha("1"), linha("2"));
    const depois = ec(linha("2"), linha("1", { statusOs: "Emitir Nova Versão", contratoStatus: "Não se Aplica", statusAprovacao: "OK" }));
    const plano = planoOsAoSalvarEc(antes, depois, [os("a", "Emitida", ["1", "2"])]);
    expect(plano).toEqual({ arquivar: [], novaVersaoPorExclusao: [], novaVersaoPorEdicao: [] });
  });

  it("OS arquivada nunca entra no plano", () => {
    const plano = planoOsAoSalvarEc(ec(linha("1")), ec(), [os("a", "Arquivada", ["1"])]);
    expect(plano).toEqual({ arquivar: [], novaVersaoPorExclusao: [], novaVersaoPorEdicao: [] });
  });
});
