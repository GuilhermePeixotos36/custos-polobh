/**
 * Edge Function agendada: vigia-banco (05/11/2026)
 *
 * A cada 30 minutos (pg_cron) pede ao banco a lista de anomalias novas
 * (`vigia_banco_rodar`, migração 20261105120000) e, se houver alguma, manda um
 * e-mail pelo Brevo para o endereço que veio no agendamento.
 *
 * Deploy:   supabase functions deploy vigia-banco --no-verify-jwt
 * Agendar:  select agendar_vigia_banco('<URL da função>', '<CRON_SECRET>', '<e-mail>');
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enviarPeloBrevo } from "../_shared/brevo.ts";

interface Anomalia {
  chave: string;
  gravidade: "alta" | "media" | "baixa";
  titulo: string;
  detalhe: string;
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const COR = { alta: "#C62828", media: "#E08600", baixa: "#5B6472" } as const;
const ROTULO = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;

function montarEmail(lista: Anomalia[]): { assunto: string; html: string } {
  const ordem = { alta: 0, media: 1, baixa: 2 };
  lista.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade]);
  const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date());
  const assunto = lista.length === 1
    ? `[Pólobh] Alerta do banco: ${lista[0].titulo}`
    : `[Pólobh] Alerta do banco: ${lista.length} anomalias (${lista[0].titulo}…)`;
  const itens = lista.map((a) => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #E3E6EB">
      <span style="display:inline-block;padding:2px 8px;border-radius:10px;background:${COR[a.gravidade]};color:#fff;font-size:12px;font-weight:700">Gravidade ${ROTULO[a.gravidade]}</span>
      <div style="font-size:15px;font-weight:700;margin:6px 0 4px">${esc(a.titulo)}</div>
      <div style="font-size:13px;color:#3A4250;white-space:pre-wrap">${esc(a.detalhe)}</div>
    </td></tr>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;color:#1B1F27">
    <h2 style="margin:0 0 4px">Vigia do banco — app Pólobh</h2>
    <div style="font-size:13px;color:#5B6472;margin-bottom:12px">Conferência de ${quando} (horário de Brasília)</div>
    <table style="width:100%;border-collapse:collapse">${itens}</table>
    <p style="font-size:12px;color:#5B6472;margin-top:16px">O mesmo problema só é avisado de novo depois de 24 horas, se continuar.</p>
  </div>`;
  return { assunto, html };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "Method not allowed" }, 405);
  const segredo = Deno.env.get("CRON_SECRET") ?? "";
  if (!segredo || req.headers.get("x-cron-secret") !== segredo) return json({ erro: "Não autorizado" }, 401);

  const corpo = (await req.json().catch(() => ({}))) as { para?: string; teste?: boolean };
  const para = String(corpo.para ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) return json({ erro: "E-mail de destino inválido" }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let lista: Anomalia[];
  if (corpo.teste) {
    lista = [{ chave: "teste", gravidade: "baixa", titulo: "Vigia ativado (e-mail de teste)", detalhe: "A partir de agora o banco é conferido a cada 30 minutos. Este e-mail só chega quando houver algo fora do normal." }];
  } else {
    const { data, error } = await sb.rpc("vigia_banco_rodar");
    if (error) {
      // A própria conferência falhar já é uma anomalia.
      lista = [{ chave: "vigia", gravidade: "alta", titulo: "A conferência do banco falhou", detalhe: error.message }];
    } else {
      lista = (data ?? []) as Anomalia[];
    }
  }
  if (!lista.length) return json({ ok: true, anomalias: 0 });

  const { assunto, html } = montarEmail(lista);
  await enviarPeloBrevo({ para: [{ email: para }], assunto, html });
  return json({ ok: true, anomalias: lista.length });
});
