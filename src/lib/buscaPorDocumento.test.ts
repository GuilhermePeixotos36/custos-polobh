import { describe, expect, it, vi } from "vitest";

// A busca fala com o banco; aqui só interessam as regras puras.
vi.mock("@/data", () => ({ repo: {} }));

const { documentoCompleto, ieDaBusca } = await import("./buscaPorDocumento");

describe("documento completo para a busca automática (18/11/2026)", () => {
  it("CNPJ e CPF válidos disparam; o meio da digitação de um CNPJ não", () => {
    expect(documentoCompleto("11222333000181")).toBe(true);
    expect(documentoCompleto("52998224725")).toBe(true);
    // Os 11 primeiros dígitos de um CNPJ não são um CPF válido.
    expect(documentoCompleto("11222333000")).toBe(false);
    expect(documentoCompleto("11222333000180")).toBe(false);
  });
});

describe("IE depois da busca", () => {
  const base = { razaoSocial: "X", nomeFantasia: "", endereco: "", inscricaoMunicipal: "" };
  it("a encontrada vence; sem ela, a digitada; só sem as duas, Isenta (e só se veio da Receita)", () => {
    expect(ieDaBusca({ ...base, inscricaoEstadual: "123", origem: "receita" }, "999")).toBe("123");
    expect(ieDaBusca({ ...base, inscricaoEstadual: "", origem: "receita" }, "999")).toBe("999");
    expect(ieDaBusca({ ...base, inscricaoEstadual: "", origem: "receita" }, "")).toBe("Isenta");
    expect(ieDaBusca({ ...base, inscricaoEstadual: "", origem: "cliente" }, "")).toBe("");
  });
});
