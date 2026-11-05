import { describe, expect, it } from "vitest";
import { formatarUsd, resumirConsumo, somarConsumos, textoConsumo, type RegistroIa } from "./consumoIa";

const reg = (p: Partial<RegistroIa>): RegistroIa => ({
  id: Math.random().toString(),
  criadoEm: "2026-11-05T12:00:00Z",
  usuario: "Ana",
  funcao: "revisao",
  modelo: "openai/gpt-4.1-mini",
  tokensEntrada: 100,
  tokensSaida: 50,
  custoUsd: 0.0001,
  sucesso: true,
  erro: "",
  itens: 1,
  duracaoMs: 1000,
  ...p,
});

describe("consumo de IA", () => {
  it("soma totais, por tipo e por pessoa", () => {
    const r = resumirConsumo([
      reg({}),
      reg({ usuario: "Bia", funcao: "leitura_orcamento", tokensEntrada: 5000, tokensSaida: 500, custoUsd: 0.0028 }),
      reg({ sucesso: false, tokensEntrada: 0, tokensSaida: 0, custoUsd: 0 }),
    ]);
    expect(r.total.chamadas).toBe(3);
    expect(r.total.falhas).toBe(1);
    expect(r.total.tokensEntrada).toBe(5100);
    expect(r.total.custoUsd).toBeCloseTo(0.0029);
    expect(r.porFuncao[0].funcao).toBe("leitura_orcamento");
    expect(r.porPessoa.map((p) => p.usuario)).toEqual(["Bia", "Ana"]);
    expect(r.porPessoa[1].totais.chamadas).toBe(2);
  });

  it("soma os lotes de uma revisão e ignora os que não voltaram", () => {
    const c = somarConsumos([
      { tokensEntrada: 300, tokensSaida: 200, custoUsd: 0.0004, modelo: "openai/gpt-4.1-mini" },
      null,
      { tokensEntrada: 100, tokensSaida: 50, custoUsd: 0.0001, modelo: "openai/gpt-4.1-mini" },
    ]);
    expect(c).toEqual({ tokensEntrada: 400, tokensSaida: 250, custoUsd: 0.0005, modelo: "openai/gpt-4.1-mini" });
    expect(somarConsumos([null, undefined])).toBeNull();
  });

  it("formata custo pequeno com 4 casas e o aviso com tokens", () => {
    expect(formatarUsd(0.0005)).toBe("US$ 0,0005");
    expect(formatarUsd(1.5)).toBe("US$ 1,50");
    expect(formatarUsd(0)).toBe("US$ 0,00");
    expect(textoConsumo({ tokensEntrada: 1000, tokensSaida: 234, custoUsd: 0.0006, modelo: "x" })).toBe("1.234 tokens · US$ 0,0006");
  });
});
