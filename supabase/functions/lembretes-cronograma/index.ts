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

Deno.serve(async () => {
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
      const proj = ec.projeto ?? {};
      const etapas = (os.cronograma ?? [])
        .map((c: any) => `<li><b>${c.etapa}:</b> ${dataBR(c.data)} ${c.horario} — ${c.atividades}</li>`)
        .join("");
      await enviarPeloBrevo({
        para: [{ email: f.email, nome: f.razaoSocial }],
        assunto: `Lembrete de cronograma — ${proj.titulo}`,
        html: `<p>Olá, ${f.razaoSocial || "fornecedor"}.</p>
          <p>Lembrete do cronograma do projeto <b>${proj.titulo}</b>, em <b>${dataBR(proj.evento)}</b>, local <b>${proj.local}</b>.</p>
          <ul>${etapas || "<li>Sem etapas cadastradas.</li>"}</ul>`,
      });
      await sb.from("emails").insert({
        assunto: `Lembrete de cronograma — ${proj.titulo}`,
        destinatarios: [f.email],
        status: "enviado",
        tipo: "lembrete_cronograma",
      });
      enviados++;
    }
  }

  return new Response(JSON.stringify({ ok: true, dataAlvo: alvo, enviados }), {
    headers: { "Content-Type": "application/json" },
  });
});
