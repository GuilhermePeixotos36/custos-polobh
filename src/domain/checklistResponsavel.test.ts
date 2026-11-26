import { describe, expect, it } from "vitest";
import { responsavelPelaFuncao } from "./checklist";

const porFuncao = {
  "Diretoria de Produção": ["Marisa M. Coelho"],
  "Back-office": ["Viviane Barreiros"],
  "Coordenação de Produção": ["Carol Estelian"],
  Desenvolvimento: ["Zeca", "Ana"],
};

describe("responsavelPelaFuncao", () => {
  it("Produção é o produtor do projeto", () => {
    expect(responsavelPelaFuncao(["Produção"], "Emanuelle Pessoa", porFuncao)).toBe("Emanuelle Pessoa");
    expect(responsavelPelaFuncao(["Produção Responsável"], "Emanuelle Pessoa", porFuncao)).toBe("Emanuelle Pessoa");
  });
  it("as demais funções vão para quem tem o cargo", () => {
    expect(responsavelPelaFuncao(["Back-office"], "Emanuelle", porFuncao)).toBe("Viviane Barreiros");
  });
  it("a primeira função que acha alguém decide", () => {
    expect(responsavelPelaFuncao(["Coordenação de Produção", "Produção"], "Emanuelle", porFuncao)).toBe("Carol Estelian");
    expect(responsavelPelaFuncao(["Assistente Financeiro", "Back-office"], "", porFuncao)).toBe("Viviane Barreiros");
    expect(responsavelPelaFuncao(["Produção", "Back-office"], "", porFuncao)).toBe("Viviane Barreiros");
  });
  it("mais de uma pessoa na função: a primeira em ordem alfabética", () => {
    expect(responsavelPelaFuncao(["Desenvolvimento"], "", porFuncao)).toBe("Ana");
  });
  it("ninguém na função: sem dono", () => {
    expect(responsavelPelaFuncao(["Assistente Financeiro"], "", porFuncao)).toBe("");
    expect(responsavelPelaFuncao(undefined, "Fulana", porFuncao)).toBe("");
  });
});

import { resumirChecklist } from "./checklist";
import type { Checklist, ItemChecklist, StatusChecklist } from "@/data/types";

const item = (status: StatusChecklist, dataLimite: string): ItemChecklist => ({
  id: Math.random().toString(), checklistId: "c", origemModeloItemId: "", titulo: "t", descricao: "", etapa: "",
  status, dataLimite, dataManual: false, concluidoEm: "", concluidoPor: "", responsavel: "", observacoes: [], oculto: false, ordem: 0,
});

describe("resumirChecklist — as contas fecham", () => {
  it("total = concluídas + não se aplica + abertas; abertas = atrasadas + vencendo + no prazo + sem data", () => {
    const c = { itens: [
      item("Concluído", "2026-11-01"), item("Não se aplica", "2026-11-01"),
      item("Pendente", "2026-11-20"), item("Em andamento", "2026-11-26"), item("Pendente", "2026-11-28"),
      item("Pendente", "2026-12-20"), item("Pendente", ""),
    ] } as unknown as Checklist;
    const r = resumirChecklist(c, "2026-11-26");
    expect(r).toMatchObject({ total: 7, concluidos: 1, naoSeAplica: 1, abertos: 5, atrasados: 1, proximos: 2, noPrazo: 1, semData: 1, contam: 6 });
    expect(r.concluidos + r.naoSeAplica + r.abertos).toBe(r.total);
    expect(r.atrasados + r.proximos + r.noPrazo + r.semData).toBe(r.abertos);
  });
});
