import { describe, expect, it } from "vitest";
import {
  padronizarCliente,
  padronizarEcLinha,
  padronizarFornecedor,
  padronizarProjetoInfo,
  padronizarTexto,
} from "./textos";
import { projetoInfoVazio } from "./projeto";
import type { Cliente, EcLinha, Fornecedor } from "@/data/types";

describe("como cada texto se escreve", () => {
  it("nome próprio: caixa alta da Receita vira texto escrito", () => {
    expect(padronizarTexto("BANCO MERCANTIL DO BRASIL", "titulo")).toBe("Banco Mercantil do Brasil");
  });

  it("caixa mista é decisão de gente e não se mexe", () => {
    // Regra da casa, a mesma de `gerarApelidoFornecedor`: quem escreveu
    // "Sonora AV" quis aquilo. Sem este corte, toda gravação estragaria o que a
    // equipe escreveu à mão.
    expect(padronizarTexto("Sonora AV", "titulo")).toBe("Sonora AV");
    expect(padronizarTexto("Coffee break", "frase")).toBe("Coffee break");
    expect(padronizarTexto("Rua da Bahia, 1200 — Centro, Belo Horizonte/MG", "endereco"))
      .toBe("Rua da Bahia, 1200 — Centro, Belo Horizonte/MG");
    // Mas ainda apara espaço sobrando.
    expect(padronizarTexto("  Sonora   AV  ", "titulo")).toBe("Sonora AV");
  });

  it("sigla não vira nome próprio", () => {
    // Português não começa palavra com três consoantes ("LSPRO") nem escreve
    // palavra sem vogal ("VT") — mesmo teste do apelido do fornecedor.
    expect(padronizarTexto("LSPRO LOCACOES E EVENTOS LTDA", "titulo-empresa"))
      .toBe("LSPRO Locacoes e Eventos LTDA");
  });

  it("endereço preserva a UF e o CEP", () => {
    // Passar o endereço inteiro pelo Nome Próprio produz "Mg" e "Cep:" — foi
    // assim que um cliente ficou gravado na correção manual de agosto.
    expect(padronizarTexto("AV. AGGEO PIO SOBRINHO, 265 - BURITIS - BELO HORIZONTE - MG - CEP: 30575834", "endereco"))
      .toBe("Av. Aggeo Pio Sobrinho, 265 - Buritis - Belo Horizonte - MG - CEP: 30575834");
  });

  it("palavra acentuada de duas letras não é confundida com UF", () => {
    expect(padronizarTexto("PRAÇA DA SÉ, 100 - SÃO PAULO - SP", "endereco"))
      .toBe("Praça da Sé, 100 - São Paulo - SP");
  });

  it("razão social preserva a sigla societária", () => {
    expect(padronizarTexto("BANCO MERCANTIL DO BRASIL SA", "titulo-empresa")).toBe(
      "Banco Mercantil do Brasil SA"
    );
    expect(padronizarTexto("POLOBH PROMOCOES LTDA", "titulo-empresa")).toBe("Polobh Promocoes LTDA");
    // Palavra comprida com três consoantes seguidas não é sigla: "CONSTRUTORA"
    // tem "nstr", e sem teto de tamanho ficaria gritando no meio do texto.
    expect(padronizarTexto("CONSTRUTORA PATRIMÔNIO LTDA", "titulo-empresa"))
      .toBe("Construtora Patrimônio LTDA");
  });

  it("frase: caixa alta inteira vira frase escrita", () => {
    expect(padronizarTexto("BUFFET PARA 300 PAX", "frase")).toBe("Buffet para 300 pax");
  });

  it("livre só apara espaços: documento, telefone e e-mail ficam como estão", () => {
    expect(padronizarTexto("  12.345.678/0001-90 ", "livre")).toBe("12.345.678/0001-90");
    expect(padronizarTexto("ANA@ACME.COM", "livre")).toBe("ANA@ACME.COM");
  });

  it("vazio continua vazio, sem inventar texto", () => {
    expect(padronizarTexto("", "titulo")).toBe("");
    expect(padronizarTexto(undefined, "titulo")).toBe("");
    expect(padronizarTexto(null, "inscricao")).toBe("");
  });
});

/**
 * O caso que abriu esta conversa: a inscrição aceita duas coisas muito
 * diferentes no mesmo campo — um número que precisa bater com a Receita, e uma
 * palavra dizendo que não há inscrição.
 */
describe("inscrição estadual/municipal", () => {
  it("'ISENTO' vira 'Isento'", () => {
    expect(padronizarTexto("ISENTO", "inscricao")).toBe("Isento");
    expect(padronizarTexto("NÃO CONTRIBUINTE", "inscricao")).toBe("Não Contribuinte");
  });

  it("número de inscrição fica EXATAMENTE como veio", () => {
    // Formatar aqui quebraria a conferência com a fonte.
    expect(padronizarTexto("0044120/002-1", "inscricao")).toBe("0044120/002-1");
    expect(padronizarTexto("062.307.657.0119", "inscricao")).toBe("062.307.657.0119");
    expect(padronizarTexto("ISENTO 123", "inscricao")).toBe("ISENTO 123");
    expect(padronizarTexto("Isento", "inscricao")).toBe("Isento");
  });
});

