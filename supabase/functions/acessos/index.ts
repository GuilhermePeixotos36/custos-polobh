// Acessos: criar usuário e trocar senhas (padrão de Acessos — só login e senha).
//
// Quem cria o acesso escolhe a pessoa (colaborador do cadastro ou avulso), informa o CPF, o grupo
// de permissão e a senha inicial. Todo usuário entra com e-mail (o login) e senha. A senha inicial
// é PROVISÓRIA (`usuario.senha_provisoria`): no primeiro acesso o app pede uma nova. Não há SSO,
// "esqueci minha senha" nem e-mail com link. Senha vazada é recusada pelo Auth (HIBP).
//
//   criar_usuario  {origem, colaboradorId?, nome?, email?, cpf, cargo?, setor?, senha, grupoId,
//                  empresas?, todasEmpresas? — só com RECORTE_DE_EMPRESAS (_shared/acessos.ts)}
//                  exige acessos.usuarios · criar (RPC `tem_permissao` com o JWT de quem chama)
//                  -> { usuarioId }
//                  400 CPF inválido, senha fora da política ou vazada | 403 | 404
//                  409 {codigo: "EMAIL_DUPLICADO" | "CPF_DUPLICADO" | "COLABORADOR_DUPLICADO"}
//   definir_senha  {usuarioId, senha}  exige acessos.usuarios · editar -> { ok: true }
//                  A senha volta a ser provisória. 400 política/vazada | 409 usuário não está ativo
//                  | 403 a própria senha (use trocar_minha_senha) ou alvo fora do alcance
//   trocar_minha_senha {senhaAtual, senhaNova}  exige sessão de usuário ativo -> { ok: true }
//                  400 senha atual não confere, nova fora da política/vazada/igual à atual
//                  | 429 tentativas demais com a senha atual errada
//
// A senha e o CPF nunca vão para log nem para resposta. Membro do grupo
// Administrador só é tocado por quem também é do Administrador: trocar a senha de uma conta é
// assumir a conta.
//
// Segredos: só os que o projeto já tem — SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// SUPABASE_ANON_KEY. Opcional: ACESSOS_ALLOWED_ORIGINS.
//
// Pólobh (26/11/2026): a tabela de usuários é `perfis`; não há lista de colaboradores (todo cadastro
// é avulso, pelo "+") nem recorte de empresas (`RECORTE_DE_EMPRESAS = false`).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.112.3";
import { clienteDeLogDoAmbiente, registrarErroDaEdge, registrarLog } from "../_shared/log.ts";
import {
  criarFreioDeTentativas, decidirReaproveitamento, duplicidadeDoErro, emailConfere, emailDoColaborador,
  MENSAGEM_DE_DUPLICIDADE, RECORTE_DE_EMPRESAS, traduzirErroDeSenha, validarCriarUsuario, validarDefinirSenha,
  validarTrocarMinhaSenha,
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
const STATUS_DE_COLABORADOR_COM_ACESSO = ["pre_admissao", "ativo", "em_desligamento"];
const CODIGO_DE_DUPLICIDADE = { email: "EMAIL_DUPLICADO", cpf: "CPF_DUPLICADO", colaborador: "COLABORADOR_DUPLICADO" } as const;
const freio = criarFreioDeTentativas();

function servico(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !chave) throw new Error("INTEGRACAO_NAO_CONFIGURADA");
  return createClient(url, chave, OPCOES_CLIENTE);
}

const jwtDe = (req: Request) => (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1] ?? "";

type Chamador = { id: string; cliente: SupabaseClient; ehAdministrador: boolean };

/** Sessão válida; `cliente` leva o JWT dele, para a RPC de permissão enxergar quem chama. */
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

async function temPermissao(chamador: Chamador, tela: string, acao: string): Promise<boolean> {
  const { data, error } = await chamador.cliente.rpc("tem_permissao", { p_tela: tela, p_acao: acao });
  return !error && data === true;
}

