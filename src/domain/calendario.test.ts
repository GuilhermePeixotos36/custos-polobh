import { describe, expect, it } from "vitest";
import {
  anosComProjetos,
  contagemPorMes,
  corDoProjeto,
  diasNoMes,
  duracaoEmDias,
  isoDoDia,
  montarCalendario,
  periodoDoProjeto,
  projetosDoAno,
  rotuloDias,
  rotuloPeriodo,
  segmentoNoMes,
  segmentosDoMes,
  trilhasDoMes,
  type ProjetoNoCalendario,
} from "./calendario";
import { projetoInfoVazio } from "@/domain/projeto";
import type { Projeto } from "@/data/types";

/** Projeto mínimo com as faixas da etapa "Evento" já preenchidas. */
function projeto(id: string, datasEvento: string[], extra: Partial<Projeto> = {}): Projeto {
  const info = projetoInfoVazio();
  return {
    id,
    nome: `Projeto ${id}`,
    cliente: { nome: `Cliente ${id}` } as Projeto["cliente"],
    info: {
      ...info,
      local: "Teatro",
      modalidade: "Cultural",
      cronograma: {
        ...info.cronograma,
        montagem: [{ id: "m", data: "2026-02-25", inicio: "", fim: "" }],
        desmontagem: [{ id: "d", data: "2026-03-30", inicio: "", fim: "" }],
        evento: datasEvento.map((data, i) => ({ id: `e${i}`, data, inicio: "", fim: "" })),
      },
    },
    docsUrl: "",
    status: "Ativo",
    criadoEm: "2026-01-01",
    atualizadoEm: "2026-01-01",
    ...extra,
  };
}

const item = (id: string, inicio: string, fim: string): ProjetoNoCalendario => ({
  id,
  titulo: `Projeto ${id}`,
  cliente: "Cliente",
  produtora: "",
  local: "",
  modalidade: "",
  status: "Ativo",
  inicio,
  fim,
  dias: duracaoEmDias({ inicio, fim }),
  cor: corDoProjeto(id),
});

describe("período do projeto", () => {
  it("usa só a etapa Evento — montagem e desmontagem ficam de fora", () => {
    expect(periodoDoProjeto(projeto("a", ["2026-03-05", "2026-03-07", "2026-03-06"]))).toEqual({
      inicio: "2026-03-05",
      fim: "2026-03-07",
    });
  });

  it("evento de um dia começa e termina no mesmo dia", () => {
    expect(periodoDoProjeto(projeto("b", ["2026-03-05"]))).toEqual({ inicio: "2026-03-05", fim: "2026-03-05" });
  });

  it("ignora faixas em branco e datas mal formadas", () => {
    expect(periodoDoProjeto(projeto("c", ["", "  ", "05/03/2026", "2026-03-09"]))).toEqual({
      inicio: "2026-03-09",
      fim: "2026-03-09",
    });
  });

  it("sem data de evento não tem período", () => {
    expect(periodoDoProjeto(projeto("d", []))).toBeNull();
  });

  it("cai no campo legado quando o projeto é anterior ao cronograma por faixas", () => {
    const p = projeto("e", []);
    p.info.evento = "2026-07-14";
    expect(periodoDoProjeto(p)).toEqual({ inicio: "2026-07-14", fim: "2026-07-14" });
  });
});

describe("duração", () => {
  it("conta as duas pontas", () => {
    expect(duracaoEmDias({ inicio: "2026-03-05", fim: "2026-03-09" })).toBe(5);
    expect(duracaoEmDias({ inicio: "2026-03-05", fim: "2026-03-05" })).toBe(1);
  });

  it("atravessa a virada do mês e do ano", () => {
    expect(duracaoEmDias({ inicio: "2026-12-30", fim: "2027-01-02" })).toBe(4);
  });
});

describe("montagem do quadro", () => {
  const projetos = [
    projeto("b", ["2026-05-10", "2026-05-12"]),
    projeto("a", ["2026-03-05"]),
    projeto("z", []),
  ];

  it("ordena por data e separa quem ainda não tem data", () => {
    const { itens, semData } = montarCalendario(projetos, []);
    expect(itens.map((i) => i.id)).toEqual(["a", "b"]);
    expect(itens[1].dias).toBe(3);
    expect(semData.map((s) => s.id)).toEqual(["z"]);
  });

  it("dá a mesma cor ao mesmo projeto, sempre", () => {
    const um = montarCalendario(projetos, []).itens.find((i) => i.id === "a");
    const outro = montarCalendario([...projetos].reverse(), []).itens.find((i) => i.id === "a");
    expect(um?.cor.forte).toBe(outro?.cor.forte);
  });
});

