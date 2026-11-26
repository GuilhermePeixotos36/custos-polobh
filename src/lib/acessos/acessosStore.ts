// Leitura e escrita da tela de Acessos. Toda ESCRITA passa por RPC ou pela Edge `acessos`: a
// sessão não escreve nas tabelas (banco.sql). Sem React aqui: a tela chama estas funções com o
// estado local da própria tela.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { todasAsPermissoes, type Permissao } from "./permissoes";

// As tabelas e funções novas podem ainda não estar nos tipos gerados do banco (o arquivo é
// regenerado depois que a migration sobe). Até lá, o cliente sem tipos; cada leitura valida o
// formato que usa.
const bd = supabase as unknown as SupabaseClient;

// No Pólobh a tabela de usuários é `perfis` (migração 20261126100000).
const TABELA_USUARIO = "perfis";

export type OrigemUsuario = "colaborador" | "avulso";
export type StatusUsuarioAcesso = "ativo" | "pendente" | "inativo";

export type GrupoAcesso = {
  id: string;
  nome: string;
  descricao: string;
  sistema: boolean;
  ativo: boolean;
  /** Grupo padrão: recebe quem fica ativo sem grupo; não se inativa. */
  padrao: boolean;
  /**
   * Usuários ativos no grupo — é o que impede inativá-lo. `null` = não dá para contar: sem
   * `acessos.usuarios` · ver a RLS devolve só a própria linha, e um número daquele seria falso.
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
  /** (v2.1) */
  setor: string;
  grupoId: string | null;
  origem: OrigemUsuario;
  colaboradorId: string | null;
  status: StatusUsuarioAcesso;
  ultimoAcesso: string;
  /** (v2.1) Chaves de `PERMISSOES_ESPECIAIS` ligadas para este usuário. */
  especiais: string[];
  /** "***.456.789-**" (coluna `cpf_mascarado`). O CPF inteiro a sessão não lê. "" = sem CPF (usuário antigo). */
  cpfMascarado: string;
  /** A senha atual foi definida pelo administrador e ainda não foi trocada pela pessoa. */
  senhaProvisoria: boolean;
  // O Pólobh não tem recorte extra por usuário.
};



/** Uma pessoa da lista do DPRH, para o combo "Colaborador". */
export type ColaboradorParaAcesso = {
  id: string;
  nome: string;
  cargo: string;
  setor: string;
  empresa: string;
  statusColaborador: string;
  emailCorporativo: string;
};

export type PermissoesDoUsuario = {
  grupo: { id: string; nome: string; sistema: boolean };
  permissoes: Permissao[];
  /** (v2.1) Permissões específicas do usuário. No grupo de sistema não importa: ele tem todas. */
  especiais: string[];
};

type ErroDoBanco = { message?: string; code?: string; status?: number };

/**
 * As RPCs de acesso explicam a recusa em português (42501: sem permissão, grupo de sistema,
 * próprio grupo; 22023: dado inválido (CPF inválido inclusive), nome repetido, grupo com usuário
 * ativo; 23514: último administrador, grupo padrão; 23505: e-mail ou CPF repetido). Para esses
 * códigos vale a mensagem do banco.
 * Os demais: mensagem genérica.
 */
function mensagemDoBanco(erro: ErroDoBanco): string {
  if ((erro.code === "42501" || erro.code === "22023" || erro.code === "23514") && erro.message) return erro.message;
  // (senha) Repetido: a RPC levanta 23505 com a mensagem pronta ("Já existe um usuário com este
  // CPF."); a violação crua do índice traz o valor da chave — nunca a mostre.
  if (erro.code === "23505") {
    if (/^Já existe um usuário/.test(erro.message ?? "")) return erro.message!;
    return /cpf/i.test(erro.message ?? "") ? "Já existe um usuário com este CPF." : "Já existe um usuário com este e-mail.";
  }
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

/** Lançada enquanto a migration dos grupos não subiu: o provider cai no modo de compatibilidade. */
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
  // Banco ainda na v2.0 não manda `especiais`: lista vazia (ninguém ganha nada por engano).
  const especiais = Array.isArray(bruto.especiais) ? bruto.especiais.filter((e): e is string => typeof e === "string") : [];
  // O grupo de sistema libera tudo sem linhas de permissão: não dependo delas.
  if (bruto.grupo.sistema) return { grupo: bruto.grupo, permissoes: todasAsPermissoes(), especiais };
  return { grupo: bruto.grupo, permissoes: Array.isArray(bruto.permissoes) ? bruto.permissoes : [], especiais };
}

