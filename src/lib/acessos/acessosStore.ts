/**
 * Leitura e escrita da tela de Acessos (padrão de Acessos LSPRO). Toda ESCRITA passa por RPC ou
 * pela Edge `acessos`: a sessão não escreve nas tabelas (migration 20261124150000). Sem React
 * aqui: a tela chama estas funções e recarrega depois de gravar.
 *
 * A tabela de usuários do app é `perfis` (id = auth.users.id). O e-mail e o último acesso não
 * moram nela: vêm do Auth pela RPC `contas_dos_usuarios()`, que só responde a quem vê usuários.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { todasAsPermissoes, type Permissao } from "./permissoes";

// As tabelas e funções novas ainda não estão nos tipos do cliente: cada leitura valida o formato.
const bd = supabase as unknown as SupabaseClient;

const TABELA_USUARIO = "perfis";

export type StatusUsuarioAcesso = "ativo" | "pendente" | "inativo";

export type GrupoAcesso = {
  id: string;
  nome: string;
  descricao: string;
  sistema: boolean;
  ativo: boolean;
  /** Grupo padrão: recebe quem fica ativo sem grupo; não se inativa. */
  padrao: boolean;
  /** Nível no banco (adaptação Pólobh): o papel que as policies antigas leem. `null` no de sistema. */
  nivel: string | null;
  /**
   * Usuários ativos no grupo — é o que impede inativá-lo. `null` = não dá para contar: sem
   * `acessos.usuarios` · ver a leitura não traz os outros, e um número daquele seria falso.
   */
  usuariosAtivos: number | null;
  usuarios: number | null;
  permissoes: Permissao[];
};

export type UsuarioDoAcesso = {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  setor: string;
  telefone: string;
  grupoId: string | null;
  status: StatusUsuarioAcesso;
  ultimoAcesso: string;
  /** Chaves de `PERMISSOES_ESPECIAIS` ligadas para este usuário (a Pólobh não tem nenhuma). */
  especiais: string[];
};

export type PermissoesDoUsuario = {
  grupo: { id: string; nome: string; sistema: boolean };
  permissoes: Permissao[];
  especiais: string[];
};

type ErroDoBanco = { message?: string; code?: string; status?: number };

/**
 * As RPCs de acesso explicam a recusa em português (42501: sem permissão, grupo de sistema,
 * próprio grupo; 22023: dado inválido, nome repetido, grupo com usuário ativo; 23514: último
 * administrador, grupo padrão). Para esses códigos vale a mensagem do banco.
 */
function mensagemDoBanco(erro: ErroDoBanco): string {
  if ((erro.code === "42501" || erro.code === "22023" || erro.code === "23514") && erro.message) return erro.message;
  return "Não foi possível concluir a operação. Tente de novo.";
}

function falhar(contexto: string, erro: ErroDoBanco | null) {
  if (erro) throw new Error(`${contexto}: ${mensagemDoBanco(erro)}`);
}

/** O PostgREST devolve no máximo 1000 linhas por consulta: lê em páginas até acabar. */
async function lerTudo<T>(pagina: (de: number, ate: number) => PromiseLike<{ data: unknown; error: ErroDoBanco | null }>, contexto: string): Promise<T[]> {
  const TAMANHO = 1000;
  const tudo: T[] = [];
  for (let de = 0; ; de += TAMANHO) {
    const { data, error } = await pagina(de, de + TAMANHO - 1);
    falhar(contexto, error);
    const linhas = (data ?? []) as T[];
    tudo.push(...linhas);
    if (linhas.length < TAMANHO) return tudo;
  }
}

/** A função ainda não existe no banco (migration não aplicada): PostgREST 404 / PGRST202. */
export function funcaoAusente(erro: ErroDoBanco | null | undefined): boolean {
  if (!erro) return false;
  return erro.code === "PGRST202" || erro.status === 404 || /could not find the function|schema cache/i.test(erro.message ?? "");
}

/** Lançada enquanto a migration dos grupos não subiu: o app cai no modo de compatibilidade. */
export class MigracaoAusente extends Error {
  constructor() { super("As permissões por grupo ainda não estão no banco."); }
}

