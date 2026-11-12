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
  it("os blocos do financeiro abrem com a produção, na fase dele e na do back-office", () => {
    expect(editaFinanceiro(os({ fase: "producao" }))).toBe(true);
    expect(editaFinanceiro(os({ fase: "direcao" }))).toBe(false);
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
    // A Produção preenche a OS inteira (12/11/2026): os blocos do Financeiro estão abertos a ela.
    expect(vezDoBloco("Financeiro", "producao")).toEqual({ vez: false, aberto: true, aviso: "Aberto à Produção nesta etapa" });
    expect(vezDoBloco("Direção de Produção", "producao").aviso).toBe("Abre na etapa da Direção de Produção");
    expect(vezDoBloco("Produção", "financeiro").aviso).toBe("Produção já concluiu — em leitura");
    expect(vezDoBloco("Financeiro", "financeiro").vez).toBe(true);
  });
  it("no back-office, o Financeiro segue aberto para correção; emitida, tudo em leitura", () => {
    expect(vezDoBloco("Back-office", "backoffice").vez).toBe(true);
    expect(vezDoBloco("Financeiro", "backoffice").aviso).toBe("Aberto ao Back-office para revisão");
    expect(vezDoBloco("Produção", "backoffice").aviso).toBe("Aberto ao Back-office para revisão");
    expect(vezDoBloco("Back-office", "emitida")).toEqual({ vez: false, aviso: "OS emitida — em leitura" });
  });
});

describe("Direção de Produção valida o contrato da OS cultural (11/11/2026)", async () => {
  const { comValidacaoDeContrato, fasesDoCaminho, RECURSO_DA_FASE } = await import("./faseOs");

  it("só a OS cultural COM contrato passa pela Direção", () => {
    expect(comValidacaoDeContrato(true, true)).toBe(true);
    expect(comValidacaoDeContrato(true, false)).toBe(false);
    expect(comValidacaoDeContrato(false, true)).toBe(false);
  });

  it("o caminho com validação ganha a etapa entre Produção e Financeiro", () => {
    expect(fasesDoCaminho(true)).toEqual(["producao", "direcao", "financeiro", "backoffice", "emitida"]);
    expect(proximaFase("producao", true)).toBe("direcao");
    expect(proximaFase("direcao", true)).toBe("financeiro");
    expect(faseAnterior("financeiro", true)).toBe("direcao");
    expect(faseAnterior("direcao", true)).toBe("producao");
  });

  it("sem validação o caminho é o de sempre", () => {
    expect(fasesDoCaminho(false)).toEqual(["producao", "financeiro", "backoffice", "emitida"]);
    expect(proximaFase("producao", false)).toBe("financeiro");
    expect(faseAnterior("financeiro", false)).toBe("producao");
    // Uma OS que já está com a Direção volta para a Produção de qualquer jeito.
    expect(faseAnterior("direcao", false)).toBe("producao");
  });

  it("a pendência da etapa vai para quem valida contrato", () => {
    expect(RECURSO_DA_FASE.direcao).toBe("oss.validarContrato");
  });

  it("o bloco da Direção é a vez dela só na etapa dela", () => {
    expect(vezDoBloco("Direção de Produção", "direcao").vez).toBe(true);
    expect(vezDoBloco("Direção de Produção", "producao").aviso).toBe("Abre na etapa da Direção de Produção");
    expect(vezDoBloco("Produção", "direcao").vez).toBe(false);
  });
});