type LinhaUsuario = {
  id: string; nome: string; email: string; status: string; grupo_id: string | null; origem: string;
  colaborador_id: string | null; cargo: string | null; setor: string | null; cpf: string | null;
  senha_provisoria: boolean;
  /** Só com RECORTE_DE_EMPRESAS. */
  acesso_todas_empresas?: boolean;
};
const COLUNAS_USUARIO = "id, nome, email, status, grupo_id, origem, colaborador_id, cargo, setor, cpf, senha_provisoria"
  + (RECORTE_DE_EMPRESAS ? ", acesso_todas_empresas" : "");

/** Os campos de recorte só existem no banco de quem tem recorte: sem ele, nem aparecem no upsert. */
const recorteDaLinha = (todas: boolean | undefined) => (RECORTE_DE_EMPRESAS ? { acesso_todas_empresas: todas === true } : {});

type Colaborador = { nome: string; cargo: string; setor: string; emailCorporativo: string; status: string };

/**
 * Pólobh: não há lista de colaboradores (decisão de 26/11/2026) — todo cadastro é avulso. Pedido
 * com `origem: "colaborador"` não acha ninguém e recebe 404.
 */
async function buscarColaborador(_admin: SupabaseClient, _id: string): Promise<Colaborador | null> {
  return null;
}

/** Conta do Auth pelo e-mail (RPC só da service role): o Auth é quem diz de quem é o e-mail. */
async function contaDoAuthPorEmail(admin: SupabaseClient, email: string): Promise<{ id: string; email: string } | null> {
  const { data, error } = await admin.rpc("usuario_auth_por_email", { p_email: email });
  if (error) throw new Error(`usuario_auth_por_email: ${error.message}`);
  const linha = (Array.isArray(data) ? data[0] : data) as { id?: string; email?: string } | undefined;
  return linha?.id ? { id: String(linha.id), email: String(linha.email ?? "") } : null;
}

async function usuarioPorId(admin: SupabaseClient, id: string): Promise<LinhaUsuario | null> {
  const { data } = await admin.from("perfis").select(COLUNAS_USUARIO).eq("id", id).maybeSingle();
  return (data as LinhaUsuario | null) ?? null;
}

/** Outro usuário (que não `ignorar`) já tem este CPF? */
async function cpfEmUso(admin: SupabaseClient, cpf: string, ignorar: string | null): Promise<boolean> {
  let consulta = admin.from("perfis").select("id").eq("cpf", cpf).limit(1);
  if (ignorar) consulta = consulta.neq("id", ignorar);
  const { data } = await consulta;
  return !!data?.length;
}

/** Outra linha de `usuario` (que não `ignorar`) já tem este e-mail, sem diferenciar caixa? */
async function emailEmUsoNoApp(admin: SupabaseClient, email: string, ignorar: string | null): Promise<boolean> {
  // `ilike` sem curinga: escapa % e _ para casar o e-mail exato (só a caixa é ignorada).
  const exato = email.replace(/[\\%_]/g, (c) => "\\" + c);
  let consulta = admin.from("perfis").select("id").ilike("email", exato).limit(1);
  if (ignorar) consulta = consulta.neq("id", ignorar);
  const { data } = await consulta;
  return !!data?.length;
}

/** Nome de quem fez o ato, para o log (o log guarda o nome copiado). Falha aqui nunca derruba o ato. */
async function nomeDoChamador(admin: SupabaseClient, idDoChamador: string): Promise<string> {
  try {
    const { data } = await admin.from("perfis").select("nome, email").eq("id", idDoChamador).maybeSingle();
    return String(data?.nome || data?.email || "");
  } catch {
    return "";
  }
}

