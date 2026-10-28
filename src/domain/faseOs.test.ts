import { describe, expect, it } from "vitest";
import { editaFinanceiro, editaProducao, faseAnterior, faseDaOs, osEmitida, proximaFase, vezDoBloco } from "./faseOs";
import type { Os } from "@/data/types";

const os = (p: Partial<Os>): Os => ({ status: "Rascunho", ...p }) as Os;

describe("faseDaOs — o padrão de quem veio antes das fases", () => {
  it("OS nova, sem fase gravada, está com a produção", () => {
    expect(faseDaOs(os({}))).toBe("producao");
  });

  // Uma OS que já saiu da casa não pode aparecer como "a produção está
  // montando": o documento existe do lado do fornecedor.
  it("OS antiga já emitida entra como emitida", () => {
    expect(faseDaOs(os({ status: "Emitida" }))).toBe("emitida");
  });

  it("a fase gravada manda sobre o palpite pelo status", () => {
    expect(faseDaOs(os({ status: "Emitida", fase: "financeiro" }))).toBe("financeiro");
  });
});

describe("o que cada fase deixa aberto", () => {
  it("a produção edita os blocos dela só na primeira fase", () => {
    expect(editaProducao(os({ fase: "producao" }))).toBe(true);
    expect(editaProducao(os({ fase: "financeiro" }))).toBe(false);
    expect(editaProducao(os({ fase: "backoffice" }))).toBe(false);
    expect(editaProducao(os({ fase: "emitida" }))).toBe(false);
  });

  // O back-office ainda corrige um código de serviço na hora de emitir.
  it("o financeiro edita na fase dele e na do back-office", () => {
    expect(editaFinanceiro(os({ fase: "producao" }))).toBe(false);
    expect(editaFinanceiro(os({ fase: "financeiro" }))).toBe(true);
    expect(editaFinanceiro(os({ fase: "backoffice" }))).toBe(true);
    expect(editaFinanceiro(os({ fase: "emitida" }))).toBe(false);
  });

  it("emitida, nada se edita — o que muda vira nova versão", () => {
    expect(osEmitida(os({ fase: "emitida" }))).toBe(true);
    expect(editaProducao(os({ fase: "emitida" }))).toBe(false);
    expect(editaFinanceiro(os({ fase: "emitida" }))).toBe(false);
  });
});

describe("caminho de ida e de volta", () => {
  it("avança na ordem do fluxo e para na última", () => {
    expect(proximaFase("producao")).toBe("financeiro");
    expect(proximaFase("financeiro")).toBe("backoffice");
    expect(proximaFase("backoffice")).toBe("emitida");
    expect(proximaFase("emitida")).toBeNull();
  });

  it("devolver é possível, e para na primeira", () => {
    expect(faseAnterior("backoffice")).toBe("financeiro");
    expect(faseAnterior("financeiro")).toBe("producao");
    expect(faseAnterior("producao")).toBeNull();
  });
});

describe("destaque dos blocos da vez", () => {
  it("destaca os blocos da área que está com a OS", () => {
    expect(vezDoBloco("Produção", "producao").vez).toBe(true);
    expect(vezDoBloco("Financeiro", "producao").aviso).toBe("Abre na etapa do Financeiro");
    expect(vezDoBloco("Produção", "financeiro").aviso).toBe("Produção já concluiu — em leitura");
    expect(vezDoBloco("Financeiro", "financeiro").vez).toBe(true);
  });
  it("no back-office, o Financeiro segue aberto para correção; emitida, tudo em leitura", () => {
    expect(vezDoBloco("Back-office", "backoffice").vez).toBe(true);
    expect(vezDoBloco("Financeiro", "backoffice").aviso).toBe("Aberto ao Back-office para correção");
    expect(vezDoBloco("Produção", "backoffice").aviso).toBe("Aberto ao Back-office para correção");
    expect(vezDoBloco("Back-office", "emitida")).toEqual({ vez: false, aviso: "OS emitida — em leitura" });
  });
});
