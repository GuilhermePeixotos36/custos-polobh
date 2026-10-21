import { describe, expect, it } from "vitest";
import { planoDeEmissao } from "./emissaoOs";
import type { EcLinha, Os } from "@/data/types";

const linha = (id: string, fornecedorRazao: string, fornecedorCnpj: string): EcLinha =>
  ({ id, item: id, fornecedorRazao, fornecedorCnpj, valorPolobh: 0 }) as EcLinha;
const os = (id: string, ecLinhaIds: string[], status: Os["status"] = "Rascunho"): Os =>
  ({ id, ecLinhaIds, status }) as Os;

describe("plano da emissão de OS", () => {
  it("uma OS por fornecedor: 3 itens, 2 fornecedores → 2 OSs", () => {
    const p = planoDeEmissao(
      [linha("a", "Som Ltda", "11.111.111/0001-11"), linha("b", "Som Ltda", "11111111000111"), linha("c", "Luz SA", "22.222.222/0001-22")],
      []
    );
    expect(p.grupos.map((g) => g.linhas.map((l) => l.id))).toEqual([["a", "b"], ["c"]]);
  });

  it("sem CNPJ, a razão social junta sem ligar para acento e caixa", () => {
    const p = planoDeEmissao([linha("a", "Iluminação Zé", ""), linha("b", "ILUMINACAO ZÉ ", "")], []);
    expect(p.grupos).toHaveLength(1);
  });

  it("item que já está numa OS viva: a anterior é arquivada, mesmo com status 'Emitir'", () => {
    const p = planoDeEmissao(
      [linha("a", "Som", "11111111000111")],
      [os("velha", ["a"]), os("cancelada", ["a"], "Cancelada"), os("outra", ["z"])]
    );
    expect(p.arquivar.map((o) => o.id)).toEqual(["velha"]);
    expect(p.liberar).toEqual([]);
  });

  it("itens da OS arquivada que não estão sendo emitidos voltam a 'Emitir'", () => {
    const p = planoDeEmissao([linha("a", "Som", "11111111000111")], [os("velha", ["a", "b", "c"]), os("viva", ["c"])]);
    expect(p.arquivar.map((o) => o.id)).toEqual(["velha"]);
    // "c" segue coberto pela OS "viva"; "b" ficou sem OS.
    expect(p.liberar).toEqual(["b"]);
  });
});
