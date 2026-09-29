/**
 * A trava de presença é bloqueio: enquanto ela vale, ninguém mais edita. Por
 * isso os testes olham com mais cuidado para o lado de SOLTAR do que para o de
 * prender — uma trava que não solta é pior do que trava nenhuma, porque vira
 * telefonema pedindo para alguém "sair do documento".
 */
import { describe, expect, it } from "vitest";
import {
  avisoDePosse,
  chaveDocumento,
  desdeQuando,
  posseAtiva,
  PRAZO_SEM_SINAL_MS,
  type PosseDeEdicao,
} from "./travaEdicao";

const AGORA = new Date("2026-09-25T17:30:00Z");
const segundosAtras = (n: number) => new Date(AGORA.getTime() - n * 1000).toISOString();

const posse = (p: Partial<PosseDeEdicao> = {}): PosseDeEdicao => ({
  meu: false,
  usuarioId: "u-marisa",
  usuarioNome: "Marisa",
  desde: segundosAtras(600),
  vistoEm: segundosAtras(5),
  ...p,
});

describe("o endereço do documento", () => {
  it("junta o tipo e o id", () => {
    expect(chaveDocumento("os", "abc")).toBe("os:abc");
    expect(chaveDocumento("projeto", "abc")).toBe("projeto:abc");
  });
});

describe("a posse vale?", () => {
  it("sinal recente: vale", () => {
    expect(posseAtiva(posse({ vistoEm: segundosAtras(20) }), AGORA)).toBe(true);
  });

  // Duas batidas perdidas ainda são rede instável, não ausência.
  it("sinal de 60 segundos ainda vale — rede ruim não é abandono", () => {
    expect(posseAtiva(posse({ vistoEm: segundosAtras(60) }), AGORA)).toBe(true);
  });

  // O caso que justifica o prazo existir: notebook fechado no meio da edição.
  it("sem sinal há mais de 90 segundos: caduca", () => {
    expect(posseAtiva(posse({ vistoEm: segundosAtras(91) }), AGORA)).toBe(false);
    expect(posseAtiva(posse({ vistoEm: segundosAtras(3600) }), AGORA)).toBe(false);
  });

  it("ninguém com o documento não é posse", () => {
    expect(posseAtiva(null, AGORA)).toBe(false);
  });

  it("o prazo é o mesmo que o banco aplica", () => {
    expect(PRAZO_SEM_SINAL_MS).toBe(90_000);
  });
});

describe("o aviso na tela", () => {
  it("cala quando a posse é minha", () => {
    expect(avisoDePosse(posse({ meu: true }), AGORA)).toBe("");
  });

  it("cala quando ninguém está com o documento", () => {
    expect(avisoDePosse(null, AGORA)).toBe("");
  });

  it("diz quem está e desde que horas", () => {
    const aviso = avisoDePosse(posse(), AGORA);
    expect(aviso).toContain("Marisa está editando");
    expect(aviso).toContain("leitura");
  });

  // Sem isto, quem chega depois de alguém ter fechado o notebook fica olhando
  // um aviso que manda esperar por uma pessoa que já foi embora.
  it("com o sinal velho, muda de 'espere' para 'pode assumir'", () => {
    const aviso = avisoDePosse(posse({ vistoEm: segundosAtras(200) }), AGORA);
    expect(aviso).toContain("sem sinal");
    expect(aviso).toContain("assumir");
  });

  it("sem nome cadastrado, não vira um aviso sem sujeito", () => {
    expect(avisoDePosse(posse({ usuarioNome: "  " }), AGORA)).toContain("Outra pessoa está editando");
  });
});

describe("desde que horas", () => {
  it("sai no formato da casa, com dois dígitos", () => {
    const d = new Date(2026, 8, 25, 9, 5);
    expect(desdeQuando(posse({ desde: d.toISOString() }))).toBe("09h05");
  });
});
