//
// Regras puras da lista de usuários e do combo de colaboradores da tela de Acessos. Sem banco e
// sem React: é o que os testes de `testes.md` exercitam sem montar tela.
import type { ColaboradorParaAcesso, GrupoAcesso, OrigemUsuario, StatusUsuarioAcesso, UsuarioDoAcesso } from "./acessosStore";
import type { Duplicidade } from "./acessosStore";
import type { Permissao } from "./permissoes";
import { buscaCasaComCpf, motivoDoCpfInvalido } from "./cpf";
// ADAPTAR: caminho do catálogo no app.
import type { PermissaoEspecial } from "@/config/acessos/catalogo";

/** Quem pode ganhar acesso: ainda não saiu da empresa (valores do `status` da lista do DP Corp). */
const STATUS_COM_ACESSO = new Set(["pre_admissao", "ativo", "em_desligamento"]);

const ORDEM_PT = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });

/** Sem acento, minúsculas, espaços simples — para a busca achar "joao" em "João". */
export const normalizarBusca = (texto: string): string =>
  texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Uma opção da caixa combinada. ADAPTAR ao formato de opção do combo do design system do app. */
export type OpcaoCombo = { valor: string; rotulo: string; detalhe?: string };

/**
 * As opções do combo "Colaborador": só quem está na casa e ainda não é usuário, em ordem
 * alfabética. Vazio e aberto, o combo mostra ESTA LISTA INTEIRA (sem limite de itens) — quem
 * procura não precisa saber o nome para começar.
 */
export function opcoesDeColaboradores(
  colaboradores: readonly ColaboradorParaAcesso[],
  usuarios: readonly Pick<UsuarioDoAcesso, "colaboradorId" | "email">[],
): OpcaoCombo[] {
  const jaSao = new Set(usuarios.map((u) => u.colaboradorId).filter(Boolean));
  const emails = new Set(usuarios.map((u) => u.email.trim().toLowerCase()));
  return colaboradores
    .filter((c) => STATUS_COM_ACESSO.has(c.statusColaborador)
      && !jaSao.has(c.id)
      && !(c.emailCorporativo && emails.has(c.emailCorporativo.trim().toLowerCase())))
    .sort((a, b) => ORDEM_PT(a.nome, b.nome))
    .map((c) => ({
      valor: c.id,
      rotulo: c.nome,
      detalhe: [c.cargo, c.setor, c.empresa].filter(Boolean).join(" · "),
    }));
}

export const ROTULO_ORIGEM: Record<OrigemUsuario, string> = { colaborador: "Colaborador", avulso: "Avulso" };
export const ROTULO_STATUS: Record<StatusUsuarioAcesso, string> = { ativo: "Ativo", pendente: "Pendente", inativo: "Inativo" };

export type FiltrosDeUsuarios = {
  busca: string;
  grupoId: string;
  origem: OrigemUsuario | "";
  status: StatusUsuarioAcesso | "";
};

export function filtrarUsuarios(usuarios: readonly UsuarioDoAcesso[], f: FiltrosDeUsuarios): UsuarioDoAcesso[] {
  const termos = normalizarBusca(f.busca).split(" ").filter(Boolean);
  return usuarios
    .filter((u) => (!f.grupoId || u.grupoId === f.grupoId)
      && (!f.origem || u.origem === f.origem)
      && (!f.status || u.status === f.status)
      // Busca por nome, e-mail, cargo ou CPF (o CPF casa pelos dígitos do meio: `buscaCasaComCpf`).
      && (termos.every((t) => normalizarBusca(`${u.nome} ${u.email} ${u.cargo}`).includes(t))
          || buscaCasaComCpf(f.busca, u.cpfMascarado)))
    .sort((a, b) => ORDEM_PT(a.nome || a.email, b.nome || b.email));
}

/** Quantos filtros do painel estão ligados (a busca fica à vista e não conta) — o contador do botão "Filtros". */
export const filtrosAtivosDeUsuarios = (f: FiltrosDeUsuarios): number => [f.grupoId, f.origem, f.status].filter(Boolean).length;

/** Grupos que a pessoa pode receber: ativos; o de sistema só quem é dele entrega. */
export function gruposEscolheveis(grupos: readonly GrupoAcesso[], euSouAdministrador: boolean): GrupoAcesso[] {
  return grupos
    .filter((g) => g.ativo && (!g.sistema || euSouAdministrador))
    .sort((a, b) => Number(b.sistema) - Number(a.sistema) || ORDEM_PT(a.nome, b.nome));
}

/**
 * Quem não é do grupo de sistema nunca concede mais do que tem: só os grupos cujas permissões
 * estão TODAS contidas nas do grupo dele (o de sistema fica de fora, e o do próprio chamador
 * entra, contido em si mesmo). O banco recusa o resto (`posso_conceder_grupo`, 42501); aqui a
 * tela só evita o erro. Sem grupo, não concede nada.
 * Uso: `gruposEscolheveis(gruposQuePossoConceder(...), euSouAdministrador)` no cadastro e no
 * editar; e "Definir nova senha" só aparece se o grupo ATUAL do alvo está nesta lista.
 */
