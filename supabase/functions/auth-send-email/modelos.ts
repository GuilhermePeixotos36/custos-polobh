/**
 * Os textos dos e-mails de AUTENTICAÇÃO — recuperar senha, convite, confirmação.
 *
 * Mora aqui, e não dentro do `index.ts` da função, por duas razões:
 *
 *  · é a parte que decide o que a pessoa lê e PARA ONDE O LINK LEVA, e isso
 *    precisa de teste. O arquivo não importa nada do Deno de propósito, para
 *    que a suíte do aplicativo consiga carregá-lo — ver
 *    `src/lib/email/authEmailHook.test.ts`, mesmo arranjo do e-mail de
 *    cronograma;
 *  · um link de recuperação de senha montado errado não falha: ele chega, a
 *    pessoa clica, e o Supabase recusa. Esse tipo de defeito se descobre pelo
 *    usuário, semanas depois, e é exatamente o que o teste evita.
 *
 * A marca e o rodapé são os mesmos de `src/lib/email/templates.ts`. São duas
 * cópias porque uma roda em Deno e a outra no navegador; se o visual da casa
 * mudar, mude nos dois.
 */

/** O que chega do Supabase, já achatado pelo `index.ts`. */
export interface EventoDeEmail {
  email: string;
  novoEmail: string;
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new: string;
  token_hash_new: string;
  /** A URL do projeto no Supabase — é dela que sai o endereço de verificação. */
  projetoUrl: string;
}

/** Uma mensagem a enviar. Uma troca de e-mail confirmada dos dois lados gera duas. */
export interface MensagemDeAuth {
  para: string;
  acao: string;
  /** O link de confirmação. Vazio quando a ação é só um código. */
  url: string;
  /** O código de seis dígitos, para quem preferir digitar. */
  codigo: string;
  /** No caso da troca de e-mail, o endereço novo — o texto o menciona. */
  novoEmail?: string;
}

const REMETENTE_NOME = "Pólobh Promoções";

const h = (valor: unknown): string =>
  String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Só http(s) vira link. Um `javascript:` vindo de fora não pode virar âncora. */
const urlHttp = (valor: string): string => {
  try {
    const u = new URL(valor);
    return ["http:", "https:"].includes(u.protocol) ? h(u.toString()) : "#";
  } catch {
    return "#";
  }
};

/**
 * O endereço que confirma a ação.
 *
 * É o `/auth/v1/verify` do próprio projeto, que valida o token e só então manda
 * a pessoa para o `redirect_to`. O `redirect_to` precisa estar na lista de
 * endereços autorizados do projeto (Auth › URL Configuration) — se não estiver,
 * o e-mail chega e o link falha, que é o defeito mais difícil de diagnosticar
 * deste fluxo inteiro.
 */
function urlDeVerificacao(projetoUrl: string, tokenHash: string, tipo: string, destino: string): string {
  if (!projetoUrl) return "";
  const params = new URLSearchParams({ token: tokenHash, type: tipo, redirect_to: destino });
  return `${projetoUrl.replace(/\/+$/, "")}/auth/v1/verify?${params.toString()}`;
}

/**
 * Quais mensagens este evento gera, e para quem.
 *
 * A troca de e-mail é o único caso de duas, e os campos vêm com os nomes
 * TROCADOS — o próprio Supabase avisa disso na documentação, por
 * compatibilidade com versões antigas:
 *
 *   · `token_hash_new` vai para o endereço ATUAL, com `token`;
 *   · `token_hash`     vai para o endereço NOVO,  com `token_new`.
 *
 * Seguir o sufixo `_new` pelo nome manda cada confirmação para a caixa errada,
 * e a troca de e-mail nunca se completa.
 */
export function mensagensDoEvento(e: EventoDeEmail): MensagemDeAuth[] {
  const tipo = e.email_action_type;
  const link = (hash: string, destino = e.redirect_to) =>
    urlDeVerificacao(e.projetoUrl, hash, tipo, destino);

  if (tipo === "email_change") {
    const dosDoisLados = Boolean(e.token_hash_new && e.token_new);
    if (!dosDoisLados) {
      // Confirmação simples: só o endereço novo recebe.
      return [
        {
          para: e.novoEmail || e.email,
          acao: tipo,
          url: link(e.token_hash),
          codigo: e.token_new || e.token,
          novoEmail: e.novoEmail,
        },
      ];
    }
    return [
      { para: e.email, acao: tipo, url: link(e.token_hash_new), codigo: e.token, novoEmail: e.novoEmail },
      { para: e.novoEmail, acao: tipo, url: link(e.token_hash), codigo: e.token_new, novoEmail: e.novoEmail },
    ];
  }

  if (["signup", "invite", "magiclink", "recovery"].includes(tipo)) {
    return [{ para: e.email, acao: tipo, url: link(e.token_hash), codigo: e.token }];
  }

  // Reautenticação é só o código: não há para onde levar a pessoa.
  if (tipo === "reauthentication") {
    return [{ para: e.email, acao: tipo, url: "", codigo: e.token }];
  }

  // Aviso de senha alterada — não pede ação, mas é a única defesa da pessoa
  // contra uma troca que ela não fez.
  if (tipo === "password_changed_notification") {
    return [{ para: e.email, acao: tipo, url: "", codigo: "" }];
  }

  // Tipo que a casa não usa. Devolver lista vazia é deliberado: o hook responde
  // 200 sem e-mail, e o fluxo de quem está entrando não trava por causa de um
  // aviso que ninguém configurou.
  return [];
}

