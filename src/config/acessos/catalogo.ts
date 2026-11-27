// A única fonte de módulos, telas e ações do Pólobh (padrão "Acessos e Logs", 26/11/2026).
//
// A chave de cada tela vai para o banco (`acesso_grupo_permissao.tela`), que não conhece este
// catálogo: renomear uma chave aqui deixa para trás a permissão gravada, então CHAVE NOVA SE
// ACRESCENTA, NUNCA SE RENOMEIA.
//
// As telas e ações abaixo nasceram da matriz antiga (as "áreas"): cada recurso antigo virou uma
// tela + ação, no mapa `RECURSO_LEGADO` — o mesmo de `private.recurso_legado` no banco, que é o
// que mantém os portões antigos (`tem_recurso`, `ve_financeiro`…) lendo os grupos.
//
// O "D" do CRUD é "inativar": este padrão não apaga registro. Nas telas do Pólobh, "editar" já
// cobria criar (era assim na matriz antiga), por isso elas declaram só "ver" e "editar".

export type AcaoPadrao = "ver" | "criar" | "editar" | "inativar";

export type TelaAcesso = {
  /** Estável, vai para o banco. Formato: `[a-z0-9_.-]`. */
  chave: string;
  rotulo: string;
  /** Prefixos de rota que a tela cobre. */
  rotas: string[];
  /** As ações padrão que existem na tela; "ver" sempre. */
  acoes: AcaoPadrao[];
  /** Ações próprias da tela. Chave em `[a-z_]`. */
  extras?: { chave: string; rotulo: string }[];
};

export type ModuloAcesso = { id: string; rotulo: string; telas: TelaAcesso[] };

export const ROTULO_ACAO: Record<AcaoPadrao, string> = {
  ver: "Ver",
  criar: "Criar",
  editar: "Editar",
  inativar: "Inativar",
};

export const ACOES_PADRAO: readonly AcaoPadrao[] = ["ver", "criar", "editar", "inativar"];

const COMPLETA: AcaoPadrao[] = ["ver", "criar", "editar", "inativar"];
const SO_VER: AcaoPadrao[] = ["ver"];
const VER_EDITAR: AcaoPadrao[] = ["ver", "editar"];

export const CATALOGO: ModuloAcesso[] = [
  {
    id: "producao",
    rotulo: "Produção",
    telas: [
      { chave: "projetos", rotulo: "Projetos", rotas: ["/projetos", "/calendario", "/fluxograma"], acoes: VER_EDITAR },
      {
        chave: "ecs", rotulo: "Estimativas de Custo", rotas: ["/estimativas"], acoes: VER_EDITAR,
        extras: [
          { chave: "valores", rotulo: "Ver e editar valores e BV" },
          { chave: "rentabilidade", rotulo: "Ver a rentabilidade por item" },
        ],
      },
      {
        chave: "oss", rotulo: "Ordens de Serviço", rotas: ["/ordens"], acoes: VER_EDITAR,
        extras: [
          { chave: "financeiro_ver", rotulo: "Ver os blocos financeiros" },
          { chave: "financeiro_editar", rotulo: "Editar os blocos financeiros" },
          { chave: "emitir", rotulo: "Emitir a OS (Back-office)" },
          { chave: "validar_contrato", rotulo: "Revisar a OS cultural (Direção de Produção)" },
          { chave: "etapa_financeiro", rotulo: "Responde pela etapa do Financeiro" },
          { chave: "etapa_backoffice", rotulo: "Responde pela etapa do Back-office" },
          // Ações em lote da lista de OS (27/11/2026) — ver `domain/loteOs`.
          { chave: "status_lote", rotulo: "Alterar o status das OS em lote" },
          { chave: "excluir", rotulo: "Excluir OS (definitivo)" },
        ],
      },
      {
        chave: "checklists", rotulo: "Check-list de projetos", rotas: [], acoes: VER_EDITAR,
        extras: [
          { chave: "excluir", rotulo: "Excluir tarefas" },
          { chave: "lista_padrao", rotulo: "Editar a lista padrão" },
        ],
      },
      { chave: "cronogramas", rotulo: "Cronogramas", rotas: ["/cronogramas"], acoes: SO_VER },
      { chave: "fornecedores", rotulo: "Fornecedores", rotas: ["/fornecedores"], acoes: VER_EDITAR },
      { chave: "guia", rotulo: "Guia do Aplicativo", rotas: ["/guia"], acoes: SO_VER },
    ],
  },
  // As chaves `acessos.usuarios`, `acessos.grupos` e `admin.logs` são usadas pelo banco e pela
  // Edge — NÃO mude. As duas de Acessos dividem a rota: quem vê uma OU outra entra em /acessos.
  {
    id: "admin",
    rotulo: "Administração",
    telas: [
      {
        chave: "configuracoes", rotulo: "Configurações", rotas: ["/configuracoes"], acoes: SO_VER,
        extras: [{ chave: "clausulas", rotulo: "Editar as cláusulas padrão dos contratos" }],
      },
      { chave: "acessos.usuarios", rotulo: "Acessos · Usuários", rotas: ["/acessos"], acoes: COMPLETA },
      { chave: "acessos.grupos", rotulo: "Acessos · Grupos de permissão", rotas: ["/acessos"], acoes: COMPLETA },
      {
        chave: "admin.logs", rotulo: "Logs", rotas: ["/logs"], acoes: SO_VER,
        extras: [{ chave: "exportar", rotulo: "Exportar" }],
      },
    ],
  },
];

