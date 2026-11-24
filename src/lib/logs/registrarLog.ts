// LOGS — registrador do front (padrão LSPRO, 24/11/2026; modelo da skill `logs-padrao-lspro`).
//
// A regra de ouro: log NUNCA derruba nem atrasa a operação — chamada sem await, qualquer falha
// engolida, e se o banco ainda não tem a função (migration não aplicada) o registro se desliga
// sozinho pelo resto da sessão. Isso deixa o front subir antes do banco.
//
// O que nunca entra (o banco também descarta pelo nome da chave): senha, token, documento,
// salário, dado de formulário. Quem chama passa só o que identifica o evento — ação, tela,
// mensagem curta.
//
// ESTE ARQUIVO NÃO IMPORTA O CLIENTE SUPABASE e não lê nada no carregamento. O envio é INJETADO
// por `configurarRegistroDeLogs`, chamado por quem cria o cliente (`src/lib/supabaseClient.ts`).
// Não acrescente `import { supabase }` aqui: o módulo do cliente importa este (ponto de
// captura 1), e o ciclo dá tela em branco conforme a ordem em que o empacotador junta os arquivos.
//
// Nada de visual: serve a qualquer design system.

export type CategoriaLog = "atividade" | "acesso" | "erro";
export type NivelLog = "info" | "aviso" | "erro" | "critico";
export type ResultadoLog = "ok" | "negado" | "falha";

export type EventoLog = {
  /** Informativa: o banco tira a categoria da ação, não deste campo. */
  categoria: CategoriaLog;
  nivel?: NivelLog;
  /** Uma de `ACOES_DO_APP`: o banco recusa o resto. */
  acao: string;
  resultado?: ResultadoLog;
  /** Caminho da rota SEM query. Se não vier, é a tela atual. */
  tela?: string;
  mensagem?: string;
  detalhe?: Record<string, unknown>;
  alvoTipo?: string;
  alvoId?: string;
  alvoRotulo?: string;
  correlacao?: string;
};

export const JANELA_REPETICAO_MS = 60_000;
export const LIMITE_MENSAGEM = 500;
export const LIMITE_DETALHE = 4000;
const LIMITE_TELA = 200;
const LIMITE_ROTULO = 200;

/**
 * As únicas ações que o app manda (o banco recusa o resto). O descarte local usa a mesma lista:
 * mandar outra só gastaria uma chamada para ser jogada fora. Ação nova do front = linha aqui E na
 * função `registrar_log` do banco. Ações de banco e de Edge (`usuario_criado`, `erro_edge`,
 * `login_falhou`…) NÃO entram aqui: vêm por `registrar_log_interno` / service role.
 */
export const ACOES_DO_APP = ["login", "logout", "acesso_negado", "erro_requisicao", "erro_js", "exportacao"] as const;
const acaoValida = (acao: string) => (ACOES_DO_APP as readonly string[]).includes(acao);

const cortar = (texto: string | undefined, limite: number) => (texto === undefined ? undefined : texto.slice(0, limite));

/** Detalhe que passa de 4 KB vira um aviso de corte: o banco o descartaria inteiro de qualquer jeito. */
export function detalheCortado(detalhe: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!detalhe) return undefined;
  try {
    const texto = JSON.stringify(detalhe);
    if (texto.length <= LIMITE_DETALHE) return detalhe;
    return { cortado: true, tamanho: texto.length };
  } catch {
    return { cortado: true };   // referência circular
  }
}

/** A forma que vai na RPC: tamanhos cortados, ação fora da lista descartada (devolve `null`). */
export function prepararEvento(evento: EventoLog, appVersao?: string): Record<string, unknown> | null {
  if (!acaoValida(evento.acao)) return null;
  return {
    categoria: evento.categoria,
    nivel: evento.nivel,
    acao: evento.acao,
    resultado: evento.resultado,
    tela: cortar(evento.tela, LIMITE_TELA),
    mensagem: cortar(evento.mensagem, LIMITE_MENSAGEM),
    detalhe: detalheCortado(evento.detalhe),
    alvoTipo: cortar(evento.alvoTipo, 60),
    alvoId: cortar(evento.alvoId, 100),
    alvoRotulo: cortar(evento.alvoRotulo, LIMITE_ROTULO),
    correlacao: evento.correlacao,
    appVersao,
  };
}

