/**
 * Catálogo de Acessos (padrão de Acessos do Grupo LSPRO): a única fonte de módulos, telas e ações
 * do app. A chave de cada tela ("ordens.os") vai para o banco (`acesso_grupo_permissao.tela`),
 * que não conhece este catálogo: renomear uma chave aqui deixa para trás a permissão gravada,
 * então CHAVE NOVA SE ACRESCENTA, NUNCA SE RENOMEIA.
 *
 * Montado em 24/11/2026 a partir das telas reais e dos `Recurso` que o app já usava
 * (src/store/auth.ts): cada recurso antigo virou UMA tela × ação, e o mapa dos dois sentidos é
 * `RECURSO_POR_PERMISSAO`, lá embaixo — o mesmo da migration 20261124150000 (um teste confere).
 * É por esse mapa que todo `pode("oss.editar")` do app continua valendo, agora lido do grupo.
 *
 * Particularidades da Pólobh:
 *   - "Editar" inclui criar: nas telas daqui quem edita também cria (projeto, EC, OS,
 *     fornecedor), então a tela não tem "Criar" à parte. Nada se apaga — fora as tarefas do
 *     check-list, que têm a ação própria "Excluir tarefas".
 *   - Ações extras de leitura (ver valores, responder pela etapa) têm `escrita: false`: não
 *     contam para a faixa "Somente leitura".
 *   - Tela só com "Ver" (Cronogramas, Configurações, Logs, Guia) é de acesso inteiro: ver é usar.
 *   - `rotas` inclui a página em que o bloco MORA quando ele não tem rota própria: o check-list
 *     vive dentro do projeto, a OS nasce da EC (/estimativas/:id/os/nova) e os blocos financeiros
 *     estão na OS. É o que impede a faixa "Somente leitura" de aparecer para quem só edita o
 *     bloco de dentro (a Coordenação Administrativo-Financeira edita a OS, não a EC).
 *
 * ADAPTAÇÕES do padrão decididas pelo dono do app (24/11/2026) — mudam regras "inegociáveis":
 *   1. Sem Microsoft 365 / Entra ID / SSO / Graph: login só por e-mail e senha; o cadastro sempre
 *      define a senha inicial (popup "Login e senha").
 *   2. Sem lista de colaboradores de outro app (DPRH): Nome, E-mail, Setor e Cargo/função são
 *      digitados no cadastro (setor e cargo com sugestão dos valores já usados). Não há "Origem".
 *   3. A recuperação de senha pela própria pessoa continua ("Esqueci minha senha", /nova-senha, e
 *      o "Alterar senha" do cartão da conta). O administrador também define senha pela tela.
 *   4. O grupo tem um "Nível no banco" (Direção, Produção, Financeiro): as policies antigas
 *      decidem por esse papel, e ele precisa continuar existindo até a escrita por tela (Fase 6).
 */

export type AcaoPadrao = "ver" | "criar" | "editar" | "inativar";

export type ExtraDaTela = {
  /** Chave em `[a-z_]`, única na tela. */
  chave: string;
  rotulo: string;
  /** `false` = ação de leitura (ver um bloco, receber uma pendência). Padrão: escreve. */
  escrita?: boolean;
};

