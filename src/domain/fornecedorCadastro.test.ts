import { describe, expect, it } from "vitest";
import {
  contatosDasLinhas, linhasDosContatos, rotuloIdFornecedor, semCamposDeEmpresa, tipoDoFornecedor, validarCadastroFornecedor,
  type LinhaContato,
} from "@/domain/fornecedorCadastro";
import type { Fornecedor } from "@/data/types";

const ENDERECO_OK = "Rua das Flores, 100 - Centro, Belo Horizonte - MG, 30130-000";
const forn = (extra: Partial<Fornecedor> = {}): Fornecedor => ({
  id: "", razaoSocial: "Som Teste Ltda", cnpj: "11.222.333/0001-81", perfilTributario: "", endereco: ENDERECO_OK,
  inscricaoEstadual: "", inscricaoMunicipal: "",
  dadosBancarios: { tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "" },
  representante: "", telefone: "", email: "", contatos: [], ...extra,
});

describe("ID e tipo do fornecedor", () => {
  it("o ID sai com quatro casas; sem número, um traço", () => {
    expect(rotuloIdFornecedor(7)).toBe("0007");
    expect(rotuloIdFornecedor(12345)).toBe("12345");
    expect(rotuloIdFornecedor(undefined)).toBe("—");
  });
  it("11 dígitos é CPF; o resto é CNPJ", () => {
    expect(tipoDoFornecedor({ cnpj: "529.982.247-25" })).toBe("CPF");
    expect(tipoDoFornecedor({ cnpj: "11.222.333/0001-81" })).toBe("CNPJ");
    expect(tipoDoFornecedor({ cnpj: "" })).toBe("CNPJ");
  });
  it("pessoa física não guarda dado de empresa", () => {
    const pf = semCamposDeEmpresa(forn({ nomeFantasia: "Som", inscricaoEstadual: "123", inscricaoMunicipal: "456", cnaes: ["x"] }));
    expect([pf.nomeFantasia, pf.inscricaoEstadual, pf.inscricaoMunicipal, pf.cnaes]).toEqual(["", "", "", []]);
  });
});

describe("contatos: do banco para o formulário e de volta", () => {
  it("quem tem telefone e e-mail vira duas linhas com o mesmo nome", () => {
    expect(linhasDosContatos([{ nome: "Maria", funcao: "Financeiro", telefone: "(31) 99999-0000", email: "maria@x.com" }])).toEqual([
      { nome: "Maria", funcao: "Financeiro", tipo: "telefone", valor: "(31) 99999-0000" },
      { nome: "Maria", funcao: "Financeiro", tipo: "email", valor: "maria@x.com" },
    ]);
  });
  it("linhas do mesmo nome voltam a ser uma pessoa só, sem perder o cargo", () => {
    const linhas = linhasDosContatos([{ nome: "Maria", funcao: "Financeiro", telefone: "(31) 99999-0000", email: "maria@x.com" }]);
    expect(contatosDasLinhas(linhas)).toEqual([{ nome: "Maria", funcao: "Financeiro", telefone: "(31) 99999-0000", email: "maria@x.com" }]);
  });
  it("dois telefones da mesma pessoa não se atropelam", () => {
    const linhas: LinhaContato[] = [
      { nome: "João", tipo: "telefone", valor: "(31) 1111-1111" },
      { nome: "João", tipo: "telefone", valor: "(31) 2222-2222" },
    ];
    expect(contatosDasLinhas(linhas)).toEqual([
      { nome: "João", telefone: "(31) 1111-1111" },
      { nome: "João", telefone: "(31) 2222-2222" },
    ]);
  });
  it("linha em branco é descartada; contato só com valor é legítimo", () => {
    expect(contatosDasLinhas([{ nome: "", tipo: "telefone", valor: "" }, { nome: "", tipo: "email", valor: "a@b.co" }])).toEqual([
      { nome: "", email: "a@b.co" },
    ]);
  });
});

describe("validação do cadastro", () => {
  it("cadastro completo passa", () => {
    expect(validarCadastroFornecedor(forn(), "CNPJ", [], [])).toEqual({});
  });
  it("barra CNPJ e CPF inválidos e documento em branco", () => {
    expect(validarCadastroFornecedor(forn({ cnpj: "11.222.333/0001-00" }), "CNPJ", [], []).documento).toMatch(/CNPJ inválido/);
    expect(validarCadastroFornecedor(forn({ cnpj: "111.111.111-11" }), "CPF", [], []).documento).toMatch(/CPF inválido/);
    expect(validarCadastroFornecedor(forn({ cnpj: "" }), "CNPJ", [], []).documento).toBe("Informe o CNPJ.");
    expect(validarCadastroFornecedor(forn({ cnpj: "529.982.247-25" }), "CPF", [], [])).toEqual({});
  });
  it("não deixa duplicar o documento, mas deixa regravar o próprio cadastro", () => {
    const outro = { id: "abc", cnpj: "11222333000181", razaoSocial: "Som Teste Ltda", nomeFantasia: "Som" };
    expect(validarCadastroFornecedor(forn(), "CNPJ", [], [outro]).documento).toBe("Este CNPJ já está cadastrado: Som.");
    expect(validarCadastroFornecedor(forn({ id: "abc" }), "CNPJ", [], [outro])).toEqual({});
  });
  it("exige nome e endereço completo", () => {
    expect(validarCadastroFornecedor(forn({ razaoSocial: " " }), "CNPJ", [], []).nome).toBe("Informe a razão social.");
    expect(validarCadastroFornecedor(forn({ razaoSocial: " " }), "CPF", [], []).nome).toBe("Informe o nome completo.");
    expect(validarCadastroFornecedor(forn({ endereco: "Rua das Flores" }), "CNPJ", [], []).endereco).toMatch(/Endereço incompleto/);
  });
  it("confere os contatos: e-mail malformado e linha com nome e sem valor", () => {
    expect(validarCadastroFornecedor(forn(), "CNPJ", [{ nome: "Ana", tipo: "email", valor: "ana@" }], []).contatos).toMatch(/E-mail inválido/);
    expect(validarCadastroFornecedor(forn(), "CNPJ", [{ nome: "Ana", tipo: "telefone", valor: "" }], []).contatos).toMatch(/Informe o telefone de Ana/);
    expect(validarCadastroFornecedor(forn(), "CNPJ", [{ nome: "Ana", tipo: "email", valor: "ana@x.com" }], [])).toEqual({});
  });
});
