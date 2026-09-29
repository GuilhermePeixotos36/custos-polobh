import { describe, expect, it } from "vitest";
import { credenciadosDaFila, filaDeCredenciamento, podeEnviar, podeReceberLink } from "./credenciamento";
import type { CredenciamentoResposta, Ec, Os } from "@/data/types";

const ec = (id: string): Ec => ({ id, projetoId: "p1" }) as Ec;

type OsDeTeste = Omit<Partial<Os>, "fornecedor"> & { fornecedor?: Partial<Os["fornecedor"]> };

const os = (p: OsDeTeste): Os =>
  ({
    id: "os1",
    numero: "OS 01",
    slugCredenciamento: "tok",
    ecId: "ec1",
    status: "Emitida",
    ...p,
    fornecedor: {
      razaoSocial: "SOM & LUZ LTDA",
      email: "contato@someluz.com.br",
      ...p.fornecedor,
    },
  }) as Os;

describe("fila de credenciamento do projeto", () => {
  it("um por fornecedor, em ordem alfabética — é assim que se procura alguém", () => {
    const fila = filaDeCredenciamento(
      [
        os({ id: "a", fornecedor: { apelido: "Som & Luz" } }),
        os({ id: "b", fornecedor: { apelido: "Buffet Sabor" } }),
      ],
      [ec("ec1")],
      []
    );
    expect(fila.map((f) => f.fornecedor)).toEqual(["Buffet Sabor", "Som & Luz"]);
  });

  it("o nome vem do apelido, e cai para fantasia e razão social nessa ordem", () => {
    const so = (f: Partial<Os["fornecedor"]>) => filaDeCredenciamento([os({ fornecedor: f })], [ec("ec1")], [])[0];
    expect(so({ apelido: "Som & Luz", nomeFantasia: "SL", razaoSocial: "X LTDA" }).fornecedor).toBe("Som & Luz");
    expect(so({ nomeFantasia: "SL", razaoSocial: "X LTDA" }).fornecedor).toBe("SL");
    expect(so({ razaoSocial: "X LTDA" }).fornecedor).toBe("X LTDA");
  });

  it("OS cancelada ou arquivada sai da fila — não credencia mais ninguém", () => {
    const fila = filaDeCredenciamento(
      [os({ id: "a" }), os({ id: "b", status: "Cancelada" }), os({ id: "c", status: "Arquivada" })],
      [ec("ec1")],
      []
    );
    expect(fila.map((f) => f.os.id)).toEqual(["a"]);
  });

  it("marca quem já respondeu", () => {
    const fila = filaDeCredenciamento([os({ id: "a" }), os({ id: "b" })], [ec("ec1")], ["a"]);
    expect(fila.find((f) => f.os.id === "a")!.respondeu).toBe(true);
    expect(fila.find((f) => f.os.id === "b")!.respondeu).toBe(false);
  });

  describe("quem entra no disparo em lote", () => {
    const daFila = (p: OsDeTeste, responderam: string[] = []) =>
      filaDeCredenciamento([os(p)], [ec("ec1")], responderam)[0];

    it("com link, e-mail, EC e sem resposta: entra", () => {
      expect(podeReceberLink(daFila({}))).toBe(true);
    });

    it("quem já respondeu fica de fora — reenviar a quem preencheu é ruído", () => {
      expect(podeReceberLink(daFila({ id: "os1" }, ["os1"]))).toBe(false);
    });

    it("fornecedor sem e-mail fica de fora, em vez de o envio falhar calado", () => {
      expect(podeReceberLink(daFila({ fornecedor: { email: "" } }))).toBe(false);
      expect(podeReceberLink(daFila({ fornecedor: { email: "   " } }))).toBe(false);
    });

    it("OS ainda não salva fica de fora: o token do link nasce no banco", () => {
      const semToken = daFila({ slugCredenciamento: "", credenciamento: { prazoLimite: "", linkFormulario: "" } });
      expect(semToken.link).toBe("");
      expect(podeReceberLink(semToken)).toBe(false);
    });

    it("OS cuja EC não está carregada fica de fora — o e-mail cita o projeto", () => {
      const semEc = filaDeCredenciamento([os({ ecId: "outra" })], [ec("ec1")], [])[0];
      expect(semEc.ec).toBeUndefined();
      expect(podeReceberLink(semEc)).toBe(false);
    });
  });
});

