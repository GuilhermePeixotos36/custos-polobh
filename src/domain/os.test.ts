import { describe, expect, it } from "vitest";
import {
  itensDaOs,
  osIncentivada,
  CAMPOS_LOGISTICA,
  CAMPOS_INFRAESTRUTURA,
  itensParaDocumento,
  naoSeAplica,
  alternarNaoSeAplica,
  temContrato,
  contratoPreenchido,
  mesmoFornecedor,
  exigeNovaVersaoPorFornecedor,
} from "./os";
import type { Ec, EcLinha, Infraestrutura, Logistica, Os } from "@/data/types";

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

/**
 * "Não se aplica" na Logística: o item some do documento impresso, do que vai
 * por e-mail e da planilha. As três saídas leem daqui — é o que impede uma
 * delas de continuar imprimindo o que a tela já escondeu.
 */
describe("logística que não se aplica", () => {
  /** Atalho: quase todo caso deste bloco olha a Logística. */
  const daLogistica = (l: Logistica | undefined) => itensParaDocumento(l, CAMPOS_LOGISTICA);

  const logistica = (p: Partial<Logistica> = {}): Logistica => ({
    transporteMaterial: "Por conta do fornecedor",
    transporteEquipe: "Por conta do fornecedor",
    hospedagem: "Hotel Ouro Minas",
    alimentacao: "",
    estacionamentoCarga: "Liberado pelo local",
    estacionamentoEquipe: "",
    uniformizacao: "Camisa preta",
    ...p,
  });

  it("sem nada marcado, os sete itens saem — na ordem da tela", () => {
    const visiveis = daLogistica(logistica());
    expect(visiveis).toHaveLength(CAMPOS_LOGISTICA.length);
    expect(visiveis[0]).toEqual({ rotulo: "Transporte Material", valor: "Por conta do fornecedor" });
  });

  it("o item marcado some da lista que vira documento e planilha", () => {
    const visiveis = daLogistica(logistica({ naoAplicaveis: ["hospedagem", "alimentacao"] }));
    expect(visiveis.map((i) => i.rotulo)).not.toContain("Hospedagem Equipe");
    expect(visiveis.map((i) => i.rotulo)).not.toContain("Alimentação Equipe");
    expect(visiveis).toHaveLength(5);
  });

  it("item VAZIO continua saindo — vazio é pergunta em aberto, não resposta", () => {
    // Esconder o vazio daria por respondido o que ninguém respondeu; a linha
    // sai em branco no documento para o fornecedor preencher.
    const visiveis = daLogistica(logistica({ alimentacao: "" }));
    expect(visiveis.map((i) => i.rotulo)).toContain("Alimentação Equipe");
  });

  it("tudo marcado devolve lista vazia — a seção inteira fica fora", () => {
    const tudo = logistica({ naoAplicaveis: CAMPOS_LOGISTICA.map((c) => c.campo) });
    expect(daLogistica(tudo)).toEqual([]);
  });

  it("OS antiga, sem a lista, se comporta como nada marcado", () => {
    const antiga = logistica();
    delete antiga.naoAplicaveis;
    expect(daLogistica(antiga)).toHaveLength(CAMPOS_LOGISTICA.length);
    expect(naoSeAplica(antiga, "hospedagem")).toBe(false);
    expect(daLogistica(undefined)).toHaveLength(CAMPOS_LOGISTICA.length);
  });

  describe("marcar e desmarcar", () => {
    it("marcar NÃO apaga o que foi digitado", () => {
      const marcada = alternarNaoSeAplica(logistica(), "hospedagem");
      expect(naoSeAplica(marcada, "hospedagem")).toBe(true);
      expect(marcada.hospedagem).toBe("Hotel Ouro Minas");
    });

    it("desmarcar devolve o item — com o texto intacto", () => {
      const marcada = alternarNaoSeAplica(logistica(), "hospedagem");
      const voltou = alternarNaoSeAplica(marcada, "hospedagem");
      expect(naoSeAplica(voltou, "hospedagem")).toBe(false);
      expect(voltou.hospedagem).toBe("Hotel Ouro Minas");
      expect(daLogistica(voltou).map((i) => i.rotulo)).toContain("Hospedagem Equipe");
    });

    it("marcar duas vezes não duplica a entrada na lista", () => {
      const uma = alternarNaoSeAplica(logistica(), "hospedagem");
      const outra = alternarNaoSeAplica(uma, "alimentacao");
      expect(outra.naoAplicaveis).toEqual(["hospedagem", "alimentacao"]);
    });
  });
});

