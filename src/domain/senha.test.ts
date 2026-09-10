import { describe, expect, it } from "vitest";
import { motivoSenhaInvalida, traduzirErroDeSenha, TAMANHO_MINIMO_SENHA } from "./senha";

describe("regra da senha nova", () => {
  const ok = (atual: string, nova: string, conf: string) => motivoSenhaInvalida(atual, nova, conf) === null;

  it("aceita uma senha diferente da atual, longa o bastante e confirmada", () => {
    expect(ok("senha-antiga", "cadeira-azul-2026", "cadeira-azul-2026")).toBe(true);
  });

  it("cobra a senha atual — é ela que prova que é a pessoa", () => {
    expect(motivoSenhaInvalida("", "cadeira-azul-2026", "cadeira-azul-2026")).toMatch(/senha atual/i);
  });

  it("recusa senha curta, dizendo o tamanho", () => {
    const motivo = motivoSenhaInvalida("antiga123", "curta12", "curta12");
    expect(motivo).toContain(String(TAMANHO_MINIMO_SENHA));
  });

  /** Senha só de espaços passa no `length`, e é um acidente de teclado. */
  it("recusa senha só de espaços", () => {
    expect(motivoSenhaInvalida("antiga123", "          ", "          ")).toMatch(/digite a nova senha/i);
  });

  it("recusa repetir a senha atual", () => {
    expect(motivoSenhaInvalida("cadeira-azul", "cadeira-azul", "cadeira-azul")).toMatch(/diferente da atual/i);
  });

  it("recusa confirmação que não confere", () => {
    expect(motivoSenhaInvalida("antiga123", "cadeira-azul-2026", "cadeira-azul-2027")).toMatch(/confirmação/i);
  });

  /** O espaço no meio é caractere legítimo: frase é senha boa. */
  it("aceita frase com espaços", () => {
    expect(ok("antiga123", "o palco chegou tarde", "o palco chegou tarde")).toBe(true);
  });
});

describe("mensagens do Supabase viram português", () => {
  it("traduz o que ele diz sobre senha repetida e senha curta", () => {
    expect(traduzirErroDeSenha("New password should be different from the old password.")).toMatch(
      /diferente da atual/i
    );
    expect(traduzirErroDeSenha("Password should be at least 6 characters.")).toMatch(/curta demais/i);
  });

  it("traduz sessão expirada e excesso de tentativas", () => {
    expect(traduzirErroDeSenha("invalid JWT: token is expired")).toMatch(/sessão expirou/i);
    expect(traduzirErroDeSenha("Request rate limit reached")).toMatch(/muitas tentativas/i);
  });

  /** O caso raro precisa chegar inteiro a quem for investigar. */
  it("devolve intacta a mensagem que não conhece", () => {
    expect(traduzirErroDeSenha("Unexpected failure from the auth server")).toBe(
      "Unexpected failure from the auth server"
    );
  });
});