export type Enviar = (payload: Record<string, unknown>) => PromiseLike<{ error: { code?: string; message?: string } | null }>;

export type OpcoesRegistrador = {
  enviar: Enviar;
  /** Relógio injetável (ms); o teste anda com ele. */
  agora?: () => number;
  /** Agenda o fechamento da janela de repetição; o teste dispara à mão. */
  agendar?: (acao: () => void, ms: number) => unknown;
  cancelar?: (id: unknown) => void;
  appVersao?: string;
  ativo?: () => boolean;
};

type Grupo = { chave: string; evento: EventoLog; repeticoes: number; inicio: number; timer: unknown };

/**
 * O registrador com a regra de repetição: o primeiro evento sai na hora; os iguais (mesma ação +
 * mensagem + tela) em até 60 s só contam, e saem juntos num evento com `detalhe.repeticoes` quando
 * a janela fecha ou quando chega um evento diferente. Sem isto um erro dentro de um laço de
 * renderização encheria o log (e o freio de 60/min do banco) com a mesma linha.
 *
 * Nenhuma promessa daqui rejeita, e a falha de envio NÃO passa pelo tratamento central de erro do
 * app: senão o erro ao registrar geraria outro registro, que falharia de novo (laço).
 */
export function criarRegistrador(opcoes: OpcoesRegistrador) {
  const agora = opcoes.agora ?? Date.now;
  const agendar = opcoes.agendar ?? ((acao: () => void, ms: number) => setTimeout(acao, ms));
  const cancelar = opcoes.cancelar ?? ((id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>));
  let desligado = false;
  let grupo: Grupo | null = null;

  function enviar(evento: EventoLog): Promise<void> {
    if (desligado || opcoes.ativo?.() === false) return Promise.resolve();
    const payload = prepararEvento(evento, opcoes.appVersao);
    if (!payload) return Promise.resolve();
    try {
      return Promise.resolve(opcoes.enviar(payload)).then(({ error }) => {
        // A função não existe: a migration ainda não subiu. Para de tentar nesta sessão.
        if (error && (error.code === "PGRST202" || /could not find the function/i.test(error.message ?? ""))) desligado = true;
      }, () => undefined);
    } catch {
      return Promise.resolve();
    }
  }

  function fecharGrupo() {
    if (!grupo) return;
    const { evento, repeticoes, timer } = grupo;
    cancelar(timer);
    grupo = null;
    if (repeticoes > 0) void enviar({ ...evento, detalhe: { ...evento.detalhe, repeticoes } });
  }

  function registrar(evento: EventoLog): Promise<void> {
    const chave = `${evento.acao}|${evento.mensagem ?? ""}|${evento.tela ?? ""}`;
    if (grupo && grupo.chave === chave && agora() - grupo.inicio < JANELA_REPETICAO_MS) {
      grupo.repeticoes += 1;
      return Promise.resolve();
    }
    fecharGrupo();
    const novo: Grupo = { chave, evento, repeticoes: 0, inicio: agora(), timer: null };
    novo.timer = agendar(fecharGrupo, JANELA_REPETICAO_MS);
    grupo = novo;
    return enviar(evento);
  }

  return {
    /** Sem await, sem erro: é o que o app chama. */
    registrar(evento: EventoLog): void { void registrar(evento); },
    /** Igual, mas devolve a promessa (que nunca rejeita) — para o logout, que precisa da sessão viva. */
    registrarAgora: registrar,
    /** Fecha a janela agora: a aba está sendo escondida e o resumo das repetições não pode se perder. */
    descarregar: fecharGrupo,
    desligado: () => desligado,
  };
}

// ---------------------------------------------------------------------------------------------
// Instância do app

/**
 * O envio é INJETADO por `configurarRegistroDeLogs` (feito no módulo que cria o cliente Supabase,
 * logo depois do `createClient`). Este módulo não importa o cliente: o ciclo cliente ↔ registrador
 * que existiu na primeira versão do DP Corp só funcionava pela ordem em que o empacotador juntava
 * os arquivos, e reordenar um import dava tela em branco ("Cannot access 'supabase' before
 * initialization"). Nada é lido no carregamento; sem injeção, registrar não faz nada.
 */
