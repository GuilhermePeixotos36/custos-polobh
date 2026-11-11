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
 * PUSH (11/11/2026): o aviso que chega com o app FECHADO.
 *
 * O servidor (`push-pendencias`) manda { titulo, corpo, url, tag }, cifrado para
 * este navegador. O navegador acorda este worker só para mostrar o aviso — por
 * isso todo push TEM de virar notificação (o Chrome cancela a inscrição de quem
 * recebe push "silencioso").
 */
self.addEventListener("push", (evento) => {
  let aviso = {};
  try {
    aviso = evento.data ? evento.data.json() : {};
  } catch (_) {
    aviso = { corpo: evento.data ? evento.data.text() : "" };
  }
  const url = new URL(aviso.url || "/projetos", self.location.origin).href;
  evento.waitUntil(
    self.registration.showNotification(aviso.titulo || "Pólobh", {
      body: aviso.corpo || "Há novidade para você no Pólobh.",
      // O "bh" da logo, legível em tamanho pequeno. (Até 11/11/2026 isto apontava
      // para um icone-192.png que era uma imagem quebrada.)
      icon: "/icone-aviso.png",
      badge: "/icone-badge.png",
      tag: aviso.tag || "polobh-pendencias",
      // Mesma tag substitui o aviso anterior; `renotify` faz o novo tocar/vibrar.
      renotify: true,
      data: { url },
    })
  );
});

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

/**
 * Rede primeiro, sem cache de conteúdo — e existe por DOIS motivos.
 *
 * 1. Sem um handler de `fetch`, o Chrome não considera o site instalável: o
 *    convite "Instalar aplicativo" não aparece no Android. E instalar como PWA
 *    é justamente o caminho da notificação no celular — sem isso, o recurso
 *    inteiro fica só no computador.
 *
 * 2. Quando a rede cai no meio de uma navegação, o navegador mostra a página de
 *    dinossauro dele, que não diz nada sobre o Pólobh. Aqui a pessoa recebe um
 *    aviso claro de que é a conexão, não o sistema.
 *
 * O que este handler NÃO faz, de propósito: guardar resposta nenhuma. Só
 * navegação passa por aqui (`mode: "navigate"`), e mesmo ela vai sempre à rede
 * primeiro; a página de aviso é montada na hora, não é uma cópia velha do app.
 * Dado de custo servido de cache é pior do que dado nenhum — a pessoa decidiria
 * em cima de um valor que já mudou.
 */
const PAGINA_SEM_REDE = `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sem conexão — Pólobh</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#E8EAEE;
       font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1F2430}
  main{max-width:22rem;padding:2rem;text-align:center}
  h1{font-size:1.25rem;margin:0 0 .5rem}
  p{margin:0 0 1.5rem;color:#5A6273}
  button{background:#F2820D;color:#fff;border:0;border-radius:.5rem;
         padding:.75rem 1.5rem;font:inherit;font-weight:600;cursor:pointer}
</style>
<main>
  <h1>Sem conexão</h1>
  <p>O Pólobh precisa de internet para mostrar os dados atualizados. Assim que a
     conexão voltar, é só tentar de novo.</p>
  <button onclick="location.reload()">Tentar de novo</button>
</main></html>`;

self.addEventListener("fetch", (evento) => {
  if (evento.request.mode !== "navigate") return;
  evento.respondWith(
    fetch(evento.request).catch(
      () =>
        new Response(PAGINA_SEM_REDE, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
    )
  );
});