/**
 * Rotas autenticadas que não pertencem a tela nenhuma: abertas a todo usuário ativo.
 * `/` redireciona; `/suporte` é o Help Desk, de todos.
 */
export const ROTAS_LIVRES = ["/", "/suporte"];

/**
 * O recurso da matriz antiga (`Recurso`, em src/store/auth.ts) → tela + ação. O MESMO mapa de
 * `private.recurso_legado` (migração 20261126100000). É o que deixa o código antigo, que pergunta
 * `pode("oss.emitir")`, responder pelo grupo.
 */
export const RECURSO_LEGADO: Record<string, { tela: string; acao: string }> = {
  projetos: { tela: "projetos", acao: "ver" },
  "projetos.editar": { tela: "projetos", acao: "editar" },
  ecs: { tela: "ecs", acao: "ver" },
  "ecs.editar": { tela: "ecs", acao: "editar" },
  financeiro: { tela: "ecs", acao: "valores" },
  rentabilidade: { tela: "ecs", acao: "rentabilidade" },
  oss: { tela: "oss", acao: "ver" },
  "oss.editar": { tela: "oss", acao: "editar" },
  "oss.emitir": { tela: "oss", acao: "emitir" },
  "oss.validarContrato": { tela: "oss", acao: "validar_contrato" },
  "oss.etapaFinanceiro": { tela: "oss", acao: "etapa_financeiro" },
  "oss.etapaBackoffice": { tela: "oss", acao: "etapa_backoffice" },
  // Só do front: o banco decide pelo papel do grupo; estas duas chaves controlam os botões da lista.
  "oss.statusLote": { tela: "oss", acao: "status_lote" },
  "oss.excluir": { tela: "oss", acao: "excluir" },
  "oss.financeiro": { tela: "oss", acao: "financeiro_ver" },
  "oss.financeiro.editar": { tela: "oss", acao: "financeiro_editar" },
  checklists: { tela: "checklists", acao: "ver" },
  "checklists.editar": { tela: "checklists", acao: "editar" },
  "checklists.excluir": { tela: "checklists", acao: "excluir" },
  "checklists.padrao": { tela: "checklists", acao: "lista_padrao" },
  cronogramas: { tela: "cronogramas", acao: "ver" },
  fornecedores: { tela: "fornecedores", acao: "ver" },
  "fornecedores.editar": { tela: "fornecedores", acao: "editar" },
  configuracoes: { tela: "configuracoes", acao: "ver" },
  "contratos.clausulas": { tela: "configuracoes", acao: "clausulas" },
  logs: { tela: "admin.logs", acao: "ver" },
  guia: { tela: "guia", acao: "ver" },
  // Só do front (o banco não tem estas chaves no mapa antigo): o menu e a rota de Acessos.
  "acessos.usuarios": { tela: "acessos.usuarios", acao: "ver" },
  "acessos.grupos": { tela: "acessos.grupos", acao: "ver" },
};

// --- Permissões específicas por usuário ------------------------------------------------------
// O Pólobh começa sem nenhuma (o que era "por pessoa" já está nos extras das telas). A seção some
// da tela enquanto a lista estiver vazia. Chave se acrescenta, nunca se renomeia.

export type PermissaoEspecial = {
  chave: string;
  rotulo: string;
  descricao: string;
};

export const PERMISSOES_ESPECIAIS: PermissaoEspecial[] = [];

export const CHAVE_ESPECIAL_VALIDA = /^[a-z][a-z0-9_.]{1,60}$/;
