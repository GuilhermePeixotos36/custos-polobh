/**
 * O que o revisor toca e o que ele NÃO toca.
 *
 * Os dois lados importam igualmente. Deixar um campo de fora faz um texto
 * chegar ao fornecedor sem revisão; incluir um a mais faz a IA reescrever uma
 * cláusula de contrato, o recado de uma pessoa ou um código de serviço — e
 * esses erros não avisam, só aparecem no documento impresso.
 */
import { describe, expect, it } from "vitest";
import {
  apenasMudados,
  aplicarNaEc,
  aplicarNaOs,
  aplicarNoChecklist,
  camposDaEc,
  camposDaOs,
  camposDoChecklist,
  retratoDeTextos,
} from "./revisaoTexto";
import type { EcLinha, ItemChecklist, Os } from "@/data/types";

const linha = (p: Partial<EcLinha> = {}): EcLinha => ({
  id: "l1", grupo: "PRODUÇÃO", item: "buffet", descricao: "coffee break", descricaoCompleta: "<p>para 200</p>",
  valorPolobh: 0, valorCliente: 0, valorGasto: 0, valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0,
  valoresNaoAplicaveis: [], bv: { modo: "percentual", valor: 0, justificativa: "" }, statusAprovacao: "Pendente",
  fornecedorRazao: "", fornecedorCnpj: "", fornecedorContato: "", faturaNf: "", codigoServico: "",
  pedidoCompra: "", statusOs: "Pendente", contratoStatus: "Pendente", observacao: "", observacoes: [],
  oculto: false, ordem: 0, ...p,
});

const ids = (campos: { id: string }[]) => campos.map((c) => c.id).sort();

describe("os campos da EC", () => {
  it("leva item, descrição e descrição completa", () => {
    expect(ids(camposDaEc([linha()]))).toEqual(["ec:l1:completa", "ec:l1:descricao", "ec:l1:item"]);
  });

  it("marca como HTML só o rich-text — o revisor precisa preservar as tags", () => {
    const campos = camposDaEc([linha()]);
    expect(campos.find((c) => c.id === "ec:l1:completa")?.html).toBe(true);
    expect(campos.find((c) => c.id === "ec:l1:descricao")?.html).toBeFalsy();
  });

  it("campo vazio não vira pedido à IA", () => {
    expect(camposDaEc([linha({ descricao: "", descricaoCompleta: "   " })])).toHaveLength(1);
  });

  // Fornecedor, CNPJ, código de serviço e pedido de compra são identificadores,
  // não prosa: "corrigir" um deles é estragá-lo.
  it("não leva cadastro nem código", () => {
    const texto = JSON.stringify(camposDaEc([linha({
      fornecedorRazao: "acme ltda", fornecedorCnpj: "00.000.000/0001-00",
      codigoServico: "1401", pedidoCompra: "pc-9",
    })]));
    for (const proibido of ["acme ltda", "00.000.000", "1401", "pc-9"]) {
      expect(texto).not.toContain(proibido);
    }
  });

  // A thread é a palavra de uma pessoa falando com outra, e serve de prova do
  // que foi combinado. Reescrevê-la, ainda que só a vírgula, é mexer no que ela
  // disse.
  it("não leva a conversa do item", () => {
    const com = camposDaEc([linha({
      observacoes: [{ id: "o1", texto: "o cliente cortou o coffee", autorId: "u", autorNome: "Ana",
        criadoEm: "2026-09-01T10:00:00Z", resolvida: false, respostas: [] }],
    })]);
    expect(JSON.stringify(com)).not.toContain("cortou o coffee");
  });

  it("devolve o texto revisado para o lugar certo, e preserva o que não voltou", () => {
    const r = new Map([["ec:l1:item", "Buffet"], ["ec:l1:descricao", "Coffee break"]]);
    const [saida] = aplicarNaEc([linha()], r);
    expect(saida.item).toBe("Buffet");
    expect(saida.descricao).toBe("Coffee break");
    expect(saida.descricaoCompleta).toBe("<p>para 200</p>");
  });
});

