import { describe, expect, it } from "vitest";
import {
  anosComProjetos,
  contagemPorMes,
  blocosDoPeriodoNoMes,
  corDoProjeto,
  diasNoMes,
  duracaoEmDias,
  isoDoDia,
  montarCalendario,
  etapasDoProjeto,
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

/**
 * Projeto mínimo, com montagem em 25/02, desmontagem em 30/03 e as faixas do
 * evento que o teste pedir. As três etapas entram no quadro desde 15/09/2026.
 */
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
  etapas: [{ etapa: "evento" as const, inicio, fim }],
  modalidade: "",
  status: "Ativo",
  inicio,
  fim,
  dias: duracaoEmDias({ inicio, fim }),
  cor: corDoProjeto(id),
});

describe("período do projeto", () => {
  // A regra virou em 15/09/2026: o quadro mostra a OCUPAÇÃO da equipe, do
  // primeiro dia de montagem ao último de desmontagem. Quem olha o quadro está
  // decidindo se cabe mais um projeto na semana, e a equipe já está em campo
  // desde a montagem.
  it("vai da primeira montagem à última desmontagem", () => {
    expect(periodoDoProjeto(projeto("a", ["2026-03-05", "2026-03-07", "2026-03-06"]))).toEqual({
      inicio: "2026-02-25",
      fim: "2026-03-30",
    });
  });

  it("sem montagem nem desmontagem, o período é o do evento", () => {
    const p = projeto("b", ["2026-03-05"]);
    p.info.cronograma.montagem = [];
    p.info.cronograma.desmontagem = [];
    expect(periodoDoProjeto(p)).toEqual({ inicio: "2026-03-05", fim: "2026-03-05" });
  });

  it("ignora faixas em branco e datas mal formadas", () => {
    const p = projeto("c", ["", "  ", "05/03/2026", "2026-03-09"]);
    p.info.cronograma.montagem = [];
    p.info.cronograma.desmontagem = [];
    expect(periodoDoProjeto(p)).toEqual({ inicio: "2026-03-09", fim: "2026-03-09" });
  });

  it("sem data nenhuma não tem período", () => {
    const p = projeto("d", []);
    p.info.cronograma.montagem = [];
    p.info.cronograma.desmontagem = [];
    expect(periodoDoProjeto(p)).toBeNull();
  });

  it("cai no campo legado quando o projeto é anterior ao cronograma por faixas", () => {
    const p = projeto("e", []);
    p.info.cronograma.montagem = [];
    p.info.cronograma.desmontagem = [];
    p.info.evento = "2026-07-14";
    expect(periodoDoProjeto(p)).toEqual({ inicio: "2026-07-14", fim: "2026-07-14" });
  });
});

describe("etapas do projeto — o que dá cor à barra", () => {
  it("devolve montagem, evento e desmontagem, cada uma com o seu trecho", () => {
    expect(etapasDoProjeto(projeto("a", ["2026-03-05", "2026-03-07"]))).toEqual([
      { etapa: "montagem", inicio: "2026-02-25", fim: "2026-02-25" },
      { etapa: "evento", inicio: "2026-03-05", fim: "2026-03-07" },
      { etapa: "desmontagem", inicio: "2026-03-30", fim: "2026-03-30" },
    ]);
  });

  it("etapa não preenchida não vira trecho — não se inventa dia de montagem", () => {
    const p = projeto("b", ["2026-03-05"]);
    p.info.cronograma.montagem = [];
    expect(etapasDoProjeto(p).map((e) => e.etapa)).toEqual(["evento", "desmontagem"]);
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

  it("ordena por data e continua cobrando quem não tem a data do evento", () => {
    const { itens, semData } = montarCalendario(projetos, []);
    // Os três têm montagem em 25/02 (é o que o quadro desenha), então o
    // desempate é o título.
    expect(itens.map((i) => i.id)).toEqual(["a", "b", "z"]);
    // "z" aparece no quadro pelo que já tem E segue cobrado pelo que falta:
    // com o período completo, ele deixaria de ser cobrado em silêncio.
    expect(semData.map((s) => s.id)).toEqual(["z"]);
  });

  it("todos os projetos usam a mesma cor: o Laranja Pólobh", () => {
    const cores = new Set(montarCalendario(projetos, []).itens.map((i) => i.cor.forte));
    expect(cores).toEqual(new Set(["#F2820D"]));
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

describe("blocos do período no mês", () => {
  const com = (p: Projeto) => montarCalendario([p], []).itens[0];

  it("ladrilha o período inteiro, sem furo, uma etapa depois da outra", () => {
    const it = com(projeto("a", ["2026-03-05", "2026-03-07"]));
    // montagem 25/02, evento 05-07/03, desmontagem 30/03 — em março:
    expect(blocosDoPeriodoNoMes(it, 2026, 2)).toEqual([
      { etapa: "montagem", diaInicio: 1, diaFim: 4 },
      { etapa: "evento", diaInicio: 5, diaFim: 29 },
      { etapa: "desmontagem", diaInicio: 30, diaFim: 30 },
    ]);
  });

  it("no mês da montagem o primeiro bloco abre no primeiro dia do período", () => {
    const it = com(projeto("a", ["2026-03-05"]));
    expect(blocosDoPeriodoNoMes(it, 2026, 1)).toEqual([{ etapa: "montagem", diaInicio: 25, diaFim: 28 }]);
  });

  it("mês fora do período não tem bloco", () => {
    expect(blocosDoPeriodoNoMes(com(projeto("a", ["2026-03-05"])), 2026, 5)).toEqual([]);
  });
});
