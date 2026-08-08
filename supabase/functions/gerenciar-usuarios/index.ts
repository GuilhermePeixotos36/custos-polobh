import { createClient } from "jsr:@supabase/supabase-js@2";
import { autorizar, respostaAutorizacao, type Papel } from "../_shared/auth.ts";

/**
 * Edge Function: gerenciar-usuarios
 *
 * CRUD de usuários do sistema (perfis + e-mail/login no Supabase Auth). Roda
 * com a chave de serviço porque criar login e editar e-mail exige a Admin API
 * do Supabase Auth — inacessível para o cliente (anon key) por segurança.
 * Só Admin/Direção/Administrativo (mesmo grupo do recurso "configuracoes")
 * podem chamar esta função.
 *
 * Ações (POST { acao, ... }):
 *   listar                                  -> { ok, usuarios: [...] }
 *   criar    { email, nome, papel, telefone } -> convida por e-mail + cria o perfil
 *   atualizar { id, nome?, papel?, telefone?, email? } -> atualiza perfil (+ e-mail no Auth se mudou)
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAPEIS_VALIDOS: Papel[] = ["Admin", "Direcao", "Producao", "Administrativo"];
const QUEM_GERENCIA: Papel[] = ["Admin", "Direcao", "Administrativo"];

interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  papel: Papel;
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Lista os perfis cadastrados e casa cada um com o e-mail do respectivo login no Auth. */
async function listarUsuarios(sb: ReturnType<typeof admin>): Promise<UsuarioRow[]> {
  const { data: perfis, error: perfisErro } = await sb
    .from("perfis")
    .select("id, nome, papel, telefone")
    .order("nome");
  if (perfisErro) throw new Error(perfisErro.message);

  const { data: authList, error: authErro } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (authErro) throw new Error(authErro.message);
  const emailPorId = new Map(authList.users.map((u) => [u.id, u.email ?? ""]));

  return (perfis ?? []).map((p): UsuarioRow => ({
    id: p.id,
    nome: p.nome ?? "",
    telefone: p.telefone ?? "",
    papel: p.papel as Papel,
    email: emailPorId.get(p.id) ?? "",
  }));
}

async function criarUsuario(sb: ReturnType<typeof admin>, body: Record<string, unknown>): Promise<UsuarioRow> {
  const email = String(body.email ?? "").trim();
  const nome = String(body.nome ?? "").trim();
  const telefone = String(body.telefone ?? "").trim();
  const papel = body.papel as Papel;
  if (!EMAIL_RE.test(email)) throw new Error("E-mail inválido.");
  if (!nome) throw new Error("Nome é obrigatório.");
  if (!PAPEIS_VALIDOS.includes(papel)) throw new Error("Papel/grupo de permissão inválido.");

  // Cria o login (convite por e-mail — o próprio usuário define a senha).
  const { data: convite, error: conviteErro } = await sb.auth.admin.inviteUserByEmail(email);
  if (conviteErro || !convite?.user) throw new Error(conviteErro?.message ?? "Não foi possível convidar este e-mail.");

  const { error: perfilErro } = await sb.from("perfis").insert({ id: convite.user.id, nome, papel, telefone });
  if (perfilErro) {
    // Reverte o convite se não conseguir criar o perfil, para não deixar login órfão.
    await sb.auth.admin.deleteUser(convite.user.id).catch(() => {});
    throw new Error(perfilErro.message);
  }

  return { id: convite.user.id, nome, telefone, papel, email };
}

async function atualizarUsuario(sb: ReturnType<typeof admin>, body: Record<string, unknown>): Promise<UsuarioRow> {
  const id = String(body.id ?? "").trim();
  if (!id) throw new Error("Usuário não informado.");

  const patchPerfil: Record<string, unknown> = {};
  if (typeof body.nome === "string" && body.nome.trim()) patchPerfil.nome = body.nome.trim();
  if (typeof body.telefone === "string") patchPerfil.telefone = body.telefone.trim();
  if (typeof body.papel === "string") {
    if (!PAPEIS_VALIDOS.includes(body.papel as Papel)) throw new Error("Papel/grupo de permissão inválido.");
    patchPerfil.papel = body.papel;
  }
  if (Object.keys(patchPerfil).length) {
    const { error } = await sb.from("perfis").update(patchPerfil).eq("id", id);
    if (error) throw new Error(error.message);
  }

  if (typeof body.email === "string" && body.email.trim()) {
    const email = body.email.trim();
    if (!EMAIL_RE.test(email)) throw new Error("E-mail inválido.");
    const { error } = await sb.auth.admin.updateUserById(id, { email });
    if (error) throw new Error(error.message);
  }

  const { data: perfil, error: perfilErro } = await sb.from("perfis").select("id, nome, papel, telefone").eq("id", id).maybeSingle();
  if (perfilErro || !perfil) throw new Error(perfilErro?.message ?? "Usuário não encontrado após atualizar.");
  const { data: authUser } = await sb.auth.admin.getUserById(id);
  return { id: perfil.id, nome: perfil.nome ?? "", telefone: perfil.telefone ?? "", papel: perfil.papel as Papel, email: authUser?.user?.email ?? "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, erro: "Method not allowed" }, 405);

  try {
    await autorizar(req, QUEM_GERENCIA);
  } catch (erro) {
    return respostaAutorizacao(erro, cors) ?? json({ ok: false, erro: "Falha ao validar a sessão." }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, erro: "JSON inválido." }, 400);
  }

  const sb = admin();
  try {
    switch (body.acao) {
      case "listar":
        return json({ ok: true, usuarios: await listarUsuarios(sb) });
      case "criar":
        return json({ ok: true, usuario: await criarUsuario(sb, body) });
      case "atualizar":
        return json({ ok: true, usuario: await atualizarUsuario(sb, body) });
      default:
        return json({ ok: false, erro: "Ação desconhecida." }, 400);
    }
  } catch (e) {
    return json({ ok: false, erro: (e as Error).message }, 400);
  }
});
