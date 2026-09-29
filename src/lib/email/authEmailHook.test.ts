/**
 * Os e-mails de autenticação — o que a pessoa lê, e para onde o link leva.
 *
 * O módulo testado mora em `supabase/functions/auth-send-email/` porque roda em
 * Deno, dentro do hook que o Supabase chama. O teste vive aqui, em `src/`,
 * porque é onde a suíte procura — mesmo arranjo do e-mail de cronograma.
 *
 * O que justifica testar isto com cuidado: um link de recuperação montado
 * errado NÃO falha no envio. Ele chega bonito, a pessoa clica, e o Supabase
 * recusa — e aí o defeito aparece pelo usuário, dias depois, sem rastro no log
 * de quem mandou. É o tipo de erro que só um teste pega antes.
 */
import { describe, expect, it } from "vitest";
import {
  assuntoDe,
  corpoDe,
  mensagensDoEvento,
  type EventoDeEmail,
} from "../../../supabase/functions/auth-send-email/modelos";

const PROJETO = "https://qtubypczpkkrdbvgdziu.supabase.co";

const evento = (p: Partial<EventoDeEmail> = {}): EventoDeEmail => ({
  email: "marisa@polobh.com.br",
  novoEmail: "",
  token: "305805",
  token_hash: "hash-do-atual",
  redirect_to: "https://app.polobh.com.br/nova-senha",
  email_action_type: "recovery",
  site_url: "https://app.polobh.com.br",
  token_new: "",
  token_hash_new: "",
  projetoUrl: PROJETO,
  ...p,
});

describe("o link de confirmação", () => {
  it("aponta para o /auth/v1/verify do projeto, com token, tipo e destino", () => {
    const [m] = mensagensDoEvento(evento());
    const u = new URL(m.url);
    expect(u.origin + u.pathname).toBe(`${PROJETO}/auth/v1/verify`);
    expect(u.searchParams.get("token")).toBe("hash-do-atual");
    expect(u.searchParams.get("type")).toBe("recovery");
    expect(u.searchParams.get("redirect_to")).toBe("https://app.polobh.com.br/nova-senha");
  });

  // O destino vem do cliente e pode ter query própria ("?aba=ec"). Concatenar à
  // mão quebraria a URL; quem monta precisa codificar.
  it("codifica um destino que já tem query", () => {
    const [m] = mensagensDoEvento(evento({ redirect_to: "https://app.polobh.com.br/x?a=1&b=2" }));
    expect(new URL(m.url).searchParams.get("redirect_to")).toBe("https://app.polobh.com.br/x?a=1&b=2");
  });

  it("usa o token_hash, e não o código de seis dígitos", () => {
    const [m] = mensagensDoEvento(evento());
    expect(new URL(m.url).searchParams.get("token")).not.toBe("305805");
    expect(m.codigo).toBe("305805");
  });
});

describe("quem recebe cada tipo de evento", () => {
  it.each(["signup", "invite", "magiclink", "recovery"])("%s vai para o e-mail da conta", (tipo) => {
    const ms = mensagensDoEvento(evento({ email_action_type: tipo }));
    expect(ms).toHaveLength(1);
    expect(ms[0].para).toBe("marisa@polobh.com.br");
    expect(ms[0].url).toContain("/auth/v1/verify");
  });

  it("reautenticação manda só o código, sem link", () => {
    const [m] = mensagensDoEvento(evento({ email_action_type: "reauthentication" }));
    expect(m.url).toBe("");
    expect(corpoDe(m)).toContain("305805");
  });

  // Tipo que a casa não configurou não pode travar quem está tentando entrar:
  // sem mensagem, o hook responde 200 e o Supabase segue.
  it("tipo desconhecido não gera mensagem nenhuma", () => {
    expect(mensagensDoEvento(evento({ email_action_type: "mfa_factor_enrolled_notification" }))).toEqual([]);
  });
});

/**
 * A troca de e-mail é o único caso de duas mensagens — e os campos vêm com os
 * nomes trocados, por compatibilidade antiga do próprio Supabase. Seguir o
 * sufixo `_new` pelo nome manda cada confirmação para a caixa errada, e a troca
 * nunca se completa.
 */
describe("troca de e-mail", () => {
  const trocaDupla = evento({
    email_action_type: "email_change",
    novoEmail: "marisa.nova@polobh.com.br",
    token: "111111",
    token_hash: "hash-do-novo",
    token_new: "222222",
    token_hash_new: "hash-do-atual",
  });

  it("com confirmação dos dois lados, manda duas — cada uma com o par certo", () => {
    const ms = mensagensDoEvento(trocaDupla);
    expect(ms).toHaveLength(2);

    const atual = ms.find((m) => m.para === "marisa@polobh.com.br")!;
    const novo = ms.find((m) => m.para === "marisa.nova@polobh.com.br")!;

    // Endereço ATUAL recebe token_hash_new + token.
    expect(new URL(atual.url).searchParams.get("token")).toBe("hash-do-atual");
    expect(atual.codigo).toBe("111111");

    // Endereço NOVO recebe token_hash + token_new.
    expect(new URL(novo.url).searchParams.get("token")).toBe("hash-do-novo");
    expect(novo.codigo).toBe("222222");
  });

  it("sem confirmação dupla, manda uma só, para o endereço novo", () => {
    const ms = mensagensDoEvento(
      evento({
        email_action_type: "email_change",
        novoEmail: "marisa.nova@polobh.com.br",
        token_hash: "hash-do-novo",
        token_hash_new: "",
        token_new: "",
      })
    );
    expect(ms).toHaveLength(1);
    expect(ms[0].para).toBe("marisa.nova@polobh.com.br");
  });
});

describe("o corpo da mensagem", () => {
  it("traz a marca, o assunto certo e o link clicável", () => {
    const [m] = mensagensDoEvento(evento());
    const html = corpoDe(m);
    expect(assuntoDe(m)).toBe("Criar uma nova senha — Aplicativo Gestão Pólobh");
    expect(html).toContain("Pólobh Promoções");
    expect(html).toContain(`href="${m.url.replace(/&/g, "&amp;")}"`);
    // O endereço também sai em texto, para quem não consegue clicar.
    expect(html).toContain("copie e cole");
  });

  // O destino vem de fora. Um `javascript:` virando âncora num e-mail de
  // recuperação de senha é exatamente o que não pode acontecer.
  it("destino que não é http não vira link", () => {
    const [m] = mensagensDoEvento(evento({ projetoUrl: "javascript:alert(1)" }));
    expect(corpoDe(m)).toContain('href="#"');
  });

  it("escapa o que vem de fora, em vez de injetar no HTML", () => {
    const [m] = mensagensDoEvento(evento({ email: '<script>alert(1)</script>@x.com' }));
    const html = corpoDe(m);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("o aviso de senha alterada diz o que fazer quando não foi você", () => {
    const [m] = mensagensDoEvento(evento({ email_action_type: "password_changed_notification" }));
    expect(corpoDe(m)).toContain("Esqueceu a sua senha?");
  });
});
