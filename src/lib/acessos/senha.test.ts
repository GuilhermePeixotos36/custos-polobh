/** Senha que o administrador define (padrão de Acessos LSPRO, testes.md bloco 2). */
import { describe, expect, it } from "vitest";
import { gerarSenha, motivoDaSenhaInvalida, senhaValida, TAMANHO_SENHA_GERADA } from "./senha";

describe("gerarSenha", () => {
  it("tem 16 caracteres com maiúscula, minúscula, dígito e símbolo", () => {
    for (let i = 0; i < 50; i++) {
      const s = gerarSenha();
      expect(s).toHaveLength(TAMANHO_SENHA_GERADA);
      expect(s).toMatch(/[A-Z]/);
      expect(s).toMatch(/[a-z]/);
      expect(s).toMatch(/[0-9]/);
      expect(s).toMatch(/[!@#$%&*?\-_+=]/);
    }
  });

  it("não repete de uma chamada para outra", () => {
    expect(new Set(Array.from({ length: 30 }, () => gerarSenha())).size).toBe(30);
  });

  it("usa a fonte aleatória recebida, inclusive no extremo", () => {
    const zeros = gerarSenha((n) => new Uint32Array(n));
    expect(zeros).toHaveLength(TAMANHO_SENHA_GERADA);
    // O topo do intervalo é descartado (sorteio sem viés): a fonte alterna o máximo e um valor válido.
    let chamada = 0;
    const comDescartes = gerarSenha((n) => new Uint32Array(n).fill(chamada++ % 2 === 0 ? 0xffffffff : 5));
    expect(comDescartes).toHaveLength(TAMANHO_SENHA_GERADA);
  });
});

describe("senha digitada", () => {
  it("exige 8 caracteres", () => {
    expect(senhaValida("1234567")).toBe(false);
    expect(motivoDaSenhaInvalida("1234567")).toMatch(/8 caracteres/);
    expect(senhaValida("12345678")).toBe(true);
  });

  it("recusa acima de 72 bytes UTF-8 (acento conta dois)", () => {
    expect(senhaValida("a".repeat(72))).toBe(true);
    expect(senhaValida("á".repeat(37))).toBe(false);
    expect(motivoDaSenhaInvalida("á".repeat(37))).toMatch(/72 bytes/);
  });
});