/**
 * Infraestrutura usa a MESMA mecânica da Logística — é o ponto de ter uma só.
 * Estes casos existem para provar que a segunda lista está de fato ligada nela,
 * e não é uma cópia que ficou para trás.
 */
describe("infraestrutura que não se aplica", () => {
  const infra = (p: Partial<Infraestrutura> = {}): Infraestrutura => ({
    energia: "220V trifásico",
    internet: "Wi-Fi do local",
    pontosEletricos: "8 pontos",
    estruturas: "",
    servicosApoio: "Carregadores",
    artLaudos: "ART emitida",
    ...p,
  });

  it("os seis itens saem quando nada está marcado", () => {
    expect(itensParaDocumento(infra(), CAMPOS_INFRAESTRUTURA)).toHaveLength(CAMPOS_INFRAESTRUTURA.length);
  });

  it("o item marcado some do documento e da planilha", () => {
    const visiveis = itensParaDocumento(infra({ naoAplicaveis: ["internet", "artLaudos"] }), CAMPOS_INFRAESTRUTURA);
    expect(visiveis.map((i) => i.rotulo)).toEqual([
      "Energia", "Pontos Elétricos", "Estruturas Diversas", "Serviços de Apoio",
    ]);
  });

  it("marcar não apaga o texto, e desmarcar devolve o item", () => {
    const marcada = alternarNaoSeAplica(infra(), "internet");
    expect(naoSeAplica(marcada, "internet")).toBe(true);
    expect(marcada.internet).toBe("Wi-Fi do local");
    const voltou = alternarNaoSeAplica(marcada, "internet");
    expect(naoSeAplica(voltou, "internet")).toBe(false);
    expect(voltou.internet).toBe("Wi-Fi do local");
  });

  it("OS antiga, sem a lista, se comporta como nada marcado", () => {
    expect(itensParaDocumento(undefined, CAMPOS_INFRAESTRUTURA)).toHaveLength(CAMPOS_INFRAESTRUTURA.length);
  });

  it("os rótulos são os do documento — é deles que as três saídas leem", () => {
    expect(CAMPOS_INFRAESTRUTURA.map((c) => c.rotulo)).toEqual([
      "Energia", "Internet", "Pontos Elétricos", "Estruturas Diversas",
      "Serviços de Apoio", "ART, Laudos e Certificações",
    ]);
  });
});

/**
 * Quem decide se a OS tem contrato é a EC, na coluna Contrato de cada item.
 * Antes o bloco saía em toda OS — inclusive na do fornecedor que só emite nota,
 * e aí o documento dele descrevia com valores e data um contrato inexistente.
 */
