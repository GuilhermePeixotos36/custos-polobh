/**
 * Dados financeiros: ver e editar separados (12/11/2026). A matriz da área não
 * deixa "editar" existir sem "ver", e o padrão de cada nível respeita isso.
 */
import { describe, expect, it, vi } from "vitest";

// `auth` importa o cliente do banco; aqui só interessam as tabelas de permissão.
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

import { DADOS_FINANCEIROS, PERMISSOES, PERMISSOES_ESPECIAIS, TODOS_RECURSOS } from "./auth";

describe("dados financeiros", () => {
  it("cada linha da matriz tem 'ver'; 'editar' só onde faz sentido", () => {
    expect(DADOS_FINANCEIROS.map((d) => d.ver)).toEqual(["financeiro", "oss.financeiro", "rentabilidade"]);
    expect(DADOS_FINANCEIROS.find((d) => d.ver === "oss.financeiro")?.editar).toBe("oss.financeiro.editar");
    expect(DADOS_FINANCEIROS.find((d) => d.ver === "financeiro")?.editar).toBeUndefined();
  });

  it("nenhum padrão de nível edita sem ver", () => {
    for (const [papel, recursos] of Object.entries(PERMISSOES)) {
      for (const d of DADOS_FINANCEIROS) {
        if (d.editar && recursos.includes(d.editar)) {
          expect(recursos, `${papel}: ${d.editar} sem ${d.ver}`).toContain(d.ver);
        }
      }
    }
  });

  it("o Administrador tem os recursos novos, e a Produção padrão não ganha os blocos financeiros sozinha", () => {
    expect(TODOS_RECURSOS).toContain("oss.financeiro");
    expect(TODOS_RECURSOS).toContain("oss.financeiro.editar");
    expect(PERMISSOES.Producao).not.toContain("oss.financeiro");
  });

  it("as permissões especiais não repetem o que já está na matriz de dados financeiros", () => {
    const naMatriz = new Set(DADOS_FINANCEIROS.flatMap((d) => [d.ver, d.editar]));
    expect(PERMISSOES_ESPECIAIS.filter((p) => naMatriz.has(p.key))).toEqual([]);
  });
});