async function grupoDeSistema(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin.from("acesso_grupo").select("id").eq("sistema", true).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

const duplicado = (req: Request, tipo: "email" | "cpf" | "colaborador") =>
  json(req, { codigo: CODIGO_DE_DUPLICIDADE[tipo], error: MENSAGEM_DE_DUPLICIDADE[tipo] }, 409);

// --- criar_usuario -----------------------------------------------------------------------------

async function desfazerCriacao(admin: SupabaseClient, id: string) {
  // A linha do app primeiro: sem ela a conta do Auth apagada deixaria o cadastro órfão.
  const apagado = await admin.from("perfis").delete().eq("id", id);
  if (apagado.error) console.error("[acessos] rollback usuario", apagado.error.message);
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) console.error("[acessos] rollback auth", error.message);
}

/**
 * A conta do Auth já existia sem linha em `usuario` (gatilho ausente ou linha apagada): a falha
 * devolve a conta ao estado pendente — sem grupo e sem empresas —, em vez de apagar a linha e
 * deixar a conta do Auth órfã.
 */
async function restaurarComoPendente(admin: SupabaseClient, id: string, email: string, nome: string) {
  const { error } = await admin.from("perfis").upsert({
    id, nome, email, status: "pendente", grupo_id: null, origem: "avulso", colaborador_id: null,
    cargo: null, setor: null, cpf: null, ...recorteDaLinha(false),
  });
  if (error) console.error("[acessos] restaurar pendente", error.message);
  if (RECORTE_DE_EMPRESAS) await admin.from("usuario_empresa").delete().eq("usuario_id", id);
}

async function restaurarUsuario(admin: SupabaseClient, anterior: LinhaUsuario, empresas: string[]) {
  const { error } = await admin.from("perfis").update({
    nome: anterior.nome, status: anterior.status, grupo_id: anterior.grupo_id, origem: anterior.origem,
    colaborador_id: anterior.colaborador_id, cargo: anterior.cargo, setor: anterior.setor, cpf: anterior.cpf,
    senha_provisoria: anterior.senha_provisoria, ...recorteDaLinha(anterior.acesso_todas_empresas),
  }).eq("id", anterior.id);
  if (error) console.error("[acessos] restaurar usuario", error.message);
  if (!RECORTE_DE_EMPRESAS) return;
  await admin.from("usuario_empresa").delete().eq("usuario_id", anterior.id);
  if (empresas.length) {
    await admin.from("usuario_empresa").insert(empresas.map((empresa_id) => ({ usuario_id: anterior.id, empresa_id })));
  }
}

