import { describe, expect, it } from "vitest";
import { liberarItensDaOsExcluida, osComStatus } from "./loteOs";
import type { EcLinha, Os } from "@/data/types";

const AGORA = "2026-11-27T12:00:00.000Z";
const os = (p: Partial<Os>): Os => ({ id: "o1", status: "Ativa", fase: "financeiro", faseEm: "2026-11-01T00:00:00.000Z", ecLinhaIds: [], ...p }) as Os;
const linha = (id: string, statusOs: string): EcLinha => ({ id, statusOs }) as EcLinha;

describe("status da OS trocado em lote", () => {
  it("Emitida leva a etapa para 'emitida' e carimba a data", () => {
    const r = osComStatus(os({}), "Emitida", AGORA);
    expect([r.status, r.fase, r.faseEm]).toEqual(["Emitida", "emitida", AGORA]);
  });
  it("Ativa: a que estava emitida volta para o Back-office", () => {
    const r = osComStatus(os({ status: "Emitida", fase: "emitida" }), "Ativa", AGORA);
    expect([r.status, r.fase, r.faseEm]).toEqual(["Ativa", "backoffice", AGORA]);
  });
  it("Ativa: a arquivada no meio do caminho volta para onde estava, sem mexer na data da etapa", () => {
    const r = osComStatus(os({ status: "Arquivada" }), "Ativa", AGORA);
    expect([r.status, r.fase, r.faseEm]).toEqual(["Ativa", "financeiro", "2026-11-01T00:00:00.000Z"]);
  });
  it("Arquivada só muda o status", () => {
    const r = osComStatus(os({}), "Arquivada", AGORA);
    expect([r.status, r.fase]).toEqual(["Arquivada", "financeiro"]);
  });
  it("status igual ao atual: a mesma OS, nada a gravar", () => {
    const o = os({});
    expect(osComStatus(o, "Ativa", AGORA)).toBe(o);
  });
});

describe("itens da EC liberados quando a OS é excluída", () => {
  it("o item que perdeu a única OS volta para 'Emitir'", () => {
    const r = liberarItensDaOsExcluida([linha("1", "OK"), linha("2", "OK")], ["1"], []);
    expect(r.liberados).toBe(1);
    expect(r.linhas.map((l) => l.statusOs)).toEqual(["Emitir", "OK"]);
  });
  it("item coberto por outra OS viva não muda; OS arquivada não segura o item", () => {
    const linhas = [linha("1", "OK"), linha("2", "Emitir Nova Versão")];
    const r = liberarItensDaOsExcluida(linhas, ["1", "2"], [
      { status: "Emitida", ecLinhaIds: ["1"] },
      { status: "Arquivada", ecLinhaIds: ["2"] },
    ]);
    expect(r.linhas.map((l) => l.statusOs)).toEqual(["OK", "Emitir"]);
  });
  it("nada a liberar: devolve as mesmas linhas", () => {
    const linhas = [linha("1", "Pendente")];
    const r = liberarItensDaOsExcluida(linhas, ["1"], []);
    expect(r.liberados).toBe(0);
    expect(r.linhas).toBe(linhas);
  });
});