describe("a OS tem contrato?", () => {
  const contratoVazio = {
    contratante: "" as const, descritivoServicos: "", informacoesComplementares: "",
    valorUnitario: 0, valorTotal: 0, descontoNegociado: 0, valorAPagar: 0,
    dataContrato: "", rubrica: "",
  };
  const comContrato = (ct: Partial<Os["contrato"]> = {}) => ({ contrato: { ...contratoVazio, ...ct } });
  const item = (contratoStatus: EcLinha["contratoStatus"]) => ({ contratoStatus });

  it("basta UM item pedindo contrato — a OS é uma só, o contrato também", () => {
    expect(temContrato(comContrato(), [item("Não se Aplica"), item("Emitir")])).toBe(true);
    expect(temContrato(comContrato(), [item("Emitir Nova Versão")])).toBe(true);
  });

  it("com todos em 'Não se Aplica', não há contrato nenhum", () => {
    expect(temContrato(comContrato(), [item("Não se Aplica"), item("Não se Aplica")])).toBe(false);
  });

  it("'Pendente' e 'OK' não pedem emissão — o bloco espera a decisão na EC", () => {
    expect(temContrato(comContrato(), [item("Pendente")])).toBe(false);
    expect(temContrato(comContrato(), [item("OK")])).toBe(false);
  });

  it("OS sem item vinculado não inventa contrato", () => {
    expect(temContrato(comContrato(), [])).toBe(false);
  });

  /**
   * A trava que impede o dado de sumir: o que a equipe escreveu no contrato
   * segura o bloco na tela mesmo que alguém mexa no status da linha depois.
   */
  it("contrato já escrito pela equipe continua aparecendo, mudem o status ou não", () => {
    expect(temContrato(comContrato({ rubrica: "MC" }), [item("Não se Aplica")])).toBe(true);
    expect(temContrato(comContrato({ informacoesComplementares: "Multa de 10%" }), [item("OK")])).toBe(true);
  });

  /**
   * Só valem os campos que ninguém preenche sozinho. Contratante, descritivo,
   * valores, forma de pagamento e data entram automaticamente em toda OS COM
   * contrato — se contassem aqui, "tem contrato" responderia sempre que sim.
   */
  it("o que o sistema preenche sozinho não conta como contrato escrito", () => {
    expect(contratoPreenchido({ ...contratoVazio, contratante: "Polobh" })).toBe(false);
    expect(contratoPreenchido({ ...contratoVazio, descritivoServicos: "Sonorização" })).toBe(false);
    expect(contratoPreenchido({ ...contratoVazio, dataContrato: "2026-08-20" })).toBe(false);
    expect(contratoPreenchido({ ...contratoVazio, valorTotal: 10000, valorAPagar: 10000 })).toBe(false);
    expect(contratoPreenchido({ ...contratoVazio, formaPagamento: "À vista" })).toBe(false);
    // ...e espaço em branco não é texto escrito.
    expect(contratoPreenchido({ ...contratoVazio, rubrica: "   " })).toBe(false);
  });
});

/**
 * Trocar o fornecedor de uma OS que JÁ SAIU da casa não é edição: é outro
 * contrato. A OS anterior existe do lado do primeiro fornecedor, e deixar duas
 * empresas com o mesmo número na mão é o que a versão nova evita.
 */
describe("troca de fornecedor numa OS", () => {
  const forn = (cnpj: string, razaoSocial: string) => ({ cnpj, razaoSocial });
  const som = forn("11.111.111/0001-11", "Som & Luz Produções LTDA");
  const outro = forn("22.222.222/0001-22", "Monta Tudo Estruturas LTDA");

  describe("quem é o mesmo fornecedor", () => {
    it("o CNPJ manda quando existe dos dois lados", () => {
      // Mesmo CNPJ, razão social redigitada de outro jeito: é o mesmo.
      expect(mesmoFornecedor(som, forn("11111111000111", "SOM E LUZ"))).toBe(true);
      // CNPJs diferentes: a razão social parecida não salva.
      expect(mesmoFornecedor(som, forn("22.222.222/0001-22", "Som & Luz Produções LTDA"))).toBe(false);
    });

    it("sem CNPJ, compara a razão social sem acento, caixa nem espaço sobrando", () => {
      expect(mesmoFornecedor(forn("", "Som & Luz Produções LTDA"), forn("", "  SOM & LUZ PRODUCOES LTDA "))).toBe(true);
      expect(mesmoFornecedor(forn("", "Som & Luz"), forn("", "Monta Tudo"))).toBe(false);
    });
  });

  it("em rascunho, trocar é corrigir — não gera versão", () => {
    // A OS nasce com o fornecedor que a EC apontou, e o primeiro ajuste de quem
    // está montando o documento costuma ser exatamente esse.
    expect(exigeNovaVersaoPorFornecedor({ status: "Rascunho" }, som, outro)).toBe(false);
  });

  it("emitida, trocar exige versão nova", () => {
    // "Disparada" deixou de ser status em 15/09/2026: o envio ao fornecedor
    // virou carimbo (`disparadaEm`) ao lado de uma OS Emitida.
    expect(exigeNovaVersaoPorFornecedor({ status: "Emitida" }, som, outro)).toBe(true);
  });

  it("mexer no cadastro do MESMO fornecedor não é troca", () => {
    // Corrigir a razão social, preencher o CNPJ que faltava: continua sendo ele.
    expect(exigeNovaVersaoPorFornecedor({ status: "Emitida" }, som, forn("11111111000111", "Som e Luz Producoes"))).toBe(false);
  });

  it("fornecedor apagado no meio da edição é campo em branco, não troca", () => {
    expect(exigeNovaVersaoPorFornecedor({ status: "Emitida" }, som, forn("", ""))).toBe(false);
    expect(exigeNovaVersaoPorFornecedor({ status: "Emitida" }, som, undefined)).toBe(false);
  });

  it("OS já encerrada não entra na conta", () => {
    // Cancelada/Arquivada não reemite: a própria RPC recusa.
    expect(exigeNovaVersaoPorFornecedor({ status: "Cancelada" }, som, outro)).toBe(false);
  });
});

