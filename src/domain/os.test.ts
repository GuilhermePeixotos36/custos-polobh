import { describe, expect, it } from "vitest";
import { itensDaOs } from "./os";
import type { Ec, EcLinha, Os } from "@/data/types";

const linha = (p: Partial<EcLinha>): EcLinha =>
  ({
    id: "l1", grupo: "AUDIOVISUAL", item: "Sonorização", descricao: "", ordem: 0,
    ...p,
  }) as EcLinha;

const ec = (linhas: EcLinha[]): Ec => ({ id: "ec1", linhas }) as unknown as Ec;
const os = (ecLinhaIds: string[], ecId = "ec1"): Pick<Os, "ecId" | "ecLinhaIds"> => ({ ecId, ecLinhaIds });

describe("itens que cada OS consolida", () => {
  const linhas = [
    linha({ id: "a", item: "Sonorização", ordem: 1 }),
    linha({ id: "b", item: "Iluminação cênica", ordem: 0 }),
    linha({ id: "c", item: "Coffee break", grupo: "GASTRONOMIA", ordem: 2 }),
  ];

  it("traz só os itens da OS, na ordem da EC", () => {
    const itens = itensDaOs(os(["a", "b"]), [ec(linhas)]);
    expect(itens.map((i) => i.item)).toEqual(["Iluminação cênica", "Sonorização"]);
    expect(itens[0].grupo).toBe("AUDIOVISUAL");
  });

  it("OS sem vínculo com item nenhum não mostra caixinha", () => {
    expect(itensDaOs(os([]), [ec(linhas)])).toEqual([]);
  });

  it("EC fora da lista carregada devolve vazio, em vez de quebrar", () => {
    expect(itensDaOs(os(["a"], "outra-ec"), [ec(linhas)])).toEqual([]);
    expect(itensDaOs(os(["a"]), [])).toEqual([]);
  });

  it("id que não existe mais na EC é ignorado", () => {
    expect(itensDaOs(os(["a", "sumiu"]), [ec(linhas)]).map((i) => i.id)).toEqual(["a"]);
  });

  it("item sem nome se identifica pela descrição e, em último caso, se anuncia", () => {
    const semNome = [linha({ id: "x", item: "", descricao: "Locação de praticáveis" }), linha({ id: "y", item: "" })];
    const itens = itensDaOs(os(["x", "y"]), [ec(semNome)]);
    expect(itens[0].item).toBe("Locação de praticáveis");
    expect(itens[1].item).toBe("(item sem nome)");
  });
});
