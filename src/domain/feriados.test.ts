import { describe, expect, it } from "vitest";
import {
  feriadosDaApi, feriadosDoAno, indiceDeFeriados, pendenciaDeFeriados, responsavelPadraoDosFeriados,
  type Feriado, type FeriadosGuardados,
} from "./feriados";

const guardados = (p: Partial<FeriadosGuardados> = {}): FeriadosGuardados => ({
  municipais: {},
  nacionais: {},
  ...p,
});

describe("feriados do ano", () => {
  it("junta nacionais e municipais, em ordem de data", () => {
    const lista = feriadosDoAno(
      guardados({
        nacionais: { "2026": [{ data: "2026-09-07", nome: "Independência", origem: "nacional" }] },
        municipais: { "2026": [{ data: "2026-08-15", nome: "Assunção", origem: "municipal" }] },
      }),
      2026
    );
    expect(lista.map((f) => f.data)).toEqual(["2026-08-15", "2026-09-07"]);
  });

  // Quem lançou o municipal é alguém da casa, que sabe como a cidade chama
  // aquele dia — e a API nacional não conhece o nome local.
  it("na mesma data, vence o municipal", () => {
    const lista = feriadosDoAno(
      guardados({
        nacionais: { "2026": [{ data: "2026-12-08", nome: "Feriado", origem: "nacional" }] },
        municipais: { "2026": [{ data: "2026-12-08", nome: "Nossa Senhora da Conceição", origem: "municipal" }] },
      }),
      2026
    );
    expect(lista).toHaveLength(1);
    expect(lista[0].nome).toBe("Nossa Senhora da Conceição");
  });

  it("ano sem nada devolve lista vazia, e não quebra", () => {
    expect(feriadosDoAno(guardados(), 2026)).toEqual([]);
    expect(feriadosDoAno(undefined, 2026)).toEqual([]);
  });

  it("o índice acha pelo dia", () => {
    const i = indiceDeFeriados([{ data: "2026-09-07", nome: "Independência", origem: "nacional" }]);
    expect(i.get("2026-09-07")?.nome).toBe("Independência");
    expect(i.has("2026-09-08")).toBe(false);
  });
});

describe("resposta da BrasilAPI", () => {
  it("converte o que vem no formato esperado", () => {
    expect(feriadosDaApi([{ date: "2026-09-07", name: "Independência do Brasil", type: "national" }])).toEqual([
      { data: "2026-09-07", nome: "Independência do Brasil", origem: "nacional" },
    ]);
  });

  // Uma resposta estranha — um erro em HTML, uma mudança de contrato da API —
  // não pode virar feriado no quadro do ano.
  it("descarta o que não tem data no formato, e aguenta lixo", () => {
    expect(feriadosDaApi([{ date: "07/09/2026", name: "x" }, { name: "sem data" }, null, 7])).toEqual([]);
    expect(feriadosDaApi("<html>erro</html>")).toEqual([]);
    expect(feriadosDaApi(undefined)).toEqual([]);
  });

  it("feriado sem nome não fica sem rótulo na tela", () => {
    expect(feriadosDaApi([{ date: "2026-09-07", name: "  " }])[0].nome).toBe("Feriado");
  });
});

describe("lembrete de janeiro", () => {
  const g0 = (municipais: Record<string, Feriado[]> = {}) => ({ municipais, nacionais: {} });

  it("em janeiro, sem municipais lançados, cobra o responsável", () => {
    const p = pendenciaDeFeriados({ hoje: "2027-01-10", guardados: g0(), responsavel: "Tiago" });
    expect(p?.pessoas).toEqual(["Tiago"]);
    expect(p?.ano).toBe(2027);
  });

  it("some quando o ano já tem feriado municipal lançado", () => {
    const g = g0({ "2027": [{ data: "2027-08-15", nome: "Assunção", origem: "municipal" }] });
    expect(pendenciaDeFeriados({ hoje: "2027-01-10", guardados: g, responsavel: "Tiago" })).toBeNull();
  });

  it("só existe em janeiro e só com alguém a quem cobrar", () => {
    expect(pendenciaDeFeriados({ hoje: "2027-02-01", guardados: g0(), responsavel: "Tiago" })).toBeNull();
    expect(pendenciaDeFeriados({ hoje: "2027-01-10", guardados: g0(), responsavel: "" })).toBeNull();
  });

  it("o padrão é o Tiago, entre os usuários ativos", () => {
    expect(responsavelPadraoDosFeriados([{ nome: "Marisa" }, { nome: "Tiago Alves" }])).toBe("Tiago Alves");
    expect(responsavelPadraoDosFeriados([{ nome: "Tiago", ativo: false }])).toBe("");
  });
});