/**
 * A folha da portaria: gente e veículos achatados, com o fornecedor em cada
 * linha, mais quem ainda não mandou nada.
 */
describe("credenciados para a portaria", () => {
  const resposta = (p: Partial<CredenciamentoResposta>): CredenciamentoResposta => ({
    id: "r1", enviadoEm: "2026-09-01T10:00:00Z", equipe: [], veiculos: [], ...p,
  });

  const fila = () =>
    filaDeCredenciamento(
      [
        os({ id: "a", fornecedor: { apelido: "Som & Luz" } }),
        os({ id: "b", fornecedor: { apelido: "Buffet Sabor" } }),
      ],
      [ec("ec1")],
      ["a"]
    );

  it("cada pessoa vira uma linha, com o fornecedor ao lado", () => {
    const { equipe } = credenciadosDaFila(
      fila(),
      new Map([["a", [resposta({ equipe: [{ nome: "Ana", cpf: "111", funcao: "Técnica" }, { nome: "Bruno", cpf: "222", funcao: "Roadie" }] })]]])
    );
    // Os campos que o credenciamento pode pedir por evento (RG, endereço,
    // telefone, aniversário) vêm vazios quando não foram pedidos — a linha tem
    // sempre o mesmo formato, e a planilha é que decide quais viram coluna.
    expect(equipe).toEqual([
      { fornecedor: "Som & Luz", nome: "Ana", cpf: "111", funcao: "Técnica", rg: "", endereco: "", telefone: "", aniversario: "" },
      { fornecedor: "Som & Luz", nome: "Bruno", cpf: "222", funcao: "Roadie", rg: "", endereco: "", telefone: "", aniversario: "" },
    ]);
  });

  it("veículos saem na sua própria lista", () => {
    const { veiculos } = credenciadosDaFila(
      fila(),
      new Map([["a", [resposta({ veiculos: [{ modelo: "Sprinter", placa: "ABC1D23" }] })]]])
    );
    expect(veiculos).toEqual([{ fornecedor: "Som & Luz", modelo: "Sprinter", placa: "ABC1D23" }]);
  });

  /** Sem esta lista, a ausência de um nome na portaria vira dúvida. */
  it("quem não respondeu sai nomeado, e não some da folha", () => {
    const { semResposta } = credenciadosDaFila(fila(), new Map([["a", [resposta({})]]]));
    expect(semResposta).toEqual(["Buffet Sabor"]);
  });

  it("linha em branco do formulário não vira credenciado", () => {
    const { equipe, veiculos } = credenciadosDaFila(
      fila(),
      new Map([["a", [resposta({ equipe: [{ nome: "   ", cpf: "", funcao: "" }], veiculos: [{ modelo: "", placa: "" }] })]]])
    );
    expect(equipe).toEqual([]);
    expect(veiculos).toEqual([]);
  });
});

/**
 * Marcar alguém na lista é uma escolha, e ela pode ser justamente reenviar a
 * quem já respondeu — o formulário voltou errado, a equipe mudou.
 */
describe("podeEnviar x podeReceberLink", () => {
  const so = (p: OsDeTeste, responderam: string[] = []) => filaDeCredenciamento([os(p)], [ec("ec1")], responderam)[0];

  it("quem já respondeu sai do disparo automático, mas pode ser marcado à mão", () => {
    const respondeu = so({ id: "os1" }, ["os1"]);
    expect(podeReceberLink(respondeu)).toBe(false);
    expect(podeEnviar(respondeu)).toBe(true);
  });

  it("sem e-mail não sai por caminho nenhum — nem marcado", () => {
    expect(podeEnviar(so({ fornecedor: { email: "" } }))).toBe(false);
  });
});