describe("anos", () => {
  const itens = [item("a", "2025-12-28", "2026-01-03"), item("b", "2026-06-01", "2026-06-02")];

  it("lista todos os anos tocados, inclusive a virada", () => {
    expect(anosComProjetos(itens)).toEqual([2025, 2026]);
  });

  it("o projeto que vira o ano aparece nos dois", () => {
    expect(projetosDoAno(itens, 2025).map((i) => i.id)).toEqual(["a"]);
    expect(projetosDoAno(itens, 2026).map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("recorte no mês", () => {
  it("marca as pontas de quem entra e sai do mês", () => {
    const seg = segmentoNoMes(item("a", "2026-02-26", "2026-03-04"), 2026, 2);
    expect(seg).toMatchObject({ diaInicio: 1, diaFim: 4, continuaAntes: true, continuaDepois: false });
  });

  it("quem termina depois do mês vai até o último dia", () => {
    const seg = segmentoNoMes(item("a", "2026-01-20", "2026-03-02"), 2026, 1);
    expect(seg).toMatchObject({ diaInicio: 1, diaFim: 28, continuaAntes: true, continuaDepois: true });
  });

  it("fevereiro de ano bissexto tem 29 dias", () => {
    expect(diasNoMes(2028, 1)).toBe(29);
    expect(segmentoNoMes(item("a", "2028-01-01", "2028-12-31"), 2028, 1)?.diaFim).toBe(29);
  });

  it("projeto fora do mês não aparece", () => {
    expect(segmentoNoMes(item("a", "2026-05-01", "2026-05-03"), 2026, 2)).toBeNull();
  });
});

describe("trilhas", () => {
  it("separa em linhas o que se sobrepõe e reaproveita a linha livre", () => {
    const itens = [
      item("a", "2026-03-01", "2026-03-05"),
      item("b", "2026-03-04", "2026-03-08"),
      item("c", "2026-03-10", "2026-03-12"),
    ];
    const trilhas = trilhasDoMes(segmentosDoMes(itens, 2026, 2));
    expect(trilhas).toHaveLength(2);
    expect(trilhas[0].map((s) => s.item.id)).toEqual(["a", "c"]);
    expect(trilhas[1].map((s) => s.item.id)).toEqual(["b"]);
  });

  it("dois projetos no mesmo dia nunca dividem a linha", () => {
    const itens = [item("a", "2026-03-05", "2026-03-05"), item("b", "2026-03-05", "2026-03-05")];
    expect(trilhasDoMes(segmentosDoMes(itens, 2026, 2))).toHaveLength(2);
  });
});

describe("resumo do ano", () => {
  const itens = [item("a", "2026-03-05", "2026-03-07"), item("b", "2026-03-06", "2026-04-02")];

  it("conta os projetos de cada mês", () => {
    const contagem = contagemPorMes(itens, 2026);
    expect(contagem[2]).toBe(2);
    expect(contagem[3]).toBe(1);
    expect(contagem[0]).toBe(0);
  });
});

describe("rótulos", () => {
  it("dias dentro do mês", () => {
    const [um] = segmentosDoMes([item("a", "2026-03-05", "2026-03-05")], 2026, 2);
    const [varios] = segmentosDoMes([item("b", "2026-03-05", "2026-03-09")], 2026, 2);
    expect(rotuloDias(um)).toBe("05");
    expect(rotuloDias(varios)).toBe("05 a 09");
  });

  it("período por extenso", () => {
    expect(rotuloPeriodo(item("a", "2026-03-05", "2026-03-05"))).toBe("05 de março de 2026");
    expect(rotuloPeriodo(item("b", "2026-03-05", "2026-03-09"))).toBe("05 a 09 de março de 2026");
    expect(rotuloPeriodo(item("c", "2026-02-26", "2026-03-04"))).toBe("26 de fev a 04 de mar de 2026");
    expect(rotuloPeriodo(item("d", "2026-12-30", "2027-01-02"))).toBe("30 de dez de 2026 a 02 de jan de 2027");
  });

  it("iso do dia usa dois dígitos", () => {
    expect(isoDoDia(2026, 0, 5)).toBe("2026-01-05");
  });
});
