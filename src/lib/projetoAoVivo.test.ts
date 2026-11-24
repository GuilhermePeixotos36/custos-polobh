import { describe, expect, it, vi } from "vitest";

vi.mock("@/data", () => ({ repo: {} }));

import type { Ec, Os } from "@/data/types";
import { osComDadosAtuais, osComFornecedorDoCadastro } from "./projetoAoVivo";

const viva = { cliente: { nome: "Cliente Novo", razaoSocial: "Novo S.A." }, projeto: { titulo: "Projeto Hoje" } } as unknown as Ec;
const os = (p: Partial<Os>) =>
  ({ cliente: { nome: "Cliente Velho" }, projeto: { titulo: "Projeto Antigo" }, status: "Rascunho", ...p }) as unknown as Os;

describe("osComDadosAtuais", () => {
  it("OS ainda não emitida sai com o cliente e o projeto do cadastro de agora", () => {
    const r = osComDadosAtuais(os({}), viva);
    expect(r.cliente.nome).toBe("Cliente Novo");
    expect(r.projeto.titulo).toBe("Projeto Hoje");
  });

  it("OS emitida fica com a foto de quando foi emitida", () => {
    const r = osComDadosAtuais(os({ status: "Emitida", fase: "emitida" } as Partial<Os>), viva);
    expect(r.cliente.nome).toBe("Cliente Velho");
    expect(r.projeto.titulo).toBe("Projeto Antigo");
  });

  it("OS emitida completa o projeto incentivado EM BRANCO com os Dados Gerais de agora", () => {
    const vivaInc = {
      ...viva,
      projeto: { titulo: "Projeto Hoje", projetoIncentivado: "Festival Hoje", codigoProjetoIncentivado: "PRONAC 26 1234", leiIncentivo: "Lei Rouanet" },
    } as unknown as Ec;
    const emitida = os({
      status: "Emitida", fase: "emitida",
      projeto: { titulo: "Projeto Antigo", projetoIncentivado: "Festival da Emissão", codigoProjetoIncentivado: "", leiIncentivo: "" },
    } as unknown as Partial<Os>);
    const r = osComDadosAtuais(emitida, vivaInc);
    // O que a emissão gravou continua; só o vazio é completado.
    expect(r.projeto.projetoIncentivado).toBe("Festival da Emissão");
    expect(r.projeto.codigoProjetoIncentivado).toBe("PRONAC 26 1234");
    expect(r.projeto.leiIncentivo).toBe("Lei Rouanet");
    expect(r.projeto.titulo).toBe("Projeto Antigo");
    expect(r.cliente.nome).toBe("Cliente Velho");
  });
});

describe("osComFornecedorDoCadastro (24/11/2026)", () => {
  const forn = { cnpj: "11.222.333/0001-81", razaoSocial: "Velha Ltda", endereco: "Rua Antiga", telefone: "(31) 3333-0000", dadosBancarios: { banco: "Itaú" } };
  const cadastro = { cnpj: "11.222.333/0001-81", razaoSocial: "Nova Ltda", endereco: "Rua Nova", telefone: "", dadosBancarios: { banco: "" } } as unknown as Parameters<typeof osComFornecedorDoCadastro>[1];

  it("OS não emitida sai com o fornecedor do cadastro; vazio no cadastro não apaga", () => {
    const r = osComFornecedorDoCadastro(os({ fornecedor: forn } as unknown as Partial<Os>), cadastro);
    expect(r.fornecedor.razaoSocial).toBe("Nova Ltda");
    expect(r.fornecedor.endereco).toBe("Rua Nova");
    expect(r.fornecedor.telefone).toBe("(31) 3333-0000");
    expect(r.fornecedor.dadosBancarios.banco).toBe("Itaú");
  });

  it("OS emitida fica com a foto; sem cadastro, com o que a OS guardou", () => {
    const emitida = os({ status: "Emitida", fase: "emitida", fornecedor: forn } as unknown as Partial<Os>);
    expect(osComFornecedorDoCadastro(emitida, cadastro).fornecedor.razaoSocial).toBe("Velha Ltda");
    expect(osComFornecedorDoCadastro(os({ fornecedor: forn } as unknown as Partial<Os>), undefined).fornecedor.razaoSocial).toBe("Velha Ltda");
  });
});