export type TelaAcesso = {
  /** Estável, vai para o banco. Formato: `modulo.tela`, minúsculas, `[a-z0-9_.-]`. */
  chave: string;
  rotulo: string;
  /** Prefixos de rota que a tela cobre (inclusive a página em que o bloco mora). */
  rotas: string[];
  /** As ações padrão que existem na tela; "ver" sempre. */
  acoes: AcaoPadrao[];
  extras?: ExtraDaTela[];
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
    id: "projetos",
    rotulo: "Projetos",
    telas: [
      { chave: "projetos.projetos", rotulo: "Projetos e Calendário", rotas: ["/projetos", "/calendario"], acoes: VER_EDITAR },
      {
        chave: "projetos.checklists", rotulo: "Check-list de projetos", rotas: ["/projetos"], acoes: VER_EDITAR,
        extras: [
          { chave: "excluir", rotulo: "Excluir tarefas" },
          { chave: "lista_padrao", rotulo: "Editar lista padrão" },
        ],
      },
      { chave: "projetos.cronogramas", rotulo: "Cronogramas", rotas: ["/cronogramas"], acoes: SO_VER },
    ],
  },
  {
    id: "estimativas",
    rotulo: "Estimativas de Custo",
    telas: [
      {
        chave: "estimativas.ec", rotulo: "Estimativas de Custo (EC)", rotas: ["/estimativas"], acoes: VER_EDITAR,
        extras: [
          { chave: "ver_valores", rotulo: "Ver valores e BV", escrita: false },
          { chave: "ver_rentabilidade", rotulo: "Ver rentabilidade", escrita: false },
        ],
      },
    ],
  },
  {
    id: "ordens",
    rotulo: "Ordens de Serviço",
    telas: [
      {
        chave: "ordens.os", rotulo: "Ordens de Serviço (OS)", rotas: ["/ordens", "/estimativas"], acoes: VER_EDITAR,
        extras: [
          { chave: "validar_contrato", rotulo: "Revisar OS cultural" },
          { chave: "emitir", rotulo: "Emitir OS" },
          { chave: "clausulas", rotulo: "Cláusulas padrão" },
          { chave: "etapa_financeiro", rotulo: "Responde pelo Financeiro", escrita: false },
          { chave: "etapa_backoffice", rotulo: "Responde pelo Back-office", escrita: false },
        ],
      },
      { chave: "ordens.financeiro", rotulo: "Blocos financeiros da OS", rotas: ["/ordens"], acoes: VER_EDITAR },
    ],
  },
  {
    id: "cadastros",
    rotulo: "Cadastros",
    telas: [
      { chave: "cadastros.fornecedores", rotulo: "Fornecedores", rotas: ["/fornecedores"], acoes: VER_EDITAR },
    ],
  },
  {
    id: "ajuda",
    rotulo: "Ajuda",
    telas: [
      { chave: "ajuda.guia", rotulo: "Guia, Fluxograma e Help Desk", rotas: ["/guia", "/fluxograma", "/suporte"], acoes: SO_VER },
    ],
  },
  // FIXO em todo app: o módulo de administração com as duas telas de Acessos. As chaves
  // `acessos.usuarios` e `acessos.grupos` são usadas pelo banco e pela Edge — NÃO mude.
  {
    id: "admin",
    rotulo: "Administração",
    telas: [
      { chave: "admin.configuracoes", rotulo: "Configurações (empresas, feriados, back-up, IA)", rotas: ["/configuracoes"], acoes: SO_VER },
      { chave: "admin.logs", rotulo: "Logs do sistema", rotas: ["/logs"], acoes: SO_VER },
      { chave: "acessos.usuarios", rotulo: "Acessos · Usuários", rotas: ["/acessos"], acoes: COMPLETA },
      { chave: "acessos.grupos", rotulo: "Acessos · Grupos de permissão", rotas: ["/acessos"], acoes: COMPLETA },
    ],
  },
];

/**
 * Recurso antigo do app (`Recurso`, src/store/auth.ts) ↔ tela × ação. Um para um. É o mesmo mapa
 * da tabela `private.acesso_recurso_legado` (migration 20261124150000): o banco o usa para
 * espelhar o grupo em `areas.recursos` e para `tem_recurso`; o front, para `useAuth().pode`.
 * Recurso novo = linha aqui E na migration (o teste `mapaRecursos.test.ts` acusa a diferença).
 */