export function gruposQuePossoConceder(
  meuGrupo: Pick<GrupoAcesso, "id" | "sistema"> | null | undefined,
  grupos: readonly GrupoAcesso[],
  permissoesPorGrupo: ReadonlyMap<string, readonly Permissao[]>,
): GrupoAcesso[] {
  if (!meuGrupo) return [];
  if (meuGrupo.sistema) return [...grupos];
  const minhas = new Set((permissoesPorGrupo.get(meuGrupo.id) ?? []).map((p) => `${p.tela}|${p.acao}`));
  return grupos.filter((g) => !g.sistema
    && (permissoesPorGrupo.get(g.id) ?? g.permissoes).every((p) => minhas.has(`${p.tela}|${p.acao}`)));
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

// --- Validação dos dados do usuário (senha) --------------------------------------------------------

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

export type ErrosDosDados = Partial<Record<"nome" | "email" | "cpf" | "grupo", string>>;

/**
 * Erros por campo do "Dados do usuário" (e do "Editar usuário", com `exigirGrupo`). Vazio = pode
 * seguir. A MESMA regra roda na Edge; aqui é para o erro aparecer sob o campo, antes de enviar.
 */
export function errosDosDados(d: { nome: string; email: string; cpf: string; grupoId: string | null }, exigirGrupo = true): ErrosDosDados {
  const erros: ErrosDosDados = {};
  if (d.nome.trim().length < 2) erros.nome = "Informe o nome.";
  const email = d.email.trim().toLowerCase();
  if (!email) erros.email = "Informe o e-mail.";
  else if (email.length > 254 || !EMAIL.test(email)) erros.email = "E-mail inválido.";
  const cpf = motivoDoCpfInvalido(d.cpf);
  if (cpf) erros.cpf = cpf;
  if (exigirGrupo && !d.grupoId) erros.grupo = "Escolha o grupo de permissão.";
  return erros;
}

/**
 * Resposta de `conferirDuplicidade` -> erros por campo. Inativo ganha a orientação de usar "Ativar"
 * (recadastrar um inativo é proibido: ele volta pela linha, com confirmação).
 */
export function errosDeDuplicidade(r: Duplicidade): ErrosDosDados {
  const erros: ErrosDosDados = {};
  if (r.emailEmUso) {
    erros.email = r.statusDoEmail === "inativo"
      ? "Este e-mail é de um usuário inativo. Use \"Ativar\" na lista de usuários."
      : "Já existe um usuário com este e-mail.";
  }
  if (r.cpfEmUso) {
    erros.cpf = r.statusDoCpf === "inativo"
      ? "Este CPF é de um usuário inativo. Use \"Ativar\" na lista de usuários."
      : "Já existe um usuário com este CPF.";
  }
  return erros;
}

/** Código de duplicidade da Edge -> campo que recebe o erro (a corrida entre a conferência e o envio). */
export const CAMPO_DA_DUPLICIDADE: Record<string, "email" | "cpf"> = {
  EMAIL_DUPLICADO: "email", COLABORADOR_DUPLICADO: "email", CPF_DUPLICADO: "cpf",
};

/** Por que a edição está travada, ou `null` quando pode editar. */
export function motivoDeEdicaoTravada(opcoes: { ehEu: boolean; membroDoAdministrador: boolean; euSouAdministrador: boolean }): string | null {
  if (opcoes.ehEu) return "Você não altera o seu próprio acesso.";
  if (opcoes.membroDoAdministrador && !opcoes.euSouAdministrador) return "Só um Administrador de sistema altera membros do Administrador de sistema.";
  return null;
}

// --- Ações da linha do usuário (v2.2): olho · lápis · ativar/inativar -----------------------------

/** Estado de um botão da linha: some, aparece desabilitado (com o motivo) ou aparece livre. */
export type EstadoDoBotao = "oculto" | "travado" | "livre";

export type AcoesDaLinha = {
  /** Olho: "Detalhes do usuário", só leitura. Nunca travado. */
  ver: Exclude<EstadoDoBotao, "travado">;
  /** Lápis: "Editar usuário" / "Liberar acesso". Inativo não tem lápis: primeiro ativa (v2.3). */
  editar: EstadoDoBotao;
  /**
   * Ativar/inativar: qual dos dois (ativo e pendente → inativar; inativo → ativar) e o estado. No "ativar", `escolherGrupo` diz
   * se a confirmação precisa pedir o grupo (o atual está inativo ou fora do alcance de quem ativa).
   */
  alternar: { tipo: "inativar" | "ativar"; estado: EstadoDoBotao; escolherGrupo: boolean } | null;
  /** Motivo da trava, para a dica dos botões travados. */
  motivo: string | null;
};

/**
 * Quais botões a linha mostra. `pode` é o de `usePermissoes()`; `grupoAtualConcedivel` = o grupo
 * atual do usuário existe, está ativo e quem está na tela poderia concedê-lo (é do Administrador
 * ou o grupo está nos concedíveis). A tela só evita o erro: quem recusa é o banco.
 */
export function acoesDaLinha(
  usuario: Pick<UsuarioDoAcesso, "status">,
  o: {
    pode: (tela: string, acao: string) => boolean;
    ehEu: boolean;
    membroDoAdministrador: boolean;
    euSouAdministrador: boolean;
    grupoAtualConcedivel: boolean;
    /**
     * O usuário guarda permissão específica que quem está na tela não tem (v2.4): o banco não deixa
     * ativá-lo (reativar não devolve o que quem reativa não concederia) — o "Ativar" fica travado.
     */
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
  // Pendente também se inativa (v2.4): conta criada por fora do cadastro não fica pendurada.
  const alternar =
    usuario.status === "inativo"
      ? { tipo: "ativar" as const, estado: estado(o.pode("acessos.usuarios", "editar"), motivo), escolherGrupo: !o.grupoAtualConcedivel }
      : { tipo: "inativar" as const, estado: estado(o.pode("acessos.usuarios", "inativar")), escolherGrupo: false };
  return {
    ver: o.pode("acessos.usuarios", "ver") ? "livre" : "oculto",
    // Inativo não se edita (o banco recusa): o lápis some; ver é pelo olho, voltar é pelo "Ativar".
    editar: usuario.status === "inativo" ? "oculto" : estado(o.pode("acessos.usuarios", "editar")),
    alternar: alternar && alternar.estado !== "oculto" ? alternar : null,
    motivo,
  };
}

// --- Setor e Cargo/função do avulso (v2.1) --------------------------------------------------------
// Setor e cargo NÃO se criam no Acessos: quem os cria é o app Gestão de Colaboradores (DPRH). No
// avulso, as duas caixas combinadas só ESCOLHEM, entre os valores que a lista do DPRH já usa
// (espelho `colaboradores_dp`; no próprio DP Corp, os cadastros de lá). Faltou um? Ele é criado no
// DPRH; depois da sincronização, aparece aqui.
// ADAPTAR: se o DP Corp passar a expor setores e cargos numa API própria, troque a origem — a regra
// (escolher, nunca criar) continua.

/**
 * Valores distintos de um campo da lista do DPRH, sem repetir (mesmo texto sem olhar acento,
 * caixa e espaços), em ordem alfabética. `atual` = o valor que o usuário já tem: entra na lista
 * mesmo que o DPRH não o use mais, para a edição não apagá-lo sem querer.
 */
function opcoesDistintas(valores: readonly string[], atual = ""): OpcaoCombo[] {
  const porChave = new Map<string, string>();
  // O atual vem primeiro: se o DPRH grafa diferente ("PLANEJAMENTO"), vale o texto exato do usuário.
  for (const v of [atual, ...valores]) {
    const texto = v.replace(/\s+/g, " ").trim();
    if (texto && !porChave.has(normalizarBusca(texto))) porChave.set(normalizarBusca(texto), texto);
  }
  return [...porChave.values()].sort(ORDEM_PT).map((t) => ({ valor: t, rotulo: t }));
}

/** Opções da caixa "Setor" do avulso: os setores da lista do DPRH (+ o atual do usuário). */
export const opcoesDeSetor = (colaboradores: readonly Pick<ColaboradorParaAcesso, "setor">[], atual = ""): OpcaoCombo[] =>
  opcoesDistintas(colaboradores.map((c) => c.setor), atual);

/** Opções da caixa "Cargo/função" do avulso: os cargos da lista do DPRH (+ o atual do usuário). */
export const opcoesDeCargo = (colaboradores: readonly Pick<ColaboradorParaAcesso, "cargo">[], atual = ""): OpcaoCombo[] =>
  opcoesDistintas(colaboradores.map((c) => c.cargo), atual);

// --- Permissões específicas por usuário (v2.1) -------------------------------------------------------

export type CaixaDeEspecial = PermissaoEspecial & {
  marcada: boolean;
  /** Quem edita não pode LIGAR o que não tem; desligar sempre pode (igual à matriz do grupo). */
  desabilitada: boolean;
  dica: string | null;
};

/**
 * As caixas da seção "Permissões específicas", na ordem do catálogo. `temEspecial` é o de quem
 * está na tela (`usePermissoes().temEspecial`; o Administrador tem todas). `travado` = edição
 * travada (`motivoDeEdicaoTravada`) ou sem `acessos.usuarios` · editar: tudo desabilitado.
 * Usuário do grupo de sistema: passe `marcadas` = todas as chaves e `travado` = true — ele já tem.
 */
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

// GANCHO (FUTURO — não implementar agora): sugestão de grupo por setor/cargo. Quando existir,
// entra aqui uma função pura `grupoSugerido(colaborador, regras)` que só PRÉ-SELECIONA o rádio no
// passo do grupo; a escolha continua obrigatória e de quem cadastra.

// ADAPTAR: recorte extra por usuário — as regras puras do recorte ficam aqui. No DP Corp:
// `escopoDeEmpresasValido(todas, ids)` ("Todas" ou ao menos uma) e `escopoDeQuemConcede(...)`
// (quem não é do Administrador só oferece o que ele mesmo enxerga).