/* -------------------------------------------------------------------------- */

const os = (p: Partial<Os> = {}): Os => ({
  descritivo: "montagem do palco", entrega: "até as 8h", observacoesGerais: "levar extintor",
  cronograma: [{ id: "c1", etapa: "Montagem", data: "2026-10-01", horario: "08:00", atividades: "montar estrutura" }],
  logistica: {
    transporteMaterial: "caminhão baú", transporteEquipe: "van", hospedagem: "hotel centro",
    alimentacao: "almoço no local", estacionamentoCarga: "portão 2", estacionamentoEquipe: "g3",
    uniformizacao: "camisa preta",
  },
  infraestrutura: {
    energia: "gerador 180kva", internet: "link dedicado", pontosEletricos: "8 pontos",
    estruturas: "praticável", servicosApoio: "limpeza", artLaudos: "art do engenheiro",
  },
  ...p,
} as unknown as Os);

describe("os campos da OS", () => {
  it("leva o que sai no documento do fornecedor", () => {
    const encontrados = ids(camposDaOs(os()));
    for (const esperado of [
      "os:descritivo", "os:entrega", "os:observacoesGerais", "os:crono:c1",
      "os:log:transporteMaterial", "os:infra:energia",
    ]) {
      expect(encontrados).toContain(esperado);
    }
  });

  // "Não se aplica" não sai no documento. Revisar o que ninguém vai ler é
  // gastar por nada.
  it("pula o que está marcado como não se aplica", () => {
    const encontrados = ids(camposDaOs(os({
      cronogramaNaoSeAplica: true,
      observacoesGeraisNaoSeAplica: true,
    })));
    expect(encontrados).not.toContain("os:crono:c1");
    expect(encontrados).not.toContain("os:observacoesGerais");
    expect(encontrados).toContain("os:descritivo");
  });

  it("pula o campo de infraestrutura declarado não aplicável", () => {
    const encontrados = ids(camposDaOs(os({
      infraestrutura: { ...os().infraestrutura, naoAplicaveis: ["internet"] },
    })));
    expect(encontrados).not.toContain("os:infra:internet");
    expect(encontrados).toContain("os:infra:energia");
  });

  it("alcança os itens extras da infraestrutura e dos grupos criados na OS", () => {
    const encontrados = ids(camposDaOs(os({
      infraestrutura: { ...os().infraestrutura, extras: [{ id: "e1", rotulo: "Água", valor: "galões" }] },
      gruposExtras: [{ id: "g1", nome: "Segurança", itens: [{ id: "i1", rotulo: "Brigadista", valor: "2 no local" }] }],
    })));
    expect(encontrados).toContain("os:infra:extra:e1");
    expect(encontrados).toContain("os:grupo:g1:i1");
  });

  // A cláusula é texto jurídico aprovado como está. Uma "correção" de
  // concordância numa cláusula de rescisão é risco sem ganho nenhum.
  it("não leva as cláusulas do contrato", () => {
    const comContrato = os({
      contrato: { clausulas: { foro: "fica eleito o foro da comarca de belo horizonte" } },
    } as unknown as Partial<Os>);
    expect(JSON.stringify(camposDaOs(comContrato))).not.toContain("foro da comarca");
  });

  it("devolve cada texto ao seu lugar, inclusive nos aninhados", () => {
    const base = os({
      infraestrutura: { ...os().infraestrutura, extras: [{ id: "e1", rotulo: "Água", valor: "galões" }] },
      gruposExtras: [{ id: "g1", nome: "Segurança", itens: [{ id: "i1", rotulo: "Brigadista", valor: "2 no local" }] }],
    });
    const saida = aplicarNaOs(base, new Map([
      ["os:descritivo", "Montagem do palco"],
      ["os:log:hospedagem", "Hotel Centro"],
      ["os:infra:extra:e1", "Galões"],
      ["os:grupo:g1:i1", "2 no local, das 8h às 18h"],
      ["os:crono:c1", "Montar estrutura"],
    ]));
    expect(saida.descritivo).toBe("Montagem do palco");
    expect(saida.logistica.hospedagem).toBe("Hotel Centro");
    expect(saida.infraestrutura.extras?.[0].valor).toBe("Galões");
    expect(saida.gruposExtras?.[0].itens[0].valor).toBe("2 no local, das 8h às 18h");
    expect(saida.cronograma[0].atividades).toBe("Montar estrutura");
    // O que a IA não devolveu fica como estava.
    expect(saida.entrega).toBe("até as 8h");
  });
});

