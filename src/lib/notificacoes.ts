/**
 * Notificações do sistema operacional — a do canto do Windows, a da barra do
 * celular.
 *
 * O sino dentro do app só avisa quem já está olhando para ele. As pendências
 * que importam são justamente as que aparecem enquanto a pessoa está em outra
 * coisa: um comentário cobrando resposta, uma OS que precisa ser emitida hoje.
 *
 * Duas coisas para saber antes de mexer aqui:
 *
 *  1. A permissão SÓ pode ser pedida a partir de um clique da pessoa. Navegador
 *     nenhum aceita `requestPermission()` no carregamento da página — e, pior,
 *     o Chrome pune o site que tenta, bloqueando o pedido de vez. Por isso
 *     `pedirPermissao` existe separado e é chamado pelo botão em Configurações.
 *
 *  2. No celular a notificação PRECISA vir do service worker; `new Notification`
 *     simplesmente não funciona no Android. Como o caminho do service worker
 *     também funciona no computador, é ele o preferido, e o `new Notification`
 *     fica só como reserva para o navegador que não registrou o worker.
 *
 * Com o app FECHADO o aviso é Web Push (`lib/push.ts`, 11/11/2026): o servidor
 * entrega ao service worker. Este arquivo cuida da permissão e do aviso local,
 * que segue valendo onde o push não existe (navegador sem suporte, iPhone fora
 * da Tela de Início).
 */

export type PermissaoNotificacao = "concedida" | "negada" | "nao-pedida" | "sem-suporte";

/** O navegador sabe notificar? (Safari antigo e webview de app não sabem.) */
export const temSuporte = (): boolean =>
  typeof window !== "undefined" && "Notification" in window;

export function permissaoAtual(): PermissaoNotificacao {
  if (!temSuporte()) return "sem-suporte";
  if (Notification.permission === "granted") return "concedida";
  if (Notification.permission === "denied") return "negada";
  return "nao-pedida";
}

/**
 * Pede a permissão. Chame SEMPRE de dentro de um clique — ver o comentário do
 * topo. Devolve o estado final, para a tela dizer o que aconteceu.
 */
export async function pedirPermissao(): Promise<PermissaoNotificacao> {
  if (!temSuporte()) return "sem-suporte";
  if (Notification.permission === "granted") return "concedida";
  if (Notification.permission === "denied") return "negada";
  try {
    const r = await Notification.requestPermission();
    return r === "granted" ? "concedida" : r === "denied" ? "negada" : "nao-pedida";
  } catch {
    return "nao-pedida";
  }
}

/** Registra o service worker que mostra as notificações (silencioso se falhar). */
export async function registrarWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    // Sem worker o app segue igual; só as notificações do celular ficam de fora.
    return null;
  }
}

export interface Aviso {
  titulo: string;
  corpo: string;
  /** Para onde levar quem clicar (caminho do app, ex.: "/projetos/123"). */
  url?: string;
  /**
   * Identidade do aviso. Dois avisos com a mesma tag se SUBSTITUEM em vez de
   * empilhar — é o que impede "3 pendências" e "4 pendências" de virarem duas
   * notificações concorrentes na bandeja.
   */
  tag?: string;
}

/**
 * Mostra o aviso. Prefere o service worker (único caminho que funciona no
 * celular) e cai para a notificação direta quando ele não está registrado.
 *
 * Não pede permissão: quem não concedeu não recebe nada, em silêncio. Pedir
 * aqui significaria um pop-up do navegador surgindo sozinho no meio do
 * trabalho, que é exatamente o que o passo 1 do topo evita.
 */
export async function notificar(aviso: Aviso): Promise<boolean> {
  if (permissaoAtual() !== "concedida") return false;

  const opcoes: NotificationOptions = {
    body: aviso.corpo,
    icon: "/icone-192.png",
    badge: "/icone-192.png",
    tag: aviso.tag,
    data: { url: aviso.url ? new URL(aviso.url, location.origin).href : location.origin },
  };

  try {
    const registro = await navigator.serviceWorker?.ready;
    if (registro) {
      await registro.showNotification(aviso.titulo, opcoes);
      return true;
    }
  } catch {
    // cai para o caminho direto
  }

  try {
    const n = new Notification(aviso.titulo, opcoes);
    if (aviso.url) {
      n.onclick = () => {
        window.focus();
        location.assign(aviso.url!);
        n.close();
      };
    }
    return true;
  } catch {
    return false;
  }
}
