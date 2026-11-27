import { describe, expect, it } from "vitest";
import { comContratoReativadoPelaEc, dispensaDeContratoPendente, temContrato } from "@/domain/os";
import type { Os } from "@/data/types";

const contrato = (extra: Partial<Os["contrato"]> = {}) =>
  ({ informacoesComplementares: "", rubrica: "", ...extra }) as Os["contrato"];
const linha = (contratoStatus: string) => ({ contratoStatus }) as { contratoStatus: "Emitir" };

describe("contrato dispensado pela OS", () => {
  it("sem a marca, quem decide é a coluna Contrato da EC", () => {
    expect(temContrato({ contrato: contrato() }, [linha("Emitir")])).toBe(true);
    expect(temContrato({ contrato: contrato() }, [linha("Não se Aplica")])).toBe(false);
  });

  it("com a marca não há contrato, mesmo com a EC pedindo ou com o bloco já digitado", () => {
    expect(temContrato({ contrato: contrato({ naoSeAplica: true }) }, [linha("Emitir")])).toBe(false);
    expect(
      temContrato({ contrato: contrato({ naoSeAplica: true, informacoesComplementares: "cláusula extra" }) }, [linha("Não se Aplica")])
    ).toBe(false);
  });

  it("a dispensa está pendente enquanto a marca está ligada e a EC ainda pede contrato", () => {
    expect(dispensaDeContratoPendente({ contrato: contrato({ naoSeAplica: true }) }, [linha("Emitir")])).toBe(true);
    expect(dispensaDeContratoPendente({ contrato: contrato({ naoSeAplica: true }) }, [linha("Emitir Nova Versão"), linha("OK")])).toBe(true);
    // Já chegou à EC: não há mais o que levar.
    expect(dispensaDeContratoPendente({ contrato: contrato({ naoSeAplica: true }) }, [linha("Não se Aplica")])).toBe(false);
    expect(dispensaDeContratoPendente({ contrato: contrato() }, [linha("Emitir")])).toBe(false);
  });

  it("se a EC volta a pedir contrato, a marca da OS gravada é desfeita", () => {
    const os = { contrato: contrato({ naoSeAplica: true, rubrica: "1.2" }) };
    const reativada = comContratoReativadoPelaEc(os, [linha("Emitir")]);
    expect(reativada.contrato.naoSeAplica).toBeUndefined();
    expect(reativada.contrato.rubrica).toBe("1.2"); // o que estava digitado continua lá
    expect(temContrato(reativada, [linha("Emitir")])).toBe(true);
    // EC continua sem pedir: a OS fica como está.
    expect(comContratoReativadoPelaEc(os, [linha("Não se Aplica")])).toBe(os);
  });
});
