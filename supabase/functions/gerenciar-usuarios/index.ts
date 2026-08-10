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
 *   listar                                     -> { ok, usuarios: [...] }
 *   criar    { email, nome, areaId, telefone }  -> convida por e-mail + cria o perfil na área
 *   atualizar { id, nome?, areaId?, telefone?, email? } -> atualiza perfil (+ e-mail no Auth se mudou)
 *
 * O `papel` (nível de segurança usado pela RLS) NÃO vem do cliente: é derivado
 * do `papel_base` da área por trigger no banco — ver a migração
 * 20260809120000_areas_permissoes.sql.
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const QUEM_GERENCIA: Papel[] = ["Admin", "Direcao", "Administrativo"];

interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  papel: Papel;
  areaId: string | null;
  areaNome: string | null;
}

/** Confere se a área existe; devolve o papel_base para gravar junto (a trigger reforça). */
async function papelDaArea(sb: ReturnType<typeof admin>, areaId: string): Promise<Papel> {
  const { data, error } = await sb.from("areas").select("papel_base").eq("id", areaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Área não encontrada.");
  return data.papel_base as Papel;
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
    .select("id, nome, papel, telefone, area_id, areas(nome)")
    .order("nome");
  if (perfisErro) throw new Error(perfisErro.message);

  const { data: authList, error: authErro } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (authErro) throw new Error(authErro.message);
  const emailPorId = new Map(authList.users.map((u) => [u.id, u.email ?? ""]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (perfis ?? []).map((p: any): UsuarioRow => ({
    id: p.id,
    nome: p.nome ?? "",
    telefone: p.telefone ?? "",
    papel: p.papel as Papel,
    email: emailPorId.get(p.id) ?? "",
    areaId: p.area_id ?? null,
    areaNome: (Array.isArray(p.areas) ? p.areas[0]?.nome : p.areas?.nome) ?? null,
  }));
}

async function criarUsuario(sb: ReturnType<typeof admin>, body: Record<string, unknown>): Promise<UsuarioRow> {
  const email = String(body.email ?? "").trim();
  const nome = String(body.nome ?? "").trim();
  const telefone = String(body.telefone ?? "").trim();
  const areaId = String(body.areaId ?? "").trim();
  if (!EMAIL_RE.test(email)) throw new Error("E-mail inválido.");
  if (!nome) throw new Error("Nome é obrigatório.");
  if (!areaId) throw new Error("Selecione a área do usuário.");
  const papel = await papelDaArea(sb, areaId);

  // Cria o login (convite por e-mail — o próprio usuário define a senha).
  const { data: convite, error: conviteErro } = await sb.auth.admin.inviteUserByEmail(email);
  if (conviteErro || !convite?.user) throw new Error(conviteErro?.message ?? "Não foi possível convidar este e-mail.");

  const { data: perfil, error: perfilErro } = await sb
    .from("perfis")
    .insert({ id: convite.user.id, nome, papel, telefone, area_id: areaId })
    .select("area_id, areas(nome)")
    .single();
  if (perfilErro) {
    // Reverte o convite se não conseguir criar o perfil, para não deixar login órfão.
    await sb.auth.admin.deleteUser(convite.user.id).catch(() => {});
    throw new Error(perfilErro.message);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const area = (Array.isArray((perfil as any)?.areas) ? (perfil as any).areas[0] : (perfil as any)?.areas) ?? null;
  return { id: convite.user.id, nome, telefone, papel, email, areaId, areaNome: area?.nome ?? null };
}

async function atualizarUsuario(sb: ReturnType<typeof admin>, body: Record<string, unknown>): Promise<UsuarioRow> {
  const id = String(body.id ?? "").trim();
  if (!id) throw new Error("Usuário não informado.");

  const patchPerfil: Record<string, unknown> = {};
  if (typeof body.nome === "string" && body.nome.trim()) patchPerfil.nome = body.nome.trim();
  if (typeof body.telefone === "string") patchPerfil.telefone = body.telefone.trim();
  if (typeof body.areaId === "string" && body.areaId.trim()) {
    const areaId = body.areaId.trim();
    patchPerfil.papel = await papelDaArea(sb, areaId); // a trigger no banco reforça
    patchPerfil.area_id = areaId;
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

  const { data: perfil, error: perfilErro } = await sb
    .from("perfis")
    .select("id, nome, papel, telefone, area_id, areas(nome)")
    .eq("id", id)
    .maybeSingle();
  if (perfilErro || !perfil) throw new Error(perfilErro?.message ?? "Usuário não encontrado após atualizar.");
  const { data: authUser } = await sb.auth.admin.getUserById(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = perfil as any;
  const area = (Array.isArray(p.areas) ? p.areas[0] : p.areas) ?? null;
  return {
    id: p.id,
    nome: p.nome ?? "",
    telefone: p.telefone ?? "",
    papel: p.papel as Papel,
    email: authUser?.user?.email ?? "",
    areaId: p.area_id ?? null,
    areaNome: area?.nome ?? null,
  };
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
