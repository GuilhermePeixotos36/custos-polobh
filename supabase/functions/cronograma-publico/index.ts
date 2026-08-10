/**
 * Cronograma público (sem login). Roda com service role e devolve APENAS os
 * campos do cronograma — nunca o objeto EC/OS completo. Assim a página pública
 * /cronograma/:ecId funciona sem expor financeiro, dados bancários ou contatos.
 *
 * Deploy com verify_jwt = false (público). Mesmo público, exige a anon key no
 * cabeçalho (gateway do Supabase).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const slug = new URL(req.url).searchParams.get("slug");
    if (!slug) return json({ error: "slug obrigatório" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: ec, error: ecErr } = await supabase
      .from("ecs")
      .select("id, projeto, cliente")
      .eq("slug_publico", slug)
      .neq("status", "Arquivada")
      .maybeSingle();
    if (ecErr) throw ecErr;
    if (!ec) return json({ error: "Cronograma não encontrado." }, 404);

    const { data: oss, error: osErr } = await supabase
      .from("oss")
      .select("fornecedor, status, cronograma")
      .eq("ec_id", ec.id)
      .neq("status", "Arquivada")
      .order("seq");
    if (osErr) throw osErr;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proj = (ec.projeto ?? {}) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cli = (ec.cliente ?? {}) as any;

    const resposta = {
      projeto: {
        titulo: proj.titulo ?? "",
        local: proj.local ?? "",
        evento: proj.evento ?? "",
      },
      cliente: { nome: cli.nome ?? "" },
      blocos: (oss ?? []).map((o) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const f = (o.fornecedor ?? {}) as any;
        const cron = Array.isArray(o.cronograma) ? o.cronograma : [];
        return {
          fornecedor: f.razaoSocial ?? "",
          status: o.status,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cronograma: cron.map((c: any) => ({
            etapa: c.etapa ?? "",
            data: c.data ?? "",
            horario: c.horario ?? "",
            atividades: c.atividades ?? "",
          })),
        };
      }),
    };

    return json(resposta, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
