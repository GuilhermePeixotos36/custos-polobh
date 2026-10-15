import { describe, expect, it } from "vitest";
import { dividirLinha, motivoDivisaoInvalida } from "./ec";
import type { EcLinha } from "@/data/types";

const original = {
  id: "a", grupo: "EQUIPE PRODUÇÃO", item: "Equipe", descricao: "Equipe de produção",
  valorPolobh: 1275, valorCliente: 1500, valorComBvNf: 1275, valorSemBvComNf: 1200, valorSemBvSemNf: 0,
  statusAprovacao: "OK", statusOs: "OK", contratoStatus: "Não se Aplica",
  fornecedorRazao: "Stefano", fornecedorCnpj: "65.384.520/0001-90", oculto: false,
} as unknown as EcLinha;
const base = { id: "b", grupo: "", item: "", descricao: "", valorPolobh: 0, valorCliente: 0, statusAprovacao: "Pendente", statusOs: "Pendente", contratoStatus: "Pendente", fornecedorRazao: "", fornecedorCnpj: "", oculto: false } as unknown as EcLinha;

describe("dividir item da EC", () => {
  it("o original fica com o resto e a soma não muda", () => {
    const [resto, nova] = dividirLinha(original, { item: "Produtor 1/2 diária", descricao: "", valorPolobh: 425, valorCliente: 500 }, base);
    expect(resto.valorPolobh + nova.valorPolobh).toBe(1275);
    expect(resto.valorCliente + nova.valorCliente).toBe(1500);
    expect(resto.fornecedorRazao).toBe("Stefano");
    expect(resto.statusOs).toBe("OK");
  });
  it("as formas de cobrança do original não passam do que sobrou", () => {
    const [resto] = dividirLinha(original, { item: "x", descricao: "", valorPolobh: 425, valorCliente: 0 }, base);
    expect(resto.valorComBvNf).toBe(850);
    expect(resto.valorSemBvComNf).toBe(850);
  });
  it("a parte nova nasce no mesmo grupo, sem fornecedor, aprovada e pedindo OS", () => {
    const [, nova] = dividirLinha(original, { item: "Produtor 1/2 diária", descricao: "", valorPolobh: 425, valorCliente: 0 }, base);
    expect(nova).toMatchObject({ grupo: "EQUIPE PRODUÇÃO", fornecedorRazao: "", statusAprovacao: "OK", statusOs: "Emitir", descricao: "Produtor 1/2 diária", contratoStatus: "Não se Aplica" });
  });
  it("recusa valor maior que o do item e nome vazio", () => {
    expect(motivoDivisaoInvalida(original, { item: "x", descricao: "", valorPolobh: 2000, valorCliente: 0 })).toMatch(/Pólobh/);
    expect(motivoDivisaoInvalida(original, { item: " ", descricao: "", valorPolobh: 10, valorCliente: 0 })).toMatch(/nome/);
    expect(motivoDivisaoInvalida(original, { item: "x", descricao: "", valorPolobh: 10, valorCliente: 0 })).toBeNull();
  });
});
