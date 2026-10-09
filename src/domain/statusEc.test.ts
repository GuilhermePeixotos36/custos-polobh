import { describe, expect, it } from "vitest";
import { aplicarMudancaDeStatus } from "./statusEc";
import type { EcLinha } from "@/data/types";

const l = (id: string, extra: Partial<EcLinha> = {}) =>
  ({ id, statusAprovacao: "Pendente", statusOs: "Pendente", contratoStatus: "Pendente", ...extra }) as EcLinha;

describe("mudar status sem editar a EC", () => {
  it("aprovar já pede a OS, só nos ids escolhidos", () => {
    const r = aplicarMudancaDeStatus([l("a"), l("b")], ["a"], { aprovacao: "OK" });
    expect(r[0]).toMatchObject({ statusAprovacao: "OK", statusOs: "Emitir" });
    expect(r[1].statusAprovacao).toBe("Pendente");
  });
  it("reverter desfaz só a OS que estava em Emitir", () => {
    const r = aplicarMudancaDeStatus(
      [l("a", { statusAprovacao: "OK", statusOs: "Emitir" }), l("b", { statusAprovacao: "OK", statusOs: "OK" })],
      ["a", "b"],
      { aprovacao: "Pendente" },
    );
    expect(r[0]).toMatchObject({ statusAprovacao: "Pendente", statusOs: "Pendente" });
    expect(r[1]).toMatchObject({ statusAprovacao: "Pendente", statusOs: "OK" });
  });
  it("OS e Contrato são escolhidos como vêm e nada mais muda", () => {
    const r = aplicarMudancaDeStatus([l("a")], ["a"], { os: "Emitir", contrato: "Não se Aplica" });
    expect(r[0]).toMatchObject({ statusAprovacao: "Pendente", statusOs: "Emitir", contratoStatus: "Não se Aplica" });
  });
});
