/**
 * O back-up é a única coisa do sistema cujo defeito só aparece no dia em que
 * alguém precisa dele de volta. Estes testes existem porque, aqui, "parece que
 * está funcionando" não é evidência de nada.
 */
import { describe, expect, it } from "vitest";
import {
  formatarTamanho,
  haQuantoTempo,
  lerDestinatarios,
  podeTirarBackup,
  rotuloFrequencia,
  situacaoDoBackup,
} from "./backup";

const dia = 86_400_000;
const AGORA = new Date("2026-09-25T12:00:00Z");
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * dia);

describe("quem tira o back-up", () => {
  it("Admin e Direção podem", () => {
    expect(podeTirarBackup("Admin")).toBe(true);
    expect(podeTirarBackup("Direcao")).toBe(true);
  });

  // O Administrativo administra o cadastro, mas o pacote leva a base inteira,
  // inclusive o financeiro — não é o mesmo grupo da tela de Configurações.
  it("Administrativo e Produção não podem", () => {
    expect(podeTirarBackup("Administrativo")).toBe(false);
    expect(podeTirarBackup("Producao")).toBe(false);
    expect(podeTirarBackup(undefined)).toBe(false);
  });
});

describe("a situação do back-up", () => {
  it("desligado é desligado, mesmo sem nunca ter rodado", () => {
    expect(situacaoDoBackup("desligado", null, AGORA)).toBe("desligado");
  });

  it("nunca rodou aparece como 'nunca'", () => {
    expect(situacaoDoBackup("semanal", null, AGORA)).toBe("nunca");
  });

  it("semanal com 5 dias está em dia", () => {
    expect(situacaoDoBackup("semanal", diasAtras(5), AGORA)).toBe("em dia");
  });

  // O alarme só toca no DOBRO do intervalo: o job roda de madrugada, e um
  // semanal com 7 dias e 3 horas não é um problema — é o horário.
  it("semanal com 8 dias ainda está em dia; com 15, atrasado", () => {
    expect(situacaoDoBackup("semanal", diasAtras(8), AGORA)).toBe("em dia");
    expect(situacaoDoBackup("semanal", diasAtras(15), AGORA)).toBe("atrasado");
  });

  it("diário com 3 dias já está atrasado", () => {
    expect(situacaoDoBackup("diario", diasAtras(3), AGORA)).toBe("atrasado");
  });

  it("mensal só atrasa depois de 60 dias", () => {
    expect(situacaoDoBackup("mensal", diasAtras(45), AGORA)).toBe("em dia");
    expect(situacaoDoBackup("mensal", diasAtras(70), AGORA)).toBe("atrasado");
  });
});

describe("há quanto tempo", () => {
  it.each([
    [0, "hoje"],
    [1, "ontem"],
    [3, "há 3 dias"],
    [29, "há 29 dias"],
    [31, "há 1 mês"],
    [95, "há 3 meses"],
  ])("%s dias atrás vira %s", (n, esperado) => {
    expect(haQuantoTempo(diasAtras(n as number), AGORA)).toBe(esperado);
  });
});

describe("os destinatários", () => {
  it("aceita vírgula, ponto-e-vírgula e quebra de linha", () => {
    const r = lerDestinatarios("marisa@polobh.com.br, carol@polobh.com.br; financeiro@polobh.com.br\nti@polobh.com.br");
    expect(r.validos).toEqual([
      "marisa@polobh.com.br",
      "carol@polobh.com.br",
      "financeiro@polobh.com.br",
      "ti@polobh.com.br",
    ]);
    expect(r.invalidos).toEqual([]);
  });

  it("normaliza para minúsculas e não repete", () => {
    const r = lerDestinatarios("Marisa@Polobh.com.br, marisa@polobh.com.br");
    expect(r.validos).toEqual(["marisa@polobh.com.br"]);
  });

  // O endereço com erro de digitação NÃO some: some da lista, o back-up passa
  // meses indo para uma pessoa a menos, e ninguém repara.
  it("devolve os inválidos em separado, em vez de descartar", () => {
    const r = lerDestinatarios("marisa@polobh.com.br, marisa@polobh, @polobh.com.br");
    expect(r.validos).toEqual(["marisa@polobh.com.br"]);
    expect(r.invalidos).toEqual(["marisa@polobh", "@polobh.com.br"]);
  });

  it("caixa vazia não vira destinatário vazio", () => {
    expect(lerDestinatarios("   ").validos).toEqual([]);
    expect(lerDestinatarios("").invalidos).toEqual([]);
  });
});

describe("apresentação", () => {
  it("o rótulo da frequência sai em português", () => {
    expect(rotuloFrequencia("semanal")).toBe("Toda semana");
    expect(rotuloFrequencia("desligado")).toBe("Desligado");
  });

  it.each([
    [512, "512 B"],
    [2048, "2 KB"],
    [1_572_864, "1.5 MB"],
    [null, "0 B"],
  ])("%s bytes vira %s", (bytes, esperado) => {
    expect(formatarTamanho(bytes as number | null)).toBe(esperado);
  });
});
