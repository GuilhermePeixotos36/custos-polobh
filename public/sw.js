/**
 * Service worker do Pólobh — existe por causa das NOTIFICAÇÕES.
 *
 * No computador dá para notificar sem service worker (`new Notification`), mas
 * no celular não: o Android só mostra notificação de site que veio de um
 * service worker registrado. Como é o mesmo código nos dois lugares, tudo passa
 * por aqui.
 *
 * De propósito NÃO há cache de arquivos. Um app de custos que serve tela velha
 * de cache é pior do que um app que pede rede: a pessoa veria um valor que já
 * mudou e decidiria em cima dele. Quando houver necessidade de trabalhar sem
 * rede, isso vira uma decisão consciente, não um efeito colateral.
 */

// Assume o controle na primeira visita, sem esperar uma segunda aba fechar.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

/**
 * Clique na notificação: leva a pessoa AO LUGAR da pendência.
 *
 * Reaproveita a aba já aberta quando existe — abrir uma segunda aba do mesmo
 * sistema é o caminho mais curto para alguém editar a EC na aba errada e
 * perder o que digitou na outra.
 */
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = evento.notification.data && evento.notification.data.url;
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
      for (const aba of abas) {
        if ("focus" in aba) {
          if (destino && "navigate" in aba) aba.navigate(destino).catch(() => {});
          return aba.focus();
        }
      }
      return self.clients.openWindow(destino || "/");
    })
  );
});
