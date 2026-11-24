/**
 * Regras puras da lista de usuários e dos grupos da tela de Acessos (padrão de Acessos LSPRO).
 * Sem banco e sem React: é o que os testes exercitam sem montar tela.
 *
 * Adaptação Pólobh (24/11/2026): sem lista de colaboradores de outro app, não há "Origem" nem o
 * combo "Colaborador"; setor e cargo são texto do app, com sugestão dos valores já usados.
 */
import type { GrupoAcesso, StatusUsuarioAcesso, UsuarioDoAcesso } from "./acessosStore";
import type { Permissao } from "./permissoes";
import { nivelContido, type PermissaoEspecial } from "@/config/acessos/catalogo";

const ORDEM_PT = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });

/** Sem acento, minúsculas, espaços simples — para a busca achar "joao" em "João". */
export const normalizarBusca = (texto: string): string =>
  texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

export const ROTULO_STATUS: Record<StatusUsuarioAcesso, string> = { ativo: "Ativo", pendente: "Pendente", inativo: "Inativo" };

export type FiltrosDeUsuarios = {
  busca: string;
  grupoId: string;
  status: StatusUsuarioAcesso | "";
};

export const FILTROS_VAZIOS: FiltrosDeUsuarios = { busca: "", grupoId: "", status: "" };

export function filtrarUsuarios(usuarios: readonly UsuarioDoAcesso[], f: FiltrosDeUsuarios): UsuarioDoAcesso[] {
  const termos = normalizarBusca(f.busca).split(" ").filter(Boolean);
  return usuarios
    .filter((u) => (!f.grupoId || u.grupoId === f.grupoId)
      && (!f.status || u.status === f.status)
      && termos.every((t) => normalizarBusca(`${u.nome} ${u.email} ${u.cargo} ${u.setor}`).includes(t)))
    .sort((a, b) => ORDEM_PT(a.nome || a.email, b.nome || b.email));
}

/** Quantos filtros do painel estão ligados (a busca fica à vista e não conta). */
export const filtrosAtivosDeUsuarios = (f: FiltrosDeUsuarios): number => [f.grupoId, f.status].filter(Boolean).length;

/** Grupos que a pessoa pode receber: ativos; o de sistema só quem é dele entrega. */
export function gruposEscolheveis(grupos: readonly GrupoAcesso[], euSouAdministrador: boolean): GrupoAcesso[] {
  return grupos
    .filter((g) => g.ativo && (!g.sistema || euSouAdministrador))
    .sort((a, b) => Number(b.sistema) - Number(a.sistema) || ORDEM_PT(a.nome, b.nome));
}

/**
 * Quem não é do grupo de sistema nunca concede mais do que tem: só os grupos cujas permissões
 * estão TODAS contidas nas do grupo dele e cujo nível no banco está contido no dele (o de sistema
 * fica de fora; o do próprio chamador entra). O banco recusa o resto (`posso_conceder_grupo`);
 * aqui a tela só evita o erro. Sem grupo, não concede nada.
 */
export function gruposQuePossoConceder(
  meuGrupo: Pick<GrupoAcesso, "id" | "sistema"> | null | undefined,
  grupos: readonly GrupoAcesso[],
): GrupoAcesso[] {
  if (!meuGrupo) return [];
  if (meuGrupo.sistema) return [...grupos];
  const meu = grupos.find((g) => g.id === meuGrupo.id);
  if (!meu) return [];
  const minhas = new Set(meu.permissoes.map((p) => `${p.tela}|${p.acao}`));
  return grupos.filter((g) => !g.sistema
    && nivelContido(g.nivel, meu.nivel)
    && g.permissoes.every((p) => minhas.has(`${p.tela}|${p.acao}`)));
}

/** Só o grupo de sistema existe: o passo do grupo oferece o atalho para criar um. */
export const semGrupoAlemDoSistema = (grupos: readonly GrupoAcesso[]): boolean => grupos.every((g) => g.sistema);

/** Mensagem de quem não pode inativar o grupo: diz quantos usuários ativos o seguram. */
export function motivoDeNaoInativarGrupo(usuariosAtivos: number | null): string | null {
  if (usuariosAtivos === null || usuariosAtivos <= 0) return null;
  return usuariosAtivos === 1
    ? "Este grupo tem 1 usuário ativo. Mude o grupo dele antes de inativar."
    : `Este grupo tem ${usuariosAtivos} usuários ativos. Mude o grupo deles antes de inativar.`;
}

/** Por que a edição está travada, ou `null` quando pode editar. */
export function motivoDeEdicaoTravada(opcoes: { ehEu: boolean; membroDoAdministrador: boolean; euSouAdministrador: boolean }): string | null {
  if (opcoes.ehEu) return "Você não altera o seu próprio acesso.";
  if (opcoes.membroDoAdministrador && !opcoes.euSouAdministrador) return "Só um Administrador de sistema altera membros do Administrador de sistema.";
  return null;
}

// --- Ações da linha do usuário: olho · lápis · ativar/inativar ------------------------------------

/** Estado de um botão da linha: some, aparece desabilitado (com o motivo) ou aparece livre. */
export type EstadoDoBotao = "oculto" | "travado" | "livre";

export type AcoesDaLinha = {
  /** Olho: "Detalhes do usuário", só leitura. Nunca travado. */
  ver: Exclude<EstadoDoBotao, "travado">;
  /** Lápis: "Editar usuário" / "Liberar acesso". Inativo não tem lápis: primeiro ativa. */
  editar: EstadoDoBotao;
  /** Ativar/inativar (ativo e pendente → inativar; inativo → ativar). */
  alternar: { tipo: "inativar" | "ativar"; estado: EstadoDoBotao; escolherGrupo: boolean } | null;
  /** Motivo da trava, para a dica dos botões travados. */
  motivo: string | null;
};

