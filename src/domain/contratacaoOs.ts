/**
 * A CONTRATAÇÃO: o que a OS decidiu pagar, item a item.
 *
 * Divisão de trabalho entre os dois documentos (revisão de 09/09/2026):
 *   · na EC a produção LEVANTA o preço — quanto o item custaria de cada uma das
 *     três formas, ou "Não se aplica" (ver `OPCOES_VALOR_ITEM`). Lá não há
 *     escolha;
 *   · na OS se FECHA a condição — qual forma vale para cada item, por quanto, e
 *     com que BV. É aqui que a decisão mora, porque é a OS que vira contrato
 *     com o fornecedor.
 *
 * Os valores CHEGAM prontos da EC (`itensDaEc`) e seguem editáveis: a OS é uma
 * negociação, e o número que fecha nem sempre é o que foi estimado. O que a EC
 * registrou fica lá, intacto — quem quiser comparar tem os dois.
 *
 * A JUSTIFICATIVA é uma POR FORMA, e não uma por item como na EC. Ali só uma
 * das três valia, então uma bastava; aqui as três convivem na mesma tabela, e
 * cada uma responde por si: por que este item sai sem BV, por que aquele sai
 * com BV abaixo do padrão.
 */
import type { BvItem, DocumentoFiscal, EcLinha, ItemContratacaoOs, OpcaoContratacaoOs, OpcaoValorDefinida, Os } from "@/data/types";
import { BV_PADRAO_PERCENTUAL, OPCOES_VALOR_ITEM, opcaoNaoSeAplica, r2 } from "@/domain/calc";

/** Forma de cobrança sem valor definido — o estado inicial de tudo. */
const opcaoVazia = (): OpcaoContratacaoOs => ({ naoSeAplica: false, valor: 0, justificativaBv: "" });

export const itemContratacaoVazio = (ecLinhaId = ""): ItemContratacaoOs => ({
  ecLinhaId,
  comBvNf: opcaoVazia(),
  bv: { modo: "percentual", valor: 0 },
  semBvComNf: opcaoVazia(),
  semBvSemNf: opcaoVazia(),
});

/**
 * A contratação como a EC a entrega: valores, "não se aplica" e BV vindos do
 * item, prontos para serem confirmados ou renegociados na OS.
 */
export function itemDaLinhaEc(l: EcLinha): ItemContratacaoOs {
  const de = (opcao: OpcaoValorDefinida, valor: number, justificativaBv = ""): OpcaoContratacaoOs => ({
    naoSeAplica: opcaoNaoSeAplica(l, opcao),
    valor: Number(valor ?? 0) || 0,
    justificativaBv,
  });
  const bv: BvItem = l.bv ?? { modo: "percentual", valor: 0, justificativa: "" };
  return {
    ecLinhaId: l.id,
    // A justificativa do BV da EC entra na forma a que ela pertence: a com BV.
    comBvNf: de("comBvNf", l.valorComBvNf, bv.justificativa ?? ""),
    bv: { modo: bv.modo, valor: Number(bv.valor ?? 0) || 0 },
    semBvComNf: de("semBvComNf", l.valorSemBvComNf),
    semBvSemNf: de("semBvSemNf", l.valorSemBvSemNf),
  };
}

/**
 * Casa o que já foi decidido na OS com os itens que ela consolida hoje.
 *
 * A OS pode ganhar ou perder itens depois de aberta (reemissão, mudança de
 * escopo), e o que já foi negociado não pode se perder no caminho: item que
 * continua mantém a decisão gravada; item novo entra com o que a EC diz; item
 * que saiu da OS some. A ORDEM é a dos itens da EC, para a tabela do documento
 * sair na mesma sequência da estimativa.
 */
export function sincronizarContratacao(itens: ItemContratacaoOs[], linhas: EcLinha[]): ItemContratacaoOs[] {
  const gravados = new Map(itens.map((i) => [i.ecLinhaId, i]));
  return linhas.map((l) => {
    const gravado = gravados.get(l.id);
    // DECIDIDO = o Financeiro já escolheu a forma. Só aí a OS guarda os valores
    // dela. Antes disso os valores são da EC e a acompanham (15/10/2026): a OS
    // nascida antes de as Alternativas de Custos serem preenchidas ficava com
    // R$ 0,00 congelado, e corrigir a EC não chegava à OS.
    return gravado?.forma ? gravado : itemDaLinhaEc(l);
  });
}

/* ------------------------------- o resumo -------------------------------- */

/**
 * As três formas na ordem do modelo da OS, com os dois rótulos que o sistema
 * usa: o `curto` cabe na coluna estreita da tabela (tela, PDF e planilha), o
 * `longo` é o do formulário, onde há espaço para dizer a coisa por inteiro.
 * Mora aqui para os três lugares nunca discordarem sobre o nome de uma coluna.
 */
