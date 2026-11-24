/**
 * Regras puras das Edge Functions de Acessos (padrão de Acessos LSPRO, testes.md bloco 4). Os
 * módulos moram em `supabase/functions/_shared/` porque rodam no Deno; aqui só a lógica.
 */
import { describe, expect, it } from "vitest";
import {
  decidirReaproveitamento, emailConfere, emailValido, normalizarEmail, traduzirErroDeSenha, validarCriarUsuario,
  validarDefinirSenha, validarSenha,
} from "../../../supabase/functions/_shared/acessos";
import { decidirPermissao, rpcInexistente } from "../../../supabase/functions/_shared/permissaoDoUsuario";

const UUID = "11111111-2222-3333-4444-555555555555";

describe("e-mail", () => {
  it("normaliza e valida", () => {
    expect(normalizarEmail("  Fulano@Polobh.com.BR ")).toBe("fulano@polobh.com.br");
    expect(normalizarEmail(42)).toBe("");
    expect(emailValido("a@b.co")).toBe(true);
    expect(emailValido("sem-arroba")).toBe(false);
  });

  it("emailConfere só aceita o mesmo e-mail (normalizado); vazio nunca confere", () => {
    expect(emailConfere("A@b.com", " a@B.com")).toBe(true);
    expect(emailConfere("a@b.com", "c@b.com")).toBe(false);
    expect(emailConfere("", "")).toBe(false);
  });
});

describe("validarCriarUsuario", () => {
  const corpo = { nome: "Fulana", email: "fulana@x.com", senha: "senha-forte-1", grupoId: UUID };

  it("exige grupo, nome, e-mail válido e senha (sem Microsoft, a senha vem já no cadastro)", () => {
    expect(validarCriarUsuario(corpo).ok).toBe(true);
    expect(validarCriarUsuario({ ...corpo, grupoId: "x" })).toEqual({ ok: false, erro: "Escolha o grupo de permissão do usuário." });
    expect(validarCriarUsuario({ ...corpo, nome: "F" }).ok).toBe(false);
    expect(validarCriarUsuario({ ...corpo, email: "x" }).ok).toBe(false);
    expect(validarCriarUsuario({ ...corpo, senha: "curta" }).ok).toBe(false);
  });

  it("apara e normaliza; setor longo é recusado", () => {
    const r = validarCriarUsuario({ ...corpo, email: " FULANA@X.COM ", setor: "  Produção  " });
    expect(r.ok && r.dados.email).toBe("fulana@x.com");
    expect(r.ok && r.dados.setor).toBe("Produção");
    expect(validarCriarUsuario({ ...corpo, setor: "x".repeat(121) }).ok).toBe(false);
  });
});

describe("senha", () => {
  it("validarSenha conta bytes, não letras", () => {
    expect(validarSenha("a".repeat(72))).toBeNull();
    expect(validarSenha("á".repeat(37))).toMatch(/72 bytes/);
    expect(validarSenha("1234567")).toMatch(/8 caracteres/);
  });

  it("validarDefinirSenha exige usuário e senha válida", () => {
    expect(validarDefinirSenha({ usuarioId: UUID, senha: "12345678" }).ok).toBe(true);
    expect(validarDefinirSenha({ usuarioId: "x", senha: "12345678" }).ok).toBe(false);
    expect(validarDefinirSenha({ usuarioId: UUID, senha: "1" }).ok).toBe(false);
  });

  it("traduz senha vazada e senha fraca do Auth", () => {
    expect(traduzirErroDeSenha({ code: "weak_password", reasons: ["pwned"] })?.erro).toMatch(/vazamentos/);
    expect(traduzirErroDeSenha({ code: "weak_password", reasons: ["length"] })?.erro).toMatch(/política/);
    expect(traduzirErroDeSenha({ code: "outro" })).toBeNull();
  });
});

describe("decidirReaproveitamento", () => {
  it("ativo e inativo → 409; pendente pode ser liberado", () => {
    expect(decidirReaproveitamento("ativo")).toEqual({ ok: false, status: 409, erro: "Este e-mail já é um usuário ativo." });
    expect(decidirReaproveitamento("inativo").ok).toBe(false);
    expect(decidirReaproveitamento("pendente")).toEqual({ ok: true });
  });
});

describe("helper de permissão das Edge Functions", () => {
  it("usa a RPC quando existe", () => {
    expect(decidirPermissao({ data: true, error: null }, null, [])).toBe(true);
    expect(decidirPermissao({ data: false, error: null }, { papel: "Admin", ativo: true }, ["Admin"])).toBe(false);
  });

  it("sem a RPC cai no papel antigo (ativo)", () => {
    const ausente = { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
    expect(rpcInexistente(ausente.error)).toBe(true);
    expect(decidirPermissao(ausente, { papel: "Admin", ativo: true }, ["Admin"])).toBe(true);
    expect(decidirPermissao(ausente, { papel: "Admin", ativo: false }, ["Admin"])).toBe(false);
    expect(decidirPermissao(ausente, { papel: "Producao", ativo: true }, ["Admin"])).toBe(false);
  });

  it("outro erro da RPC nega (falha fechada)", () => {
    expect(decidirPermissao({ data: null, error: { code: "500", message: "boom" } }, { papel: "Admin", ativo: true }, ["Admin"])).toBe(false);
  });
});