describe("itens criados dentro da OS (15/09/2026)", () => {
  const comExtras = (
    extras: { id: string; rotulo: string; valor: string; naoSeAplica?: boolean }[],
    ordem?: string[]
  ): Logistica => ({
    transporteMaterial: "Por conta do fornecedor",
    transporteEquipe: "",
    hospedagem: "",
    alimentacao: "",
    estacionamentoCarga: "",
    estacionamentoEquipe: "",
    uniformizacao: "",
    extras,
    ordem,
  });

  it("o item criado sai no documento junto dos fixos", () => {
    const lista = itensParaDocumento(
      comExtras([{ id: "x1", rotulo: "Gerador 180 kVA", valor: "Por conta da Pólobh" }]),
      CAMPOS_LOGISTICA
    );
    expect(lista.map((i) => i.rotulo)).toContain("Gerador 180 kVA");
    // Sem ordem definida, ele entra depois dos fixos — que é como nasce.
    expect(lista.at(-1)).toEqual({ rotulo: "Gerador 180 kVA", valor: "Por conta da Pólobh" });
  });

  it("o item criado também aceita 'não se aplica' e some do documento", () => {
    const lista = itensParaDocumento(
      comExtras([{ id: "x1", rotulo: "Gerador", valor: "…", naoSeAplica: true }]),
      CAMPOS_LOGISTICA
    );
    expect(lista.map((i) => i.rotulo)).not.toContain("Gerador");
  });

  it("a ordem reordena fixos e criados na mesma lista", () => {
    const lista = itensParaDocumento(
      comExtras([{ id: "x1", rotulo: "Gerador", valor: "" }], ["x1", "transporteMaterial"]),
      CAMPOS_LOGISTICA
    );
    expect(lista[0].rotulo).toBe("Gerador");
    expect(lista[1].rotulo).toBe("Transporte Material");
  });

  // Uma OS gravada antes disto não tem `ordem`, e um item fixo que a casa venha
  // a acrescentar não aparece na ordem de nenhuma OS antiga: os dois casos caem
  // na mesma regra — quem não está na ordem entra no fim, na ordem natural.
  it("quem não está na ordem entra no fim, sem sumir", () => {
    const lista = itensParaDocumento(comExtras([], ["uniformizacao"]), CAMPOS_LOGISTICA);
    expect(lista[0].rotulo).toBe("Uniformização Equipe");
    expect(lista).toHaveLength(CAMPOS_LOGISTICA.length);
  });
});

describe("OS de projeto incentivado", () => {
  const os = (modalidade: string, modelo?: string) =>
    ({ projeto: { modalidade }, contrato: { modelo } }) as unknown as Parameters<typeof osIncentivada>[0];
  it("cultural é incentivado; corporativo não mostra lei de incentivo", () => {
    expect(osIncentivada(os("Cultural"))).toBe(true);
    expect(osIncentivada(os("Corporativo"))).toBe(false);
  });
  it("corporativo com contrato no modelo Cultural conta como incentivado", () => {
    expect(osIncentivada(os("Corporativo", "Cultural"))).toBe(true);
  });
});