const cliente = (p: Partial<Cliente>): Cliente => ({
  id: "c1", apelido: "", nome: "", razaoSocial: "", endereco: "", cnpjCpf: "",
  inscricaoEstadual: "", inscricaoMunicipal: "",
  representante: { nome: "", cargo: "", telefones: "", email: "" },
  ...p,
});

describe("cliente inteiro, como a consulta de CNPJ o entrega", () => {
  it("põe cada campo na sua forma, e não mexe em documento nem contato", () => {
    const c = padronizarCliente(
      cliente({
        apelido: "BM",
        nome: "BANCO MERCANTIL",
        razaoSocial: "BANCO MERCANTIL DO BRASIL SA",
        endereco: "AV. DO CONTORNO, 5800 - SAVASSI - BELO HORIZONTE - MG",
        cnpjCpf: "17.184.037/0001-10",
        inscricaoEstadual: "ISENTO",
        inscricaoMunicipal: "0044120/002-1",
        representante: { nome: "ANA PAULA SOUZA", cargo: "DIRETORA", telefones: "(31) 3333-4444", email: "ANA@MERCANTIL.COM" },
      })
    );
    expect(c.nome).toBe("Banco Mercantil");
    // O apelido é código curto da casa e vira prefixo do número da EC: "BM",
    // não "Bm".
    expect(c.apelido).toBe("BM");
    expect(c.razaoSocial).toBe("Banco Mercantil do Brasil SA");
    expect(c.endereco).toBe("Av. do Contorno, 5800 - Savassi - Belo Horizonte - MG");
    expect(c.inscricaoEstadual).toBe("Isento");
    // Intocados de propósito:
    expect(c.cnpjCpf).toBe("17.184.037/0001-10");
    expect(c.inscricaoMunicipal).toBe("0044120/002-1");
    expect(c.representante.email).toBe("ANA@MERCANTIL.COM");
    expect(c.representante.nome).toBe("Ana Paula Souza");
  });

  it("é idempotente: passar de novo não muda nada", () => {
    const uma = padronizarCliente(cliente({ nome: "ACME EVENTOS", razaoSocial: "ACME EVENTOS LTDA" }));
    expect(padronizarCliente(uma)).toEqual(uma);
  });
});

const fornecedor = (p: Partial<Fornecedor>): Fornecedor => ({
  id: "f1", razaoSocial: "", cnpj: "", perfilTributario: "", endereco: "",
  inscricaoEstadual: "", inscricaoMunicipal: "",
  dadosBancarios: { tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "" },
  representante: "", telefone: "", email: "", ...p,
});

describe("fornecedor", () => {
  it("razão social, endereço e representante entram; o apelido da casa não", () => {
    const f = padronizarFornecedor(
      fornecedor({
        razaoSocial: "SOM & LUZ PRODUÇÕES LTDA",
        apelido: "Som & Luz",
        endereco: "RUA DOS TIMBIRAS, 100 - BELO HORIZONTE - MG",
        representante: "CARLOS ALBERTO",
        inscricaoEstadual: "ISENTO",
      })
    );
    expect(f.razaoSocial).toBe("Som & Luz Produções LTDA");
    expect(f.endereco).toBe("Rua dos Timbiras, 100 - Belo Horizonte - MG");
    expect(f.representante).toBe("Carlos Alberto");
    expect(f.inscricaoEstadual).toBe("Isento");
    // O apelido é escolha da casa e entra no título da OS: fica como escreveram.
    expect(f.apelido).toBe("Som & Luz");
  });
});

describe("dados do evento", () => {
  it("normaliza local, endereço e produtora — e não reescreve o título composto", () => {
    const info = padronizarProjetoInfo({
      ...projetoInfoVazio(),
      titulo: "ACME – Convenção – 2026",
      nomeProjeto: "CONVENÇÃO ANUAL",
      local: "EXPOMINAS",
      enderecoLocal: "AV. AMAZONAS, 6200 - BELO HORIZONTE - MG",
      produtoraResponsavel: "MARISA",
    });
    expect(info.nomeProjeto).toBe("Convenção Anual");
    expect(info.local).toBe("Expominas");
    expect(info.enderecoLocal).toBe("Av. Amazonas, 6200 - Belo Horizonte - MG");
    expect(info.produtoraResponsavel).toBe("Marisa");
    // O título é composto e às vezes ajustado à mão para o documento.
    expect(info.titulo).toBe("ACME – Convenção – 2026");
  });
});

describe("linha da EC", () => {
  it("normaliza o fornecedor; grupo e nome do item ficam como estão", () => {
    const l = padronizarEcLinha({
      grupo: "EQUIPE PRODUÇÃO",
      item: "ECAD",
      fornecedorRazao: "SOM & LUZ PRODUÇÕES LTDA",
      fornecedorContato: "CARLOS ALBERTO",
    } as EcLinha);
    // Cabeçalho: é assim que sai no documento.
    expect(l.grupo).toBe("EQUIPE PRODUÇÃO");
    // Sigla da casa: baixar automaticamente daria "Ecad".
    expect(l.item).toBe("ECAD");
    expect(l.fornecedorRazao).toBe("Som & Luz Produções LTDA");
    expect(l.fornecedorContato).toBe("Carlos Alberto");
  });
});
