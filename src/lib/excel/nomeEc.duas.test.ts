import { describe, expect, it } from "vitest";
import { nomeEcExcel } from "./nomeEc";
import type { Ec } from "@/data/types";
import { projetoInfoVazio } from "@/domain/projeto";

describe("Salvar na pasta grava as duas planilhas (11/11/2026)", () => {
  it("mesma versão nos dois nomes; a reduzida leva \" - Financeiro\"", () => {
    const ec = {
      versao: 3, criadoEm: "2026-11-11T12:00:00Z", numero: "EC – ACME – V03",
      projeto: { ...projetoInfoVazio(), titulo: "BM – Prêmio Jornalista – 2026" },
    } as unknown as Ec;
    const completa = nomeEcExcel(ec, "completa");
    const financeiro = nomeEcExcel(ec, "financeiro");
    expect(completa).toBe("EC – BM – Prêmio Jornalista – 2026 (03) em 11 11 26.xlsx");
    expect(financeiro).toBe("EC – BM – Prêmio Jornalista – 2026 (03) em 11 11 26 - Financeiro.xlsx");
  });
});
