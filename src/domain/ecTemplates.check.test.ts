import { describe, expect, it } from "vitest";
import { TEMPLATE_CORPORATIVO, TEMPLATE_CULTURAL } from "./ecTemplates";

const itensDoBloco = (t: { grupo: string; item: string }[], grupo: string) =>
  t.filter((i) => i.grupo === grupo).map((i) => i.item);

describe("templates de EC", () => {
  it("EXTRAS aparece uma única vez no Corporativo", () => {
    expect(TEMPLATE_CORPORATIVO.filter((i) => i.grupo === "EXTRAS")).toHaveLength(1);
  });

  it("Cultural tem todos os itens de EQUIPE PRODUÇÃO do Corporativo", () => {
    const corporativo = itensDoBloco(TEMPLATE_CORPORATIVO, "EQUIPE PRODUÇÃO");
    const cultural = itensDoBloco(TEMPLATE_CULTURAL, "EQUIPE PRODUÇÃO");
    expect(corporativo).toEqual(["Despesas operacionais", "Equipe", "Transporte", "Alimentação"]);
    for (const item of corporativo) expect(cultural).toContain(item);
  });

  it("Corporativo mantém a contagem oficial de itens", () => {
    expect(TEMPLATE_CORPORATIVO).toHaveLength(155);
  });
});
