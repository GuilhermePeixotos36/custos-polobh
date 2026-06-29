/**
 * Edge Function: send-email
 * Recebe a mensagem montada pelo frontend (VITE_EMAIL_ENDPOINT aponta para cá),
 * envia pelo Brevo e registra na tabela `emails`. A chave fica só no servidor.
 *
 * Deploy:  supabase functions deploy send-email
 * Segredos: supabase secrets set BREVO_API_KEY=... BREVO_SENDER_EMAIL=... BREVO_SENDER_NAME="Pólobh Eventos"
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enviarPeloBrevo, type EmailBrevo } from "../_shared/brevo.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const msg = (await req.json()) as EmailBrevo;
    if (!msg?.para?.length || !msg.assunto) {
      return new Response(JSON.stringify({ erro: "Payload inválido." }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const r = await enviarPeloBrevo(msg);

    // Registro (opcional): exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente da função.
    try {
      const url = Deno.env.get("SUPABASE_URL");
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (url && key) {
        const sb = createClient(url, key);
        await sb.from("emails").insert({
          assunto: msg.assunto,
          destinatarios: msg.para.map((p) => p.email),
          provider_id: r.messageId ?? null,
          status: "enviado",
        });
      }
    } catch (_) {
      // log do e-mail é best-effort; não falha o envio
    }

    return new Response(JSON.stringify({ ok: true, messageId: r.messageId }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, erro: String((e as Error).message) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
