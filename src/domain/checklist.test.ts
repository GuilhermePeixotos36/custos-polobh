import { describe, expect, it } from "vitest";
import {
  agruparPorData,
  atrasoNaConclusao,
  calcularDataLimite,
  dataLocalDe,
  definirDataConclusao,
  paraCampoDataHora,
  definirStatus,
  diasEntre,
  gerarChecklist,
  janelaDoProjeto,
  ordenarPorPrazo,
  recalcularPrazos,
  resumirChecklist,
  situacaoPrazo,
  somarDias,
  sincronizarComModelo,
} from "./checklist";
import { calcularPendencias } from "@/domain/pendencias";
import { projetoInfoVazio } from "@/domain/projeto";
import type { Ec, ItemChecklist, ModeloChecklist, Projeto } from "@/data/types";

/** Gerador de ids previsível — os testes comparam estrutura, não uuid. */
function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

const projeto = (p: Partial<Projeto["info"]> = {}): Projeto => ({
  id: "p1",
  nome: "Projeto",
  cliente: {} as Projeto["cliente"],
  info: { ...projetoInfoVazio(), preEvento: "2026-01-01", evento: "2026-03-11", posEvento: "2026-03-31", ...p },
  docsUrl: "",
  status: "Ativo",
  criadoEm: "2026-01-01",
  atualizadoEm: "2026-01-01",
});

const modelo = (itens: Partial<ModeloChecklist["itens"][number]>[]): ModeloChecklist => ({
  id: "m1",
  modalidade: "Cultural",
  nome: "Cultural",
  atualizadoEm: "2026-01-01",
  itens: itens.map((i, n) => ({
    id: `mi-${n + 1}`,
    titulo: `Tarefa ${n + 1}`,
    descricao: "",
    etapa: "PRÉ-PRODUÇÃO",
    prazo: { modo: "percentual" as const, percentual: 0 },
    responsavelPadrao: "",
    ordem: n,
    ...i,
  })),
});

