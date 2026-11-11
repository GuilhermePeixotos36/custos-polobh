/**
 * WEB PUSH no navegador (11/11/2026): o aviso que chega com o app FECHADO.
 *
 * O aviso local (`notificacoes.ts`) só existe enquanto alguma aba do Pólobh
 * está aberta. O push é diferente: o navegador entrega a mensagem do servidor
 * ao service worker mesmo fechado (no Windows, basta o Chrome/Edge seguir rodando
 * em segundo plano; no Android, sempre; no iPhone, só com o Pólobh adicionado à
 * Tela de Início).
 *
 * Duas peças moram aqui:
 *  · a INSCRIÇÃO deste aparelho (`sincronizarInscricao`, `ativarPush`), e
 *  · o REPASSE (`repassarPendencias`): este app, aberto, calcula as pendências
 *    de quem tem aparelho inscrito e manda ao servidor, que só avisa o que é novo.
 */
import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";
import { registrarWorker, permissaoAtual } from "@/lib/notificacoes";
import { avisosParaPush, chaveEnvio, type PessoaComPush } from "@/domain/pushPendencias";
import type { Pendencia } from "@/domain/pendencias";

const FUNCAO = "push-pendencias";

async function chamar<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FUNCAO, { body });
  if (error) throw new Error((error as { message?: string }).message ?? "Falha no aviso por push.");
  const r = data as { ok?: boolean; erro?: string };
  if (!r?.ok) throw new Error(r?.erro ?? "Falha no aviso por push.");
  return data as T;
}