/** `null` = sem grupo ativo (usuário pendente, inativo ou de grupo inativo). */
export async function carregarMinhasPermissoes(): Promise<PermissoesDoUsuario | null> {
  const { data, error } = await bd.rpc("minhas_permissoes");
  if (error) {
    if (funcaoAusente(error as ErroDoBanco)) throw new MigracaoAusente();
    throw new Error(mensagemDoBanco(error));
  }
  if (!data) return null;
  const bruto = data as { grupo?: { id: string; nome: string; sistema: boolean }; permissoes?: Permissao[]; especiais?: unknown };
  if (!bruto.grupo) return null;
  const especiais = Array.isArray(bruto.especiais) ? bruto.especiais.filter((e): e is string => typeof e === "string") : [];
  // O grupo de sistema libera tudo sem linhas de permissão: não dependo delas.
  if (bruto.grupo.sistema) return { grupo: bruto.grupo, permissoes: todasAsPermissoes(), especiais };
  return { grupo: bruto.grupo, permissoes: Array.isArray(bruto.permissoes) ? bruto.permissoes : [], especiais };
}

type LinhaGrupo = {
  id: string; nome: string; descricao: string | null; sistema: boolean; ativo: boolean; padrao?: boolean | null;
  papel_legado?: string | null;
};
type LinhaPermissao = { grupo_id: string; tela: string; acao: string };

/** `contarUsuarios` = quem abre tem `acessos.usuarios` · ver (senão a contagem seria falsa). */
export async function carregarGrupos(contarUsuarios: boolean): Promise<GrupoAcesso[]> {
  const [grupos, permissoes, usuarios] = await Promise.all([
    lerTudo<LinhaGrupo>((de, ate) => bd.from("acesso_grupo").select("*").order("nome").range(de, ate), "Grupos"),
    lerTudo<LinhaPermissao>((de, ate) => bd.from("acesso_grupo_permissao").select("grupo_id,tela,acao").order("grupo_id").order("tela").order("acao").range(de, ate), "Permissões dos grupos"),
    contarUsuarios
      ? lerTudo<{ grupo_id: string | null; status: string }>((de, ate) => bd.from(TABELA_USUARIO).select("id,grupo_id,status").order("id").range(de, ate), "Usuários")
      : Promise.resolve([]),
  ]);
  const porGrupo = new Map<string, Permissao[]>();
  for (const linha of permissoes) {
    const lista = porGrupo.get(linha.grupo_id) ?? [];
    lista.push({ tela: linha.tela, acao: linha.acao });
    porGrupo.set(linha.grupo_id, lista);
  }
  return grupos.map((g) => ({
    id: g.id,
    nome: g.nome,
    descricao: g.descricao ?? "",
    sistema: g.sistema,
    ativo: g.ativo,
    padrao: g.padrao === true,
    nivel: g.papel_legado ?? null,
    usuarios: contarUsuarios ? usuarios.filter((u) => u.grupo_id === g.id).length : null,
    usuariosAtivos: contarUsuarios ? usuarios.filter((u) => u.grupo_id === g.id && u.status === "ativo").length : null,
    // O grupo de sistema não tem linhas: o banco o trata como "tudo". A tela o mostra marcado.
    permissoes: g.sistema ? todasAsPermissoes() : (porGrupo.get(g.id) ?? []),
  }));
}

type LinhaUsuario = {
  id: string; nome: string | null; cargo: string | null; setor: string | null; telefone: string | null;
  grupo_id: string | null; status: string | null;
};

const statusDaLinha = (status: string | null): StatusUsuarioAcesso =>
  status === "ativo" ? "ativo" : status === "pendente" ? "pendente" : "inativo";

export async function carregarUsuarios(): Promise<UsuarioDoAcesso[]> {
  const [linhas, especiais, contas] = await Promise.all([
    lerTudo<LinhaUsuario>(
      (de, ate) => bd.from(TABELA_USUARIO).select("id,nome,cargo,setor,telefone,grupo_id,status").order("id").range(de, ate),
      "Usuários",
    ),
    lerTudo<{ usuario_id: string; chave: string }>(
      (de, ate) => bd.from("acesso_usuario_especial").select("usuario_id,chave").order("usuario_id").order("chave").range(de, ate),
      "Permissões específicas",
    ),
    // E-mail (login) e último acesso, do Auth. Também em páginas: a RPC obedece ao teto de 1000.
    lerTudo<{ id: string; email: string | null; ultimo_acesso: string | null }>(
      (de, ate) => bd.rpc("contas_dos_usuarios").order("id").range(de, ate),
      "Contas",
    ),
  ]);
  const contaDe = new Map(contas.map((c) => [c.id, c]));
  const porUsuario = new Map<string, string[]>();
  for (const e of especiais) porUsuario.set(e.usuario_id, [...(porUsuario.get(e.usuario_id) ?? []), e.chave]);
  return linhas.map((u) => ({
    id: u.id,
    nome: u.nome ?? "",
    email: contaDe.get(u.id)?.email ?? "",
    cargo: u.cargo ?? "",
    setor: u.setor ?? "",
    telefone: u.telefone ?? "",
    grupoId: u.grupo_id,
    status: statusDaLinha(u.status),
    ultimoAcesso: contaDe.get(u.id)?.ultimo_acesso ?? "",
    especiais: porUsuario.get(u.id) ?? [],
  }));
}

