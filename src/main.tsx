import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "@/router";
import { useAuth } from "@/store/auth";
import { useEmpresas } from "@/store/empresas";
import "@/index.css";
import { tentarRecuperarErroDeChunk } from "@/lib/lazyComRecuperacao";

window.addEventListener("vite:preloadError", (evento) => {
  const erro = (evento as Event & { payload?: unknown }).payload;
  if (tentarRecuperarErroDeChunk(erro)) evento.preventDefault();
});

// Inicializa a sessão do Supabase e, com a sessão pronta, carrega as empresas
// do grupo (dados fiscais usados na geração da OS).
useAuth
  .getState()
  .bootstrap()
  .then(() => useEmpresas.getState().carregar());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