describe("datas", () => {
  it("soma dias sem escorregar de fuso", () => {
    expect(somarDias("2026-03-11", -7)).toBe("2026-03-04");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("conta os dias entre duas datas", () => {
    expect(diasEntre("2026-01-01", "2026-03-31")).toBe(89);
    expect(diasEntre("2026-03-31", "2026-01-01")).toBe(-89);
    expect(diasEntre("", "2026-01-01")).toBeNull();
  });
});

describe("janela do projeto", () => {
  it("usa pré-evento, evento e pós-evento", () => {
    expect(janelaDoProjeto(projeto())).toEqual({ inicio: "2026-01-01", evento: "2026-03-11", fim: "2026-03-31" });
  });

  it("projeto com só a data do evento ainda posiciona o que é ancorado", () => {
    const j = janelaDoProjeto(projeto({ preEvento: "", posEvento: "" }));
    expect(j).toEqual({ inicio: "2026-03-11", evento: "2026-03-11", fim: "2026-03-11" });
    expect(calcularDataLimite({ modo: "ancora", diasDoEvento: -10 }, j)).toBe("2026-03-01");
  });
});

describe("calcularDataLimite", () => {
  const janela = { inicio: "2026-01-01", evento: "2026-03-11", fim: "2026-03-31" };

  it("percentual distribui no período completo", () => {
    expect(calcularDataLimite({ modo: "percentual", percentual: 0 }, janela)).toBe("2026-01-01");
    expect(calcularDataLimite({ modo: "percentual", percentual: 1 }, janela)).toBe("2026-03-31");
    // 89 dias * 0,5 = 44,5 -> 45 (arredonda)
    expect(calcularDataLimite({ modo: "percentual", percentual: 0.5 }, janela)).toBe("2026-02-15");
  });

  it("percentual fora de 0..1 é travado nas pontas", () => {
    expect(calcularDataLimite({ modo: "percentual", percentual: 2 }, janela)).toBe("2026-03-31");
    expect(calcularDataLimite({ modo: "percentual", percentual: -1 }, janela)).toBe("2026-01-01");
  });

  it("âncora conta a partir do dia do evento", () => {
    expect(calcularDataLimite({ modo: "ancora", diasDoEvento: -7 }, janela)).toBe("2026-03-04");
    expect(calcularDataLimite({ modo: "ancora", diasDoEvento: 5 }, janela)).toBe("2026-03-16");
  });

  it("sem a data que a régua precisa, devolve vazio em vez de inventar prazo", () => {
    expect(calcularDataLimite({ modo: "ancora", diasDoEvento: -7 }, { inicio: "", evento: "", fim: "" })).toBe("");
    expect(calcularDataLimite({ modo: "percentual", percentual: 0.5 }, { inicio: "", evento: "", fim: "" })).toBe("");
  });
});

describe("gerarChecklist", () => {
  it("cria todos os itens pendentes, visíveis e com prazo calculado", () => {
    const c = gerarChecklist(
      projeto(),
      modelo([
        { prazo: { modo: "percentual", percentual: 0 } },
        { prazo: { modo: "ancora", diasDoEvento: -7 } },
      ]),
      ids()
    );
    expect(c.itens).toHaveLength(2);
    expect(c.itens.every((i) => i.status === "Pendente" && !i.oculto && !i.dataManual)).toBe(true);
    expect(c.itens.map((i) => i.dataLimite)).toEqual(["2026-01-01", "2026-03-04"]);
    expect(c.itens.map((i) => i.origemModeloItemId)).toEqual(["mi-1", "mi-2"]);
    expect(c.modalidade).toBe("Cultural");
  });

  it("respeita a ordem declarada no modelo, não a ordem do array", () => {
    const m = modelo([{ ordem: 2 }, { ordem: 0 }, { ordem: 1 }]);
    const c = gerarChecklist(projeto(), m, ids());
    expect(c.itens.map((i) => i.origemModeloItemId)).toEqual(["mi-2", "mi-3", "mi-1"]);
    expect(c.itens.map((i) => i.ordem)).toEqual([0, 1, 2]);
  });
});

describe("recalcularPrazos", () => {
  const m = modelo([
    { prazo: { modo: "percentual", percentual: 0.5 } },
    { prazo: { modo: "ancora", diasDoEvento: -7 } },
  ]);

  it("acompanha a mudança das datas do projeto", () => {
    const c = gerarChecklist(projeto(), m, ids());
    const novo = recalcularPrazos(c, projeto({ evento: "2026-04-11", posEvento: "2026-04-30" }), m);
    expect(novo.itens[0].dataLimite).toBe("2026-03-02"); // 119 dias * 0,5 = 59,5 -> 60
    expect(novo.itens[1].dataLimite).toBe("2026-04-04");
  });

  it("não passa por cima de data ajustada à mão", () => {
    const c = gerarChecklist(projeto(), m, ids());
    c.itens[0] = { ...c.itens[0], dataLimite: "2026-02-02", dataManual: true };
    const novo = recalcularPrazos(c, projeto({ posEvento: "2026-04-30" }), m);
    expect(novo.itens[0].dataLimite).toBe("2026-02-02");
  });

  it("não mexe em item já encerrado", () => {
    const c = gerarChecklist(projeto(), m, ids());
    c.itens[1] = { ...c.itens[1], status: "Concluído" };
    const novo = recalcularPrazos(c, projeto({ evento: "2026-06-11" }), m);
    expect(novo.itens[1].dataLimite).toBe("2026-03-04");
  });

  it("item criado à mão (sem modelo) mantém a própria data", () => {
    const c = gerarChecklist(projeto(), m, ids());
    const manual: ItemChecklist = { ...c.itens[0], id: "x", origemModeloItemId: "", dataLimite: "2026-05-05" };
    const novo = recalcularPrazos({ ...c, itens: [manual] }, projeto({ posEvento: "2026-12-31" }), m);
    expect(novo.itens[0].dataLimite).toBe("2026-05-05");
  });
});

describe("sincronizarComModelo", () => {
  it("acrescenta só o que é novo no modelo, sem tocar no que já existe", () => {
    const m1 = modelo([{ prazo: { modo: "ancora", diasDoEvento: -30 } }]);
    const c = gerarChecklist(projeto(), m1, ids());
    c.itens[0] = { ...c.itens[0], status: "Concluído", observacoes: [] };

    const m2: ModeloChecklist = {
      ...m1,
      itens: [...m1.itens, { ...m1.itens[0], id: "mi-novo", titulo: "Tarefa nova", ordem: 1 }],
    };
    const { checklist, adicionados } = sincronizarComModelo(c, projeto(), m2, ids());
    expect(adicionados).toBe(1);
    expect(checklist.itens).toHaveLength(2);
    expect(checklist.itens[0].status).toBe("Concluído"); // preservado
    expect(checklist.itens[1].titulo).toBe("Tarefa nova");
    expect(checklist.itens[1].ordem).toBe(1);
  });

  it("é idempotente — rodar de novo não duplica nada", () => {
    const m = modelo([{}, {}]);
    const c = gerarChecklist(projeto(), m, ids());
    const { checklist, adicionados } = sincronizarComModelo(c, projeto(), m, ids());
    expect(adicionados).toBe(0);
    expect(checklist).toBe(c);
  });
});

describe("definirStatus", () => {
  const base: ItemChecklist = {
    id: "i1", checklistId: "c1", origemModeloItemId: "mi-1", titulo: "T", descricao: "", etapa: "E",
    status: "Pendente", dataLimite: "2026-02-01", dataManual: false, concluidoEm: "", concluidoPor: "",
    responsavel: "", observacoes: [], oculto: false, ordem: 0,
  };

  it("concluir carimba data/autor e recolhe o item", () => {
    const r = definirStatus(base, "Concluído", "Marisa", "2026-01-20T10:00:00Z");
    expect(r.status).toBe("Concluído");
    expect(r.concluidoEm).toBe("2026-01-20T10:00:00Z");
    expect(r.concluidoPor).toBe("Marisa");
    expect(r.oculto).toBe(true);
  });

  it("reabrir limpa o carimbo e traz o item de volta", () => {
    const concluido = definirStatus(base, "Concluído", "Marisa", "2026-01-20T10:00:00Z");
    const r = definirStatus(concluido, "Em andamento", "Carol", "2026-01-21T10:00:00Z");
    expect(r.concluidoEm).toBe("");
    expect(r.concluidoPor).toBe("");
    expect(r.oculto).toBe(false);
  });

  it("'Não se aplica' recolhe sem carimbar conclusão", () => {
    const r = definirStatus(base, "Não se aplica", "Marisa", "2026-01-20T10:00:00Z");
    expect(r.oculto).toBe(true);
    expect(r.concluidoEm).toBe("");
  });

  it("repetir o mesmo status devolve o objeto intacto", () => {
    expect(definirStatus(base, "Pendente", "Marisa", "2026-01-20T10:00:00Z")).toBe(base);
  });
});

describe("data de conclusão", () => {
  const base: ItemChecklist = {
    id: "i1", checklistId: "c1", origemModeloItemId: "mi-1", titulo: "T", descricao: "", etapa: "E",
    status: "Concluído", dataLimite: "2026-02-10", dataManual: false, concluidoEm: "", concluidoPor: "",
    responsavel: "", observacoes: [], oculto: true, ordem: 0,
  };

  it("guarda data E hora, e devolve as duas ao campo da tela", () => {
    const r = definirDataConclusao(base, "2026-02-08T18:30");
    // Vai para o banco em UTC...
    expect(r.concluidoEm).toContain("T");
    expect(new Date(r.concluidoEm).getTime()).toBe(new Date("2026-02-08T18:30").getTime());
    // ...e volta para a tela no horário local, sem perder a hora.
    expect(paraCampoDataHora(r.concluidoEm)).toBe("2026-02-08T18:30");
  });

  it("só a data (sem hora) assume meio-dia, longe da virada", () => {
    expect(paraCampoDataHora(definirDataConclusao(base, "2026-02-08").concluidoEm)).toBe("2026-02-08T12:00");
  });

  it("conclusão da noite continua sendo o dia em que a pessoa trabalhou", () => {
    // Às 22h no Brasil já é o dia seguinte em UTC: ler o ISO cru daria 09/02.
    const r = definirDataConclusao(base, "2026-02-08T22:00");
    expect(dataLocalDe(r.concluidoEm)).toBe("2026-02-08");
    expect(atrasoNaConclusao({ ...r, dataLimite: "2026-02-08" })).toBe(0); // entregou no prazo
  });

  it("limpar o campo devolve vazio", () => {
    expect(definirDataConclusao(base, "").concluidoEm).toBe("");
  });

  it("compara prazo e conclusão para dizer se saiu no tempo", () => {
    expect(atrasoNaConclusao(definirDataConclusao(base, "2026-02-13T09:00"))).toBe(3);  // 3 dias depois
    expect(atrasoNaConclusao(definirDataConclusao(base, "2026-02-10T23:59"))).toBe(0);  // no dia, no limite
    expect(atrasoNaConclusao(definirDataConclusao(base, "2026-02-05T08:00"))).toBe(-5); // adiantada
  });

  it("sem uma das duas datas não há comparação a fazer", () => {
    expect(atrasoNaConclusao({ ...base, concluidoEm: "" })).toBeNull();
    expect(atrasoNaConclusao({ ...definirDataConclusao(base, "2026-02-13T10:00"), dataLimite: "" })).toBeNull();
  });
});

describe("situacaoPrazo", () => {
  const item = (p: Partial<ItemChecklist>): ItemChecklist => ({
    id: "i", checklistId: "c", origemModeloItemId: "", titulo: "T", descricao: "", etapa: "",
    status: "Pendente", dataLimite: "2026-02-10", dataManual: false, concluidoEm: "", concluidoPor: "",
    responsavel: "", observacoes: [], oculto: false, ordem: 0, ...p,
  });

  it("classifica pelo que falta até o prazo", () => {
    const hoje = "2026-02-10";
    expect(situacaoPrazo(item({ dataLimite: "2026-02-09" }), hoje)).toBe("atrasado");
    expect(situacaoPrazo(item({ dataLimite: "2026-02-10" }), hoje)).toBe("hoje");
    expect(situacaoPrazo(item({ dataLimite: "2026-02-12" }), hoje)).toBe("proximo");
    expect(situacaoPrazo(item({ dataLimite: "2026-03-01" }), hoje)).toBe("em-dia");
    expect(situacaoPrazo(item({ dataLimite: "" }), hoje)).toBe("sem-data");
  });

  it("item encerrado não cobra prazo, nem atrasado", () => {
    expect(situacaoPrazo(item({ dataLimite: "2020-01-01", status: "Concluído" }), "2026-02-10")).toBe("encerrado");
    expect(situacaoPrazo(item({ dataLimite: "2020-01-01", status: "Não se aplica" }), "2026-02-10")).toBe("encerrado");
  });
});

describe("resumirChecklist", () => {
  it("mede progresso ignorando o que não se aplica", () => {
    // percentual 1 = fim da janela (31/03), ainda no futuro em 10/02: assim só
    // o item que recebe uma data antiga logo abaixo conta como atrasado.
    const noFim = { prazo: { modo: "percentual" as const, percentual: 1 } };
    const c = gerarChecklist(projeto(), modelo([noFim, noFim, noFim, noFim]), ids());
    c.itens[0] = { ...c.itens[0], status: "Concluído" };
    c.itens[1] = { ...c.itens[1], status: "Não se aplica" };
    c.itens[2] = { ...c.itens[2], dataLimite: "2020-01-01" };
    const r = resumirChecklist(c, "2026-02-10");
    expect(r.total).toBe(4);
    expect(r.concluidos).toBe(1);
    expect(r.abertos).toBe(2);
    expect(r.atrasados).toBe(1);
    expect(r.progresso).toBeCloseTo(1 / 3); // 3 contam, 1 concluído
  });

  it("check-list ausente não quebra o resumo", () => {
    expect(resumirChecklist(undefined, "2026-02-10").total).toBe(0);
  });
});

describe("ordenação e agrupamento por data", () => {
  const c = gerarChecklist(
    projeto(),
    modelo([
      { prazo: { modo: "ancora", diasDoEvento: 0 } },
      { prazo: { modo: "ancora", diasDoEvento: -30 } },
      { prazo: { modo: "ancora", diasDoEvento: 0 } },
    ]),
    ids()
  );

  it("ordena por data-limite, com os sem data no fim", () => {
    const semData = { ...c.itens[0], id: "z", dataLimite: "" };
    const ordenados = ordenarPorPrazo([semData, ...c.itens]);
    expect(ordenados[0].dataLimite).toBe("2026-02-09");
    expect(ordenados[ordenados.length - 1].dataLimite).toBe("");
  });

  it("agrupa por data mantendo a ordem cronológica", () => {
    const grupos = agruparPorData(c.itens);
    expect(grupos.map((g) => g.data)).toEqual(["2026-02-09", "2026-03-11"]);
    expect(grupos[1].itens).toHaveLength(2);
  });
});

describe("pendências geradas pelo check-list", () => {
  const HOJE = "2026-02-10";
  const pendencias = (c: ReturnType<typeof gerarChecklist>, p = projeto()) =>
    calcularPendencias([p], [], [], ["Marisa", "Carol"], [], [c], HOJE);

  /** Check-list com um item só, com prazo e responsável controlados. */
  function comUmItem(patch: Partial<ItemChecklist>) {
    const c = gerarChecklist(projeto(), modelo([{}]), ids());
    c.itens[0] = { ...c.itens[0], responsavel: "Carol", dataLimite: "2026-03-01", ...patch };
    return c;
  }

  it("cobra do responsável a tarefa atrasada", () => {
    const p = pendencias(comUmItem({ dataLimite: "2026-02-01" }));
    const atraso = p.find((x) => x.tipo === "checklist.atrasado");
    expect(atraso?.pessoas).toEqual(["Carol"]);
    expect(atraso?.aba).toBe("checklist");
    expect(atraso?.titulo).toContain("Tarefa atrasada");
  });

  it("avisa a tarefa que está vencendo, dentro da janela de alerta", () => {
    expect(pendencias(comUmItem({ dataLimite: "2026-02-12" })).some((x) => x.tipo === "checklist.vencendo")).toBe(true);
    // Fora da janela ainda não incomoda ninguém.
    expect(pendencias(comUmItem({ dataLimite: "2026-03-01" })).some((x) => x.tipo?.startsWith("checklist."))).toBe(false);
  });

  it("tarefa concluída para de cobrar, mesmo vencida", () => {
    const c = comUmItem({ dataLimite: "2026-01-01", status: "Concluído" });
    expect(pendencias(c).some((x) => x.tipo?.startsWith("checklist."))).toBe(false);
  });

  it("sem responsável no item, a cobrança cai no produtor do projeto", () => {
    const p = projeto();
    p.info.produtoraResponsavel = "Marisa";
    const c = comUmItem({ dataLimite: "2026-02-01", responsavel: "" });
    expect(pendencias(c, p).find((x) => x.tipo === "checklist.atrasado")?.pessoas).toEqual(["Marisa"]);
  });

  it("observação em aberto vira pendência de quem foi endereçado", () => {
    const c = comUmItem({
      observacoes: [
        { id: "o1", texto: "Confirmar com o fornecedor", autorId: "", autorNome: "Carol",
          criadoEm: "2026-02-01", responsavelNome: "Marisa", resolvida: false, respostas: [] },
      ],
    });
    const obs = pendencias(c).find((x) => x.tipo === "checklist.observacao");
    expect(obs?.pessoas).toEqual(["Marisa"]);
    expect(obs?.checklistItemId).toBe(c.itens[0].id);
  });

  it("observação resolvida sai do quadro", () => {
    const c = comUmItem({
      observacoes: [
        { id: "o1", texto: "Confirmar", autorId: "", autorNome: "Carol", criadoEm: "2026-02-01",
          responsavelNome: "Marisa", resolvida: true, respostas: [] },
      ],
    });
    expect(pendencias(c).some((x) => x.tipo === "checklist.observacao")).toBe(false);
  });

  it("tarefa sem título ainda é identificável no quadro", () => {
    // Tarefa criada à mão nasce sem título; a pendência não pode virar
    // "Tarefa atrasada: " com o nome em branco.
    const c = comUmItem({ dataLimite: "2026-02-01", titulo: "" });
    expect(pendencias(c).find((x) => x.tipo === "checklist.atrasado")?.titulo).toBe(
      "Tarefa atrasada: (tarefa sem título)"
    );
  });

  it("projeto encerrado não cobra nada do check-list", () => {
    // O status do projeto é DERIVADO das ECs (statusProjetoAutomatico): com todas
    // arquivadas, o projeto está encerrado e o quadro para de cobrar.
    const p = projeto();
    const ecArquivada = { id: "e1", projetoId: p.id, status: "Arquivada", ativa: false, linhas: [] } as unknown as Ec;
    const c = comUmItem({ dataLimite: "2026-01-01" });
    const comEc = calcularPendencias([p], [ecArquivada], [], ["Marisa", "Carol"], [], [c], HOJE);
    expect(comEc.some((x) => x.tipo?.startsWith("checklist."))).toBe(false);
    // Sanidade: sem a EC arquivada, a mesma tarefa É cobrada.
    expect(pendencias(c, p).some((x) => x.tipo === "checklist.atrasado")).toBe(true);
  });
});
