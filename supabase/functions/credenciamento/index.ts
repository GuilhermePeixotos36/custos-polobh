/**
 * Credenciamento público (sem login). O fornecedor abre pelo link
 * /credenciamento/<token>, vê o contexto do evento e envia sua equipe e
 * veículos. Roda com service role; grava em `credenciamentos`.
 *
 * GET  ?token=...        -> contexto (evento, fornecedor, prazo, já enviado?)
 * POST { token, equipe, veiculos } -> grava a resposta (respeita o prazo)
 *
 * Deploy com verify_jwt = false (público). Exige a anon key no cabeçalho.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // ----- Contexto do formulário -----
    if (req.method === "GET") {
      const token = new URL(req.url).searchParams.get("token");
      if (!token) return json({ error: "token obrigatório" }, 400);

      const { data: os, error } = await supabase
        .from("oss")
        .select("id, fornecedor, credenciamento, ec:ecs(projeto)")
        .eq("slug_credenciamento", token)
        .maybeSingle();
      if (error) throw error;
      if (!os) return json({ error: "Link de credenciamento inválido." }, 404);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const proj = ((os as any).ec?.projeto ?? {}) as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const forn = ((os as any).fornecedor ?? {}) as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cred = ((os as any).credenciamento ?? {}) as any;

      return json({
        evento: { titulo: proj.titulo ?? "", local: proj.local ?? "", data: proj.evento ?? "" },
        fornecedor: forn.razaoSocial ?? "",
        prazoLimite: cred.prazoLimite ?? "",
      });
    }

    // ----- Envio da resposta -----
    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      const token = body?.token as string | undefined;
      if (!token) return json({ error: "token obrigatório" }, 400);

      const { data: os, error } = await supabase
        .from("oss")
        .select("id, credenciamento")
        .eq("slug_credenciamento", token)
        .maybeSingle();
      if (error) throw error;
      if (!os) return json({ error: "Link de credenciamento inválido." }, 404);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prazo = ((os as any).credenciamento ?? {}).prazoLimite as string | undefined;
      if (prazo) {
        const limite = new Date(prazo + "T23:59:59");
        if (!isNaN(limite.getTime()) && new Date() > limite) {
          return json({ error: "O prazo de credenciamento já encerrou." }, 403);
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const equipe = (Array.isArray(body?.equipe) ? body.equipe : []).slice(0, 200).map((p: any) => ({
        nome: str(p?.nome), cpf: str(p?.cpf, 20), funcao: str(p?.funcao, 80),
      })).filter((p: { nome: string }) => p.nome.trim() !== "");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const veiculos = (Array.isArray(body?.veiculos) ? body.veiculos : []).slice(0, 100).map((v: any) => ({
        modelo: str(v?.modelo, 120), placa: str(v?.placa, 12),
      })).filter((v: { modelo: string; placa: string }) => v.modelo.trim() !== "" || v.placa.trim() !== "");

      if (equipe.length === 0 && veiculos.length === 0) {
        return json({ error: "Informe ao menos um membro da equipe ou um veículo." }, 400);
      }

      const { error: insErr } = await supabase.from("credenciamentos").insert({
        os_id: (os as { id: string }).id,
        equipe,
        veiculos,
      });
      if (insErr) throw insErr;

      return json({ ok: true });
    }

    return json({ error: "método não suportado" }, 405);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