export const COLUNAS_CONTRATACAO = [
  { chave: "comBvNf", curto: "Com BV e NF", longo: "Valor com BV e NF" },
  { chave: "semBvComNf", curto: "Sem BV e Com NF", longo: "Valor Sem BV e Com Nota Fiscal" },
  { chave: "semBvSemNf", curto: "Sem BV e Sem NF", longo: "Valor Sem BV e Sem NF" },
] as const satisfies readonly { chave: OpcaoValorDefinida; curto: string; longo: string }[];


/** O que uma forma de cobrança vale neste item — `null` é "não se aplica". */
const valorDefinido = (o: OpcaoContratacaoOs | undefined): number | null =>
  !o || o.naoSeAplica ? null : Number(o.valor ?? 0) || 0;

/**
 * A forma de pagamento que vale neste item: a ESCOLHIDA (se ainda tem valor) ou,
 * quando só uma das três tem valor, essa. `undefined` = falta escolher — e aí o
 * resumo cai no comportamento antigo (mostra o que cada forma valeria), para OS
 * gravada antes da escolha existir continuar se lendo como sempre.
 */
export function formaDoItem(i: ItemContratacaoOs): OpcaoValorDefinida | undefined {
  const vale = (o: OpcaoValorDefinida) => (valorDefinido(i[o]) ?? 0) > 0;
  if (i.forma && vale(i.forma)) return i.forma;
  const validas = OPCOES_VALOR_ITEM.map((o) => o.opcao).filter(vale);
  return validas.length === 1 ? validas[0] : undefined;
}

/**
 * O documento fiscal que a forma de pagamento escolhida exige (21/10/2026).
 *
 * A escolha da forma já diz qual documento o fornecedor entrega: as duas com
 * NF pedem Nota Fiscal; "Sem BV e Sem NF" é paga por Fatura; uma OS com itens
 * dos dois tipos pede os dois. `""` = nenhum item tem forma ainda — aí o
 * documento segue escolhido à mão.
 */
export function documentoFiscalDaContratacao(itens: ItemContratacaoOs[]): DocumentoFiscal {
  let comNota = false;
  let semNota = false;
  for (const i of itens) {
    const forma = formaDoItem(i);
    if (forma === "semBvSemNf") semNota = true;
    else if (forma) comNota = true;
  }
  if (comNota && semNota) return "Fatura e Nota Fiscal";
  if (comNota) return "Nota Fiscal";
  if (semNota) return "Fatura";
  return "";
}

/**
 * O valor da OS: o que vai ser pago ao fornecedor — a soma da forma adotada em
 * cada item. Item sem forma definida ainda não conta. NUNCA o valor do item na
 * EC: aquele é o preço ao cliente.
 */
export function valorDaContratacao(itens: ItemContratacaoOs[]): number {
  return r2(
    itens.reduce((s, i) => {
      const forma = formaDoItem(i);
      return s + (forma ? valorDefinido(i[forma]) ?? 0 : 0);
    }, 0)
  );
}

/**
 * Leva o valor da OS ao Faturamento, ao Contrato e ao prazo de pagamento.
 *
 * Só move o que ainda ESPELHA um valor anterior (`de`): quem ajustou à mão
 * tinha um motivo. As parcelas acompanham quando há uma só ("Pagamento único")
 * — dividida em várias, a divisão é decisão de alguém.
 *
 * Caso que motivou (22/10/2026): OSs emitidas até 21/10 nasciam com o valor do
 * item na EC (preço ao cliente) nesses três lugares — R$ 1.500 numa OS cujo
 * fornecedor recebe R$ 1.200.
 */
export function acompanharValorDaOs(os: Os, de: number[], para: number): Os {
  if (!(para > 0)) return os;
  const espelha = (v: number) => de.some((d) => r2(d) === r2(v)) && r2(v) !== r2(para);
  const { financeiro: f, contrato: c, orcamento: o } = os;
  const parcelas =
    o.parcelas.length === 1 && espelha(o.parcelas[0].valor) ? [{ ...o.parcelas[0], valor: para }] : o.parcelas;
  return {
    ...os,
    orcamento: parcelas === o.parcelas ? o : { ...o, parcelas },
    financeiro: espelha(f.valorTotal)
      ? { ...f, valorUnitario: para, valorTotal: para, valorAPagar: r2(para - (f.descontoNegociado || 0)) }
      : f,
    contrato: espelha(c.valorTotal)
      ? { ...c, valorUnitario: para, valorTotal: para, valorAPagar: r2(para - (c.descontoNegociado || 0)) }
      : c,
  };
}

