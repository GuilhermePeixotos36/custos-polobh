/**
 * Edge Function agendada: lembretes-cronograma
 * Envia, automaticamente, o lembrete de cronograma aos fornecedores
 * **2 dias úteis antes do evento** (exigência da Pólobh — texto padrão).
 *
 * Deploy:   supabase functions deploy lembretes-cronograma
 * Agendar:  via pg_cron (ver supabase/schema.sql) ou um cron externo que faça
 *           POST nesta função 1x ao dia.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enviarPeloBrevo } from "../_shared/brevo.ts";

/** Soma N dias úteis (pula sábado/domingo). */
function maisDiasUteis(base: Date, n: number): Date {
  const d = new Date(base);
  let restantes = n;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) restantes--;
  }
  return d;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const dataBR = (s: string) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "");
const h = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ erro: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  const segredo = Deno.env.get("CRON_SECRET") ?? "";
  if (!segredo || req.headers.get("x-cron-secret") !== segredo) {
    return new Response(JSON.stringify({ erro: "Não autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);

  // Data-alvo: eventos que acontecem daqui a 2 dias úteis.
  const alvo = iso(maisDiasUteis(new Date(), 2));

  // ECs com evento na data-alvo (projeto.evento guardado em jsonb).
  const { data: ecs, error } = await sb
    .from("ecs")
    .select("id, numero, cliente_id, projeto")
    .filter("projeto->>evento", "eq", alvo);
  if (error) return new Response(JSON.stringify({ erro: error.message }), { status: 500 });

  let enviados = 0;
  for (const ec of ecs ?? []) {
    const { data: oss } = await sb.from("oss").select("*").eq("ec_id", ec.id);
    for (const os of oss ?? []) {
      const f = os.fornecedor ?? {};
      if (!f.email) continue;
      // A restrição única no banco transforma cada lembrete diário em uma operação idempotente.
      const { data: reserva, error: reservaErro } = await sb.from("emails").insert({
        assunto: `Lembrete de cronograma — ${ec.projeto?.titulo ?? ""}`,
        destinatarios: [f.email],
        status: "processando",
        tipo: "lembrete_cronograma",
        referencia_id: os.id,
        data_referencia: alvo,
      }).select("id").maybeSingle();
      if (reservaErro?.code === "23505" || !reserva) continue;
      if (reservaErro) throw reservaErro;
      const proj = ec.projeto ?? {};
      const etapas = (os.cronograma ?? [])
        .map((c: any) => `<li><b>${h(c.etapa)}:</b> ${h(dataBR(c.data))} ${h(c.horario)} — ${h(c.atividades)}</li>`)
        .join("");
      try {
        const envio = await enviarPeloBrevo({
          para: [{ email: f.email, nome: f.razaoSocial }],
          assunto: `Lembrete de cronograma — ${proj.titulo}`,
          html: `<p>Olá, ${h(f.razaoSocial || "fornecedor")}.</p>
            <p>Lembrete do cronograma do projeto <b>${h(proj.titulo)}</b>, em <b>${h(dataBR(proj.evento))}</b>, local <b>${h(proj.local)}</b>.</p>
            <ul>${etapas || "<li>Sem etapas cadastradas.</li>"}</ul>`,
        });
        await sb.from("emails").update({ status: "enviado", provider_id: envio.messageId ?? null }).eq("id", reserva.id);
        enviados++;
      } catch (erro) {
        await sb.from("emails").update({ status: "erro", erro: String((erro as Error).message) }).eq("id", reserva.id);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, dataAlvo: alvo, enviados }), {
    headers: { "Content-Type": "application/json" },
  });
});
