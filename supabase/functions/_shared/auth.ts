import { createClient } from "jsr:@supabase/supabase-js@2";

export type Papel = "Admin" | "Direcao" | "Producao" | "Administrativo";

export interface UsuarioAutorizado {
  id: string;
  papel: Papel;
  /** Nome do perfil (para os registros de consumo e de ações). */
  nome?: string;
}

/** Valida o JWT do usuário e o papel no servidor. A anon key isolada nunca autoriza. */
export async function autorizar(req: Request, papeis: Papel[]): Promise<UsuarioAutorizado> {
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Response(JSON.stringify({ ok: false, erro: "Não autenticado." }), { status: 401 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) {
    throw new Response(JSON.stringify({ ok: false, erro: "Sessão inválida ou expirada." }), { status: 401 });
  }
  const { data: perfil, error: perfilError } = await admin
    .from("perfis")
    .select("papel, nome")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (perfilError || !perfil || !papeis.includes(perfil.papel as Papel)) {
    throw new Response(JSON.stringify({ ok: false, erro: "Sem permissão para esta operação." }), { status: 403 });
  }
  return { id: authData.user.id, papel: perfil.papel as Papel, nome: (perfil as { nome?: string }).nome ?? undefined };
}

export function respostaAutorizacao(erro: unknown, cors: Record<string, string>): Response | null {
  if (!(erro instanceof Response)) return null;
  return new Response(erro.body, {
    status: erro.status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
