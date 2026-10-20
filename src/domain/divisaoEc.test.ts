import { describe, expect, it } from "vitest";
import { infoDasDivisoes, juntarDivisoes } from "./divisaoEc";
import { dividirLinha } from "./ec";
import type { EcLinha } from "@/data/types";

const l = (p: Partial<EcLinha>) =>
  ({ id: "x", grupo: "G", item: "", descricao: "", valorPolobh: 0, valorCliente: 0, valorGasto: 0,
    valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0, statusAprovacao: "OK", statusOs: "OK",
    contratoStatus: "Pendente", fornecedorRazao: "", fornecedorCnpj: "", oculto: false, ordem: 0, ...p }) as EcLinha;

describe("item com partes", () => {
  const original = l({ id: "a", item: "Equipe", valorPolobh: 1275, valorCliente: 1500, fornecedorRazao: "Stefano" });
  const [resto, parte] = dividirLinha(original, { item: "Produtor 1/2 diária", descricao: "", valorPolobh: 425, valorCliente: 500 }, l({ id: "b" }));
  const linhas = [l({ id: "z", item: "Antes" }), resto, parte, l({ id: "w", item: "Depois" })];

  it("dividir liga as duas partes pela mesma chave", () => {
    expect(resto.divisao).toBeTruthy();
    expect(parte.divisao).toBe(resto.divisao);
  });

  it("cada parte sabe qual é e o total do item", () => {
    const info = infoDasDivisoes(linhas);
    expect(info.get("a")).toMatchObject({ parte: 1, total: 2, somaPolobh: 1275, somaCliente: 1500 });
    expect(info.get("b")?.parte).toBe(2);
    expect(info.has("z")).toBe(false);
  });

  it("para o cliente vira uma linha só, no lugar do principal, com a soma", () => {
    const juntas = juntarDivisoes(linhas);
    expect(juntas.map((x) => x.id)).toEqual(["z", "a", "w"]);
    expect(juntas[1]).toMatchObject({ item: "Equipe", valorPolobh: 1275, valorCliente: 1500 });
  });

  it("parte oculta não entra na soma e item com uma parte só fica como está", () => {
    const comOculta = [resto, { ...parte, oculto: true }];
    expect(infoDasDivisoes(comOculta).size).toBe(0);
    expect(juntarDivisoes(comOculta)[0].valorPolobh).toBe(850);
  });

  it("dividir de novo um item já dividido mantém a mesma chave", () => {
    const [, terceira] = dividirLinha(resto, { item: "Outra", descricao: "", valorPolobh: 100, valorCliente: 0 }, l({ id: "c" }));
    expect(terceira.divisao).toBe(resto.divisao);
  });
});