/* -------------------------------------------------------------------------- */

const tarefa = (p: Partial<ItemChecklist> = {}): ItemChecklist => ({
  id: "t1", checklistId: "c1", origemModeloItemId: "", titulo: "emitir a os do buffet",
  descricao: "conferir o cardápio antes", etapa: "Pré-evento", status: "Pendente",
  dataLimite: "2026-10-01", dataManual: false, concluidoEm: "", concluidoPor: "",
  responsavel: "Ana", observacoes: [], ...p,
} as ItemChecklist);

describe("os campos do check-list", () => {
  it("leva o título e a descrição da tarefa", () => {
    expect(ids(camposDoChecklist([tarefa()]))).toEqual(["chk:t1:descricao", "chk:t1:titulo"]);
  });

  it("não leva o responsável nem a conversa da tarefa", () => {
    const texto = JSON.stringify(camposDoChecklist([tarefa({
      observacoes: [{ id: "o1", texto: "já falei com o fornecedor", autorId: "u", autorNome: "Ana",
        criadoEm: "2026-09-01T10:00:00Z", resolvida: false, respostas: [] }],
    })]));
    expect(texto).not.toContain("já falei");
    expect(texto).not.toContain("Ana");
  });

  it("devolve o texto revisado para a tarefa", () => {
    const [saida] = aplicarNoChecklist([tarefa()], new Map([["chk:t1:titulo", "Emitir a OS do buffet"]]));
    expect(saida.titulo).toBe("Emitir a OS do buffet");
    expect(saida.descricao).toBe("conferir o cardápio antes");
  });
});

/* -------------------------------------------------------------------------- */

/**
 * Esta é a peça que responde à ressalva do check-list ("estender a revisão
 * aumenta o custo por salvamento"). Sem ela, a conta cresceria com o número de
 * SALVAMENTOS — que é enorme — em vez de com o de EDIÇÕES DE TEXTO.
 */
describe("só o que mudou vai para a IA", () => {
  const antes = camposDaEc([linha(), linha({ id: "l2", item: "som", descricao: "pa 2000w", descricaoCompleta: "" })]);
  const retrato = retratoDeTextos(antes);

  it("nada mudou: nada é enviado", () => {
    expect(apenasMudados(antes, retrato)).toEqual([]);
  });

  it("mexeu num campo: vai só ele", () => {
    const depois = camposDaEc([linha({ descricao: "coffee break reforçado" }), linha({ id: "l2", item: "som", descricao: "pa 2000w", descricaoCompleta: "" })]);
    expect(ids(apenasMudados(depois, retrato))).toEqual(["ec:l1:descricao"]);
  });

  it("linha nova entra inteira", () => {
    const depois = [...antes, ...camposDaEc([linha({ id: "l3", item: "luz", descricao: "par led", descricaoCompleta: "" })])];
    expect(ids(apenasMudados(depois, retrato))).toEqual(["ec:l3:descricao", "ec:l3:item"]);
  });

  // Documento novo não tem retrato anterior: tudo é novidade, e tudo vai.
  it("sem retrato anterior, vai tudo", () => {
    expect(apenasMudados(antes, new Map())).toHaveLength(antes.length);
  });
});
