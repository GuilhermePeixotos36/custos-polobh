import { describe, expect, it } from "vitest";
import {
  calcularDataLimite,
  diasEntre,
  gerarChecklist,
  janelaDoProjeto,
  recalcularPrazos,
  segundaDaSemana,
  semanasDeReferencia,
  somarDiasUteis,
  type JanelaProjeto,
} from "./checklist";
import { projetoInfoVazio } from "@/domain/projeto";
import type { ItemModeloChecklist, ModeloChecklist, Projeto, RegraPrazoChecklist } from "@/data/types";

/**
 * As réguas da lista padrão da Pólobh (01/10/2026): "segunda-feira da Nª semana
 * antes do evento" (que se adapta à janela do projeto), data de trabalho do
 * cronograma, dias úteis e semanas depois do evento.
 *
 * Calendário de apoio — quarta-feira 2026-11-18 é o evento; a segunda da sua
 * semana é 2026-11-16.
 */
const EVENTO = "2026-11-18";

const faixa = (data: string) => ({ id: data, data, inicio: "", fim: "" });

function projeto(opcoes: {
  criadoEm?: string;
  evento?: string;
  montagem?: string[];
  alinhamentos?: string[];
  eventoDias?: string[];
  desmontagem?: string[];
  produtora?: string;
}): Projeto {
  const info = projetoInfoVazio();
  const evento = opcoes.evento ?? EVENTO;
  info.evento = evento;
  info.produtoraResponsavel = opcoes.produtora ?? "";
  info.cronograma = {
    montagem: (opcoes.montagem ?? []).map(faixa),
    alinhamentos: (opcoes.alinhamentos ?? []).map(faixa),
    ensaios: [],
    evento: (opcoes.eventoDias ?? [evento]).map(faixa),
    desmontagem: (opcoes.desmontagem ?? []).map(faixa),
  };
  return {
    id: "p1",
    nome: "Projeto",
    cliente: {} as Projeto["cliente"],
    info,
    docsUrl: "",
    status: "Ativo",
    criadoEm: opcoes.criadoEm ?? "2026-09-02",
    atualizadoEm: "2026-09-02",
  };
}

const semanasAntes = (semanas: number, fixo = false): RegraPrazoChecklist => ({
  modo: "semanas-antes",
  semanas,
  ...(fixo ? { fixo } : {}),
});

const modeloCom = (regras: RegraPrazoChecklist[], extra: Partial<ItemModeloChecklist> = {}): ModeloChecklist => ({
  id: "m",
  modalidade: "Cultural",
  nome: "Cultural",
  atualizadoEm: "",
  itens: regras.map((prazo, n) => ({
    id: `mi-${n}`,
    titulo: `Tarefa ${n}`,
    descricao: "",
    etapa: "ETAPA 1",
    prazo,
    responsavelPadrao: "",
    funcoes: [],
    ordem: n,
    ...extra,
  })),
});

function janela(p: Projeto, regras: RegraPrazoChecklist[]): JanelaProjeto {
  return janelaDoProjeto(p, { modelo: modeloCom(regras) });
}

describe("dias úteis e semanas", () => {
  it("segunda-feira da semana de qualquer dia", () => {
    expect(segundaDaSemana("2026-11-18")).toBe("2026-11-16"); // quarta
    expect(segundaDaSemana("2026-11-16")).toBe("2026-11-16"); // a própria segunda
    expect(segundaDaSemana("2026-11-22")).toBe("2026-11-16"); // domingo fecha a semana
  });

  it("soma dias úteis pulando fim de semana e feriado", () => {
    expect(somarDiasUteis("2026-11-20", 1)).toBe("2026-11-23"); // sexta -> segunda
    expect(somarDiasUteis("2026-11-20", 4)).toBe("2026-11-26");
    expect(somarDiasUteis("2026-11-20", 1, new Set(["2026-11-23"]))).toBe("2026-11-24");
  });
});

describe("semanas antes do evento — escala de manual", () => {
  const regras = [semanasAntes(11), semanasAntes(6), semanasAntes(1)];

  it("com a janela de manual, cada tarefa cai na segunda-feira que a lista escreve", () => {
    // projeto criado exatamente na segunda da 11ª semana antes do evento
    const p = projeto({ criadoEm: "2026-08-31" });
    const j = janela(p, regras);
    expect(segundaDaSemana(EVENTO)).toBe("2026-11-16");
    // 11 semanas antes de 16/11 = 31/08
    expect(calcularDataLimite(semanasAntes(11), j)).toBe("2026-08-31");
    expect(calcularDataLimite(semanasAntes(6), j)).toBe("2026-10-05");
    expect(calcularDataLimite(semanasAntes(1), j)).toBe("2026-11-09");
  });

  it("semanasReferencia sai da tarefa mais antecipada da lista", () => {
    expect(semanasDeReferencia(modeloCom(regras))).toBe(11);
    expect(semanasDeReferencia(modeloCom([semanasAntes(11, true), semanasAntes(4)]))).toBe(4);
    expect(semanasDeReferencia(undefined)).toBe(0);
  });
});