export const RECURSO_POR_PERMISSAO: readonly { recurso: string; tela: string; acao: string }[] = [
  { recurso: "projetos", tela: "projetos.projetos", acao: "ver" },
  { recurso: "projetos.editar", tela: "projetos.projetos", acao: "editar" },
  { recurso: "checklists", tela: "projetos.checklists", acao: "ver" },
  { recurso: "checklists.editar", tela: "projetos.checklists", acao: "editar" },
  { recurso: "checklists.excluir", tela: "projetos.checklists", acao: "excluir" },
  { recurso: "checklists.padrao", tela: "projetos.checklists", acao: "lista_padrao" },
  { recurso: "cronogramas", tela: "projetos.cronogramas", acao: "ver" },
  { recurso: "ecs", tela: "estimativas.ec", acao: "ver" },
  { recurso: "ecs.editar", tela: "estimativas.ec", acao: "editar" },
  { recurso: "financeiro", tela: "estimativas.ec", acao: "ver_valores" },
  { recurso: "rentabilidade", tela: "estimativas.ec", acao: "ver_rentabilidade" },
  { recurso: "oss", tela: "ordens.os", acao: "ver" },
  { recurso: "oss.editar", tela: "ordens.os", acao: "editar" },
  { recurso: "oss.validarContrato", tela: "ordens.os", acao: "validar_contrato" },
  { recurso: "oss.emitir", tela: "ordens.os", acao: "emitir" },
  { recurso: "oss.etapaFinanceiro", tela: "ordens.os", acao: "etapa_financeiro" },
  { recurso: "oss.etapaBackoffice", tela: "ordens.os", acao: "etapa_backoffice" },
  { recurso: "contratos.clausulas", tela: "ordens.os", acao: "clausulas" },
  { recurso: "oss.financeiro", tela: "ordens.financeiro", acao: "ver" },
  { recurso: "oss.financeiro.editar", tela: "ordens.financeiro", acao: "editar" },
  { recurso: "fornecedores", tela: "cadastros.fornecedores", acao: "ver" },
  { recurso: "fornecedores.editar", tela: "cadastros.fornecedores", acao: "editar" },
  { recurso: "guia", tela: "ajuda.guia", acao: "ver" },
  { recurso: "configuracoes", tela: "admin.configuracoes", acao: "ver" },
  { recurso: "logs", tela: "admin.logs", acao: "ver" },
  { recurso: "acessos.usuarios", tela: "acessos.usuarios", acao: "ver" },
  { recurso: "acessos.grupos", tela: "acessos.grupos", acao: "ver" },
];

// --- Permissões específicas por usuário (v2.1) -------------------------------------------------
// Permissão ligada a UMA pessoa, não ao grupo. A Pólobh não tem nenhuma (decisão de 24/11/2026):
// o que a área chamava de "permissão especial" (emitir, revisar OS cultural, cláusulas, lista
// padrão do check-list, responder pela etapa) vale para o time inteiro e virou ação extra da
// tela. Lista vazia = a seção some da tela; o banco fica igual ao dos outros apps.

export type PermissaoEspecial = {
  /** Estável, vai para o banco. */
  chave: string;
  rotulo: string;
  descricao: string;
};

export const PERMISSOES_ESPECIAIS: PermissaoEspecial[] = [];

export const CHAVE_ESPECIAL_VALIDA = /^[a-z][a-z0-9_.]{1,60}$/;

// --- Nível no banco (adaptação Pólobh) ------------------------------------------------------------

export type NivelNoBanco = "Direcao" | "Producao" | "Administrativo";

/** Mesmos rótulos de `ROTULO_PAPEL` (o 'Administrativo' é o Financeiro da casa). */
export const NIVEIS_NO_BANCO: { valor: NivelNoBanco; rotulo: string; descricao: string }[] = [
  { valor: "Direcao", rotulo: "Direção", descricao: "Tudo o que a Produção e o Financeiro alcançam no banco, mais as configurações gerais." },
  { valor: "Producao", rotulo: "Produção", descricao: "Grava projetos, EC, OS, check-list e fornecedores." },
  { valor: "Administrativo", rotulo: "Financeiro", descricao: "Grava projetos, OS, check-list, fornecedores, empresas e feriados; lê back-up e e-mails. Não grava EC." },
];

/** O nível `alvo` está contido no `meu`? A Direção contém os outros dois; Produção e Financeiro, só a si. */
export const nivelContido = (alvo: string | null | undefined, meu: string | null | undefined): boolean =>
  !!alvo && !!meu && (alvo === meu || meu === "Direcao");