/**
 * Mantém a OS presa ao VALOR DA CONTRATAÇÃO — a forma de pagamento escolhida em
 * cada item, somada (03/11/2026).
 *
 * Caso que motivou: o item mudou na EC de R$ 1.300 para R$ 1.550; a OS recebeu o
 * valor novo nas formas de pagamento, mas a parcela única e o Faturamento
 * ficaram em R$ 1.300 — e a parcela não aceitava passar disso.
 *
 * - A PARCELA ÚNICA é sempre o valor da contratação (pedido da Produção).
 * - Faturamento e Contrato seguem quando ainda espelham o valor anterior (a
 *   memória `valorContratado`, o valor da EC, ou — na OS gravada antes dessa
 *   memória existir — a própria parcela única, que era o espelho dele).
 *   Ajuste feito à mão fica.
 */
export function alinharAoValorContratado(os: Os, para: number): Os {
  if (!(para > 0)) return os;
  const o = os.orcamento;
  const anterior = o.valorContratado;
  const de = [o.valorEc];
  if (anterior !== undefined) de.push(anterior);
  else if (o.parcelas.length === 1) de.push(o.parcelas[0].valor);
  const r = acompanharValorDaOs(os, de, para);
  const parcelas =
    r.orcamento.parcelas.length === 1 && r2(r.orcamento.parcelas[0].valor) !== r2(para)
      ? [{ ...r.orcamento.parcelas[0], valor: para }]
      : r.orcamento.parcelas;
  return { ...r, orcamento: { ...r.orcamento, parcelas, valorContratado: para } };
}

/**
 * O que impede a contratação de estar pronta para a emissão (lista vazia = ok).
 *
 * Três coisas, decididas com a Pólobh (29/09/2026): todo item tem uma forma
 * escolhida; a forma escolhida tem valor naquele item; e a OS NÃO mistura
 * formas — "COM BV e COM NF", "SEM BV e COM NF" e "SEM BV e SEM NF" não
 * convivem numa mesma ordem de serviço.
 */
export function problemasDaContratacao(itens: ItemContratacaoOs[], nomeDoItem: (ecLinhaId: string) => string): string[] {
  const out: string[] = [];
  const usadas = new Set<OpcaoValorDefinida>();
  for (const i of itens) {
    const nome = nomeDoItem(i.ecLinhaId);
    if (i.forma && !((valorDefinido(i[i.forma]) ?? 0) > 0)) {
      out.push(`${nome}: a forma escolhida não tem valor neste item — escolha outra ou ajuste a EC.`);
      continue;
    }
    const forma = formaDoItem(i);
    if (!forma) {
      out.push(`${nome}: escolha a forma de pagamento.`);
      continue;
    }
    usadas.add(forma);
  }
  if (usadas.size > 1) {
    const rotulos = COLUNAS_CONTRATACAO.filter((c) => usadas.has(c.chave)).map((c) => c.curto);
    out.push(`A OS mistura formas de pagamento (${rotulos.join(", ")}) — use a mesma em todos os itens.`);
  }
  return out;
}

export interface LinhaResumoContratacao {
  ecLinhaId: string;
  item: string;
  comBvNf: number | null;
  semBvComNf: number | null;
  semBvSemNf: number | null;
}

export interface ResumoContratacao {
  linhas: LinhaResumoContratacao[];
  totais: { comBvNf: number; semBvComNf: number; semBvSemNf: number };
  /**
   * Quais colunas têm algum valor. O documento que vai ao fornecedor mostra só
   * essas: uma coluna inteira zerada não é informação, é ruído numa tabela que
   * ele vai conferir linha a linha.
   */
  colunas: { comBvNf: boolean; semBvComNf: boolean; semBvSemNf: boolean };
  /**
   * O que gera nota fiscal: as duas colunas "com NF". É sobre este valor que a
   * OS informa os dados de emissão — o "sem NF" não entra, por definição.
   */
  totalComNota: number;
  /** O que é pago sem nota. Sai separado, para não se somar ao de cima. */
  totalSemNota: number;
  /** O valor total contratado — a soma do que cada item adotou. */
  contratado: number;
  /** O BV total, só dos itens que adotaram "com BV e NF". */
  bvTotal: number;
  /** Contratado menos o BV. */
  liquido: number;
}

/**
 * O Resumo dos Custos da OS: o que foi decidido item a item, com os totais.
 *
 * O nome do item vem da EC (é ela que o batiza); o valor vem da contratação (é
 * a OS que o fecha).
 */