// --- Escrita: RPCs ---------------------------------------------------------------------------------

export type EntradaDoGrupo = {
  id?: string;
  nome: string;
  descricao?: string;
  ativo?: boolean;
  /** Nível no banco: obrigatório no grupo novo. */
  papel?: string;
  /** Passe por `permissoesValidas()` antes: o banco não conhece o catálogo. */
  permissoes: Permissao[];
};

export async function salvarGrupo(entrada: EntradaDoGrupo): Promise<string> {
  const { data, error } = await bd.rpc("salvar_grupo_acesso", { p: entrada });
  if (error) throw new Error(mensagemDoBanco(error));
  return data as string;
}

/** `null`/ausente = não muda (é o contrato da RPC). Mande só o que mudou. */
export type EntradaDoAcesso = {
  usuarioId: string;
  grupoId: string | null;
  status?: "ativo" | "inativo";
  nome?: string | null;
  cargo?: string | null;
  /** "" = apagar. */
  setor?: string | null;
  telefone?: string | null;
};

export async function definirAcessoDoUsuario(e: EntradaDoAcesso): Promise<void> {
  const { error } = await bd.rpc("definir_acesso_do_usuario", {
    p_usuario: e.usuarioId,
    p_grupo: e.grupoId,
    p_status: e.status ?? null,
    p_nome: e.nome ?? null,
    p_cargo: e.cargo ?? null,
    p_setor: e.setor ?? null,
    p_telefone: e.telefone ?? null,
  });
  if (error) throw new Error(mensagemDoBanco(error));
}

/** Grava o conjunto INTEIRO das permissões específicas do usuário (como deve ficar). */
export async function definirPermissoesEspeciais(usuarioId: string, chaves: readonly string[]): Promise<void> {
  const { error } = await bd.rpc("definir_permissoes_especiais", { p_usuario: usuarioId, p_chaves: [...chaves] });
  if (error) throw new Error(mensagemDoBanco(error));
}

// --- Escrita: Edge `acessos` ------------------------------------------------------------------------

/** Erro da Edge `acessos`, com o status HTTP (a mensagem já vem em português). */
export class ErroDaEdge extends Error {
  constructor(mensagem: string, readonly status?: number) {
    super(mensagem);
  }
}

async function chamarEdge<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("acessos", { body });
  if (error) {
    // A função responde `{ error: "mensagem em português" }` com status 4xx/5xx.
    let mensagem = error.message || "Não foi possível falar com o serviço de acessos.";
    let status: number | undefined;
    const contexto = "context" in error ? (error as { context?: unknown }).context : null;
    if (contexto instanceof Response) {
      status = contexto.status;
      const corpo = await contexto.clone().json().catch(() => null) as { error?: string } | null;
      if (corpo?.error) mensagem = corpo.error;
    }
    throw new ErroDaEdge(mensagem, status);
  }
  return data as T;
}

export type EntradaDoNovoUsuario = {
  nome: string;
  email: string;
  setor?: string;
  cargo?: string;
  telefone?: string;
  /** A senha vai no corpo da chamada e em lugar nenhum mais. */
  senha: string;
  /** Obrigatório: grupo de permissão. */
  grupoId: string;
};

export function criarUsuario(e: EntradaDoNovoUsuario): Promise<{ usuarioId: string }> {
  return chamarEdge<{ usuarioId: string }>({ acao: "criar_usuario", ...e });
}

/** Troca a senha de outro usuário ativo. A própria se troca no "Alterar senha" da conta. */
export async function definirSenha(usuarioId: string, senha: string): Promise<void> {
  await chamarEdge<{ ok: true }>({ acao: "definir_senha", usuarioId, senha });
}
