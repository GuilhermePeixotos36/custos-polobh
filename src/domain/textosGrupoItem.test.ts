import { describe, expect, it } from "vitest";
import { padronizarBlocosDaOs, padronizarEcLinha, padronizarNomeGrupo, padronizarNomeItem } from "./textos";
import { aplicarAlteracaoDeLinha } from "./ec";
import type { EcLinha } from "@/data/types";

describe("nome de GRUPO — sempre em caixa alta", () => {
  it("sobe tudo e apara espaços", () => {
    expect(padronizarNomeGrupo("  equipe   produção ")).toBe("EQUIPE PRODUÇÃO");
    expect(padronizarNomeGrupo("Segurança")).toBe("SEGURANÇA");
    expect(padronizarNomeGrupo("")).toBe("");
    expect(padronizarNomeGrupo(undefined)).toBe("");
  });
});

describe("nome de ITEM — primeira letra maiúscula, siglas preservadas", () => {
  it("caixa mista é respeitada: só garante a primeira letra", () => {
    expect(padronizarNomeItem("palco")).toBe("Palco");
    expect(padronizarNomeItem("E-mail MKT")).toBe("E-mail MKT");
    expect(padronizarNomeItem("Sonorização AV")).toBe("Sonorização AV");
  });

  it("tudo em maiúsculas vira frase, preservando as siglas", () => {
    expect(padronizarNomeItem("EQUIPE TÉCNICA")).toBe("Equipe técnica");
    expect(padronizarNomeItem("MÍDIA")).toBe("Mídia");
    expect(padronizarNomeItem("ECAD")).toBe("ECAD");
    expect(padronizarNomeItem("VT")).toBe("VT");
    expect(padronizarNomeItem("EMISSÃO OS")).toBe("Emissão OS");
    expect(padronizarNomeItem("ALIMENTAÇÃO EQUIPE BV")).toBe("Alimentação equipe BV");
  });

  it("vazio continua vazio e espaços repetidos somem", () => {
    expect(padronizarNomeItem("   ")).toBe("");
    expect(padronizarNomeItem("  mão   de obra ")).toBe("Mão de obra");
  });
});

describe("na gravação", () => {
  it("a linha da EC grava grupo em caixa alta e item em frase", () => {
    const l = padronizarEcLinha({ grupo: "equipe produção", item: "TRANSPORTE", fornecedorRazao: "", fornecedorContato: "" } as EcLinha);
    expect(l.grupo).toBe("EQUIPE PRODUÇÃO");
    expect(l.item).toBe("Transporte");
  });

  it("a OS padroniza os grupos extras e os itens extras", () => {
    const r = padronizarBlocosDaOs({
      logistica: { extras: [{ id: "a", rotulo: "gerador 180 kva", valor: "x" }] } as never,
      infraestrutura: { extras: [{ id: "b", rotulo: "BALSA", valor: "y" }] } as never,
      gruposExtras: [{ id: "g", nome: "segurança", itens: [{ id: "i", rotulo: "brigadista", valor: "2" }] }],
    });
    expect(r.logistica?.extras?.[0].rotulo).toBe("Gerador 180 kva");
    expect(r.infraestrutura?.extras?.[0].rotulo).toBe("Balsa");
    expect(r.gruposExtras?.[0].nome).toBe("SEGURANÇA");
    expect(r.gruposExtras?.[0].itens[0].rotulo).toBe("Brigadista");
    expect(r.gruposExtras?.[0].itens[0].valor).toBe("2"); // o valor é prosa, tem dono próprio
  });
});

describe("descrição financeira acompanha o nome do item", () => {
  const linha = (item: string, descricao: string) => ({ item, descricao }) as EcLinha;

  it("descrição vazia segue o nome", () => {
    expect(aplicarAlteracaoDeLinha(linha("", ""), { item: "Pa" }).descricao).toBe("Pa");
    expect(aplicarAlteracaoDeLinha(linha("Pa", "Pa"), { item: "Palco" }).descricao).toBe("Palco");
  });

  it("descrição personalizada deixa de ser mexida", () => {
    expect(aplicarAlteracaoDeLinha(linha("Palco", "Palco 8x6 com cobertura"), { item: "Palco grande" }).descricao).toBe(
      "Palco 8x6 com cobertura"
    );
  });

  it("alterar a descrição no mesmo gesto prevalece; outros campos não mexem nela", () => {
    expect(aplicarAlteracaoDeLinha(linha("A", "A"), { item: "B", descricao: "Texto" }).descricao).toBe("Texto");
    expect(aplicarAlteracaoDeLinha(linha("A", "A"), { valorPolobh: 10 }).descricao).toBe("A");
  });
});