type LinhaGrupo = { id: string; nome: string; descricao: string | null; sistema: boolean; ativo: boolean; padrao?: boolean | null };
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
    usuarios: contarUsuarios ? usuarios.filter((u) => u.grupo_id === g.id).length : null,
    usuariosAtivos: contarUsuarios ? usuarios.filter((u) => u.grupo_id === g.id && u.status === "ativo").length : null,
    // O grupo de sistema não tem linhas: o banco o trata como "tudo". A tela o mostra marcado.
    permissoes: g.sistema ? todasAsPermissoes() : (porGrupo.get(g.id) ?? []),
  }));
}

type LinhaUsuario = {
  id: string; nome: string | null; email: string; cargo: string | null; setor: string | null; grupo_id: string | null;
  origem: string | null; colaborador_id: string | null; status: string; ultimo_acesso: string | null;
  cpf_mascarado: string | null; senha_provisoria: boolean | null;
};

const statusDaLinha = (status: string): StatusUsuarioAcesso =>
  status === "ativo" ? "ativo" : status === "pendente" ? "pendente" : "inativo";

export async function carregarUsuarios(): Promise<UsuarioDoAcesso[]> {
  const [linhas, especiais] = await Promise.all([
    lerTudo<LinhaUsuario>(
      // Colunas listadas: a sessão não tem SELECT em `cpf` (só em `cpf_mascarado`), e `*` falharia.
      (de, ate) => bd.from(TABELA_USUARIO).select("id,nome,email,cargo,setor,grupo_id,origem,colaborador_id,status,ultimo_acesso,cpf_mascarado,senha_provisoria").order("id").range(de, ate),
      "Usuários",
    ),
    // (v2.1) A RLS só entrega tudo a quem tem `acessos.usuarios` · ver — o mesmo que lê esta lista.
    lerTudo<{ usuario_id: string; chave: string }>(
      (de, ate) => bd.from("acesso_usuario_especial").select("usuario_id,chave").order("usuario_id").order("chave").range(de, ate),
      "Permissões específicas",
    ),
  ]);
  const porUsuario = new Map<string, string[]>();
  for (const e of especiais) porUsuario.set(e.usuario_id, [...(porUsuario.get(e.usuario_id) ?? []), e.chave]);
  return linhas.map((u) => ({
    id: u.id,
    nome: u.nome ?? "",
    email: u.email,
    cargo: u.cargo ?? "",
    setor: u.setor ?? "",
    grupoId: u.grupo_id,
    origem: u.origem === "colaborador" ? "colaborador" : "avulso",
    colaboradorId: u.colaborador_id,
    status: statusDaLinha(u.status),
    ultimoAcesso: u.ultimo_acesso ?? "",
    especiais: porUsuario.get(u.id) ?? [],
    cpfMascarado: u.cpf_mascarado ?? "",
    senhaProvisoria: u.senha_provisoria === true,
  }));
}

// --- Lista de colaboradores -----------------------------------------------------------------------
// O Pólobh não tem lista de colaboradores (decisão de 26/11/2026): a caixa combinada do "Novo
// usuário" fica vazia, com "Nenhum colaborador disponível", e todo cadastro é avulso, pelo "+".

export async function carregarColaboradores(): Promise<ColaboradorParaAcesso[]> {
  return [];
}

export type ResultadoDaSincronizacao = { configurado: boolean; pulado?: boolean; atualizados?: number; erro?: string };

export async function sincronizarColaboradores(): Promise<ResultadoDaSincronizacao> {
  return { configurado: false };
}

// --- Escrita: RPCs ---------------------------------------------------------------------------------

export type EntradaDoGrupo = {
  id?: string;
  nome: string;
  descricao?: string;
  ativo?: boolean;
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
  /** (v2.1) Avulso: escolhido entre os setores do DPRH (`opcoesDeSetor`). "" = apagar. */
  setor?: string | null;
  /** CPF novo (com ou sem máscara), só quando a pessoa usou "Alterar CPF". Nunca "" (é obrigatório). */
  cpf?: string | null;
  // O Pólobh não tem recorte extra por usuário.
};

export async function definirAcessoDoUsuario(e: EntradaDoAcesso): Promise<void> {
  const { error } = await bd.rpc("definir_acesso_do_usuario", {
    p_usuario: e.usuarioId,
    p_grupo: e.grupoId,
    p_status: e.status ?? null,
    p_nome: e.nome ?? null,
    p_cargo: e.cargo ?? null,
    p_setor: e.setor ?? null,
    p_cpf: e.cpf ?? null,
  });
  if (error) throw new Error(mensagemDoBanco(error));
}

/**
 * (v2.1) Grava o conjunto INTEIRO das permissões específicas do usuário (como deve ficar). Pede
 * `acessos.usuarios` · editar; para LIGAR uma, quem grava precisa tê-la (o banco confere).
 * Chame só quando o conjunto mudou, e depois de `criarUsuario` / `definirAcessoDoUsuario`.
 */
