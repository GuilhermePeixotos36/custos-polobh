/**
 * O mapa recurso antigo ↔ tela × ação existe em DOIS lugares — a tabela
 * `private.acesso_recurso_legado` (migration 20261124150000) e `RECURSO_POR_PERMISSAO` (catálogo) —
 * e os dois têm de ser iguais: o banco espelha o grupo em `areas.recursos` e responde
 * `tem_recurso` por um, o front responde `useAuth().pode` pelo outro. Este teste lê o SQL da
 * própria migration, não uma cópia.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

// `auth` importa o cliente do banco; aqui só interessam as listas.
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

import { RECURSO_POR_PERMISSAO } from "@/config/acessos/catalogo";
import { TODOS_RECURSOS } from "@/store/auth";

// Da raiz do repositório (onde o vitest roda): no jsdom, `import.meta.url` não é file:.
const PASTA = resolve(process.cwd(), "supabase/migrations") + "/";
const ARQUIVO = readdirSync(PASTA).find((n) => n.endsWith("_acessos_grupos_de_permissao.sql"));

function mapaDaMigration(): { recurso: string; tela: string; acao: string }[] {
  const sql = readFileSync(`${PASTA}${ARQUIVO}`, "utf8");
  const bloco = sql.slice(sql.indexOf("MAPA-RECURSOS-INICIO"), sql.indexOf("MAPA-RECURSOS-FIM"));
  return [...bloco.matchAll(/\('([^']+)',\s*'([^']+)',\s*'([^']+)'\)/g)].map((m) => ({ recurso: m[1], tela: m[2], acao: m[3] }));
}

describe("mapa recurso ↔ permissão", () => {
  it("a migration existe e o mapa foi lido", () => {
    expect(ARQUIVO).toBeDefined();
    expect(mapaDaMigration().length).toBeGreaterThan(20);
  });

  it("o mapa da migration é o mesmo do catálogo", () => {
    const ordenar = (l: readonly { recurso: string; tela: string; acao: string }[]) =>
      [...l].map((m) => `${m.recurso}=${m.tela}|${m.acao}`).sort();
    expect(ordenar(mapaDaMigration())).toEqual(ordenar(RECURSO_POR_PERMISSAO));
  });

  it("todo recurso do app está no mapa (senão o grupo nunca o liberaria)", () => {
    const mapeados = new Set(RECURSO_POR_PERMISSAO.map((m) => m.recurso));
    expect(TODOS_RECURSOS.filter((r) => !mapeados.has(r))).toEqual([]);
  });
});