export type ChamadaRpc = (nome: string, argumentos: Record<string, unknown>) => PromiseLike<{ error: { code?: string; message?: string } | null }>;

let rpcInjetada: ChamadaRpc | null = null;
let rpcAtiva = false;

export function configurarRegistroDeLogs(config: { rpc: ChamadaRpc; ativo: boolean }): void {
  rpcInjetada = config.rpc;
  rpcAtiva = config.ativo;
  padrao = null; // o registrador se refaz com o novo enviador
}

/** `true` depois que alguém injetou o enviador (o módulo do cliente, ao ser carregado). */
export const registroConfigurado = (): boolean => rpcInjetada !== null;

let padrao: ReturnType<typeof criarRegistrador> | null = null;

function registradorDoApp() {
  if (!padrao) {
    padrao = criarRegistrador({
      enviar: (p) => rpcInjetada ? rpcInjetada("registrar_log", { p }) : Promise.resolve({ error: null }),
      // A versão da publicação (vite.config.ts): diz se o erro veio de um build velho aberto numa aba.
      appVersao: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : undefined,
      // Sem navegador ou sem Supabase configurado (testes, preview) não há para onde mandar.
      ativo: () => typeof window !== "undefined" && rpcAtiva && rpcInjetada !== null,
    });
    if (typeof window !== "undefined") window.addEventListener("pagehide", () => padrao?.descarregar());
  }
  return padrao;
}

/** O caminho da página sem a query: filtro e token nunca vão para o log. */
export function telaAtual(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.location.pathname || undefined;
}

/**
 * O front grava UM formato de tela: o caminho da rota. A Pólobh ainda não tem catálogo de telas;
 * quando o padrão de Acessos trouxer um (chaves como `admin.logs`), converta aqui a chave para a
 * primeira rota dela.
 */
export function telaComoCaminho(tela: string | undefined): string | undefined {
  return tela;
}

/** Registra sem esperar e sem nunca falhar. A tela, se não vier, é a atual. */
export function registrarLog(evento: EventoLog): void {
  try {
    registradorDoApp().registrar({ ...evento, tela: telaComoCaminho(evento.tela) ?? telaAtual() });
  } catch { /* log nunca derruba a operação */ }
}

/** Devolve a promessa (que nunca rejeita). Só o logout usa. */
export function registrarLogAguardando(evento: EventoLog): Promise<void> {
  try {
    return registradorDoApp().registrarAgora({ ...evento, tela: telaComoCaminho(evento.tela) ?? telaAtual() });
  } catch {
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------------------------------------
// Os pontos de captura (onde ligar cada um: pontos-de-captura.md)

/**
 * Erro de requisição visto pelo usuário. Chame do ponto ÚNICO em que o app traduz/reporta erro do
 * Supabase. 42501 (recusa de RLS ou de função) não é erro: é acesso negado.
 * Passe a mensagem já traduzida para a pessoa, o código do Postgres e, se houver, o contexto da
 * operação ("salvar cliente"). Nunca `details`, `hint` nem o corpo enviado. (O banco ainda mascara
 * CPF e valor de chave duplicada na mensagem.)
 */
export function registrarErroDeRequisicao(mensagem: string, codigo: string | undefined, contexto?: string): void {
  if (codigo === "42501") {
    registrarLog({ categoria: "acesso", nivel: "aviso", acao: "acesso_negado", resultado: "negado", mensagem, detalhe: { codigo, ...(contexto ? { contexto } : {}) } });
    return;
  }
  registrarLog({ categoria: "erro", nivel: "erro", acao: "erro_requisicao", resultado: "falha", mensagem, detalhe: { ...(codigo ? { codigo } : {}), ...(contexto ? { contexto } : {}) } });
}

/** Erro de JavaScript: a mensagem e as cinco primeiras linhas da pilha. Nada de dado de formulário. */
export function resumoDoErroJs(erro: unknown): { mensagem: string; pilha?: string } {
  if (erro instanceof Error) {
    const pilha = erro.stack?.split("\n").slice(0, 5).join("\n");
    return { mensagem: erro.message || erro.name, pilha };
  }
  return { mensagem: typeof erro === "string" ? erro : "Erro sem mensagem" };
}

export function registrarErroJs(erro: unknown, origem?: string): void {
  const { mensagem, pilha } = resumoDoErroJs(erro);
  registrarLog({
    categoria: "erro", nivel: "erro", acao: "erro_js", resultado: "falha",
    mensagem, detalhe: { ...(pilha ? { pilha } : {}), ...(origem ? { origem } : {}) },
  });
}

/** `window.onerror` e `unhandledrejection`: instale UMA vez, na raiz (antes do render). */
export function instalarCapturaDeErrosJs(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    // O navegador reclama disto sem que nada tenha quebrado; seria só ruído no log.
    if (/ResizeObserver loop/i.test(e.message)) return;
    registrarErroJs(e.error ?? e.message, "window");
  });
  window.addEventListener("unhandledrejection", (e) => registrarErroJs(e.reason, "promessa"));
}