export async function definirPermissoesEspeciais(usuarioId: string, chaves: readonly string[]): Promise<void> {
  const { error } = await bd.rpc("definir_permissoes_especiais", { p_usuario: usuarioId, p_chaves: [...chaves] });
  if (error) throw new Error(mensagemDoBanco(error));
}

// --- Duplicidade --------------------------------------------------------------------------------------

export type Duplicidade = {
  emailEmUso: boolean; statusDoEmail: StatusUsuarioAcesso | null;
  cpfEmUso: boolean; statusDoCpf: StatusUsuarioAcesso | null;
};

/**
 * Antes de "Continuar" (cadastro) e de "Salvar" com CPF alterado: e-mail ou CPF já são de outro
 * usuário? `ignorar` = o próprio usuário, na edição. Só avisa: quem barra é o banco e a Edge.
 */
export async function conferirDuplicidade(email: string, cpf: string, ignorar?: string): Promise<Duplicidade> {
  const { data, error } = await bd.rpc("conferir_duplicidade_de_usuario", { p_email: email, p_cpf: cpf, p_ignorar: ignorar ?? null });
  if (error) throw new Error(mensagemDoBanco(error));
  return data as Duplicidade;
}

/** A conta de quem está logado: o layout lê `senhaProvisoria` para pedir a troca no primeiro acesso. */
export async function carregarMinhaConta(usuarioId: string): Promise<{ status: StatusUsuarioAcesso; senhaProvisoria: boolean } | null> {
  const { data, error } = await bd.from(TABELA_USUARIO).select("status,senha_provisoria").eq("id", usuarioId).maybeSingle();
  if (error) throw new Error(mensagemDoBanco(error));
  return data ? { status: statusDaLinha(String(data.status)), senhaProvisoria: data.senha_provisoria === true } : null;
}

// --- Escrita: Edge `acessos` ------------------------------------------------------------------------

export type ResultadoDoCadastro = { usuarioId: string };

/**
 * Erro da Edge `acessos` com o `codigo` que ela mandou. A tela decide por ele, nunca pela
 * mensagem: `EMAIL_DUPLICADO` e `COLABORADOR_DUPLICADO` (volta ao "Dados do usuário" com o erro no
 * e-mail), `CPF_DUPLICADO` (erro no campo CPF). Status 429 = tentativas demais na troca de senha.
 */
export class ErroDaEdge extends Error {
  constructor(mensagem: string, readonly codigo?: string, readonly status?: number) {
    super(mensagem);
  }
}

async function chamarEdge<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("acessos", { body });
  if (error) {
    // A função responde `{ error: "mensagem em português", codigo? }` com status 4xx/5xx.
    let mensagem = error.message || "Não foi possível falar com o serviço de acessos.";
    let codigo: string | undefined;
    let status: number | undefined;
    const contexto = "context" in error ? (error as { context?: unknown }).context : null;
    if (contexto instanceof Response) {
      status = contexto.status;
      const corpo = await contexto.clone().json().catch(() => null) as { error?: string; codigo?: string } | null;
      if (corpo?.error) mensagem = corpo.error;
      if (corpo?.codigo) codigo = corpo.codigo;
    }
    throw new ErroDaEdge(mensagem, codigo, status);
  }
  return data as T;
}

export type EntradaDoNovoUsuario = {
  origem: OrigemUsuario;
  colaboradorId?: string;
  nome?: string;
  email?: string;
  cargo?: string;
  /** (v2.1) Avulso: escolhido entre os setores do DPRH (`opcoesDeSetor`). */
  setor?: string;
  /** Obrigatório (as duas origens): com ou sem máscara; o servidor guarda só os dígitos. */
  cpf: string;
  /** Senha inicial (provisória). Vai no corpo da chamada e em lugar nenhum mais. */
  senha: string;
  /** Obrigatório: grupo de permissão. */
  grupoId: string;
};

export function criarUsuario(e: EntradaDoNovoUsuario): Promise<ResultadoDoCadastro> {
  return chamarEdge<ResultadoDoCadastro>({ acao: "criar_usuario", ...e });
}

/** O administrador define uma nova senha para OUTRO usuário. Ela volta a ser provisória. */
export async function definirSenha(usuarioId: string, senha: string): Promise<void> {
  await chamarEdge<{ ok: true }>({ acao: "definir_senha", usuarioId, senha });
}

/**
 * A própria pessoa troca a senha ("Alterar minha senha" e a troca obrigatória do primeiro acesso).
 * O servidor confere a senha atual; a sessão em uso continua valendo.
 */
export async function trocarMinhaSenha(senhaAtual: string, senhaNova: string): Promise<void> {
  await chamarEdge<{ ok: true }>({ acao: "trocar_minha_senha", senhaAtual, senhaNova });
}
