// Acessos: criar usuário e trocar a senha (padrão de Acessos LSPRO, adaptado à Pólobh — 24/11/2026).
//
// Quem cadastra digita nome, e-mail (o login), setor, cargo e telefone, escolhe o grupo de
// permissão e define a senha inicial, que aparece uma vez na tela para ser passada à pessoa.
// ADAPTAÇÕES do padrão (decisão do dono do app): sem Microsoft 365/SSO/Graph — todo usuário entra
// com e-mail e senha; sem lista de colaboradores de outro app. A recuperação de senha pela
// própria pessoa ("Esqueci minha senha", rota /nova-senha) e a troca pelo "Alterar senha" da
// conta continuam no app; esta função é o caminho do ADMINISTRADOR.
//
//   criar_usuario {nome, email, setor?, cargo?, telefone?, senha, grupoId}
//                 exige acessos.usuarios · criar (RPC `tem_permissao` com o JWT de quem chama)
//                 -> { usuarioId }
//                 400 dado inválido, senha curta, vazada ou fora da política; 403 sem permissão ou
//                 grupo fora do alcance; 409 e-mail de usuário ativo/inativo
//   definir_senha {usuarioId, senha}  exige acessos.usuarios · editar -> { ok: true }
//                 400 senha vazada ou fora da política; 409 usuário não está ativo; 403 a própria
//                 senha, membro do Administrador por quem não é, ou alvo fora do alcance
//
// A senha nunca é registrada em log nem devolvida. Trocar a senha de alguém é assumir a conta:
// quem não é do Administrador só troca a de quem está num grupo que ele poderia conceder.
//
// Segredos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (já vêm no projeto).
// Opcional: ACESSOS_ALLOWED_ORIGINS (origens do app, separadas por vírgula; sem ela o CORS é `*`).
//
// LOG: o padrão de Logs (`_shared/log.ts`) está sendo instalado em paralelo. Quando ele entrar,
// registre aqui `usuario_criado` e `senha_definida` (sem a senha). Até lá a tela registra o ato
// pelo `auditar` do front.
//
// NUNCA escreva escape unicode (barra invertida + u) neste arquivo, nem em comentário.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  decidirReaproveitamento, emailConfere, traduzirErroDeSenha, validarCriarUsuario, validarDefinirSenha,
} from "../_shared/acessos.ts";

