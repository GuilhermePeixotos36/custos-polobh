import { describe, expect, it } from "vitest";
import {
  aplicarConsulta, buscaPorDocumento, camposDaCasaLiberados, camposTravados, faltandoNoCadastroParaOs,
  filtrarFornecedores, fornecedorDaOsPeloCadastro, fornecedorEmBranco, linhaComFornecedor, opcoesDeFornecedores,
  opcoesPerfilNoCadastro, situacaoFornecedor, tipoDocumento, filtrarListaFornecedores,
} from "./cadastroFornecedor";
import type { Fornecedor } from "@/data/types";
import type { DadosCnpj } from "@/lib/cnpj";

/** Documentos de teste com dígito verificador válido (não são de ninguém do cadastro). */
const CNPJ = "11.222.333/0001-81";
const CPF = "529.982.247-25";
const ENDERECO_COMPLETO = "Rua Exemplo, 100 - Centro - Belo Horizonte - MG - CEP: 30100-000";

const forn = (p: Partial<Fornecedor> = {}): Fornecedor => ({ ...fornecedorEmBranco(CNPJ), id: "f1", ...p });

describe("documento do cadastro", () => {
  it("CNPJ válido, CPF válido, incompleto e inválido", () => {
    expect(tipoDocumento(CNPJ)).toBe("cnpj");
    expect(tipoDocumento("11222333000181")).toBe("cnpj");
    expect(tipoDocumento(CPF)).toBe("cpf");
    expect(tipoDocumento("11.222.333/0001-80")).toBe("invalido");
    expect(tipoDocumento("11.222")).toBe("incompleto");
    // 11 dígitos de um CNPJ no meio da digitação não viram CPF.
    expect(tipoDocumento("11222333000")).toBe("incompleto");
  });

  it("sem documento válido, os campos da casa não abrem: o CNPJ vem primeiro", () => {
    expect(camposDaCasaLiberados(forn({ cnpj: "" }))).toBe(false);
    expect(camposDaCasaLiberados(forn({ cnpj: "11.222.333/0001-80" }))).toBe(false);
    expect(camposDaCasaLiberados(forn())).toBe(true);
    expect(camposDaCasaLiberados(forn({ cnpj: CPF }))).toBe(true);
  });
});

describe("dados automáticos ficam só leitura", () => {
  it("CNPJ: o que veio preenchido trava; o vazio fica livre", () => {
    const t = camposTravados(forn({ razaoSocial: "Exemplo Ltda", nomeFantasia: "", endereco: ENDERECO_COMPLETO, cnaes: ["9001-9/02"], inscricaoEstadual: "Isenta", perfilTributario: "" }));
    expect([...t].sort()).toEqual(["cnaes", "endereco", "inscricaoEstadual", "razaoSocial"]);
  });

  it("endereço incompleto não trava (o contrato exige o endereço inteiro)", () => {
    expect(camposTravados(forn({ endereco: "Rua Exemplo" })).has("endereco")).toBe(false);
  });

  it("CPF: nada trava — pessoa física é cadastro manual", () => {
    expect(camposTravados(forn({ cnpj: CPF, razaoSocial: "Fulano de Tal", endereco: ENDERECO_COMPLETO })).size).toBe(0);
  });

  it("sem documento válido, tudo trava", () => {
    expect(camposTravados(forn({ cnpj: "123" })).size).toBe(6);
  });

  it("perfil travado: só a família Lucro pode ser confirmada", () => {
    expect(opcoesPerfilNoCadastro("Simples Nacional", true)).toBeNull();
    expect(opcoesPerfilNoCadastro("Lucro Presumido/Real", true)).toEqual(["Lucro Presumido/Real", "Lucro Presumido", "Lucro Real"]);
    expect(opcoesPerfilNoCadastro("Lucro Real", true)).toContain("Lucro Presumido");
    expect(opcoesPerfilNoCadastro("", false)).toContain("Pessoa Física (Recibo Simples)");
  });
});

describe("resposta da consulta do CNPJ", () => {
  const dados: DadosCnpj = {
    cnpj: CNPJ, razaoSocial: "Exemplo Ltda", nomeFantasia: "Exemplo", endereco: ENDERECO_COMPLETO,
    perfilTributario: "Simples Nacional", cnaes: ["9001-9/02"], email: "contador@exemplo.com",
    telefone: "(31) 3333-0000", inscricaoEstadual: "", inscricaoMunicipal: "",
  };

  it("preenche os automáticos; sem IE na pesquisa, Isenta", () => {
    const r = aplicarConsulta(forn(), dados);
    expect(r.razaoSocial).toBe("Exemplo Ltda");
    expect(r.cnaes).toEqual(["9001-9/02"]);
    expect(r.inscricaoEstadual).toBe("Isenta");
  });

  it("telefone e e-mail da casa não são trocados pelos da Receita", () => {
    const r = aplicarConsulta(forn({ telefone: "(31) 99999-0000", email: "maria@exemplo.com" }), dados);
    expect(r.telefone).toBe("(31) 99999-0000");
    expect(r.email).toBe("maria@exemplo.com");
    // Em branco, a consulta preenche.
    expect(aplicarConsulta(forn(), dados).email).toBe("contador@exemplo.com");
  });

  it("valor vazio na fonte não apaga; a IM digitada fica", () => {
    const r = aplicarConsulta(forn({ nomeFantasia: "Antigo", inscricaoMunicipal: "123" }), { ...dados, nomeFantasia: "" });
    expect(r.nomeFantasia).toBe("Antigo");
    expect(r.inscricaoMunicipal).toBe("123");
  });
});

