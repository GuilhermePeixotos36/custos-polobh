import { describe, expect, it } from "vitest";
import { bancariosDoHistorico, bancariosVazios } from "./fornecedor";
import { rotulosDosBancos } from "@/lib/bancos";

const os = (id: string, numero: string, cnpj: string, banco: string, criadoEm: string) =>
  ({ id, numero, criadoEm, fornecedor: { cnpj, dadosBancarios: { tipoConta: "PJ", banco, agencia: "1", conta: "2", chavePix: "" } } }) as never;

describe("dados bancários do histórico", () => {
  const lista = [
    os("a", "OS-1", "12.345.678/0001-90", "Itaú", "2026-01-01"),
    os("b", "OS-2", "12345678000190", "Inter", "2026-03-01"),
    os("c", "OS-3", "99.999.999/0001-99", "Bradesco", "2026-04-01"),
  ];
  it("traz a OS mais recente do mesmo CNPJ, ignorando a máscara", () => {
    expect(bancariosDoHistorico(lista, "12.345.678/0001-90")?.deOs).toBe("OS-2");
  });
  it("ignora a própria OS e CNPJ sem histórico", () => {
    expect(bancariosDoHistorico(lista, "12345678000190", "b")?.deOs).toBe("OS-1");
    expect(bancariosDoHistorico(lista, "11111111000111")).toBeUndefined();
    expect(bancariosDoHistorico(lista, "123")).toBeUndefined();
  });
  it("reconhece dados vazios", () => {
    expect(bancariosVazios({ tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "" })).toBe(true);
  });
});

describe("lista de bancos", () => {
  it("formata com código de três dígitos e ordena", () => {
    expect(rotulosDosBancos([{ code: 341, name: "Itaú" }, { code: 1, name: "Banco do Brasil" }, { code: null, name: "x" }])).toEqual([
      "001 - Banco do Brasil",
      "341 - Itaú",
    ]);
  });
});