describe("semanas antes do evento — adaptação à janela", () => {
  const regras = [semanasAntes(11), semanasAntes(6), semanasAntes(1)];

  it("projeto criado em cima da hora: a lista inteira se comprime e mantém a ordem", () => {
    const p = projeto({ criadoEm: "2026-11-04" }); // 14 dias antes do evento
    const j = janela(p, regras);
    const datas = regras.map((r) => calcularDataLimite(r, j));
    // a tarefa mais antecipada vence no dia em que o projeto nasceu
    expect(datas[0]).toBe("2026-11-04");
    // e todas ficam entre o nascimento e o evento, em ordem
    expect([...datas].sort()).toEqual(datas);
    for (const d of datas) {
      expect(d >= "2026-11-04").toBe(true);
      expect(d <= EVENTO).toBe(true);
    }
  });

  it("mantém a proporção: a tarefa da metade do caminho fica na metade da janela", () => {
    // manual: 11 semanas antes = 77 dias até a segunda 16/11; evento é 2 dias depois (79 dias).
    const p = projeto({ criadoEm: "2026-10-09" }); // janela real de 40 dias
    const j = janela(p, regras);
    const manualMax = 7 * 11 + 2;
    const manual6 = 7 * 6 + 2;
    const esperado = Math.round((manual6 * 40) / manualMax); // 26
    const data6 = calcularDataLimite(semanasAntes(6), j);
    // o dia útil anterior pode recuar até 2 dias — nunca avançar
    const dist = diasEntre(data6, EVENTO) as number;
    expect(dist).toBeGreaterThanOrEqual(esperado);
    expect(dist).toBeLessThanOrEqual(esperado + 2);
  });

  it("projeto criado com mais tempo que o manual: a lista se estica", () => {
    const p = projeto({ criadoEm: "2026-05-04" }); // ~28 semanas antes
    const j = janela(p, regras);
    expect(calcularDataLimite(semanasAntes(11), j)).toBe("2026-05-04");
    // sem o esticamento, a tarefa da 1ª semana ficaria em 09/11; esticada, vai bem antes
    expect(calcularDataLimite(semanasAntes(1), j) < "2026-11-09").toBe(true);
  });

  it("tarefa fixa não se adapta: fica sempre na Nª semana antes do evento", () => {
    const p = projeto({ criadoEm: "2026-11-04" });
    const j = janela(p, regras);
    expect(calcularDataLimite(semanasAntes(1, true), j)).toBe("2026-11-09");
  });

  it("nunca cai em fim de semana nem antes do nascimento do projeto", () => {
    for (const criadoEm of ["2026-09-02", "2026-10-01", "2026-10-15", "2026-11-02", "2026-11-12", "2026-11-17"]) {
      const j = janela(projeto({ criadoEm }), regras);
      for (const r of regras) {
        const d = calcularDataLimite(r, j);
        const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
        expect([0, 6]).not.toContain(dow);
        expect(d >= criadoEm || d === EVENTO).toBe(true);
      }
    }
  });

  it("projeto criado no dia do evento: tudo vence no evento", () => {
    const j = janela(projeto({ criadoEm: EVENTO }), regras);
    expect(calcularDataLimite(semanasAntes(11), j)).toBe(EVENTO);
  });

  it("sem data do evento não inventa prazo", () => {
    const j = janela(projeto({ evento: "", eventoDias: [] }), regras);
    expect(calcularDataLimite(semanasAntes(3), j)).toBe("");
  });
});