/**
 * Quais botões a linha mostra. `pode` é o de `usePermissoes()`; `grupoAtualConcedivel` = o grupo
 * atual do usuário existe, está ativo e quem está na tela poderia concedê-lo.
 */
export function acoesDaLinha(
  usuario: Pick<UsuarioDoAcesso, "status">,
  o: {
    pode: (tela: string, acao: string) => boolean;
    ehEu: boolean;
    membroDoAdministrador: boolean;
    euSouAdministrador: boolean;
    grupoAtualConcedivel: boolean;
    /** O usuário guarda permissão específica que quem está na tela não tem: o "Ativar" trava. */
    especiaisForaDoMeuAlcance?: boolean;
  },
): AcoesDaLinha {
  const motivoDaTrava = motivoDeEdicaoTravada(o);
  const travaDoAtivar =
    usuario.status === "inativo" && o.especiaisForaDoMeuAlcance
      ? "Este usuário tem permissões específicas que você não tem. Só quem as tem (ou um Administrador de sistema) pode ativá-lo."
      : null;
  const motivo = motivoDaTrava ?? travaDoAtivar;
  const estado = (tem: boolean, trava = motivoDaTrava): EstadoDoBotao => (!tem ? "oculto" : trava ? "travado" : "livre");
  const alternar =
    usuario.status === "inativo"
      ? { tipo: "ativar" as const, estado: estado(o.pode("acessos.usuarios", "editar"), motivo), escolherGrupo: !o.grupoAtualConcedivel }
      : { tipo: "inativar" as const, estado: estado(o.pode("acessos.usuarios", "inativar")), escolherGrupo: false };
  return {
    ver: o.pode("acessos.usuarios", "ver") ? "livre" : "oculto",
    editar: usuario.status === "inativo" ? "oculto" : estado(o.pode("acessos.usuarios", "editar")),
    alternar: alternar.estado !== "oculto" ? alternar : null,
    motivo,
  };
}

// --- Setor e Cargo/função: sugestões ----------------------------------------------------------------
// Sem lista de colaboradores de outro app, setor e cargo são texto do app. Para "Produção" não
// virar "Producao", "produção" e "Produçao" com o tempo, o campo sugere os valores que a casa já
// usa — e aceita um novo, quando é novo mesmo.

/**
 * Valores distintos já usados (sem repetir por acento, caixa ou espaços), em ordem alfabética. O
 * primeiro texto visto de cada valor é o que fica.
 */
export function sugestoesDistintas(valores: readonly string[]): string[] {
  const porChave = new Map<string, string>();
  for (const v of valores) {
    const texto = v.replace(/\s+/g, " ").trim();
    if (texto && !porChave.has(normalizarBusca(texto))) porChave.set(normalizarBusca(texto), texto);
  }
  return [...porChave.values()].sort(ORDEM_PT);
}

/**
 * Se o texto digitado é um valor que já existe escrito de outro jeito ("producao" para
 * "Produção"), devolve a grafia existente — a tela grava essa. Senão, o texto aparado.
 */
export function grafiaExistente(digitado: string, existentes: readonly string[]): string {
  const texto = digitado.replace(/\s+/g, " ").trim();
  if (!texto) return "";
  return existentes.find((e) => normalizarBusca(e) === normalizarBusca(texto)) ?? texto;
}

// --- Permissões específicas por usuário (v2.1) --------------------------------------------------------

export type CaixaDeEspecial = PermissaoEspecial & {
  marcada: boolean;
  /** Quem edita não pode LIGAR o que não tem; desligar sempre pode (igual à matriz do grupo). */
  desabilitada: boolean;
  dica: string | null;
};

export function caixasDeEspeciais(
  catalogo: readonly PermissaoEspecial[],
  marcadas: readonly string[],
  temEspecial: (chave: string) => boolean,
  travado = false,
): CaixaDeEspecial[] {
  const ligadas = new Set(marcadas);
  return catalogo.map((p) => {
    const marcada = ligadas.has(p.chave);
    const semPoder = !marcada && !temEspecial(p.chave);
    return {
      ...p,
      marcada,
      desabilitada: travado || semPoder,
      dica: !travado && semPoder ? "Você não tem esta permissão, então não pode concedê-la." : null,
    };
  });
}

/** Só chaves do catálogo, sem repetir — o que vai para `definirPermissoesEspeciais`. */
export function especiaisValidas(catalogo: readonly PermissaoEspecial[], chaves: readonly string[]): string[] {
  const existentes = new Set(catalogo.map((p) => p.chave));
  return [...new Set(chaves)].filter((c) => existentes.has(c)).sort();
}

/** O conjunto mudou? Sem mudança, não chama a RPC. */
export const especiaisMudaram = (antes: readonly string[], depois: readonly string[]): boolean =>
  [...new Set(antes)].sort().join("|") !== [...new Set(depois)].sort().join("|");

/** Permissões do grupo por id — o mapa que a matriz e as travas consultam. */
export const permissoesPorGrupo = (grupos: readonly GrupoAcesso[]): Map<string, Permissao[]> =>
  new Map(grupos.map((g) => [g.id, g.permissoes]));

// GANCHO (FUTURO — não implementar agora): sugestão de grupo por setor/cargo. Quando existir,
// entra aqui uma função pura `grupoSugerido(setor, cargo, regras)` que só PRÉ-SELECIONA o grupo no
// cadastro; a escolha continua obrigatória e de quem cadastra.
