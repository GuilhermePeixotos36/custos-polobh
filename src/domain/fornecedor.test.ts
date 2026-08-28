import { describe, expect, it } from "vitest";
import { doCadastro, gerarApelidoFornecedor, opcoesPerfilTributario, semVazios } from "./fornecedor";
import type { Fornecedor } from "@/data/types";

/**
 * Os casos abaixo são os fornecedores REAIS cadastrados na Pólobh (lidos do
 * banco em 27/08/2026) — é neles que o apelido precisa ficar bom, não em nomes
 * inventados.
 */
describe("apelido gerado a partir do nome do fornecedor", () => {
  const casos: [string, string, string][] = [
    // [razão social, nome fantasia, apelido esperado]
    ["SOM & LUZ PRODUÇÕES LTDA", "", "Som & Luz"],
    ["MONTA TUDO ESTRUTURAS LTDA", "", "Monta Tudo"],
    ["BUFFET SABOR & ARTE EIRELI", "", "Sabor & Arte"],
    ["LSPRO LOCACOES, SERVICOS E EVENTOS LTDA", "", "LSPRO"],
    ["REINECKE PRODUCOES CULTURAIS LTDA", "", "Reinecke"],
    ["Casa da Cenografia Produções Ltda", "", "Casa da Cenografia"],
    ["Sonora Áudio e Iluminação Ltda", "", "Sonora Áudio"],
  ];

  for (const [razao, fantasia, esperado] of casos) {
    it(`"${razao}" vira "${esperado}"`, () => {
      expect(gerarApelidoFornecedor(fantasia, razao)).toBe(esperado);
    });
  }
});

describe("de onde o apelido é tirado", () => {
  it("o nome fantasia manda quando existe — já é o nome curto da empresa", () => {
    expect(gerarApelidoFornecedor("Sonora AV", "Sonora Áudio e Iluminação Ltda")).toBe("Sonora AV");
  });

  it("mas o fantasia passa pela mesma peneira quando vem inchado", () => {
    expect(gerarApelidoFornecedor("Som & Luz Produções Ltda", "OUTRA COISA LTDA")).toBe("Som & Luz");
  });

  it("sem nome nenhum, não inventa apelido", () => {
    expect(gerarApelidoFornecedor("", "")).toBe("");
    expect(gerarApelidoFornecedor(undefined, undefined)).toBe("");
  });
});

describe("o que a redução preserva", () => {
  it("a atividade fica quando faz parte do nome (sobrariam menos de duas palavras)", () => {
    // Tirar "Cenografia" deixaria só "Casa" — que não identifica ninguém.
    expect(gerarApelidoFornecedor("", "Casa da Cenografia Ltda")).toBe("Casa da Cenografia");
    expect(gerarApelidoFornecedor("", "Cenografia Ltda")).toBe("Cenografia");
  });

  it("sigla não vira palavra ao acertar a caixa", () => {
    expect(gerarApelidoFornecedor("", "LSPRO EVENTOS LTDA")).toBe("LSPRO");
    expect(gerarApelidoFornecedor("", "MPG COMERCIO LTDA")).toBe("MPG");
    // "SOM" é palavra, não sigla: vira "Som".
    expect(gerarApelidoFornecedor("", "SOM MAIOR LTDA")).toBe("Som Maior");
  });

  it("caixa digitada à mão é respeitada", () => {
    expect(gerarApelidoFornecedor("", "Sonora AV Ltda")).toBe("Sonora AV");
  });

  it("nome comprido é cortado, e nunca termina em 'da'/'e'", () => {
    const apelido = gerarApelidoFornecedor("", "ASSOCIACAO BENEFICENTE DOS TRABALHADORES DA CULTURA MINEIRA LTDA");
    expect(apelido.length).toBeLessThanOrEqual(24);
    expect(apelido.split(" ").length).toBeLessThanOrEqual(4); // 3 identificadoras + ligação
    expect(apelido).not.toMatch(/\s(da|de|do|e|&)$/i);
  });

  it("nome de uma palavra só continua inteiro", () => {
    expect(gerarApelidoFornecedor("", "REINECKE")).toBe("Reinecke");
    expect(gerarApelidoFornecedor("", "PRODUCOES LTDA")).toBe("Producoes");
  });
});

describe("perfil tributário do fornecedor", () => {
  it("oferece os regimes que um fornecedor de evento realmente tem", () => {
    expect(opcoesPerfilTributario("")).toEqual([
      "MEI", "Simples Nacional", "Lucro Presumido", "Lucro Real",
      "Lucro Presumido/Real", "Imune / Isenta", "Pessoa Física (RPA)",
    ]);
  });

  it("mantém o que a consulta de CNPJ preenche sozinha", () => {
    // `lib/cnpj` não distingue Presumido de Real: o valor tem de continuar válido.
    expect(opcoesPerfilTributario("Lucro Presumido/Real")).toEqual([...opcoesPerfilTributario("")]);
  });

  it("põe na frente o valor antigo que não está na lista, em vez de apagá-lo", () => {
    const opcoes = opcoesPerfilTributario("Simples Nac.");
    expect(opcoes[0]).toBe("Simples Nac.");
    expect(opcoes).toHaveLength(8);
  });

  it("não duplica quando só a caixa difere", () => {
    expect(opcoesPerfilTributario("simples nacional")).toHaveLength(7);
  });
});

describe("o cadastro do fornecedor preenchendo a OS", () => {
  const completo = (p: Partial<Fornecedor> = {}): Fornecedor => ({
    id: "f1", razaoSocial: "SOM & LUZ PRODUÇÕES LTDA", nomeFantasia: "Som & Luz",
    cnpj: "12.345.678/0001-90", perfilTributario: "Simples Nacional",
    endereco: "Rua da Bahia, 1200", inscricaoEstadual: "062.987.654.0011",
    inscricaoMunicipal: "98765",
    dadosBancarios: { tipoConta: "PJ", banco: "Banco do Brasil (001)", agencia: "1234-5", conta: "67890-1", chavePix: "12.345.678/0001-90" },
    representante: "Roberto Dias", telefone: "(31) 98888-1122", email: "contato@someluz.com.br",
    ...p,
  });

  it("devolve o que fonte pública nenhuma tem — IE, IM, banco e representante", () => {
    const patch = doCadastro(completo());
    expect(patch.inscricaoEstadual).toBe("062.987.654.0011");
    expect(patch.inscricaoMunicipal).toBe("98765");
    expect(patch.representante).toBe("Roberto Dias");
    expect(patch.dadosBancarios?.banco).toBe("Banco do Brasil (001)");
    expect(patch.dadosBancarios?.chavePix).toBe("12.345.678/0001-90");
  });

  it("campo vazio no cadastro não entra — não pode apagar o que está na tela", () => {
    const patch = doCadastro(completo({ inscricaoMunicipal: "", representante: "   " }));
    expect("inscricaoMunicipal" in patch).toBe(false);
    expect("representante" in patch).toBe(false);
    expect(patch.razaoSocial).toBe("SOM & LUZ PRODUÇÕES LTDA");
  });

  it("cadastro sem dado bancário nenhum não manda o bloco", () => {
    const patch = doCadastro(completo({
      dadosBancarios: { tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "" },
    }));
    expect("dadosBancarios" in patch).toBe(false);
  });

  it("semVazios devolve só o que tem conteúdo de verdade", () => {
    expect(semVazios({ a: "x", b: "", c: "   ", d: undefined })).toEqual({ a: "x" });
  });
});
