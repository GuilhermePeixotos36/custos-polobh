import { enviarPeloBrevo } from "../_shared/brevo.ts";
import { assuntoDe, corpoDe, mensagensDoEvento, type EventoDeEmail } from "./modelos.ts";

/**
 * Edge Function: auth-send-email — o "Send Email Hook" do Supabase Auth.
 *
 * O Supabase manda os e-mails de autenticação (recuperar senha, convite,
 * confirmação, troca de e-mail) pelo SMTP configurado no projeto. Sem SMTP
 * próprio ele usa o de fábrica, que é explicitamente de desenvolvimento: poucos
 * envios por hora, sem garantia de entrega, e remetente
 * `noreply@mail.app.supabase.io` — não o domínio da Pólobh.
 *
 * O caminho comum seria configurar o SMTP do Brevo. Aqui ele não sai: o painel
 * do Brevo recusa criar a chave SMTP. Mas a API transacional do Brevo JÁ é o que
 * a casa usa para todo o resto (`_shared/brevo.ts`), e o Supabase aceita trocar
 * o SMTP por uma chamada HTTP a uma função sua — é este hook.
 *
 * Ganhos, além de destravar:
 *  · os e-mails de autenticação passam a sair de `noreply@polobh.com.br`, com a
 *    marca e o texto da casa, em português;
 *  · deixam de depender de uma chave SMTP que o Brevo expira após 90 dias sem
 *    uso — e este sistema manda pouquíssimo e-mail de autenticação, então a
 *    expiração silenciosa era questão de tempo;
 *  · o envio fica registrado na tabela `emails`, junto com todos os outros.
 *
 * SEM JWT, e é assim que tem de ser: quem chama é o servidor de autenticação,
 * que não tem sessão de usuário. Publique com `--no-verify-jwt`. O que prova a
 * origem é a ASSINATURA (Standard Webhooks), verificada abaixo — sem ela, este
 * endereço seria um disparador de e-mail aberto na internet.
 *
 * Deploy:  supabase functions deploy auth-send-email --no-verify-jwt
 *
 * Segredos (no Supabase):
 *   SEND_EMAIL_HOOK_SECRET=v1,whsec_...   (gerado no painel, em Auth › Hooks)
 *   BREVO_API_KEY / BREVO_SENDER_EMAIL / BREVO_SENDER_NAME  (já existem)
 */
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

/** O que o Supabase manda. Só os campos que este hook usa. */
interface CargaDoHook {
  user: { email: string; new_email?: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new: string;
    token_hash_new: string;
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Resposta de erro no formato que o GoTrue entende e registra. */
const erro = (mensagem: string, status = 500) =>
  json({ error: { http_code: status, message: mensagem } }, status);

/**
 * Verifica a assinatura, aceitando mais de um segredo.
 *
 * O Supabase assina com TODOS os segredos configurados, separados por `|`, para
 * que a troca de chave possa acontecer sem janela de indisponibilidade. Tentar
 * só o primeiro faria a rotação derrubar os e-mails de autenticação.
 */
function verificar(payload: string, headers: Record<string, string>): CargaDoHook {
  const bruto = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  if (!bruto) throw new Error("SEND_EMAIL_HOOK_SECRET não configurada.");

  const segredos = bruto.split("|").map((s) => s.trim().replace("v1,whsec_", "")).filter(Boolean);
  let ultimo: unknown;
  for (const segredo of segredos) {
    try {
      return new Webhook(segredo).verify(payload, headers) as CargaDoHook;
    } catch (e) {
      ultimo = e;
    }
  }
  throw new Error(`Assinatura inválida: ${String((ultimo as Error)?.message ?? "sem segredo utilizável")}`);
}

/** Registra o envio na tabela `emails`, como faz a `send-email`. Best-effort. */
async function registrar(linha: Record<string, unknown>): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/emails`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(linha),
    });
  } catch (_) {
    // O registro não pode derrubar o envio: sem e-mail, ninguém entra no sistema.
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return erro("Method not allowed", 405);

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let carga: CargaDoHook;
  try {
    carga = verificar(payload, headers);
  } catch (e) {
    // 401 de propósito: para o GoTrue isto é "não confio em quem respondeu",
    // e é o que aparece no log de autenticação para quem for investigar.
    return erro(String((e as Error).message), 401);
  }

  const evento: EventoDeEmail = {
    email: carga.user.email,
    novoEmail: carga.user.new_email ?? "",
    ...carga.email_data,
    projetoUrl: Deno.env.get("SUPABASE_URL") ?? "",
  };

  // Uma troca de e-mail com confirmação dupla gera DUAS mensagens, para
  // endereços diferentes; todo o resto gera uma.
  const mensagens = mensagensDoEvento(evento);
  if (!mensagens.length) {
    // Tipo de evento que a casa não usa: responder 200 deixa o Supabase seguir
    // sem e-mail, em vez de travar o fluxo de quem está tentando entrar.
    return json({});
  }

  for (const m of mensagens) {
    const assunto = assuntoDe(m);
    try {
      const r = await enviarPeloBrevo({ para: [{ email: m.para }], assunto, html: corpoDe(m) });
      await registrar({
        assunto,
        destinatarios: [m.para],
        provider_id: r.messageId ?? null,
        status: "enviado",
      });
    } catch (e) {
      const texto = String((e as Error).message);
      await registrar({ assunto, destinatarios: [m.para], status: "erro", erro: texto });
      return erro(`Falha ao enviar pelo Brevo: ${texto}`, 500);
    }
  }

  return json({});
});