async function criarUsuario(req: Request, chamador: Chamador, corpo: Record<string, unknown>): Promise<Response> {
  const validado = validarCriarUsuario(corpo);
  if (!validado.ok) return json(req, { error: validado.erro }, 400);
  const d = validado.dados;
  if (!(await temPermissao(chamador, "acessos.usuarios", "criar"))) {
    return json(req, { error: "Você não tem permissão para cadastrar usuários." }, 403);
  }
  // Quem não é do Administrador só concede o escopo de empresas que ele mesmo tem (uma regra só, no banco).
  if (RECORTE_DE_EMPRESAS) {
    const { data: podeConceder, error: erroEscopo } = await chamador.cliente.rpc("posso_conceder_empresas", {
      p_todas: d.todasEmpresas, p_empresas: d.empresas,
    });
    if (erroEscopo || podeConceder !== true) {
      return json(req, { error: "Você só pode conceder acesso às empresas que você mesmo acessa." }, 403);
    }
  }
  const admin = servico();

  const { data: grupo } = await admin.from("acesso_grupo").select("id, sistema, ativo").eq("id", d.grupoId).maybeSingle();
  if (!grupo || !grupo.ativo) return json(req, { error: "O grupo escolhido não existe ou está inativo." }, 400);
  if (grupo.sistema && !chamador.ehAdministrador) {
    return json(req, { error: "Somente um usuário do grupo Administrador pode cadastrar alguém nesse grupo." }, 403);
  }
  // Quem não é Administrador só atribui grupo cujas permissões ele mesmo tem (uma regra só, no banco).
  const { data: podeGrupo } = await chamador.cliente.rpc("posso_conceder_grupo", { p_grupo: d.grupoId });
  if (podeGrupo !== true) {
    return json(req, { error: "Você só pode atribuir grupos cujas permissões você mesmo tem." }, 403);
  }

  let nome = d.nome;
  let cargo = d.cargo;
  let setor = d.setor;
  let email = d.email;
  if (d.origem === "colaborador") {
    const colaborador = await buscarColaborador(admin, d.colaboradorId!);
    if (!colaborador) return json(req, { error: "Colaborador não encontrado." }, 404);
    if (!STATUS_DE_COLABORADOR_COM_ACESSO.includes(colaborador.status)) {
      return json(req, { error: "Este colaborador não pode receber acesso (status do cadastro)." }, 400);
    }
    nome = colaborador.nome;
    cargo = colaborador.cargo;
    setor = colaborador.setor;
    email = emailDoColaborador(colaborador.emailCorporativo, d.email);
    if (!email) return json(req, { error: "Sem e-mail corporativo: informe o e-mail do usuário." }, 400);
    const { data: jaTem } = await admin.from("perfis").select("id").eq("colaborador_id", d.colaboradorId).limit(1);
    if (jaTem?.length) return duplicado(req, "colaborador");
  }

  // Conta que já existe com o e-mail. Procurada NO AUTH, nunca por `usuario.email`: uma linha de
  // `usuario` com e-mail trocado não pode levar o grupo e o status de outra pessoa. O e-mail do
  // Auth do id achado tem de ser o pedido.
  const contaAuth = await contaDoAuthPorEmail(admin, email);
  if (contaAuth && !emailConfere(email, contaAuth.email)) {
    return json(req, { error: "Não foi possível confirmar a conta deste e-mail." }, 409);
  }
  const existente = contaAuth ? await usuarioPorId(admin, contaAuth.id) : null;
  let nomeDoAuth = "";
  if (contaAuth) {
    const { data: doAuth } = await admin.auth.admin.getUserById(contaAuth.id);
    if (!emailConfere(email, doAuth?.user?.email)) {
      return json(req, { error: "Não foi possível confirmar a conta deste e-mail." }, 409);
    }
    const metadados = doAuth?.user?.user_metadata as { full_name?: unknown; name?: unknown } | undefined;
    nomeDoAuth = String(metadados?.full_name ?? metadados?.name ?? "").trim();
    // Conta do Auth sem linha de `usuario` (o gatilho a cria como pendente) conta como pendente.
    const decisao = decidirReaproveitamento(existente?.status ?? "pendente");
    if (!decisao.ok) return duplicado(req, "email");
    // Liberar uma conta pendente que já existe é editar o usuário, não só cadastrar.
    if (!(await temPermissao(chamador, "acessos.usuarios", "editar"))) {
      return json(req, { error: "Esta conta já existe. Para liberá-la você precisa de permissão para editar usuários." }, 403);
    }
    if (existente?.grupo_id && !chamador.ehAdministrador && existente.grupo_id === await grupoDeSistema(admin)) {
      return json(req, { error: "Esta conta pertence ao grupo Administrador e só um Administrador pode liberá-la." }, 403);
    }
  }

  // E-mail ou CPF de outra linha de `usuario`: recusa ANTES de criar qualquer coisa. Sem a
  // conferência do e-mail, uma linha antiga com o mesmo e-mail (e outra conta) faria o gatilho do
  // Auth falhar com erro genérico. Os índices únicos são a última barreira.
  if (await emailEmUsoNoApp(admin, email, contaAuth?.id ?? null)) return duplicado(req, "email");
  if (await cpfEmUso(admin, d.cpf, contaAuth?.id ?? null)) return duplicado(req, "cpf");

  let id = contaAuth?.id ?? "";
  let empresasAnteriores: string[] = [];
  if (contaAuth) {
    if (RECORTE_DE_EMPRESAS) {
      const { data: vinculos } = await admin.from("usuario_empresa").select("empresa_id").eq("usuario_id", contaAuth.id);
      empresasAnteriores = (vinculos ?? []).map((v) => String(v.empresa_id));
    }
  } else {
    const criado = await admin.auth.admin.createUser({
      email, password: d.senha, email_confirm: true, user_metadata: { full_name: nome },
    });
    if (criado.error || !criado.data.user) {
      console.error("[acessos] createUser", criado.error?.message ?? "sem usuário");
      const senhaRecusada = traduzirErroDeSenha(criado.error);
      if (senhaRecusada) return json(req, { error: senhaRecusada.erro }, senhaRecusada.status);
      if (/already|registered|exists/i.test(criado.error?.message ?? "")) return duplicado(req, "email");
      return json(req, { error: "Não foi possível criar a conta de acesso." }, 500);
    }
    id = criado.data.user.id;
  }

  const desfazer = async () => {
    if (existente) await restaurarUsuario(admin, existente, empresasAnteriores);
    else if (contaAuth) await restaurarComoPendente(admin, id, email, nomeDoAuth); // a conta do Auth já existia: não se apaga
    else await desfazerCriacao(admin, id);
  };

  // O gatilho de Auth já criou a linha pendente; o upsert a completa (e cobre gatilho ausente) e
  // grava o e-mail do Auth, corrigindo uma linha cujo e-mail tenha divergido.
  const gravado = await admin.from("perfis").upsert({
    id, nome: nome || email, email, cpf: d.cpf, status: "ativo", grupo_id: d.grupoId, origem: d.origem,
    colaborador_id: d.origem === "colaborador" ? d.colaboradorId : null,
    cargo: cargo || null, setor: setor || null, senha_provisoria: true, ...recorteDaLinha(d.todasEmpresas),
  }).select("id").maybeSingle();
  if (gravado.error) {
    console.error("[acessos] gravar usuario", gravado.error.code ?? "", "(mensagem omitida: pode conter dado)");
    await desfazer();
    const tipo = duplicidadeDoErro(gravado.error);
    if (tipo) return duplicado(req, tipo);
    return json(req, { error: "O usuário não pôde ser registrado. Nada foi criado." }, 500);
  }

  if (RECORTE_DE_EMPRESAS) await admin.from("usuario_empresa").delete().eq("usuario_id", id);
  if (RECORTE_DE_EMPRESAS && d.empresas.length) {
    const vinculos = await admin.from("usuario_empresa").insert(d.empresas.map((empresa_id) => ({ usuario_id: id, empresa_id })));
    if (vinculos.error) {
      console.error("[acessos] vincular empresas", vinculos.error.message);
      await desfazer();
      return json(req, { error: "As empresas escolhidas não puderam ser vinculadas. Nada foi criado." }, 500);
    }
  }

  // Conta que já existia (pendente): a senha só é trocada depois de o resto gravar, para a falha
  // não deixar a senha trocada.
  if (contaAuth) {
    const { error: erroSenha } = await admin.auth.admin.updateUserById(id, { password: d.senha });
    if (erroSenha) {
      console.error("[acessos] updateUserById", erroSenha.message);
      await desfazer();
      const senhaRecusada = traduzirErroDeSenha(erroSenha);
      return json(req, { error: senhaRecusada?.erro ?? "Não foi possível definir a senha. Tente outra." }, 400);
    }
  }

  // Sem senha e sem CPF no log (nem mascarado): só o que explica o ato.
  await registrarLog(admin, req, {
    categoria: "acesso", acao: contaAuth ? "usuario_liberado" : "usuario_criado", atorId: chamador.id,
    atorNome: await nomeDoChamador(admin, chamador.id), tela: "acessos.usuarios", alvoTipo: "usuario",
    alvoId: id, alvoRotulo: nome || email, detalhe: { origem: d.origem, grupo: d.grupoId },
  });
  return json(req, { usuarioId: id });
}