// O login vira UM evento por sessão do navegador: o Supabase repete SIGNED_IN ao voltar para a
// aba, e a renovação do token não é entrada. A marca morre com a aba (sessionStorage).
const MARCA_LOGIN = "polobh.login_registrado";

/**
 * Chame quando a entrada se confirma. Na Pólobh o único caminho é e-mail e senha
 * (`entrarComEmail`, em src/store/auth.ts), e ela só vale depois de o perfil carregar ATIVO — por
 * isso o login é registrado ali, e não no `SIGNED_IN` (que dispara também para a conta inativa que
 * o app derruba em seguida, e de novo na conferência de senha da troca de senha). A marca em
 * `sessionStorage` continua: protege de um segundo registro na mesma aba.
 */
export function registrarLoginUmaVez(metodo: string): void {
  try {
    if (sessionStorage.getItem(MARCA_LOGIN)) return;
    sessionStorage.setItem(MARCA_LOGIN, "1");
  } catch { /* sem storage: registra mesmo assim, melhor repetir que perder */ }
  registrarLog({ categoria: "acesso", nivel: "info", acao: "login", resultado: "ok", detalhe: { metodo } });
}

/**
 * Chame ANTES do `supabase.auth.signOut()` e espere: depois dele não há sessão para autenticar a
 * RPC. Espera no máximo 1,5 s — o log nunca atrasa a saída — e esquece a marca do login.
 */
export async function registrarLogoutAntesDeSair(limiteMs = 1500): Promise<void> {
  await Promise.race([
    registrarLogAguardando({ categoria: "acesso", nivel: "info", acao: "logout", resultado: "ok" }),
    new Promise<void>((resolver) => setTimeout(resolver, limiteMs)),
  ]);
  try { sessionStorage.removeItem(MARCA_LOGIN); } catch { /* idem */ }
}

/**
 * Falha no formulário de senha do login. Vai por RPC própria (`registrar_falha_de_login`, liberada
 * ao anon): o banco fixa a ação, mascara o e-mail e freia por IP, com teto global.
 */
export function registrarFalhaDeLogin(email: string): void {
  if (typeof window === "undefined" || !rpcAtiva || !rpcInjetada) return;
  try {
    void Promise.resolve(rpcInjetada("registrar_falha_de_login", { p_email: email })).then(() => undefined, () => undefined);
  } catch { /* idem */ }
}

/** Rotas negadas já registradas nesta sessão do navegador: recarregar a página negada não enche o log. */
const rotasNegadasRegistradas = new Set<string>();

/** Chame quando o guarda de rota do app barrar o caminho. */
export function registrarRotaNegada(caminho: string): void {
  if (rotasNegadasRegistradas.has(caminho)) return;
  rotasNegadasRegistradas.add(caminho);
  registrarLog({ categoria: "acesso", nivel: "aviso", acao: "acesso_negado", resultado: "negado", tela: caminho, mensagem: "Rota sem permissão de ver" });
}

/**
 * Exportação de arquivo (CSV, planilha, PDF): o que saiu e de onde, nunca o conteúdo.
 * Quem chama, na prática, é o helper ÚNICO de download do app (`baixarArquivo`); chamada direta só
 * para o que não vira download (impressão, PDF em nova aba).
 */
export function registrarExportacao(tela: string | undefined, oQue: string, detalhe?: Record<string, unknown>): void {
  registrarLog({
    categoria: "atividade", nivel: "info", acao: "exportacao", resultado: "ok", tela,
    mensagem: oQue, detalhe,
  });
}
