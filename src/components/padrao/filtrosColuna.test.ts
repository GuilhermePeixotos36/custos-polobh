import { describe, expect, it } from "vitest";
import {
  FILTROS_DE_COLUNA_VAZIOS, alternarValor, chaveDoValor, desmarcarVisiveis, diaDoCarimbo, filtrarPorColunas,
  filtrosDeColunaAtivos, limparColuna, marcarVisiveis, opcoesDaColuna, type ExtratoresDeFiltro,
} from "./filtrosColuna";

type Os = { id: number; status: string; fornecedor: string | null; codigo?: number; dia: string };

const OSS: Os[] = [
  { id: 1, status: "Ativa", fornecedor: "Sonora", codigo: 12, dia: "2026-11-09" },
  { id: 2, status: "Emitida", fornecedor: "Sonora", codigo: 13, dia: "2026-11-10" },
  { id: 3, status: "Ativa", fornecedor: "Buffet", codigo: 2, dia: "2026-11-10" },
  { id: 4, status: "Arquivada", fornecedor: null, dia: "2026-10-01" },
];

const EXTRATORES: ExtratoresDeFiltro<Os> = {
  status: (o) => o.status,
  fornecedor: (o) => o.fornecedor,
  codigo: (o) => o.codigo,
  dia: (o) => o.dia,
};

const todosStatus = ["Arquivada", "Ativa", "Emitida"];

describe("chaveDoValor", () => {
  it("trata ausência, traço e número que não é número como vazio", () => {
    expect(chaveDoValor(null)).toBe("");
    expect(chaveDoValor(undefined)).toBe("");
    expect(chaveDoValor(" — ")).toBe("");
    expect(chaveDoValor(Number.NaN)).toBe("");
  });
  it("guarda zero e número como texto", () => {
    expect(chaveDoValor(0)).toBe("0");
    expect(chaveDoValor(12)).toBe("12");
    expect(chaveDoValor("  Sonora ")).toBe("Sonora");
  });
});

describe("contador de filtros ligados", () => {
  it("conta colunas filtradas, não valores marcados", () => {
    expect(filtrosDeColunaAtivos(FILTROS_DE_COLUNA_VAZIOS)).toBe(0);
    expect(filtrosDeColunaAtivos({ status: ["Ativa", "Emitida"], fornecedor: ["Sonora"] })).toBe(2);
  });
  it("lista vazia é filtro ligado (desmarcou tudo)", () => {
    expect(filtrosDeColunaAtivos({ status: [] })).toBe(1);
  });
});

describe("alternarValor", () => {
  it("desmarcar um valor liga o filtro com os demais", () => {
    const f = alternarValor({}, "status", "Arquivada", todosStatus);
    expect(f).toEqual({ status: ["Ativa", "Emitida"] });
    expect(filtrosDeColunaAtivos(f)).toBe(1);
  });
  it("marcar de volta o último desligado apaga o filtro", () => {
    const f = alternarValor({ status: ["Ativa", "Emitida"] }, "status", "Arquivada", todosStatus);
    expect(f).toEqual({});
  });
});

describe("Selecionar todos / Limpar", () => {
  it("sem busca: Limpar desmarca tudo e Selecionar todos volta a não filtrar", () => {
    const vazio = desmarcarVisiveis({}, "status", todosStatus, todosStatus);
    expect(vazio).toEqual({ status: [] });
    expect(filtrarPorColunas(OSS, vazio, EXTRATORES)).toEqual([]);
    expect(marcarVisiveis(vazio, "status", todosStatus, todosStatus)).toEqual({});
  });
  it("com busca: mexe só nos valores visíveis", () => {
    const so = marcarVisiveis({ status: [] }, "status", ["Ativa"], todosStatus);
    expect(so).toEqual({ status: ["Ativa"] });
    const semAtiva = desmarcarVisiveis({}, "status", ["Ativa"], todosStatus);
    expect(semAtiva).toEqual({ status: ["Arquivada", "Emitida"] });
  });
  it("limparColuna tira só aquela coluna", () => {
    expect(limparColuna({ status: ["Ativa"], fornecedor: ["Sonora"] }, "status")).toEqual({ fornecedor: ["Sonora"] });
  });
});

describe("filtrarPorColunas", () => {
  it("cruza as colunas (E)", () => {
    const r = filtrarPorColunas(OSS, { status: ["Ativa"], fornecedor: ["Sonora"] }, EXTRATORES);
    expect(r.map((o) => o.id)).toEqual([1]);
  });
  it("o vazio é um valor filtrável", () => {
    expect(filtrarPorColunas(OSS, { fornecedor: [""] }, EXTRATORES).map((o) => o.id)).toEqual([4]);
  });
  it("filtro de coluna sem extrator não esconde nada", () => {
    expect(filtrarPorColunas(OSS, { sumiu: ["x"] }, EXTRATORES)).toHaveLength(4);
  });
});

describe("opcoesDaColuna", () => {
  it("conta sobre as OUTRAS colunas filtradas e ignora o próprio filtro", () => {
    const op = opcoesDaColuna(OSS, "status", { fornecedor: ["Sonora"], status: ["Ativa"] }, EXTRATORES);
    expect(op).toEqual([{ valor: "Ativa", quantidade: 1 }, { valor: "Emitida", quantidade: 1 }]);
  });
  it("mantém o valor marcado que outra coluna escondeu, com zero", () => {
    const op = opcoesDaColuna(OSS, "status", { fornecedor: ["Buffet"], status: ["Emitida"] }, EXTRATORES);
    expect(op).toEqual([{ valor: "Ativa", quantidade: 1 }, { valor: "Emitida", quantidade: 0 }]);
  });
  it("vazio vai para o fim; número ordena como número", () => {
    const op = opcoesDaColuna(OSS, "codigo", {}, EXTRATORES, "numero");
    expect(op.map((o) => o.valor)).toEqual(["2", "12", "13", ""]);
  });
  it("data do mais recente para o mais antigo", () => {
    const op = opcoesDaColuna(OSS, "dia", {}, EXTRATORES, "data");
    expect(op).toEqual([
      { valor: "2026-11-10", quantidade: 2 },
      { valor: "2026-11-09", quantidade: 1 },
      { valor: "2026-10-01", quantidade: 1 },
    ]);
  });
});

describe("diaDoCarimbo", () => {
  it("data pura passa como está", () => {
    expect(diaDoCarimbo("2026-11-09")).toBe("2026-11-09");
  });
  it("carimbo vira o dia no fuso local", () => {
    const iso = new Date(2026, 10, 9, 23, 30).toISOString();
    expect(diaDoCarimbo(iso)).toBe("2026-11-09");
  });
  it("sem data é vazio", () => {
    expect(diaDoCarimbo(null)).toBe("");
    expect(diaDoCarimbo("lixo")).toBe("");
  });
});
