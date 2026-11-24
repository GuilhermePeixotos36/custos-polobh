import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "@/router";
import { useAuth } from "@/store/auth";
import { useEmpresas } from "@/store/empresas";
// Figtree servida pelo próprio app (design system LSPRO): nada de Google Fonts em tempo de execução.
import "@fontsource-variable/figtree";
import "@/index.css";
import { tentarRecuperarErroDeChunk } from "@/lib/lazyComRecuperacao";
import { registrarWorker } from "@/lib/notificacoes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { instalarCapturaDeErrosJs } from "@/lib/logs/registrarLog";

// LOGS: erro solto (`window.onerror`) e promessa rejeitada sem tratamento vão para a aba Erros da
// tela Logs. Uma vez, antes do render.
instalarCapturaDeErrosJs();

window.addEventListener("vite:preloadError", (evento) => {
  const erro = (evento as Event & { payload?: unknown }).payload;
  if (tentarRecuperarErroDeChunk(erro)) evento.preventDefault();
});

// Service worker das notificações. Registrado no boot porque o registro em si
// não pede nada à pessoa — quem pede permissão é o botão em Configurações.
// Sem ele, o celular não mostra notificação nenhuma (ver lib/notificacoes).
void registrarWorker();

// Inicializa a sessão do Supabase e, com a sessão pronta, carrega as empresas
// do grupo (dados fiscais usados na geração da OS).
useAuth
  .getState()
  .bootstrap()
  .then(() => useEmpresas.getState().carregar());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </React.StrictMode>
);