/** O navegador sabe receber push? (iPhone só dentro do app da Tela de Início.) */
export function pushSuportado(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iPhone/iPad no Safari comum: o push só existe com o Pólobh na Tela de Início. */
export function iosForaDaTelaDeInicio(): boolean {
  if (typeof navigator === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalado =
    (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches) ||
    (navigator as { standalone?: boolean }).standalone === true;
  return ios && !instalado;
}

let chaveCache: string | null = null;
async function chavePublica(): Promise<Uint8Array<ArrayBuffer>> {
  if (!chaveCache) chaveCache = (await chamar<{ chave: string }>({ acao: "chave" })).chave;
  const b64 = chaveCache.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const b64url = (buf: ArrayBuffer | null) =>
  buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "";

/**
 * Em que pé está o push NESTE aparelho — observável, para a tela dizer a
 * verdade (11/11/2026). Antes a tela afirmava "avisos ligados, mesmo com o
 * navegador fechado" assim que a permissão estava dada, e quando o registro do
 * aparelho falhava o erro ia só para o console: a pessoa achava que estava
 * ligado, e o aviso nunca chegava.
 *
 *  · inativo    — ainda não tentou (sem permissão, ou aguardando as pendências);
 *  · verificando — registrando o aparelho agora;
 *  · ativo      — o servidor tem este aparelho e vai entregar com o app fechado;
 *  · falhou     — a permissão está dada, mas o registro não deu certo (`erro`).
 */
export type EstadoPush = "inativo" | "verificando" | "ativo" | "falhou";
export const usePushEstado = create<{ estado: EstadoPush; erro: string }>(() => ({ estado: "inativo", erro: "" }));
const definir = (estado: EstadoPush, erro = "") => usePushEstado.setState({ estado, erro });

/** Este aparelho está recebendo push agora? (lido por quem decide o aviso local) */
export const pushAtivoNesteAparelho = () => usePushEstado.getState().estado === "ativo";

/** Endpoint inscrito por último — é o que sai da base quando a pessoa sai do app. */
let endpointAtual: string | null = null;

/**
 * Garante que ESTE aparelho está inscrito em nome de quem está logado.
 *
 * Com a permissão já dada, inscreve sem perguntar nada — é o que faz quem ligou
 * as notificações antes do push existir passar a receber com o app fechado.
 * `idsAtuais` são as pendências que a pessoa já tem: entram como já avisadas
 * quando o aparelho é novo para ela (o servidor decide), para não chegar uma
 * enxurrada de avisos no primeiro minuto.
 */
export async function sincronizarInscricao(idsAtuais: string[]): Promise<boolean> {
  if (!pushSuportado() || permissaoAtual() !== "concedida") {
    definir("inativo");
    return false;
  }
  definir("verificando");
  try {
    const registro = (await registrarWorker()) ?? (await navigator.serviceWorker.ready);
    if (!registro?.pushManager) {
      definir("falhou", "este navegador não deixou registrar o serviço de avisos");
      return false;
    }
    let inscricao = await registro.pushManager.getSubscription();
    if (!inscricao) {
      inscricao = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: await chavePublica(),
      });
    }
    await chamar({
      acao: "inscrever",
      inscricao: {
        endpoint: inscricao.endpoint,
        p256dh: b64url(inscricao.getKey("p256dh")),
        auth: b64url(inscricao.getKey("auth")),
      },
      userAgent: navigator.userAgent.slice(0, 300),
      ids: idsAtuais,
    });
    endpointAtual = inscricao.endpoint;
    definir("ativo");
    return true;
  } catch (e) {
    definir("falhou", (e as Error).message || "erro desconhecido");
    throw e;
  }
}

/** Ao sair do app: o aparelho para de receber os avisos de quem saiu. */
export async function desligarNesteAparelho(): Promise<void> {
  const endpoint = endpointAtual;
  definir("inativo");
  endpointAtual = null;
  if (!endpoint) return;
  try {
    await chamar({ acao: "desinscrever", endpoint });
  } catch {
    /* sair do app não pode falhar por causa do aviso */
  }
}

/** Manda um push de teste aos aparelhos de quem está logado. */
export async function testarPush(): Promise<number> {
  const r = await chamar<{ enviados: number }>({ acao: "teste" });
  return r.enviados ?? 0;
}

/* ───────────────────────────── repasse ───────────────────────────── */

const jaEnviadas = new Set<string>();
let pessoasCache: { em: number; lista: PessoaComPush[] } | null = null;
let repassando = false;
/** Carga que chegou durante um repasse: vai logo em seguida, com a lista mais nova. */
let proximo: { itens: Pendencia[]; padrao: (papel: string) => readonly string[] } | null = null;

/** Quem tem aparelho inscrito, com nome, papel e recursos da área. */
async function pessoasComPush(): Promise<PessoaComPush[]> {
  if (pessoasCache && Date.now() - pessoasCache.em < 2 * 60_000) return pessoasCache.lista;
  const { data: ids, error } = await supabase.rpc("usuarios_com_push");
  if (error) throw error;
  const lista = (ids ?? []) as unknown[];
  const uuids = lista.map((x) => (typeof x === "string" ? x : String(Object.values(x as object)[0])));
  let pessoas: PessoaComPush[] = [];
  if (uuids.length) {
    const { data, error: e2 } = await supabase
      .from("perfis")
      .select("id, nome, papel, ativo, areas(recursos)")
      .in("id", uuids);
    if (e2) throw e2;
    pessoas = (data ?? [])
      .filter((p) => (p as { ativo?: boolean }).ativo !== false)
      .map((p) => {
        const bruto = (p as { areas?: { recursos: string[] | null } | { recursos: string[] | null }[] | null }).areas;
        const area = Array.isArray(bruto) ? bruto[0] : bruto;
        return {
          id: p.id as string,
          nome: (p.nome as string) ?? "",
          papel: (p.papel as string) ?? "",
          recursos: area?.recursos ?? null,
        };
      });
  }
  pessoasCache = { em: Date.now(), lista: pessoas };
  return pessoas;
}

/**
 * Repassa ao servidor as pendências de quem tem aparelho inscrito. Chamado a
 * cada carga das pendências (que já acontece em tempo real). Falha aqui é
 * silenciosa: o sino e o aviso local seguem funcionando.
 */
export async function repassarPendencias(
  itens: Pendencia[],
  padraoDoPapel: (papel: string) => readonly string[],
): Promise<void> {
  if (repassando) {
    proximo = { itens, padrao: padraoDoPapel };
    return;
  }
  repassando = true;
  try {
    const pessoas = await pessoasComPush();
    if (!pessoas.length) return;
    const avisos = avisosParaPush(itens, pessoas, padraoDoPapel, jaEnviadas);
    if (!avisos.length) return;
    await chamar({ acao: "avisar", avisos });
    for (const a of avisos) for (const p of a.pendencias) jaEnviadas.add(chaveEnvio(a.userId, p.id));
  } catch (e) {
    console.warn("[push] repasse indisponível:", (e as Error).message);
  } finally {
    repassando = false;
    const p = proximo;
    proximo = null;
    if (p) void repassarPendencias(p.itens, p.padrao);
  }
}

/** A lista de quem tem push mudou (alguém acabou de ligar): relê na próxima. */
export function esquecerPessoasComPush(): void {
  pessoasCache = null;
}


/** O que aconteceu quando a pessoa clicou em "Ativar avisos". */
export type ResultadoAtivacao = "ativo" | "negada" | "ignorada" | "sem-push" | "falhou" | "sem-suporte";

/**
 * "Ativar avisos": pede a permissão (só funciona a partir de um clique) e
 * registra o aparelho. Devolve o que houve, para a tela NUNCA ficar muda — um
 * pedido fechado sem escolha ou bloqueado em silêncio pelo Chrome parecia, para
 * quem clicou, um botão que não faz nada.
 */
export async function ativarAvisos(idsAtuais: string[]): Promise<ResultadoAtivacao> {
  const { pedirPermissao } = await import("@/lib/notificacoes");
  const permissao = await pedirPermissao();
  if (permissao === "sem-suporte") return "sem-suporte";
  if (permissao === "negada") return "negada";
  if (permissao !== "concedida") return "ignorada";
  if (!pushSuportado()) return "sem-push";
  try {
    const ok = await sincronizarInscricao(idsAtuais);
    if (ok) esquecerPessoasComPush();
    return ok ? "ativo" : "falhou";
  } catch {
    return "falhou";
  }
}