// --- definir_senha (administrador) -------------------------------------------------------------

async function definirSenha(req: Request, chamador: Chamador, corpo: Record<string, unknown>): Promise<Response> {
  const validado = validarDefinirSenha(corpo);
  if (!validado.ok) return json(req, { error: validado.erro }, 400);
  if (!(await temPermissao(chamador, "acessos.usuarios", "editar"))) {
    return json(req, { error: "Você não tem permissão para definir a senha de usuários." }, 403);
  }
  const admin = servico();
  const { data: alvo } = await admin.from("perfis")
    .select("id, status, grupo_id" + (RECORTE_DE_EMPRESAS ? ", acesso_todas_empresas" : ""))
    .eq("id", validado.dados.usuarioId).maybeSingle<{ id: string; status: string; grupo_id: string | null; acesso_todas_empresas?: boolean }>();
  if (!alvo) return json(req, { error: "Usuário não encontrado." }, 404);
  // A própria senha se troca em "Alterar minha senha", com a senha atual — não por aqui.
  if (alvo.id === chamador.id) return json(req, { error: "Para trocar a sua própria senha, use \"Alterar minha senha\"." }, 403);
  // Inativo não se edita (nem a senha): primeiro ativa. Pendente ainda não tem acesso para trocar.
  if (alvo.status !== "ativo") return json(req, { error: "A senha só se define para usuário ativo. Ative o usuário primeiro." }, 409);
  if (!chamador.ehAdministrador && alvo.grupo_id && alvo.grupo_id === await grupoDeSistema(admin)) {
    return json(req, { error: "Somente um Administrador pode trocar a senha de membro do grupo Administrador." }, 403);
  }
  // Quem não é Administrador nunca troca a senha (a chave da conta) de quem tem mais do que ele: o
  // grupo do alvo tem de ser um que ele poderia conceder e as empresas do alvo, as dele.
  if (!chamador.ehAdministrador) {
    const { data: grupoOk } = await chamador.cliente.rpc("posso_conceder_grupo", { p_grupo: alvo.grupo_id });
    let empresasOk = true;
    if (RECORTE_DE_EMPRESAS) {
      const { data: vinculos } = await admin.from("usuario_empresa").select("empresa_id").eq("usuario_id", alvo.id);
      const empresasDoAlvo = (vinculos ?? []).map((v) => String(v.empresa_id));
      const { data } = await chamador.cliente.rpc("posso_conceder_empresas", {
        p_todas: alvo.acesso_todas_empresas === true, p_empresas: empresasDoAlvo,
      });
      empresasOk = data === true;
    }
    if (grupoOk !== true || !empresasOk) {
      return json(req, { error: "Você só pode trocar a senha de usuários cujo grupo e empresas estão dentro do seu próprio acesso." }, 403);
    }
  }
  const { error } = await admin.auth.admin.updateUserById(alvo.id, { password: validado.dados.senha });
  if (error) {
    // Só a mensagem do Auth (ex.: senha fraca demais para a política do projeto); nunca a senha.
    console.error("[acessos] updateUserById", error.message);
    return json(req, { error: traduzirErroDeSenha(error)?.erro ?? "Não foi possível definir a senha. Tente outra." }, 400);
  }
  // Senha que outra pessoa conhece é provisória: o usuário troca no próximo acesso.
  const marcada = await admin.from("perfis").update({ senha_provisoria: true }).eq("id", alvo.id);
  if (marcada.error) console.error("[acessos] marcar senha provisória", marcada.error.message);
  await registrarLog(admin, req, {
    categoria: "acesso", acao: "senha_definida", atorId: chamador.id, atorNome: await nomeDoChamador(admin, chamador.id),
    tela: "acessos.usuarios", alvoTipo: "usuario", alvoId: alvo.id,
  });
  return json(req, { ok: true });
}

