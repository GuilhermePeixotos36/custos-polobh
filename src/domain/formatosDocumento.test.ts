import { describe, expect, it } from "vitest";
import { formatarCnpjCpf, formatarInscricaoEstadual, formatarRazaoSocial, formatarTelefone, municipioDoEndereco } from "./formatosDocumento";

describe("CNPJ e CPF com pontuação completa", () => {
  it("14 dígitos viram CNPJ, 11 viram CPF", () => {
    expect(formatarCnpjCpf("07128230000180")).toBe("07.128.230/0001-80");
    expect(formatarCnpjCpf("11144477735")).toBe("111.444.777-35");
  });
  it("o que já está pontuado não muda, e o que não é número fica como veio", () => {
    expect(formatarCnpjCpf("51.411.303/0001-38")).toBe("51.411.303/0001-38");
    expect(formatarCnpjCpf("Isento")).toBe("Isento");
    expect(formatarCnpjCpf("")).toBe("");
  });
});

describe("Inscrição Estadual", () => {
  it("MG: 13 dígitos em 003.007.740/0011", () => {
    expect(formatarInscricaoEstadual("003007740.00-11")).toBe("003.007.740/0011");
    expect(formatarInscricaoEstadual("0030077400011")).toBe("003.007.740/0011");
  });
  it("Isento e inscrições de outro tamanho ficam como vieram", () => {
    expect(formatarInscricaoEstadual("Isento")).toBe("Isento");
    expect(formatarInscricaoEstadual("12345")).toBe("12345");
  });
});

describe("razão social", () => {
  it("Ltda. com o ponto e só a inicial maiúscula", () => {
    expect(formatarRazaoSocial("Polobh Promoções LTDA")).toBe("Polobh Promoções Ltda.");
    expect(formatarRazaoSocial("CS Comunicação e Arte Ltda")).toBe("CS Comunicação e Arte Ltda.");
    expect(formatarRazaoSocial("CS Comunicação e Arte Ltda.")).toBe("CS Comunicação e Arte Ltda.");
    expect(formatarRazaoSocial("MF PROMOÇÕES EIRELI")).toBe("MF PROMOÇÕES Eireli");
  });
  it("não mexe no resto do nome", () => {
    expect(formatarRazaoSocial("BANCO X S.A.")).toBe("BANCO X S.A.");
    expect(formatarRazaoSocial("")).toBe("");
  });
});

describe("município lido do endereço", () => {
  it("os formatos que o sistema guarda", () => {
    expect(municipioDoEndereco("Av. Aggeo Pio Sobrinho, 265 - Buritis, Belo Horizonte - MG, 30575-834")).toBe("Belo Horizonte - MG");
    expect(municipioDoEndereco("Rua do Fornecedor, 300 - Bairro Industrial - Contagem - MG - CEP: 32000-000")).toBe("Contagem - MG");
    expect(municipioDoEndereco("Av. do Cliente, 1 — Belo Horizonte/MG")).toBe("Belo Horizonte - MG");
  });
  it("endereço sem cidade e estado não vira palpite", () => {
    expect(municipioDoEndereco("Rua Dom Joaquim Silverio,154 |apt 402 -Coração Eucarístico")).toBe("");
    expect(municipioDoEndereco("Rua A, 10 - MG")).toBe("");
    expect(municipioDoEndereco("")).toBe("");
  });
});

describe("telefone", () => {
  it("fixo e celular ganham a formatação; o resto fica como veio", () => {
    expect(formatarTelefone("3132715531")).toBe("(31) 3271-5531");
    expect(formatarTelefone("31984892098")).toBe("(31) 98489-2098");
    expect(formatarTelefone("(31) 3658-0550")).toBe("(31) 3658-0550");
    expect(formatarTelefone("0800 123 456 7")).toBe("0800 123 456 7");
    expect(formatarTelefone("ramal 12")).toBe("ramal 12");
    expect(formatarTelefone("")).toBe("");
  });
});