function cors(req: Request): Record<string, string> {
  const origem = req.headers.get("origin") ?? "";
  const permitidas = (Deno.env.get("ACESSOS_ALLOWED_ORIGINS") ?? "*")
    .split(",").map((i) => i.trim()).filter(Boolean);
  const permitida = permitidas.includes("*") ? "*" : (permitidas.includes(origem) ? origem : "");
  return {
    ...(permitida ? { "Access-Control-Allow-Origin": permitida } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const OPCOES_CLIENTE = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

function servico(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !chave) throw new Error("INTEGRACAO_NAO_CONFIGURADA");
  return createClient(url, chave, OPCOES_CLIENTE);
}

const jwtDe = (req: Request) => (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1] ?? "";

type Chamador = { id: string; cliente: SupabaseClient; ehAdministrador: boolean };

/** Sessão válida; `cliente` leva o JWT dele, para as RPCs de permissão enxergarem quem chama. */
async function chamadorDe(req: Request): Promise<Chamador | null> {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const jwt = jwtDe(req);
  if (!url || !anon || !jwt) return null;
  const cliente = createClient(url, anon, { ...OPCOES_CLIENTE, global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: { user } } = await cliente.auth.getUser(jwt);
  if (!user) return null;
  const { data: minhas } = await cliente.rpc("minhas_permissoes");
  const grupo = (minhas as { grupo?: { sistema?: boolean } } | null)?.grupo;
  return { id: user.id, cliente, ehAdministrador: grupo?.sistema === true };
}

/** Falha fechada: erro da RPC (inclusive a migration ainda não aplicada) é "não pode". */
async function temPermissao(chamador: Chamador, tela: string, acao: string): Promise<boolean> {
  const { data, error } = await chamador.cliente.rpc("tem_permissao", { p_tela: tela, p_acao: acao });
  return !error && data === true;
}

async function possoConcederGrupo(chamador: Chamador, grupoId: string | null): Promise<boolean> {
  if (!grupoId) return false;
  const { data, error } = await chamador.cliente.rpc("posso_conceder_grupo", { p_grupo: grupoId });
  return !error && data === true;
}

type LinhaPerfil = {
  id: string; nome: string | null; papel: string; status: string; grupo_id: string | null;
  cargo: string | null; setor: string | null; telefone: string | null;
};
const COLUNAS_PERFIL = "id, nome, papel, status, grupo_id, cargo, setor, telefone";

/** Conta do Auth pelo e-mail (RPC só da service role): o Auth é quem diz de quem é o e-mail. */
async function contaDoAuthPorEmail(admin: SupabaseClient, email: string): Promise<{ id: string; email: string } | null> {
  const { data, error } = await admin.rpc("usuario_auth_por_email", { p_email: email });
  if (error) throw new Error(`usuario_auth_por_email: ${error.message}`);
  const linha = (Array.isArray(data) ? data[0] : data) as { id?: string; email?: string } | undefined;
  return linha?.id ? { id: String(linha.id), email: String(linha.email ?? "") } : null;
}

/**
 * A linha de `perfis` do id, ou `null` quando ela NÃO EXISTE. Falha de leitura lança: tratar o
 * erro como "não existe" faria a conta de um usuário ativo passar por pendente e ser tomada.
 */
async function perfilPorId(admin: SupabaseClient, id: string): Promise<LinhaPerfil | null> {
  const { data, error } = await admin.from("perfis").select(COLUNAS_PERFIL).eq("id", id).maybeSingle();
  if (error) throw new Error(`perfis: ${error.message}`);
  return (data as LinhaPerfil | null) ?? null;
}

async function grupoDeSistema(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin.from("acesso_grupo").select("id").eq("sistema", true).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

// --- criar_usuario -----------------------------------------------------------------------------

async function criarUsuario(req: Request, chamador: Chamador, corpo: Record<string, unknown>): Promise<Response> {
  const validado = validarCriarUsuario(corpo);
  if (!validado.ok) return json(req, { error: validado.erro }, 400);
  const d = validado.dados;
  if (!(await temPermissao(chamador, "acessos.usuarios", "criar"))) {
    return json(req, { error: "Você não tem permissão para cadastrar usuários." }, 403);
  }
  const admin = servico();

  const { data: grupo } = await admin.from("acesso_grupo").select("id, sistema, ativo").eq("id", d.grupoId).maybeSingle();
  if (!grupo || !grupo.ativo) return json(req, { error: "O grupo escolhido não existe ou está inativo." }, 400);
  if (grupo.sistema && !chamador.ehAdministrador) {
    return json(req, { error: "Somente um usuário do grupo Administrador de sistema pode cadastrar alguém nesse grupo." }, 403);
  }
  // Quem não é do Administrador só atribui grupo contido no dele (uma regra só, no banco).
  if (!(await possoConcederGrupo(chamador, d.grupoId))) {
    return json(req, { error: "Você só pode atribuir grupos cujas permissões você mesmo tem." }, 403);
  }

  // Conta que já existe com o e-mail (típico: convite antigo que virou pendente). Procurada NO
  // AUTH, e o e-mail do Auth do id achado tem de ser exatamente o pedido.
  const contaAuth = await contaDoAuthPorEmail(admin, d.email);
  if (contaAuth && !emailConfere(d.email, contaAuth.email)) {
    return json(req, { error: "Não foi possível confirmar a conta deste e-mail." }, 409);
  }
  const existente = contaAuth ? await perfilPorId(admin, contaAuth.id) : null;
  if (contaAuth) {
    const { data: doAuth } = await admin.auth.admin.getUserById(contaAuth.id);
    if (!emailConfere(d.email, doAuth?.user?.email)) {
      return json(req, { error: "Não foi possível confirmar a conta deste e-mail." }, 409);
    }
    // Conta do Auth sem linha em `perfis` (gatilho ausente) conta como pendente.
    const decisao = decidirReaproveitamento(existente?.status ?? "pendente");
    if (!decisao.ok) return json(req, { error: decisao.erro }, decisao.status);
    // Liberar uma conta pendente que já existe é editar o usuário, não só cadastrar.
    if (!(await temPermissao(chamador, "acessos.usuarios", "editar"))) {
      return json(req, { error: "Esta conta já existe. Para liberá-la você precisa de permissão para editar usuários." }, 403);
    }
    if (existente?.grupo_id && !chamador.ehAdministrador && existente.grupo_id === await grupoDeSistema(admin)) {
      return json(req, { error: "Esta conta pertence ao grupo Administrador de sistema e só um Administrador pode liberá-la." }, 403);
    }
  }

  let id = contaAuth?.id ?? "";
  if (!contaAuth) {
    const criado = await admin.auth.admin.createUser({
      email: d.email, password: d.senha, email_confirm: true, user_metadata: { nome: d.nome },
    });
    if (criado.error || !criado.data.user) {
      console.error("[acessos] createUser", criado.error?.message ?? "sem usuário");
      const senhaRecusada = traduzirErroDeSenha(criado.error as { code?: unknown; reasons?: unknown } | null);
      if (senhaRecusada) return json(req, { error: senhaRecusada.erro }, senhaRecusada.status);
      const jaExiste = /already|registered/i.test(criado.error?.message ?? "");
      return json(req, { error: jaExiste ? "Já existe uma conta com este e-mail." : "Não foi possível criar a conta de acesso." }, jaExiste ? 409 : 500);
    }
    id = criado.data.user.id;
  }

  const desfazer = async () => {
    if (existente) {
      // A conta do Auth já existia: volta a linha como estava (pendente), nunca se apaga a conta.
      const { error } = await admin.from("perfis").update({
        nome: existente.nome, status: existente.status, grupo_id: existente.grupo_id,
        cargo: existente.cargo, setor: existente.setor, telefone: existente.telefone ?? "",
      }).eq("id", existente.id);
      if (error) console.error("[acessos] restaurar perfil", error.message);
    } else if (contaAuth) {
      const { error } = await admin.from("perfis").delete().eq("id", id);
      if (error) console.error("[acessos] restaurar perfil ausente", error.message);
    } else {
      // A linha do app primeiro: sem ela a conta do Auth apagada deixaria o cadastro órfão.
      const apagado = await admin.from("perfis").delete().eq("id", id);
      if (apagado.error) console.error("[acessos] rollback perfil", apagado.error.message);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) console.error("[acessos] rollback auth", error.message);
    }
  };

  // O gatilho de Auth já criou a linha pendente; aqui ela é completada — e SÓ se ainda estiver
  // pendente (o filtro é a trava: se a conta virou ativa entre a leitura e a gravação, nada muda).
  // Sem linha nenhuma (gatilho ausente), insere. `papel` vai só para cumprir o NOT NULL: o
  // gatilho do banco o deriva do grupo.
  const campos = {
    nome: d.nome, status: "ativo", grupo_id: d.grupoId,
    cargo: d.cargo || null, setor: d.setor || null, telefone: d.telefone,
  };
  let gravado = await admin.from("perfis").update(campos).eq("id", id).eq("status", "pendente").select("id");
  if (!gravado.error && (gravado.data ?? []).length === 0) {
    if (existente) {
      // Nada foi gravado (a conta já existia no Auth e a linha não estava mais pendente): não há o
      // que desfazer — "restaurar" aqui sobrescreveria o que mudou.
      return json(req, { error: "Esta conta mudou enquanto o cadastro era feito. Recarregue a lista e tente de novo." }, 409);
    }
    gravado = await admin.from("perfis").insert({ id, papel: "Producao", ...campos }).select("id");
  }
  if (gravado.error) {
    console.error("[acessos] gravar perfil", gravado.error.message);
    await desfazer();
    return json(req, { error: "O usuário não pôde ser registrado. Nada foi criado." }, gravado.error.code === "23505" ? 409 : 500);
  }

  // Senha de conta já existente só depois de o resto gravar, para a falha não deixar a senha trocada.
  // O e-mail fica confirmado: conta de convite antigo que nunca confirmou seria barrada no login.
  // (Sessões que a conta pendente já tivesse continuam até expirar — pendente não acessa nada
  // pela RLS, mas o cadastro público do Auth deve estar desligado: ver docs/acessos.md.)
  if (contaAuth) {
    const { error: erroSenha } = await admin.auth.admin.updateUserById(id, { password: d.senha, email_confirm: true });
    if (erroSenha) {
      console.error("[acessos] updateUserById", erroSenha.message);
      await desfazer();
      const senhaRecusada = traduzirErroDeSenha(erroSenha as { code?: unknown; reasons?: unknown });
      return json(req, { error: senhaRecusada?.erro ?? "Não foi possível definir a senha. Tente outra." }, 400);
    }
  }

  return json(req, { usuarioId: id });
}

// --- definir_senha -----------------------------------------------------------------------------

async function definirSenha(req: Request, chamador: Chamador, corpo: Record<string, unknown>): Promise<Response> {
  const validado = validarDefinirSenha(corpo);
  if (!validado.ok) return json(req, { error: validado.erro }, 400);
  if (!(await temPermissao(chamador, "acessos.usuarios", "editar"))) {
    return json(req, { error: "Você não tem permissão para definir a senha de usuários." }, 403);
  }
  const admin = servico();
  const alvo = await perfilPorId(admin, validado.dados.usuarioId);
  if (!alvo) return json(req, { error: "Usuário não encontrado." }, 404);
  // Ninguém altera o próprio acesso pela tela de Acessos: a própria senha se troca no "Alterar
  // senha" da conta (que pede a senha atual) ou pelo "Esqueci minha senha" do login.
  if (alvo.id === chamador.id) {
    return json(req, { error: "A sua própria senha se troca em \"Alterar senha\", no cartão da sua conta." }, 403);
  }
  // Inativo não se edita (nem a senha): primeiro ativa. Pendente ainda não tem acesso para trocar.
  if (alvo.status !== "ativo") return json(req, { error: "A senha só se define para usuário ativo. Ative o usuário primeiro." }, 409);
  if (!chamador.ehAdministrador && alvo.grupo_id && alvo.grupo_id === await grupoDeSistema(admin)) {
    return json(req, { error: "Somente um Administrador de sistema pode trocar a senha de membro desse grupo." }, 403);
  }
  // Quem não é do Administrador nunca troca a senha (a chave da conta) de quem tem mais do que ele.
  if (!chamador.ehAdministrador && !(await possoConcederGrupo(chamador, alvo.grupo_id))) {
    return json(req, { error: "Você só pode trocar a senha de usuários cujo grupo está dentro do seu próprio acesso." }, 403);
  }
  const { error } = await admin.auth.admin.updateUserById(alvo.id, { password: validado.dados.senha });
  if (error) {
    // Só a mensagem do Auth (ex.: senha vazada ou fraca demais); nunca a senha.
    console.error("[acessos] updateUserById", error.message);
    return json(req, { error: traduzirErroDeSenha(error as { code?: unknown; reasons?: unknown })?.erro ?? "Não foi possível definir a senha. Tente outra." }, 400);
  }
  return json(req, { ok: true });
}

// --- entrada -----------------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Use POST." }, 405);

  const corpo = await req.json().catch(() => ({})) as Record<string, unknown>;
  const acao = String(corpo.acao ?? "");

  try {
    if (acao === "criar_usuario" || acao === "definir_senha") {
      const chamador = await chamadorDe(req);
      if (!chamador) return json(req, { error: "Sessão inválida." }, 401);
      return acao === "criar_usuario"
        ? await criarUsuario(req, chamador, corpo)
        : await definirSenha(req, chamador, corpo);
    }
    return json(req, { error: "Ação desconhecida." }, 400);
  } catch (erro) {
    console.error("[acessos]", erro instanceof Error ? erro.message : "falha");
    return json(req, { error: "Não foi possível concluir a operação." }, 500);
  }
});