describe("caixa combinada de fornecedor", () => {
  const lista = [
    forn({ id: "1", cnpj: "33.333.333/0001-33", razaoSocial: "Sonora Áudio e Iluminação Ltda", nomeFantasia: "Sonora" }),
    forn({ id: "2", cnpj: "12.345.678/0001-90", razaoSocial: "Buffet Sabor & Arte Eireli", nomeFantasia: "" }),
    forn({ id: "3", cnpj: CPF, razaoSocial: "José da Silva", nomeFantasia: "" }),
    // Sem documento e repetido não viram opção.
    forn({ id: "4", cnpj: "", razaoSocial: "Sem Documento" }),
    forn({ id: "5", cnpj: "33333333000133", razaoSocial: "Sonora repetida" }),
  ];
  const opcoes = opcoesDeFornecedores(lista);

  it("aberta e vazia: a lista completa em ordem alfabética", () => {
    expect(opcoes.map((o) => o.rotulo)).toEqual(["Buffet Sabor & Arte Eireli", "José da Silva", "Sonora Áudio e Iluminação Ltda"]);
    expect(filtrarFornecedores(opcoes, "").total).toBe(3);
  });

  it("CNPJ com ou sem máscara, parcial ou completo", () => {
    expect(filtrarFornecedores(opcoes, "12345678000190").visiveis[0].rotulo).toBe("Buffet Sabor & Arte Eireli");
    expect(filtrarFornecedores(opcoes, "12.345.678/0001-90").visiveis[0].valor).toBe("12345678000190");
    expect(filtrarFornecedores(opcoes, "33.333").visiveis.map((o) => o.valor)).toEqual(["33333333000133"]);
    // O meio do documento também acha, depois dos que começam por ele.
    expect(filtrarFornecedores(opcoes, "0001").total).toBe(2);
  });

  it("parte do nome, sem acento e sem caixa, inclusive o nome fantasia", () => {
    expect(filtrarFornecedores(opcoes, "jose").visiveis[0].rotulo).toBe("José da Silva");
    expect(filtrarFornecedores(opcoes, "AUDIO sonora").total).toBe(1);
    expect(filtrarFornecedores(opcoes, "arte").visiveis[0].rotulo).toBe("Buffet Sabor & Arte Eireli");
    expect(filtrarFornecedores(opcoes, "inexistente").total).toBe(0);
  });

  it("o que é digitação de documento", () => {
    expect(buscaPorDocumento("12.345")).toBe(true);
    expect(buscaPorDocumento("Sonora 2")).toBe(false);
    expect(buscaPorDocumento("./-")).toBe(false);
  });
});

describe("a linha da EC diante do cadastro", () => {
  const cadastro = [forn({ cnpj: CNPJ })];

  it("cadastrado, sem cadastro, só razão social digitada (linha antiga) e vazio", () => {
    expect(situacaoFornecedor("11222333000181", "", cadastro)).toBe("cadastrado");
    expect(situacaoFornecedor("33.333.333/0001-33", "Outra", cadastro)).toBe("sem-cadastro");
    expect(situacaoFornecedor("", "Digitado à mão", cadastro)).toBe("sem-documento");
    expect(situacaoFornecedor("", "  ", cadastro)).toBe("vazio");
  });

  it("escolher do cadastro grava o CNPJ com máscara e a razão social", () => {
    expect(linhaComFornecedor({ cnpj: "11222333000181", razaoSocial: "Exemplo Ltda", nomeFantasia: "Ex" }))
      .toEqual({ fornecedorCnpj: CNPJ, fornecedorRazao: "Exemplo Ltda" });
  });
});

describe("a OS lê o fornecedor do cadastro", () => {
  it("trocar de fornecedor não carrega os bancários do anterior", () => {
    const novo = fornecedorDaOsPeloCadastro(forn({ razaoSocial: "Novo Ltda", dadosBancarios: undefined as unknown as Fornecedor["dadosBancarios"] }));
    expect(novo.razaoSocial).toBe("Novo Ltda");
    expect(novo.dadosBancarios).toEqual({ tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "" });
  });

  it("aponta o que falta no cadastro para emitir a OS", () => {
    expect(faltandoNoCadastroParaOs({ endereco: "x", perfilTributario: "MEI", telefone: "", email: "" })).toEqual(["telefone", "e-mail"]);
  });
});

describe("busca da tela de fornecedores", () => {
  const lista = [
    forn({ id: "1", cnpj: "33.333.333/0001-33", razaoSocial: "Sonora Áudio Ltda", nomeFantasia: "Som & Luz", contatos: [{ nome: "Maria", funcao: "Financeiro" }] }),
    forn({ id: "2", cnpj: CPF, razaoSocial: "José da Silva" }),
  ];

  it("por nome (fantasia, razão, contato), sem acento", () => {
    expect(filtrarListaFornecedores(lista, "som & luz").map((f) => f.id)).toEqual(["1"]);
    expect(filtrarListaFornecedores(lista, "audio").map((f) => f.id)).toEqual(["1"]);
    expect(filtrarListaFornecedores(lista, "financeiro").map((f) => f.id)).toEqual(["1"]);
    expect(filtrarListaFornecedores(lista, "jose").map((f) => f.id)).toEqual(["2"]);
  });

  it("por documento com ou sem máscara", () => {
    expect(filtrarListaFornecedores(lista, "33333333").map((f) => f.id)).toEqual(["1"]);
    expect(filtrarListaFornecedores(lista, "529.982").map((f) => f.id)).toEqual(["2"]);
    expect(filtrarListaFornecedores(lista, "").length).toBe(2);
  });
});
