import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

/**
 * Testes de unidade. Foco no domínio: as contas da EC decidem honorários,
 * encargos e faturamento — dinheiro que vai para documento de cliente e
 * fornecedor. Sem isso, uma refatoração podia mudar um total sem ninguém ver.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  define: { __APP_VERSION__: JSON.stringify("teste") },
  test: {
    // jsdom por causa do sanitizador de HTML, que depende de DOMParser.
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
