import { describe, expect, it } from "vitest";
import { ecEditavel, motivoBloqueioEc, situacaoEc, ROTULO_SITUACAO_EC } from "./ec";

/** O único campo que decide a situação: a bandeira do ar (ver `domain/ec`). */
const ec = (ativa: boolean) => ({ ativa }) as Parameters<typeof situacaoEc>[0];

describe("situação da EC: no ar ou no arquivo", () => {
  it("a versão que vale é 'Ativa'", () => {
    expect(situacaoEc(ec(true))).toBe("ativa");
    expect(ROTULO_SITUACAO_EC[situacaoEc(ec(true))]).toBe("Ativa");
  });

  it("qualquer uma fora do ar é 'Arquivada' — não existe terceiro selo", () => {
    // Antes o rótulo saía do par (status, ativa), e a mesma EC aparecia ora como
    // "Rascunho", ora como "Arquivada", conforme o caminho pelo qual tinha saído
    // do ar. Agora a pergunta é uma só: esta é a estimativa que vale?
    expect(situacaoEc(ec(false))).toBe("arquivada");
    expect(ROTULO_SITUACAO_EC[situacaoEc(ec(false))]).toBe("Arquivada");
  });

  it("os selos do fluxo antigo não mudam mais a leitura", () => {
    // Uma linha antiga do banco ainda pode trazer 'Rascunho'/'Aprovada'/
    // 'Cancelada' na coluna `status`; ela é ignorada de propósito.
    const legado = { ativa: true, status: "Cancelada" } as Parameters<typeof situacaoEc>[0];
    expect(situacaoEc(legado)).toBe("ativa");
  });
});

describe("quem pode ser editada", () => {
  it("edita-se a que está no ar", () => {
    expect(ecEditavel(ec(true))).toBe(true);
    expect(motivoBloqueioEc(ec(true))).toBeNull();
  });

  it("a arquivada fica preservada, com o motivo na tela", () => {
    // Para mexer nela: trazer de volta ao ar, ou copiar para uma versão nova.
    expect(ecEditavel(ec(false))).toBe(false);
    expect(motivoBloqueioEc(ec(false))).toContain("arquivada");
  });
});
