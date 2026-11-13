import { describe, expect, it } from "vitest";
import { camposFaltando, formatarCep, formatarEndereco, lerEndereco, tipoPorExtenso } from "./endereco";

describe("formatarEndereco", () => {
  it("escreve no padrão: Tipo Nome, Número - Complemento - Bairro - Cidade - UF - CEP: …", () => {
    expect(
      formatarEndereco({ tipo: "Avenida", nome: "Aggeo Pio Sobrinho", numero: "265", complemento: "", bairro: "Buritis", cidade: "Belo Horizonte", uf: "mg", cep: "30575834" }),
    ).toBe("Avenida Aggeo Pio Sobrinho, 265 - Buritis - Belo Horizonte - MG - CEP: 30575-834");
  });

  it("com complemento, ele entra depois do número", () => {
    expect(
      formatarEndereco({ tipo: "Avenida", nome: "Prudente de Morais", numero: "621", complemento: "Sala 212", bairro: "Santo Antônio", cidade: "Belo Horizonte", uf: "MG", cep: "30350143" }),
    ).toBe("Avenida Prudente de Morais, 621 - Sala 212 - Santo Antônio - Belo Horizonte - MG - CEP: 30350-143");
  });

  it("campo vazio não deixa buraco nem hífen sobrando", () => {
    expect(formatarEndereco({ tipo: "Rua", nome: "A", numero: "", complemento: "", bairro: "", cidade: "", uf: "", cep: "" })).toBe("Rua A");
  });
});

describe("lerEndereco", () => {
  it("lê o que a própria formatação escreveu, ida e volta", () => {
    const texto = "Avenida Prudente de Morais, 621 - Sala 212 - Santo Antônio - Belo Horizonte - MG - CEP: 30350-143";
    const { partes, padronizado } = lerEndereco(texto);
    expect(partes).toEqual({ tipo: "Avenida", nome: "Prudente de Morais", numero: "621", complemento: "Sala 212", bairro: "Santo Antônio", cidade: "Belo Horizonte", uf: "MG", cep: "30350-143" });
    expect(padronizado).toBe(true);
  });

  it("o endereço sem o tipo do logradouro (o erro da consulta de CNPJ) vem com o tipo vazio e fora do padrão", () => {
    const { partes, padronizado } = lerEndereco("Prudente de Morais, 621 - Sala 212 - Santo Antonio - Belo Horizonte - MG - CEP: 30350143");
    expect(partes.tipo).toBe("");
    expect(partes.nome).toBe("Prudente de Morais");
    expect(partes.numero).toBe("621");
    expect(partes.cep).toBe("30350-143");
    expect(padronizado).toBe(false);
    expect(camposFaltando(partes)).toEqual(["tipo"]);
  });

  it("o endereço antigo da Pólobh (abreviação, vírgulas, CEP solto) é lido e acusa o que falta padronizar", () => {
    const { partes, padronizado } = lerEndereco("Av. Aggeo Pio Sobrinho, 265 - Buritis, Belo Horizonte - MG, 30575-834");
    expect(partes.tipo).toBe("Avenida");
    expect(partes.numero).toBe("265");
    expect(partes.bairro).toBe("Buritis");
    expect(partes.cidade).toBe("Belo Horizonte");
    expect(partes.uf).toBe("MG");
    expect(partes.cep).toBe("30575-834");
    expect(padronizado).toBe(false);
  });

  it("texto vazio é endereço vazio", () => {
    expect(lerEndereco("").padronizado).toBe(true);
  });
});

describe("pequenos helpers", () => {
  it("CEP com hífen; o que não tem 8 dígitos fica como está", () => {
    expect(formatarCep("30350143")).toBe("30350-143");
    expect(formatarCep("123")).toBe("123");
  });
  it("tipo por extenso a partir de abreviação ou caixa alta", () => {
    expect(tipoPorExtenso("AV.")).toBe("Avenida");
    expect(tipoPorExtenso("rua")).toBe("Rua");
    expect(tipoPorExtenso("Qualquer")).toBe("");
  });
});

import { planejarPadronizacao, textoDoQueFalta, validarEndereco } from "./endereco";

describe("validação e padronização em lote", () => {
  it("validarEndereco aponta o que falta", () => {
    expect(validarEndereco("").faltando).toHaveLength(7);
    const r = validarEndereco("Prudente de Morais, 621 - Sala 212 - Santo Antonio - Belo Horizonte - MG - CEP: 30350143");
    expect(r.completo).toBe(false);
    expect(r.faltando).toEqual(["tipo"]);
    expect(textoDoQueFalta(r.faltando)).toBe("Falta tipo.");
    expect(validarEndereco("Avenida Prudente de Morais, 621 - Santo Antônio - Belo Horizonte - MG - CEP: 30350-143").completo).toBe(true);
  });

  it("incompleto + endereço da Receita → completa, mantendo o complemento que a casa tinha", () => {
    const r = planejarPadronizacao(
      "Prudente de Morais, 621 - Sala 212 - Santo Antonio - Belo Horizonte - MG - CEP: 30350143",
      "Avenida Prudente de Morais, 621 - Santo Antônio - Belo Horizonte - MG - CEP: 30350-143",
    );
    expect(r).toEqual({
      tipo: "completar",
      novo: "Avenida Prudente de Morais, 621 - Sala 212 - Santo Antônio - Belo Horizonte - MG - CEP: 30350-143",
      completo: true,
    });
  });

  it("completo mas fora do padrão → só reescreve, sem consultar nada", () => {
    const r = planejarPadronizacao("Avenida Aggeo Pio Sobrinho, 265 - Buritis - Belo Horizonte - MG, 30575-834", "");
    expect(r).toEqual({ tipo: "reescrever", novo: "Avenida Aggeo Pio Sobrinho, 265 - Buritis - Belo Horizonte - MG - CEP: 30575-834" });
  });

  it("completo e no padrão → nada a fazer", () => {
    expect(planejarPadronizacao("Rua A, 1 - Centro - Contagem - MG - CEP: 32000-000", "").tipo).toBe("ok");
  });

  it("incompleto sem consulta possível → não inventa", () => {
    const r = planejarPadronizacao("Rua A, 1", "");
    expect(r).toMatchObject({ tipo: "completar", completo: false });
  });
});
