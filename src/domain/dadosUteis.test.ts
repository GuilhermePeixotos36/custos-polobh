import { describe, expect, it } from "vitest";
import { dadosUteisDosFornecedores } from "./dadosUteis";
import type { Ec, EcLinha, Os } from "@/data/types";

const linha = (p: Partial<EcLinha>): EcLinha =>
  ({ id: "l1", grupo: "AUDIOVISUAL", item: "Sonorização", descricao: "", ordem: 0, ...p }) as EcLinha;

const ec = (linhas: EcLinha[]): Ec => ({ id: "ec1", linhas }) as unknown as Ec;

type OsDeTeste = Omit<Partial<Os>, "fornecedor"> & { fornecedor?: Partial<Os["fornecedor"]> };

const os = (p: OsDeTeste): Os =>
  ({
    id: "os1", numero: "OS 01", ecId: "ec1", ecLinhaIds: ["l1"], status: "Emitida",
    ...p,
    fornecedor: {
      razaoSocial: "SOM & LUZ PRODUÇÕES LTDA", apelido: "Som & Luz", cnpj: "12.345.678/0001-95",
      representante: "Beltrano", telefone: "(31) 97777-0000", email: "contato@somluz.com.br",
      ...p.fornecedor,
    },
  }) as Os;

describe("folha de Dados Úteis do projeto", () => {
  const linhas = [
    linha({ id: "l1", item: "Sonorização", ordem: 0 }),
    linha({ id: "l2", item: "Iluminação cênica", ordem: 1 }),
    linha({ id: "l3", item: "Coffee break", ordem: 2 }),
  ];

  it("traz o nome curto, o contato e o que o fornecedor entrega", () => {
    const [f] = dadosUteisDosFornecedores([os({})], [ec(linhas)]);
    expect(f.fornecedor).toBe("Som & Luz");
    expect(f.itens).toEqual(["Sonorização"]);
    expect(f.contato).toBe("Beltrano");
    expect(f.telefone).toBe("(31) 97777-0000");
    expect(f.email).toBe("contato@somluz.com.br");
    expect(f.oss).toEqual(["OS 01"]);
  });

  /**
   * O ponto da folha: quem procura o telefone quer UM lugar, com tudo o que
   * aquele fornecedor faz no evento.
   */
  it("duas OSs do mesmo fornecedor viram uma linha só, com os dois serviços", () => {
    const folha = dadosUteisDosFornecedores(
      [
        os({ id: "a", numero: "OS 01", ecLinhaIds: ["l1"] }),
        os({ id: "b", numero: "OS 02", ecLinhaIds: ["l2"] }),
      ],
      [ec(linhas)]
    );
    expect(folha).toHaveLength(1);
    expect(folha[0].itens).toEqual(["Sonorização", "Iluminação cênica"]);
    expect(folha[0].oss).toEqual(["OS 01", "OS 02"]);
  });

  it("o CNPJ é que junta — razão social digitada diferente não vira duas linhas", () => {
    const folha = dadosUteisDosFornecedores(
      [
        os({ id: "a", ecLinhaIds: ["l1"] }),
        os({ id: "b", numero: "OS 02", ecLinhaIds: ["l2"], fornecedor: { razaoSocial: "Som e Luz Ltda ME" } }),
      ],
      [ec(linhas)]
    );
    expect(folha).toHaveLength(1);
  });

  it("dado que faltou numa OS é completado pela outra", () => {
    const folha = dadosUteisDosFornecedores(
      [
        os({ id: "a", fornecedor: { telefone: "", representante: "" } }),
        os({ id: "b", numero: "OS 02", ecLinhaIds: ["l2"] }),
      ],
      [ec(linhas)]
    );
    expect(folha[0].telefone).toBe("(31) 97777-0000");
    expect(folha[0].contato).toBe("Beltrano");
  });

  it("em ordem alfabética — é assim que se procura numa folha impressa", () => {
    const folha = dadosUteisDosFornecedores(
      [
        os({ id: "a", fornecedor: { apelido: "Som & Luz", cnpj: "1" } }),
        os({ id: "b", fornecedor: { apelido: "Buffet Sabor", cnpj: "2" } }),
      ],
      [ec(linhas)]
    );
    expect(folha.map((f) => f.fornecedor)).toEqual(["Buffet Sabor", "Som & Luz"]);
  });

  it("OS cancelada ou arquivada sai da folha — o fornecedor não está mais no evento", () => {
    const folha = dadosUteisDosFornecedores(
      [
        os({ id: "a", fornecedor: { apelido: "Som & Luz", cnpj: "1" } }),
        os({ id: "b", status: "Cancelada", fornecedor: { apelido: "Fora", cnpj: "2" } }),
        os({ id: "c", status: "Arquivada", fornecedor: { apelido: "Fora 2", cnpj: "3" } }),
      ],
      [ec(linhas)]
    );
    expect(folha.map((f) => f.fornecedor)).toEqual(["Som & Luz"]);
  });

  it("cai para a razão social quando não há apelido nem fantasia", () => {
    const [f] = dadosUteisDosFornecedores(
      [os({ fornecedor: { apelido: "", nomeFantasia: "" } })],
      [ec(linhas)]
    );
    expect(f.fornecedor).toBe("SOM & LUZ PRODUÇÕES LTDA");
  });
});
