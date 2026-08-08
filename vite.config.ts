import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
