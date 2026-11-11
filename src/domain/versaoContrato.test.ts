import { describe, expect, it } from "vitest";
import { versaoDoContrato } from "./versaoContrato";

describe("versões do contrato", () => {
  it("nunca emitido: vai como a (01)", () => {
    expect(versaoDoContrato({}, "abc")).toEqual({ versao: 1, jaEmitido: false });
  });
  it("mesmo conteúdo da última emissão: continua a mesma versão", () => {
    expect(versaoDoContrato({ versaoEmitida: 2, impressaoEmitida: "abc" }, "abc")).toEqual({ versao: 2, jaEmitido: true });
  });
  it("conteúdo mudou: nasce a seguinte", () => {
    expect(versaoDoContrato({ versaoEmitida: 2, impressaoEmitida: "abc" }, "xyz")).toEqual({ versao: 3, jaEmitido: false });
  });
  it("emitido antes de existir a impressão: trata como mudado", () => {
    expect(versaoDoContrato({ versaoEmitida: 1 }, "xyz")).toEqual({ versao: 2, jaEmitido: false });
  });
});

import { tituloContrato } from "./calc";
import { idsLinhasDoContrato } from "./os";
import { testemunhasDaConfig, TESTEMUNHAS_PADRAO } from "./testemunhasContrato";
import type { Ec } from "@/data/types";

const ec = (linhas: { id: string; item: string }[]) =>
  ({
    cliente: { apelido: "Banco X", nome: "Banco X" },
    projeto: { clienteAbreviado: "", nomeProjeto: "Festival de Inverno", anoProjeto: "2026", titulo: "" },
    linhas,
  }) as unknown as Ec;

describe("o título do contrato (nome do arquivo e cabeçalho do PDF)", () => {
  it("Projeto – Item – Fornecedor – Contrato (NN) em data, no molde do título da OS", () => {
    const t = tituloContrato(ec([{ id: "a", item: "Locação de som" }]), { apelido: "Som e Luz" } as never, 2, "2026-11-09", ["a"]);
    expect(t).toBe("Banco X – Festival de Inverno 2026 – Locação de som – Som e Luz – Contrato (02) em 09 11 26");
  });
  it("com mais de um item, o item vira 'Diversos'", () => {
    const t = tituloContrato(ec([{ id: "a", item: "Som" }, { id: "b", item: "Luz" }]), { apelido: "Som e Luz" } as never, 1, "2026-11-09", ["a", "b"]);
    expect(t).toContain("– Diversos –");
  });
});

describe("os itens do contrato", () => {
  const linhas = [
    { id: "a", contratoStatus: "Emitir" },
    { id: "b", contratoStatus: "OK" },
    { id: "c", contratoStatus: "Emitir Nova Versão" },
  ] as never[];
  it("são os da OS que a EC marcou para contrato", () => {
    expect(idsLinhasDoContrato({ ecLinhaIds: ["a", "b"] }, linhas)).toEqual(["a"]);
  });
  it("sem nenhum marcado, vale todos os da OS", () => {
    expect(idsLinhasDoContrato({ ecLinhaIds: ["b"] }, linhas)).toEqual(["b"]);
  });
});

describe("as testemunhas fixas gravadas", () => {
  it("sem nada gravado, as padrão", () => {
    expect(testemunhasDaConfig(undefined)).toEqual(TESTEMUNHAS_PADRAO);
  });
  it("o gravado vence, e a testemunha em branco volta ao padrão", () => {
    const t = testemunhasDaConfig([{ nome: "Ana", cpf: "1" }, { nome: "", cpf: "" }]);
    expect(t[0]).toEqual({ nome: "Ana", cpf: "1" });
    expect(t[1]).toEqual(TESTEMUNHAS_PADRAO[1]);
  });
});
