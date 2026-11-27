import { describe, expect, it } from "vitest";
import { novoCliente, tipoDoCliente, validarCadastroCliente } from "./clienteCadastro";
import type { Cliente } from "@/data/types";

const ENDERECO = "Rua dos Carijós, 100 - Centro, Belo Horizonte - MG, 30120-060";
const cliente = (patch: Partial<Cliente> = {}): Cliente => ({
  ...novoCliente(), nome: "Banco Mercantil", apelido: "BM", razaoSocial: "Banco Mercantil do Brasil S/A",
  cnpjCpf: "11.222.333/0001-81", endereco: ENDERECO, ...patch,
});

describe("validarCadastroCliente", () => {
  it("cadastro completo passa", () => {
    expect(validarCadastroCliente(cliente(), "CNPJ", [])).toEqual({});
  });

  it("documento: em branco, inválido e repetido", () => {
    expect(validarCadastroCliente(cliente({ cnpjCpf: "" }), "CNPJ", []).documento).toMatch(/Informe o CNPJ/);
    expect(validarCadastroCliente(cliente({ cnpjCpf: "11.222.333/0001-00" }), "CNPJ", []).documento).toMatch(/inválido/);
    const outro = { id: "x", cnpjCpf: "11222333000181", nome: "Outro", razaoSocial: "", apelido: "OT" };
    expect(validarCadastroCliente(cliente(), "CNPJ", [outro]).documento).toMatch(/já está cadastrado: Outro/);
  });

  it("o próprio registro não conta como repetido", () => {
    const eu = cliente({ id: "a" });
    expect(validarCadastroCliente(eu, "CNPJ", [eu])).toEqual({});
  });

  it("nome e apelido são obrigatórios; apelido não se repete (sem olhar caixa ou acento)", () => {
    const e = validarCadastroCliente(cliente({ nome: " ", apelido: "" }), "CNPJ", []);
    expect(e.nome).toBeTruthy();
    expect(e.apelido).toBeTruthy();
    const outro = { id: "x", cnpjCpf: "", nome: "Bemge", razaoSocial: "", apelido: "bm" };
    expect(validarCadastroCliente(cliente(), "CNPJ", [outro]).apelido).toMatch(/já é do cliente Bemge/);
  });

  it("endereço incompleto e e-mail do representante inválido são apontados", () => {
    expect(validarCadastroCliente(cliente({ endereco: "Rua A" }), "CNPJ", []).endereco).toMatch(/incompleto/);
    const c = cliente({ representante: { nome: "Ana", cargo: "", telefones: "", email: "ana@" } });
    expect(validarCadastroCliente(c, "CNPJ", []).representante).toMatch(/inválido/);
  });

  it("tipo pelo documento", () => {
    expect(tipoDoCliente({ cnpjCpf: "123.456.789-09" })).toBe("CPF");
    expect(tipoDoCliente({ cnpjCpf: "" })).toBe("CNPJ");
  });
});
