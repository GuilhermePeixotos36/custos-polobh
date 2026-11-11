import { describe, expect, it } from "vitest";
import { decidirAvisos } from "./avisosPendencias";

describe("aviso do navegador: o que avisar e o que lembrar", () => {
  it("primeira carga da sessão: nada é avisado, tudo vira marco zero", () => {
    const r = decidirAvisos({ jaAvisadas: [], atuais: ["a", "b"], primeiraCarga: true });
    expect(r.novas).toEqual([]);
    expect(r.memoria).toEqual(["a", "b"]);
  });

  it("depois do marco zero, só o que é novo vira aviso", () => {
    const r = decidirAvisos({ jaAvisadas: ["a", "b"], atuais: ["a", "b", "c"], primeiraCarga: false });
    expect(r.novas).toEqual(["c"]);
  });

  it("com mais de 500 lembradas, nenhuma pendência ainda aberta é esquecida (senão volta a ser avisada)", () => {
    const antigas = Array.from({ length: 600 }, (_, i) => `velha-${i}`);
    // "aberta" foi avisada lá no começo e continua aberta.
    const jaAvisadas = ["aberta", ...antigas];
    const r = decidirAvisos({ jaAvisadas, atuais: ["aberta"], primeiraCarga: false });
    expect(r.novas).toEqual([]);
    expect(r.memoria).toContain("aberta");
    expect(r.memoria.length).toBeLessThanOrEqual(500);
    // E na rodada seguinte ela continua calada.
    expect(decidirAvisos({ jaAvisadas: r.memoria, atuais: ["aberta"], primeiraCarga: false }).novas).toEqual([]);
  });
});