const ASSUNTOS: Record<string, string> = {
  signup: "Confirme o seu e-mail — Aplicativo Gestão Pólobh",
  invite: "Você foi convidado para o Aplicativo Gestão Pólobh",
  magiclink: "Seu link de entrada — Aplicativo Gestão Pólobh",
  recovery: "Criar uma nova senha — Aplicativo Gestão Pólobh",
  email_change: "Confirme o seu novo e-mail — Aplicativo Gestão Pólobh",
  reauthentication: "Seu código de verificação — Aplicativo Gestão Pólobh",
  password_changed_notification: "A sua senha foi alterada — Aplicativo Gestão Pólobh",
};

export const assuntoDe = (m: MensagemDeAuth): string =>
  ASSUNTOS[m.acao] ?? "Aviso do Aplicativo Gestão Pólobh";

function moldura(titulo: string, corpoHtml: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#15161A;max-width:560px;margin:0 auto">
    <div style="padding:18px 0;border-bottom:2px solid #F2820D">
      <span style="font-size:20px;font-weight:800;letter-spacing:-.5px">
        <span style="color:#6A6E78">polo</span><span style="color:#E36F0A">bh</span>
      </span>
      <span style="color:#A0A4AC;font-size:12px;margin-left:8px">${REMETENTE_NOME}</span>
    </div>
    <h2 style="font-size:18px;margin:22px 0 12px">${titulo}</h2>
    ${corpoHtml}
    <p style="color:#A0A4AC;font-size:12px;margin-top:28px;border-top:1px solid #EEEFF2;padding-top:12px">
      Mensagem automática do sistema Pólobh — Gestão de Projetos.
    </p>
  </div>`;
}

const botao = (url: string, rotulo: string): string => `
  <p style="margin:22px 0">
    <a href="${urlHttp(url)}" style="background:#F2820D;color:#fff;text-decoration:none;
       font-weight:700;font-size:14px;padding:11px 20px;border-radius:8px;display:inline-block">${h(rotulo)}</a>
  </p>
  <p style="font-size:12px;color:#6A6E78">Se o botão não funcionar, copie e cole este endereço no navegador:<br>
    <span style="word-break:break-all">${h(url)}</span></p>`;

const codigoEmDestaque = (codigo: string): string => `
  <p style="font-size:26px;font-weight:800;letter-spacing:4px;margin:18px 0;color:#15161A">${h(codigo)}</p>`;

/** O prazo é do Supabase, não nosso — por isso o texto não promete um número. */
const AVISO_PRAZO =
  `<p style="font-size:12px;color:#6A6E78">Este link vale por tempo limitado e só pode ser usado uma vez.</p>`;

const NAO_PEDIU =
  `<p style="font-size:13px">Se não foi você quem pediu, ignore esta mensagem — nada muda enquanto o link não for aberto.</p>`;

export function corpoDe(m: MensagemDeAuth): string {
  switch (m.acao) {
    case "recovery":
      return moldura(
        "Criar uma nova senha",
        `<p style="font-size:14px">Recebemos um pedido para redefinir a senha de <b>${h(m.para)}</b> no
           Aplicativo Gestão da Pólobh.</p>
         ${botao(m.url, "Criar nova senha")}
         ${AVISO_PRAZO}
         ${NAO_PEDIU}`
      );

    case "invite":
      return moldura(
        "Você foi convidado",
        `<p style="font-size:14px">Você recebeu acesso ao <b>Aplicativo Gestão</b> da Pólobh.
           Use o botão abaixo para criar a sua senha e entrar.</p>
         ${botao(m.url, "Criar a minha senha")}
         ${AVISO_PRAZO}`
      );

    case "signup":
      return moldura(
        "Confirme o seu e-mail",
        `<p style="font-size:14px">Confirme o endereço <b>${h(m.para)}</b> para concluir o seu cadastro.</p>
         ${botao(m.url, "Confirmar e-mail")}
         ${AVISO_PRAZO}`
      );

    case "magiclink":
      return moldura(
        "Seu link de entrada",
        `<p style="font-size:14px">Use o botão abaixo para entrar no Aplicativo Gestão, sem digitar senha.</p>
         ${botao(m.url, "Entrar")}
         ${AVISO_PRAZO}
         ${NAO_PEDIU}`
      );

    case "email_change":
      return moldura(
        "Confirme o seu novo e-mail",
        `<p style="font-size:14px">Há um pedido para trocar o e-mail de acesso
           ${m.novoEmail ? `para <b>${h(m.novoEmail)}</b>` : ""}.
           Confirme por este endereço (<b>${h(m.para)}</b>) para a troca valer.</p>
         ${botao(m.url, "Confirmar a troca")}
         ${AVISO_PRAZO}
         ${NAO_PEDIU}`
      );

    case "reauthentication":
      return moldura(
        "Seu código de verificação",
        `<p style="font-size:14px">Use o código abaixo para confirmar que é você.</p>
         ${codigoEmDestaque(m.codigo)}
         ${AVISO_PRAZO}`
      );

    case "password_changed_notification":
      return moldura(
        "A sua senha foi alterada",
        `<p style="font-size:14px">A senha de <b>${h(m.para)}</b> acabou de ser alterada no Aplicativo Gestão.</p>
         <p style="font-size:13px">Se foi você, não precisa fazer nada.
            <b>Se não foi</b>, use o "Esqueceu a sua senha?" na tela de entrada para retomar o acesso
            e avise o suporte.</p>`
      );

    default:
      return moldura("Aviso do Aplicativo Gestão", `<p style="font-size:14px">${h(m.acao)}</p>`);
  }
}