describe("cronograma — data de trabalho", () => {
  const p = projeto({
    montagem: ["2026-11-16", "2026-11-17"],
    alinhamentos: ["2026-11-17"],
    eventoDias: ["2026-11-18", "2026-11-19", "2026-11-20"],
    desmontagem: ["2026-11-20", "2026-11-21"],
  });
  const j = janela(p, []);

  it("puxa o último (padrão) ou o primeiro dia da etapa", () => {
    expect(calcularDataLimite({ modo: "cronograma", etapa: "montagem" }, j)).toBe("2026-11-17");
    expect(calcularDataLimite({ modo: "cronograma", etapa: "montagem", ponta: "primeira" }, j)).toBe("2026-11-16");
    expect(calcularDataLimite({ modo: "cronograma", etapa: "desmontagem" }, j)).toBe("2026-11-21");
    expect(calcularDataLimite({ modo: "cronograma", etapa: "evento" }, j)).toBe("2026-11-20");
  });

  it("usa a etapa de reserva quando a principal está vazia", () => {
    const sem = janela(projeto({ eventoDias: ["2026-11-18"] }), []);
    expect(calcularDataLimite({ modo: "cronograma", etapa: "alinhamentos", ou: "evento" }, sem)).toBe("2026-11-18");
  });

  it("montagem não preenchida fica sem data — não inventa", () => {
    const sem = janela(projeto({ eventoDias: ["2026-11-18"] }), []);
    expect(calcularDataLimite({ modo: "cronograma", etapa: "montagem" }, sem)).toBe("");
    expect(calcularDataLimite({ modo: "cronograma", etapa: "desmontagem" }, sem)).toBe("");
  });
});

describe("depois do evento", () => {
  const p = projeto({ eventoDias: ["2026-11-18", "2026-11-19"], desmontagem: ["2026-11-20"] });
  const j = janela(p, []);

  it("N-ésimo dia útil após a desmontagem", () => {
    expect(calcularDataLimite({ modo: "dias-uteis-apos", diasUteis: 1 }, j)).toBe("2026-11-23");
    expect(calcularDataLimite({ modo: "dias-uteis-apos", diasUteis: 5 }, j)).toBe("2026-11-27");
  });

  it("sem desmontagem cadastrada, conta a partir do último dia do evento", () => {
    const semDes = janela(projeto({ eventoDias: ["2026-11-18", "2026-11-19"] }), []);
    expect(calcularDataLimite({ modo: "dias-uteis-apos", diasUteis: 1 }, semDes)).toBe("2026-11-20");
  });

  it("segunda-feira da Nª semana após o evento", () => {
    // último dia do evento: quinta 19/11 → semana de 16/11
    expect(calcularDataLimite({ modo: "semanas-apos", semanas: 2 }, j)).toBe("2026-11-30");
    expect(calcularDataLimite({ modo: "semanas-apos", semanas: 3 }, j)).toBe("2026-12-07");
    expect(calcularDataLimite({ modo: "semanas-apos", semanas: 4 }, j)).toBe("2026-12-14");
  });
});

describe("gerar e recalcular com as réguas novas", () => {
  const modelo = modeloCom(
    [
      semanasAntes(11),
      semanasAntes(1),
      { modo: "cronograma", etapa: "montagem" },
      { modo: "cronograma", etapa: "desmontagem" },
      { modo: "dias-uteis-apos", diasUteis: 1 },
    ],
    { funcoes: ["Produção Responsável", "Back-Office"] }
  );

  it("Montagem e Desmontagem nascem com a data do cronograma e a produtora como dona", () => {
    const p = projeto({
      criadoEm: "2026-09-02",
      montagem: ["2026-11-16"],
      desmontagem: ["2026-11-20"],
      produtora: "Marisa",
    });
    const lista = gerarChecklist(p, modelo, (() => { let n = 0; return () => `id-${++n}`; })());
    const datas = lista.itens.map((i) => i.dataLimite);
    expect(datas[2]).toBe("2026-11-16");
    expect(datas[3]).toBe("2026-11-20");
    expect(datas[4]).toBe("2026-11-23");
    expect(lista.itens[0].responsavel).toBe("Marisa");
    expect(lista.itens[0].funcoes).toEqual(["Produção Responsável", "Back-Office"]);
  });

  it("mudar a data da montagem e recalcular move a tarefa — e respeita a data ajustada à mão", () => {
    const p = projeto({ montagem: ["2026-11-16"], desmontagem: ["2026-11-20"] });
    const lista = gerarChecklist(p, modelo);
    const mudou = projeto({ montagem: ["2026-11-12"], desmontagem: ["2026-11-20"] });
    const recalculado = recalcularPrazos(lista, mudou, modelo);
    expect(recalculado.itens[2].dataLimite).toBe("2026-11-12");

    lista.itens[2] = { ...lista.itens[2], dataManual: true };
    expect(recalcularPrazos(lista, mudou, modelo).itens[2].dataLimite).toBe("2026-11-16");
  });
});