// --- trocar_minha_senha (a própria pessoa) -----------------------------------------------------

async function trocarMinhaSenha(req: Request, chamador: Chamador, corpo: Record<string, unknown>): Promise<Response> {
  const validado = validarTrocarMinhaSenha(corpo);
  if (!validado.ok) return json(req, { error: validado.erro }, 400);
  if (freio.bloqueado(chamador.id)) {
    return json(req, { error: "Muitas tentativas com a senha atual errada. Espere 15 minutos e tente de novo." }, 429);
  }
  const admin = servico();
  const eu = await usuarioPorId(admin, chamador.id);
  if (!eu || eu.status !== "ativo") return json(req, { error: "Sua conta não está ativa." }, 403);
  const { data: doAuth } = await admin.auth.admin.getUserById(chamador.id);
  const email = doAuth?.user?.email ?? "";
  if (!email) return json(req, { error: "Não foi possível confirmar a sua conta." }, 409);

  // Confere a senha atual num cliente descartável (não guarda sessão) e encerra só a sessão aberta
  // aqui — `scope: "local"` não derruba a sessão em que a pessoa está.
  const conferencia = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", OPCOES_CLIENTE);
  const { data: entrou, error: erroAtual } = await conferencia.auth.signInWithPassword({ email, password: validado.dados.senhaAtual });
  if (erroAtual || entrou.user?.id !== chamador.id) {
    freio.registrarErro(chamador.id);
    await registrarLog(admin, req, {
      categoria: "acesso", acao: "senha_troca_recusada", nivel: "aviso", resultado: "falha", atorId: chamador.id,
      atorNome: eu.nome || email, mensagem: "Senha atual não confere",
    });
    return json(req, { error: "A senha atual não confere." }, 400);
  }
  await conferencia.auth.signOut({ scope: "local" }).catch(() => undefined);
  freio.limpar(chamador.id);

  const { error } = await admin.auth.admin.updateUserById(chamador.id, { password: validado.dados.senhaNova });
  if (error) {
    console.error("[acessos] trocar minha senha", error.message);
    return json(req, { error: traduzirErroDeSenha(error)?.erro ?? "Não foi possível trocar a senha. Tente outra." }, 400);
  }
  const marcada = await admin.from("perfis").update({ senha_provisoria: false }).eq("id", chamador.id);
  if (marcada.error) console.error("[acessos] desmarcar senha provisória", marcada.error.message);
  await registrarLog(admin, req, {
    categoria: "acesso", acao: "senha_alterada", atorId: chamador.id, atorNome: eu.nome || email,
    alvoTipo: "usuario", alvoId: chamador.id, detalhe: { eraProvisoria: eu.senha_provisoria === true },
  });
  return json(req, { ok: true });
}

// --- entrada -----------------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Use POST." }, 405);

  const corpo = await req.json().catch(() => ({})) as Record<string, unknown>;
  const acao = String(corpo.acao ?? "");

  try {
    if (acao === "criar_usuario" || acao === "definir_senha" || acao === "trocar_minha_senha") {
      const chamador = await chamadorDe(req);
      if (!chamador) return json(req, { error: "Sessão inválida." }, 401);
      if (acao === "criar_usuario") return await criarUsuario(req, chamador, corpo);
      if (acao === "definir_senha") return await definirSenha(req, chamador, corpo);
      return await trocarMinhaSenha(req, chamador, corpo);
    }
    return json(req, { error: "Ação desconhecida." }, 400);
  } catch (erro) {
    await registrarErroDaEdge(clienteDeLogDoAmbiente(), req, "acessos", erro);
    console.error("[acessos]", erro instanceof Error ? erro.message : "falha");
    return json(req, { error: "Não foi possível concluir a operação." }, 500);
  }
});
