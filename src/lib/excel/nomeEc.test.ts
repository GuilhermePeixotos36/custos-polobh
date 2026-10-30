import { describe, expect, it } from "vitest";
import { nomeEcExcel } from "./nomeEc";
import type { Ec } from "@/data/types";

const ec = { numero: "EC – BM – Prêmio Jornalista – 2026 – V04", versao: 4, criadoEm: "2026-10-30T10:00:00.000Z" } as unknown as Ec;

describe("nome do arquivo da EC", () => {
  it("a completa é só o nome da EC; a financeira leva '- Financeiro'", () => {
    const completa = nomeEcExcel(ec, "completa");
    const financeiro = nomeEcExcel(ec, "financeiro");
    expect(completa).not.toMatch(/Completa/);
    expect(financeiro).toBe(completa.replace(/\.xlsx$/, " - Financeiro.xlsx"));
    expect(completa).toMatch(/em \d{2} \d{2} \d{2}\.xlsx$/);
  });
});
