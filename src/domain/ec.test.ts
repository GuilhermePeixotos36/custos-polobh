import { describe, expect, it } from "vitest";
import { ecEditavel, motivoBloqueioEc, situacaoEc, ROTULO_SITUACAO_EC } from "./ec";

/** Só os dois campos que decidem a situação (ver `domain/ec`). */
const ec = (status: string, ativa: boolean) =>
  ({ status, ativa }) as Parameters<typeof situacaoEc>[0];

describe("situação da EC", () => {
  it("a versão que vale é 'Ativa'", () => {
    expect(situacaoEc(ec("Aprovada", true))).toBe("ativa");
  });

  it("rascunho que não é a ativa é 'Rascunho' — não 'Arquivada'", () => {
    // É o estado em que nasce a EC importada/duplicada: nunca entrou no ar.
    // Chamá-la de arquivada era o que punha selo errado na lista e travava a
    // edição. A versão que ENTROU no ar e foi substituída não cai mais aqui: o
    // banco a arquiva na substituição (migração `20260908120000`).
    expect(situacaoEc(ec("Rascunho", false))).toBe("rascunho");
    expect(ROTULO_SITUACAO_EC[situacaoEc(ec("Rascunho", false))]).toBe("Rascunho");
  });

  it("substituída por uma versão nova é 'Arquivada'", () => {
    expect(situacaoEc(ec("Arquivada", false))).toBe("arquivada");
  });

  it("cancelada vence qualquer outra leitura", () => {
    expect(situacaoEc(ec("Cancelada", true))).toBe("cancelada");
  });

  it("finalizada e fora do ar (aprovada, mas não é mais a ativa) fica arquivada", () => {
    expect(situacaoEc(ec("Aprovada", false))).toBe("arquivada");
  });
});

describe("quem pode ser editada", () => {
  it("a EC importada abre no editor — é um rascunho, nunca foi fechada", () => {
    expect(ecEditavel(ec("Rascunho", false))).toBe(true);
    expect(motivoBloqueioEc(ec("Rascunho", false))).toBeNull();
  });

  it("a versão ativa do projeto edita normalmente", () => {
    expect(ecEditavel(ec("Aprovada", true))).toBe(true);
  });

  it("arquivada e cancelada ficam preservadas, com o motivo na tela", () => {
    expect(ecEditavel(ec("Arquivada", false))).toBe(false);
    expect(motivoBloqueioEc(ec("Arquivada", false))).toContain("arquivada");
    expect(ecEditavel(ec("Cancelada", false))).toBe(false);
    expect(motivoBloqueioEc(ec("Cancelada", false))).toContain("cancelada");
  });
});