export function resumoContratacao(itens: ItemContratacaoOs[], linhas: EcLinha[]): ResumoContratacao {
  const nome = new Map(linhas.map((l) => [l.id, l.item?.trim() || l.descricao?.trim() || "(item sem nome)"]));
  // Com a forma definida, só ela aparece no item; sem forma, o comportamento de
  // antes (as três), para OS antiga não mudar de leitura.
  const doItem = (i: ItemContratacaoOs, opcao: OpcaoValorDefinida) => {
    const forma = formaDoItem(i);
    return forma && forma !== opcao ? null : valorDefinido(i[opcao]);
  };
  const out: LinhaResumoContratacao[] = itens.map((i) => ({
    ecLinhaId: i.ecLinhaId,
    item: nome.get(i.ecLinhaId) ?? "(item sem nome)",
    comBvNf: doItem(i, "comBvNf"),
    semBvComNf: doItem(i, "semBvComNf"),
    semBvSemNf: doItem(i, "semBvSemNf"),
  }));

  const somar = (ler: (l: LinhaResumoContratacao) => number | null) =>
    r2(out.reduce((total, l) => total + (ler(l) ?? 0), 0));
  const totais = {
    comBvNf: somar((l) => l.comBvNf),
    semBvComNf: somar((l) => l.semBvComNf),
    semBvSemNf: somar((l) => l.semBvSemNf),
  };
  // "Tem valor" é ter número maior que zero em alguma linha: uma coluna toda
  // "não se aplica", ou toda zerada, não vai ao documento.
  const temValor = (ler: (l: LinhaResumoContratacao) => number | null) =>
    out.some((l) => (ler(l) ?? 0) > 0);

  return {
    linhas: out,
    totais,
    colunas: {
      comBvNf: temValor((l) => l.comBvNf),
      semBvComNf: temValor((l) => l.semBvComNf),
      semBvSemNf: temValor((l) => l.semBvSemNf),
    },
    totalComNota: r2(totais.comBvNf + totais.semBvComNf),
    totalSemNota: totais.semBvSemNf,
    contratado: r2(totais.comBvNf + totais.semBvComNf + totais.semBvSemNf),
    bvTotal: bvDaContratacao(itens).valor,
    liquido: r2(totais.comBvNf + totais.semBvComNf + totais.semBvSemNf - bvDaContratacao(itens).valor),
  };
}

/* ---------------------------------- BV ----------------------------------- */

/**
 * O BV desta contratação: base, reais e porcento.
 *
 * A base é o valor COM BV do item — as outras duas formas dizem no nome que não
 * há BV. Mesma conta da EC (`bvDaLinha`), agora sobre o valor NEGOCIADO: se a
 * OS fechou por outro número, o BV acompanha.
 */
export function bvDoItem(i: ItemContratacaoOs): { base: number; valor: number; percentual: number } {
  // O BV só existe quando o item adotou "com BV e NF" (ou ainda não adotou nada).
  const forma = formaDoItem(i);
  const base = forma && forma !== "comBvNf" ? 0 : valorDefinido(i.comBvNf) ?? 0;
  if (!base) return { base: 0, valor: 0, percentual: 0 };
  const bv = i.bv ?? { modo: "percentual" as const, valor: 0 };
  const numero = Number(bv.valor ?? 0) || 0;
  const valor = bv.modo === "fixo" ? numero : r2((base * numero) / 100);
  return { base, valor: r2(valor), percentual: r2((valor / base) * 100) };
}

/** O BV de toda a OS — a soma dos itens, e o percentual que ela representa. */
export function bvDaContratacao(itens: ItemContratacaoOs[]): { base: number; valor: number; percentual: number } {
  let base = 0;
  let valor = 0;
  for (const i of itens) {
    const bv = bvDoItem(i);
    base += bv.base;
    valor += bv.valor;
  }
  return { base: r2(base), valor: r2(valor), percentual: base ? r2((valor / base) * 100) : 0 };
}

/**
 * A justificativa é obrigatória nesta forma, neste item?
 *
 * Sim sempre que a forma VALE (tem valor e não está marcada como "não se
 * aplica") e o BV dela fica abaixo do padrão da casa — o que inclui, por
 * definição, as duas formas "sem BV". É a mesma régua da EC, agora por forma:
 * ali só uma valia por item, aqui as três convivem.
 */
export function exigeJustificativa(i: ItemContratacaoOs, opcao: OpcaoValorDefinida): boolean {
  const valor = valorDefinido(i[opcao]);
  if (!valor) return false;
  return opcao === "comBvNf" ? bvDoItem(i).percentual < BV_PADRAO_PERCENTUAL : true;
}

/** Formas que valem neste item e ainda estão sem o motivo escrito. */
export function justificativasFaltando(i: ItemContratacaoOs): OpcaoValorDefinida[] {
  return OPCOES_VALOR_ITEM.map((o) => o.opcao).filter(
    (opcao) => exigeJustificativa(i, opcao) && !(i[opcao]?.justificativaBv ?? "").trim()
  );
}
