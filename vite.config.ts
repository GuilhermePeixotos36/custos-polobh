import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * Versão desta publicação. Vai para o código (`__APP_VERSION__`) e para o
 * arquivo `/version.json`; a aba aberta compara os dois e, quando há deploy
 * novo, oferece atualizar (ver `hooks/useVersaoDoApp`). Sem isto, quem deixa o
 * app aberto dias seguidos continua na versão velha — foi o caso da Marisa.
 */
const VERSAO = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || String(Date.now());

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: "polobh-versao",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ versao: VERSAO }) });
      },
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(VERSAO) },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: Number(process.env.PORT) || 5173, open: true },
  build: {
    rollupOptions: {
      output: {
        // Separa as bibliotecas grandes do bundle inicial. ExcelJS e PDF.js já
        // vinham em chunk próprio por serem importados sob demanda; aqui o que
        // sai do caminho crítico é o núcleo React/Router/Supabase, que antes
        // deixava o `index` em ~487 kB.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          dnd: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
        },
      },
    },
  },
});
