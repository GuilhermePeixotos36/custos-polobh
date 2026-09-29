import { describe, expect, it } from "vitest";
import { revisarEc } from "./revisaoEc";
import type { Ec, EcLinha } from "@/data/types";

function linha(p: Partial<EcLinha>): EcLinha {
  return {
    id: "l1", grupo: "CENOGRAFIA", item: "Palco", descricao: "", descricaoCompleta: "",
    valorPolobh: 0, valorCliente: 0, valorGasto: 0,
    valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0,
    valoresNaoAplicaveis: [],
    bv: { modo: "percentual", valor: 0, justificativa: "" },
    statusAprovacao: "Pendente", fornecedorRazao: "", fornecedorCnpj: "", fornecedorContato: "",
    faturaNf: "", codigoServico: "", pedidoCompra: "",
    statusOs: "Pendente", contratoStatus: "Pendente",
    observacao: "", observacoes: [], oculto: false, ordem: 0,
    ...p,
  } as EcLinha;
}

function ec(linhas: EcLinha[], extra: Partial<Ec> = {}): Ec {
  return { id: "ec1", responsavel: "Marisa", linhas, ...extra } as Ec;
}

describe("revisarEc", () => {
  it("não acusa nada quando a EC não mudou", () => {
    const atual = ec([linha({ valorPolobh: 1000 })]);
    const r = revisarEc(structuredClone(atual), atual);
    expect(r.total).toBe(0);
  });

  it("EC que nunca foi gravada não vira uma lista de inclusões", () => {
    const r = revisarEc(null, ec([linha({}), linha({ id: "l2" })]));
    expect(r.total).toBe(0);
  });

  it("aponta o campo que mudou, com o antes e o depois já formatados", () => {
    const antes = ec([linha({ valorPolobh: 1000 })]);
    const depois = ec([linha({ valorPolobh: 1500 })]);
    const r = revisarEc(antes, depois);
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0].tipo).toBe("alterado");
    const campo = r.itens[0].campos.find((c) => c.label === "Valor Pólobh");
    expect(campo?.antes).toContain("1.000");
    expect(campo?.depois).toContain("1.500");
  });

  it("item novo e item removido aparecem como tal, sem lista de campos", () => {
    const antes = ec([linha({ id: "l1" })]);
    const depois = ec([linha({ id: "l2", item: "Som" })]);
    const r = revisarEc(antes, depois);
    expect(r.itens.map((i) => i.tipo).sort()).toEqual(["incluido", "removido"]);
    expect(r.itens.every((i) => i.campos.length === 0)).toBe(true);
  });

  it("item que troca de grupo é o MESMO item, não um removido mais um novo", () => {
    const antes = ec([linha({ grupo: "CENOGRAFIA" })]);
    const depois = ec([linha({ grupo: "AUDIOVISUAL" })]);
    const r = revisarEc(antes, depois);
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0].tipo).toBe("alterado");
    expect(r.itens[0].campos[0]).toMatchObject({ label: "Grupo", antes: "CENOGRAFIA", depois: "AUDIOVISUAL" });
  });

  it("descritivo compara o TEXTO, não a marcação HTML", () => {
    const antes = ec([linha({ descricaoCompleta: "<p>Palco 10x8</p>" })]);
    const depois = ec([linha({ descricaoCompleta: "<div><b>Palco 10x8</b></div>" })]);
    expect(revisarEc(antes, depois).total).toBe(0);
  });

  it("mudança fora dos itens entra em 'gerais'", () => {
    const antes = ec([linha({})], { responsavel: "Marisa" });
    const depois = ec([linha({})], { responsavel: "Carol" });
    const r = revisarEc(antes, depois);
    expect(r.gerais).toEqual([{ label: "Responsável", antes: "Marisa", depois: "Carol" }]);
    expect(r.total).toBe(1);
  });
});
