/**
 * Cálculos da EC (seção 4 do brief) e helpers de numeração/consolidação.
 * Percentuais fixos: honorários 15%, encargos 16,33%.
 */
import type { BvItem, Ec, EcLinha, OpcaoValorDefinida, Producao, Fornecedor, Os, TaxaConfig } from "@/data/types";
import { brl, dataBRCurta, documentoCompleto } from "@/lib/format";
import { htmlParaLinhas } from "@/lib/htmlTexto";
import { gerarApelidoFornecedor } from "@/domain/fornecedor";

export const HONORARIOS = 0.15;
export const ENCARGOS = 0.1633;

export const honorariosPadrao = (): TaxaConfig => ({ modo: "percentual", valor: HONORARIOS, minimo: 0 });
export const encargosPadrao = (): TaxaConfig => ({ modo: "percentual", valor: ENCARGOS, minimo: 0 });

/**
 * Lê a taxa (honorários ou encargos) como veio do banco, sem perder o padrão.
 *
 * Havia EC gravada no formato antigo, `{ modo, percentual: 0.1633 }`, com o
 * campo `valor` ausente ou zerado — e a tela, que só lê `valor`, mostrava
 * "Encargos 0 %" numa EC que devia usar os 16,33% da casa. Quando `valor` não
 * diz nada e o campo antigo diz, vale o antigo. O objeto devolvido não carrega o
 * `percentual`: gravado de novo, um zero digitado à mão continua sendo zero.
 */
export function normalizarTaxa(bruta: unknown, padrao: TaxaConfig): TaxaConfig {
  if (!bruta || typeof bruta !== "object") return padrao;
  const t = bruta as { modo?: string; valor?: unknown; percentual?: unknown; minimo?: unknown };
  const modo = t.modo === "fixo" ? "fixo" : "percentual";
  let valor = Number(t.valor);
  if (!Number.isFinite(valor)) valor = padrao.valor;
  if (modo === "percentual" && !(valor > 0) && Number(t.percentual) > 0) valor = Number(t.percentual);
  const minimo = Number(t.minimo);
  return { modo, valor, ...(minimo > 0 ? { minimo } : {}) };
}

/** Rótulos padrão do resumo de custos (usados quando a EC não tem rótulo personalizado). */
export const ROTULO_HONORARIOS_PADRAO = "Honorários Pólobh (Organização e Planejamento)";
export const ROTULO_ENCARGOS_PADRAO = "Encargos (sobre serviços de terceiros)";

/** Valor de uma taxa: se fixo, o próprio valor; se percentual, base × fração. */
export function valorTaxa(cfg: TaxaConfig, base: number): number {
  return cfg.modo === "fixo" ? (cfg.valor || 0) : base * (cfg.valor || 0);
}

/** Piso da taxa em R$ (0 = sem piso). Só existe no modo percentual. */
export const taxaMinima = (cfg: TaxaConfig): number =>
  cfg.modo === "percentual" ? Math.max(0, cfg.minimo || 0) : 0;

/** Percentual nunca passa de 100,00% — vale para Honorários e Encargos. */
export const PERCENTUAL_MAXIMO = 1;
export const limitarPercentual = (fracao: number): number =>
  Math.min(PERCENTUAL_MAXIMO, Math.max(0, Number.isFinite(fracao) ? fracao : 0));

/**
 * Rótulo curto de uma taxa para o resumo e para a planilha: "15%",
 * "15% · taxa mínima R$ 5.000,00" ou "valor fixo". Quando o piso é o que está
 * valendo, o rótulo diz "(mínimo aplicado)" — a EC precisa explicar por que o
 * valor não bate com a conta do percentual.
 */
export function rotuloTaxa(cfg: TaxaConfig, minimoAplicado = false): string {
  if (cfg.modo === "fixo") return "valor fixo";
  const percentual = `${((cfg.valor || 0) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  const minimo = taxaMinima(cfg);
  if (!minimo) return percentual;
  return `${percentual} · taxa mínima ${brl(minimo)}${minimoAplicado ? " (mínimo aplicado)" : ""}`;
}

export interface EcTotais {
  somaLinhasPolobh: number;
  somaLinhasCliente: number;
  somaProducao: number;
  somaFornecedores: number; // Σ valor Pólobh (linhas) + Σ produção
  somaCliente: number;
  honorariosPolobh: number;
  honorariosCliente: number;
  /** true quando a taxa mínima superou o percentual e passou a valer. */
  honorariosMinimoAplicado: boolean;
  encargos: number;
  subTotalPolobh: number;
  valorTotalBruto: number;
  faturamentoPolobh: number;
  faturamentoTerceiros: number;
}

export const r2 = (n: number) => Math.round(n * 100) / 100;

export function totalProducao(p: Producao): number {
  return r2(
    p.despesasOperacionais * p.qtdDespesas +
      p.equipeBH * p.qtdEquipeBH +
      p.equipeViagem * p.qtdEquipeViagem +
      p.transporteBH * p.qtdTransporteBH +
      p.transporteViagem * p.qtdTransporteViagem +
      p.alimentacaoBH * p.qtdAlimentacaoBH +
      p.alimentacaoViagem * p.qtdAlimentacaoViagem
  );
}

export function calcularTotais(
  linhas: EcLinha[],
  producao: Producao,
  honorariosCfg: TaxaConfig = honorariosPadrao(),
  encargosCfg: TaxaConfig = encargosPadrao()
): EcTotais {
  // Itens ocultos não entram nos totais (ficam guardados, mas fora da conta).
  const ativas = linhas.filter((l) => !l.oculto);
  const somaLinhasPolobh = r2(
    ativas.reduce((s, l) => s + (l.valorPolobh || 0), 0)
  );
  const somaLinhasCliente = r2(
    ativas.reduce((s, l) => s + (l.valorCliente || 0), 0)
  );
  const somaProducao = totalProducao(producao);

  const somaFornecedores = r2(somaLinhasPolobh + somaProducao);
  const somaCliente = somaLinhasCliente;

  const honorariosPercentual = r2(valorTaxa(honorariosCfg, somaFornecedores));
  // Honorários sobre o lado Cliente só fazem sentido no modo percentual.
  const honorariosCliente = r2(
    honorariosCfg.modo === "percentual" ? somaCliente * (honorariosCfg.valor || 0) : 0
  );
  // Taxa mínima: piso do honorário TOTAL (Pólobh + Cliente). Quando o percentual
  // não alcança o mínimo, a diferença entra no lado Pólobh — a linha que a Pólobh
  // fatura —, o que preserva a identidade faturamentoPólobh + terceiros = bruto.
  const minimoHonorarios = taxaMinima(honorariosCfg);
  const honorariosPercentualTotal = r2(honorariosPercentual + honorariosCliente);
  const complementoMinimo = minimoHonorarios > honorariosPercentualTotal ? r2(minimoHonorarios - honorariosPercentualTotal) : 0;
  const honorariosPolobh = r2(honorariosPercentual + complementoMinimo);
  const honorariosMinimoAplicado = complementoMinimo > 0;
  const encargos = r2(valorTaxa(encargosCfg, somaFornecedores));

  const subTotalPolobh = r2(somaFornecedores + honorariosPolobh + encargos);
  const valorTotalBruto = r2(subTotalPolobh + somaCliente + honorariosCliente);

  const faturamentoPolobh = r2(subTotalPolobh + honorariosCliente);
  const faturamentoTerceiros = somaCliente;

  return {
    somaLinhasPolobh,
    somaLinhasCliente,
    somaProducao,
    somaFornecedores,
    somaCliente,
    honorariosPolobh,
    honorariosCliente,
    honorariosMinimoAplicado,
    encargos,
    subTotalPolobh,
    valorTotalBruto,
    faturamentoPolobh,
    faturamentoTerceiros,
  };
}

/** Slug curto de um nome para compor a numeração. */
const slug = (s: string, max = 18): string =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .slice(0, max)
    .trim();

/** Comparação tolerante a caixa e acento — só para saber se um texto repete o outro. */
const chaveTexto = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");

/**
 * Numeração automática: "EC – {Cliente} – {Projeto} – V{NN}".
 *
 * O nome do cliente é omitido quando o título do projeto JÁ começa por ele. Os
 * títulos passaram a nascer como "{Apelido} – {Projeto} – {Ano}" (ver
 * `compoeTituloProjeto`), e repetir o cliente produzia números como
 * "EC – Instituto Aurora – Instituto Aurora – Festival… – V04" — que a pessoa lia
 * como se fosse outra EC, não a que ela tinha acabado de importar.
 */
export function numeroEc(
  clienteNome: string,
  projetoTitulo: string,
  versao: number
): string {
  const v = String(versao).padStart(2, "0");
  const cliente = slug(clienteNome);
  // título do projeto com folga maior (evita "comer" parte do título no número).
  const titulo = slug(projetoTitulo, 60);
  // Compara com o PRIMEIRO trecho do título: ele traz o apelido ("ACME"), que é
  // um pedaço do nome cadastrado ("ACME Comércio Ltda") — e vice-versa.
  const primeiro = chaveTexto(titulo.split("–")[0] ?? "");
  const alvo = chaveTexto(cliente);
  const jaNoTitulo = !!primeiro && !!alvo && (alvo.startsWith(primeiro) || primeiro.startsWith(alvo));
  return jaNoTitulo || !cliente ? `EC – ${titulo} – V${v}` : `EC – ${cliente} – ${titulo} – V${v}`;
}

/**
 * Título automático da EC exibido em destaque no app e base do nome do arquivo
 * Excel — padrão: "EC – {Título do Projeto} ({NN}) em {DD/MM/AA}".
 */
export function tituloEc(ec: Ec): string {
  const versao = String(ec.versao).padStart(2, "0");
  const titulo = ec.projeto?.titulo || ec.numero || "EC";
  const data = ec.criadoEm ? dataBRCurta(ec.criadoEm) : "";
  const base = `EC – ${titulo} (${versao})`;
  return data ? `${base} em ${data}` : base;
}

/**
 * Apelido do fornecedor para a numeração — o nome curto pelo qual a casa o chama.
 *
 * O sistema GERA sozinho a partir do nome (ver `gerarApelidoFornecedor`): razão
 * social vem da Receita cheia de forma jurídica e descrição de atividade, e isso
 * inchava o título da OS sem ajudar a identificar quem é. O campo `apelido` do
 * cadastro só entra quando alguém preencheu à mão — é a saída para quando a
 * redução automática não agrada.
 */
export function apelidoFornecedor(
  f: Pick<Fornecedor, "apelido" | "nomeFantasia" | "razaoSocial"> | string | undefined
): string {
  if (typeof f === "string") return gerarApelidoFornecedor(f);
  return (f?.apelido || "").trim() || gerarApelidoFornecedor(f?.nomeFantasia, f?.razaoSocial);
}

/**
 * Qual VERSÃO desta OS está sendo emitida.
 *
 * Conta as OSs que já existem para o mesmo par EC + fornecedor, inclusive as
 * canceladas: "Emitir Nova Versão" arquiva a anterior e cria a seguinte, e é
 * essa contagem que dá o (01), (02)… do título. Não confundir com `seq`, que é
 * a ordem da OS dentro da EC (uma por fornecedor, na ordem em que saíram).
 */
export function versaoOs(oss: Os[], ecId: string, fornecedorCnpj: string, fornecedorRazao: string): number {
  const digitos = (s: string) => (s || "").replace(/\D/g, "");
  const chave = (s: string) => (s || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const cnpj = digitos(fornecedorCnpj);
  const razao = chave(fornecedorRazao);
  const mesmas = oss.filter((o) => {
    if (o.ecId !== ecId) return false;
    // CNPJ manda quando existe dos dois lados; senão, compara a razão social.
    const cnpjOs = digitos(o.fornecedor?.cnpj ?? "");
    if (cnpj && cnpjOs) return cnpj === cnpjOs;
    return !!razao && chave(o.fornecedor?.razaoSocial ?? "") === razao;
  });
  return mesmas.length + 1;
}

/**
 * Título da OS: "OS – {Apelido do Cliente} – {Projeto} – {Ano} – {Apelido do
 * Fornecedor} – ({NN}) em {DD MM AA}".
 *
 * Segue o mesmo espírito do título da EC — o que identifica o documento é a
 * linguagem da casa (apelidos), não um código —, com o fornecedor no meio, já
 * que é ele quem recebe a OS, e a versão entre parênteses no fim.
 *
 * Cada pedaço tem um plano B: EC antiga, gravada antes de o projeto ter cliente
 * abreviado / nome / ano separados, cai no título completo do projeto.
 */
export function numeroOs(
  ec: Ec,
  fornecedor: Pick<Fornecedor, "apelido" | "nomeFantasia" | "razaoSocial"> | string | undefined,
  versao: number,
  criadoEm: string = new Date().toISOString()
): string {
  const p = ec.projeto;
  const cliente = (p.clienteAbreviado || ec.cliente?.apelido || ec.cliente?.nome || "").trim();
  const projeto = (p.nomeProjeto || p.titulo || "").trim();
  const ano = (p.anoProjeto || (p.evento || criadoEm || "").slice(0, 4)).trim();
  const partes = [cliente, projeto, ano, apelidoFornecedor(fornecedor)].filter(Boolean);
  const data = dataBRCurta(criadoEm);
  const numero = `(${String(versao).padStart(2, "0")})`;
  return `OS – ${partes.join(" – ")} – ${data ? `${numero} em ${data}` : numero}`;
}

export const producaoPadrao = (): Producao => ({
  despesasOperacionais: 600,
  equipeBH: 600,
  equipeViagem: 750,
  transporteBH: 125,
  transporteViagem: 200,
  alimentacaoBH: 85,
  alimentacaoViagem: 150,
  qtdDespesas: 1,
  qtdEquipeBH: 0,
  qtdEquipeViagem: 0,
  qtdTransporteBH: 0,
  qtdTransporteViagem: 0,
  qtdAlimentacaoBH: 0,
  qtdAlimentacaoViagem: 0,
});

/** Produção zerada — o bloco fixo foi descontinuado; os custos ficam no grupo EQUIPE PRODUÇÃO. */
export const producaoZerada = (): Producao => ({
  despesasOperacionais: 0, equipeBH: 0, equipeViagem: 0, transporteBH: 0, transporteViagem: 0,
  alimentacaoBH: 0, alimentacaoViagem: 0,
  qtdDespesas: 0, qtdEquipeBH: 0, qtdEquipeViagem: 0, qtdTransporteBH: 0, qtdTransporteViagem: 0,
  qtdAlimentacaoBH: 0, qtdAlimentacaoViagem: 0,
});

/**
 * Converte o antigo bloco fixo de Produção em linhas de custo (grupo EQUIPE PRODUÇÃO),
 * preservando os valores de ECs já salvas quando o card fixo foi removido. Retorna
 * só as linhas com valor > 0. O total é idêntico ao antigo `totalProducao`.
 */
export function linhasProducaoLegado(p: Producao): { item: string; descricao: string; valorPolobh: number }[] {
  const linhas = [
    { item: "Despesas operacionais", descricao: "Motoboy, cartório, Correios — Taxa Fixa Pólobh.", valorPolobh: r2(p.despesasOperacionais * p.qtdDespesas) },
    { item: "Equipe", descricao: "Diárias da equipe de produção.", valorPolobh: r2(p.equipeBH * p.qtdEquipeBH + p.equipeViagem * p.qtdEquipeViagem) },
    { item: "Transporte", descricao: "Transporte da equipe de produção.", valorPolobh: r2(p.transporteBH * p.qtdTransporteBH + p.transporteViagem * p.qtdTransporteViagem) },
    { item: "Alimentação", descricao: "Alimentação da equipe de produção.", valorPolobh: r2(p.alimentacaoBH * p.qtdAlimentacaoBH + p.alimentacaoViagem * p.qtdAlimentacaoViagem) },
  ];
  return linhas.filter((l) => l.valorPolobh > 0);
}

/* --------------------- Formas de cobrar o item (EC → OS) ------------------ */

/**
 * As três formas de cobrar um item, na ordem em que aparecem no modelo de OS da
 * Pólobh. O rótulo é o mesmo na tela e na planilha.
 *
 * Na EC elas são INFORMAÇÃO, não escolha: a produção preenche o que cada forma
 * custaria — ou responde "Não se aplica" —, e as três seguem lado a lado para a
 * OS. Quem decide por qual delas o item vai ser pago é a OS, no bloco de valores
 * negociados; a EC é onde se levanta o preço, não onde se fecha a condição.
 *
 * Havia um seletor aqui (um rádio elegendo "a que vale"), e ele obrigava a
 * produção a decidir cedo demais, num documento que ainda estava sendo montado —
 * e a decisão nem chegava à planilha, que já imprimia as três colunas de
 * qualquer jeito. Ela agora mora na OS, item a item (`src/domain/contratacaoOs.ts`).
 * Revisão de 09/09/2026.
 */
export const OPCOES_VALOR_ITEM = [
  { opcao: "comBvNf", rotulo: "Valor com BV e NF", campo: "valorComBvNf" },
  { opcao: "semBvComNf", rotulo: "Valor Sem BV e Com Nota Fiscal", campo: "valorSemBvComNf" },
  { opcao: "semBvSemNf", rotulo: "Valor Sem BV e Sem NF", campo: "valorSemBvSemNf" },
] as const satisfies readonly { opcao: OpcaoValorDefinida; rotulo: string; campo: keyof EcLinha }[];

/** "Valor do Item na EC do Projeto": o que o item custa na EC (Pólobh + Cliente). */
export function valorItemNaEc(l: Pick<EcLinha, "valorPolobh" | "valorCliente">): number {
  return r2((l.valorPolobh || 0) + (l.valorCliente || 0));
}

/**
 * A opção foi marcada como "Não se aplica" neste item?
 *
 * É diferente de valor zero: "não se aplica" é uma RESPOSTA da produção (este
 * item não é cobrado assim), e o campo em branco é uma pergunta sem resposta.
 * A planilha da OS imprime as duas coisas de jeitos diferentes.
 */
export function opcaoNaoSeAplica(l: Pick<EcLinha, "valoresNaoAplicaveis">, opcao: OpcaoValorDefinida): boolean {
  return !!l.valoresNaoAplicaveis?.includes(opcao);
}

/** Valor de uma das três formas no item — zero quando ela não se aplica. */
export function valorDaOpcao(l: EcLinha, opcao: OpcaoValorDefinida): number {
  const def = OPCOES_VALOR_ITEM.find((o) => o.opcao === opcao);
  if (!def || opcaoNaoSeAplica(l, opcao)) return 0;
  return Number(l[def.campo] ?? 0) || 0;
}

/* --------------------------- BV por item --------------------------------- */

/**
 * BV padrão da casa, em porcento. Abaixo dele — inclusive zero — a Pólobh
 * precisa registrar POR QUÊ: é a regra que a OS já aplicava, agora aplicada
 * onde o BV é de fato combinado, no item da EC.
 */
export const BV_PADRAO_PERCENTUAL = 15;

export const bvVazio = (): BvItem => ({ modo: "percentual", valor: 0, justificativa: "" });

/**
 * Trava do percentual do BV entre 0 e 100.
 *
 * Não reaproveita `limitarPercentual`: aquele trabalha em FRAÇÃO (0,15 = 15%),
 * como honorários e encargos guardam; o BV é escrito em porcento inteiro (15),
 * que é o formato que a OS já usava e que a pessoa digita.
 */
export const limitarBvPercentual = (pct: number): number =>
  Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));

/**
 * O BV deste item, em reais e em porcento.
 *
 * A base é o valor COM BV do item — é dele que sai a bonificação, e as outras
 * duas formas dizem no próprio nome que não há BV. Basta esse valor existir:
 * antes o BV só contava depois de alguém ELEGER "com BV e NF" como a forma do
 * item, e essa escolha saiu da EC (ver `OPCOES_VALOR_ITEM`) — o BV é combinado
 * junto com o preço, não depois de fechada a condição de pagamento.
 *
 * Devolve `base` junto porque a tela precisa dizer sobre o quê o percentual
 * incide, e a OS precisa somar as bases para recompor o percentual do conjunto.
 */
export function bvDaLinha(l: EcLinha): { base: number; valor: number; percentual: number } {
  const base = opcaoNaoSeAplica(l, "comBvNf") ? 0 : Number(l.valorComBvNf ?? 0) || 0;
  const bv = l.bv ?? bvVazio();
  if (!base) return { base: 0, valor: 0, percentual: 0 };
  const valor = bv.modo === "fixo" ? Number(bv.valor ?? 0) || 0 : r2((base * (Number(bv.valor ?? 0) || 0)) / 100);
  return { base, valor: r2(valor), percentual: r2((valor / base) * 100) };
}

/**
 * A justificativa do BV é obrigatória neste item?
 *
 * Duas situações pedem motivo escrito, e as duas são uma RESPOSTA da produção
 * sobre a cobrança "com BV e NF" deste item:
 *   · ela marcou "Não se aplica" — o item sai sem BV, de propósito;
 *   · ela informou o valor, e o BV combinado ficou abaixo do padrão da casa.
 *
 * O campo em branco não pede nada: ali a pergunta ainda não foi respondida, e
 * cobrar antes acenderia alerta em toda linha recém-criada. Era o `opcaoValor`
 * que fazia esse papel de "já decidiram como este item é pago?"; com o seletor
 * fora da EC, quem responde é o próprio par valor/"não se aplica".
 */
export function bvExigeJustificativa(l: EcLinha): boolean {
  // A produção RESPONDEU que este item não é cobrado com BV: é o caso que mais
  // precisa de motivo escrito.
  if (opcaoNaoSeAplica(l, "comBvNf")) return true;
  // Campo em branco é pergunta sem resposta, não "não tem BV": não cobra nada
  // ainda, senão toda linha recém-criada nasceria com alerta vermelho.
  if (!(Number(l.valorComBvNf ?? 0) || 0)) return false;
  return bvDaLinha(l).percentual < BV_PADRAO_PERCENTUAL;
}

/** Item com a justificativa pendente — o que trava a emissão da OS. */
export function bvJustificativaFaltando(l: EcLinha): boolean {
  return bvExigeJustificativa(l) && !(l.bv?.justificativa ?? "").trim();
}

/**
 * O BV do conjunto de itens que uma OS consolida.
 *
 * A OS tem um campo só, e os itens podem ter sido negociados com BVs
 * diferentes. Somar os VALORES em reais é o único jeito exato: o percentual é
 * recomposto sobre o total, de forma que o dinheiro bata mesmo quando os itens
 * divergem. As justificativas distintas entram todas, porque cada uma explica
 * um item.
 */
export function bvConsolidado(linhas: EcLinha[]): { valor: number; percentual: number; justificativa: string } {
  let valor = 0;
  let base = 0;
  const motivos: string[] = [];
  for (const l of linhas) {
    const bv = bvDaLinha(l);
    valor += bv.valor;
    base += bv.base;
    const texto = (l.bv?.justificativa ?? "").trim();
    if (texto && !motivos.includes(texto)) motivos.push(texto);
  }
  return {
    valor: r2(valor),
    percentual: base ? r2((valor / base) * 100) : 0,
    justificativa: motivos.join(" · "),
  };
}

/* ------------------------- Rentabilidade ------------------------- */

export interface RentabilidadeItem {
  estimado: number; // A — valor total estimado do item na EC
  gasto: number; // B — valor gasto até a presente data
  percent: number | null; // C — (A - B) / A; null quando A = 0
}

/** Rentabilidade de um item: A=estimado, B=gasto, C=(A-B)/A. */
export function rentabilidadeItem(l: {
  valorPolobh: number;
  valorCliente: number;
  valorGasto: number;
}): RentabilidadeItem {
  const estimado = r2((l.valorPolobh || 0) + (l.valorCliente || 0));
  const gasto = r2(l.valorGasto || 0);
  return { estimado, gasto, percent: estimado > 0 ? (estimado - gasto) / estimado : null };
}

/**
 * Gasto por linha da EC derivado das OS's: o "valor a pagar" (líquido, já com BV e
 * desconto) de cada OS é rateado entre as linhas que ela consolida, na proporção do
 * valor Pólobh de cada linha (rateio igual quando a soma dos valores é zero).
 * Assim o "Gasto" da rentabilidade sai automático, sem digitação manual.
 */
export function gastoPorLinhaViaOSs(linhas: EcLinha[], oss: Os[]): Record<string, number> {
  const valorPolobh = new Map(linhas.map((l) => [l.id, l.valorPolobh || 0]));
  const acc: Record<string, number> = {};
  for (const os of oss) {
    const ids = (os.ecLinhaIds ?? []).filter((id) => valorPolobh.has(id));
    if (!ids.length) continue;
    const pago = os.financeiro?.valorAPagar || 0;
    const soma = ids.reduce((s, id) => s + (valorPolobh.get(id) || 0), 0);
    for (const id of ids) {
      const peso = soma > 0 ? (valorPolobh.get(id) || 0) / soma : 1 / ids.length;
      acc[id] = r2((acc[id] || 0) + pago * peso);
    }
  }
  return acc;
}

/** Rentabilidade agregada de uma lista de itens. */
export function rentabilidadeTotal(linhas: { valorPolobh: number; valorCliente: number; valorGasto: number }[]): RentabilidadeItem {
  const estimado = r2(linhas.reduce((s, l) => s + (l.valorPolobh || 0) + (l.valorCliente || 0), 0));
  const gasto = r2(linhas.reduce((s, l) => s + (l.valorGasto || 0), 0));
  return { estimado, gasto, percent: estimado > 0 ? (estimado - gasto) / estimado : null };
}

/* ----------------------- Elegibilidade para emitir OS ----------------------- */

/** Item marcado para gerar OS, com o que ainda falta nele (vazio = pronto). */
export interface ItemEmissaoOs {
  linha: EcLinha;
  faltas: string[];
}

export interface AnaliseEmissaoOs {
  /** Marcados para emitir e com tudo preenchido — são estes que viram OS. */
  prontos: EcLinha[];
  /** Marcados para emitir, mas barrados: cada um com a lista do que falta. */
  bloqueados: ItemEmissaoOs[];
}

/**
 * O que ainda falta na linha para ela virar OS (lista vazia = pronta).
 *
 * Fica separado de `analisarEmissaoOs` porque a barra de seleção da EC precisa
 * antecipar o bloqueio ANTES de o item ser marcado como "Emitir" — ela roda
 * esta mesma peneira sobre o item já simulado como aprovado, para avisar na
 * hora quantos itens vão ficar travados por falta de dado fiscal.
 */
export function faltasParaEmitirOs(l: EcLinha, conferirValor = false): string[] {
  const faltas: string[] = [];
  if (l.statusAprovacao !== "OK") faltas.push("Aprovação (item ainda pendente)");
  if (!l.fornecedorRazao?.trim()) faltas.push("Fornecedor (razão social)");
  // CPF também vale (27/10/2026): pessoa física sem CNPJ é contratação comum.
  if (!documentoCompleto(l.fornecedorCnpj)) faltas.push("CPF ou CNPJ do fornecedor");
  // DOCUMENTO PG, CÓDIGO DE SERVIÇO e PEDIDO DE COMPRA saíram desta peneira
  // (15/09/2026), e isso era um nó: a EC exigia, para emitir a OS, três dados
  // que só a OS produz. O check-list da Pólobh diz, com todas as letras, que
  // eles "não serão editáveis" na EC e que "o sistema vai puxar as informações
  // a partir da OS de cada fornecedor" — ou seja, esperá-los aqui era esperar
  // pelo documento que ainda não pode nascer. Era esta a queixa "não estou
  // conseguindo emitir OS's": item aprovado, fornecedor identificado, e a
  // emissão barrada por campos fiscais que ninguém tinha como preencher ainda.
  //
  // O BV fora do padrão precisa de motivo escrito ANTES da OS sair: depois de
  // emitida, quem lê o documento não tem a quem perguntar por que a Pólobh
  // abriu mão da bonificação neste item.
  if (bvJustificativaFaltando(l)) faltas.push("Justificativa do BV");
  // VALOR VAZIO (09/10/2026). Item sem nenhum valor chegava à emissão e a OS
  // saía zerada — ou falhava no meio, sem dizer por quê. Só confere quem enxerga
  // valores: para os outros o banco devolve zero, e isso não é "vazio".
  if (conferirValor && !temValorDefinido(l)) faltas.push("Valor do item (está vazio)");
  return faltas;
}

/**
 * Decide quais linhas entram na emissão de OS.
 *
 * Só entra a linha que reúne as três condições combinadas com a Marisa
 * (14/08/2026): aprovada, com fornecedor identificado (razão social + CNPJ
 * completo) e marcada como "Emitir" ou "Emitir Nova Versão". Os campos fiscais
 * obrigatórios entram na mesma peneira — assim a tela consegue dizer, item a
 * item, exatamente o que está travando a emissão em vez de só recusar tudo.
 */
export function temValorDefinido(l: EcLinha): boolean {
  return [l.valorPolobh, l.valorCliente, l.valorComBvNf, l.valorSemBvComNf, l.valorSemBvSemNf].some(
    (v) => (Number(v) || 0) > 0
  );
}

export function analisarEmissaoOs(linhas: EcLinha[], conferirValor = false): AnaliseEmissaoOs {
  const prontos: EcLinha[] = [];
  const bloqueados: ItemEmissaoOs[] = [];
  for (const l of linhas) {
    if (l.statusOs !== "Emitir" && l.statusOs !== "Emitir Nova Versão") continue;
    const faltas = faltasParaEmitirOs(l, conferirValor);
    if (faltas.length) bloqueados.push({ linha: l, faltas });
    else prontos.push(l);
  }
  return { prontos, bloqueados };
}

/* ---------------------- Aprovação dos itens da EC ---------------------- */

/**
 * Aprova um item e, junto, deixa a OS pronta para ser emitida.
 *
 * É a regra ÚNICA da aprovação: vale tanto para o botão "Aprovar selecionados"
 * quanto para quem troca o campo Aprovação do item para "OK" na mão. Antes o
 * campo mudava sozinho, e o item aprovado ficava com a OS em "Pendente" — a
 * emissão dependia de alguém lembrar de mexer no segundo campo.
 *
 * Duas travas, decididas com o cliente (23/08/2026):
 *   1. só mexe em item com Aprovação "Pendente" — item já aprovado que não
 *      sofreu alteração não é reaprovado. Se a OS mudou, quem marca "Emitir
 *      Nova Versão" é a pessoa, no campo: só ela sabe que houve alteração;
 *   2. a OS só é empurrada para "Emitir" quando ainda está "Pendente" — quem já
 *      tem OS emitida ("OK"), já está marcado para emitir, ou não gera OS
 *      ("Não se Aplica") mantém o status, para aprovar não disparar uma segunda
 *      OS nem ressuscitar item declarado fora do fluxo.
 *
 * Item fora dessas condições volta inalterado (mesma referência).
 */
export function aprovarLinha(l: EcLinha): EcLinha {
  if (l.statusAprovacao !== "Pendente") return l;
  return { ...l, statusAprovacao: "OK", statusOs: l.statusOs === "Pendente" ? "Emitir" : l.statusOs };
}

/**
 * Desfaz a aprovação de um item — rede de segurança para o clique errado.
 *
 * Espelha `aprovarLinha`: volta a Aprovação para "Pendente" e só desfaz a OS que
 * a própria aprovação havia criado (a que está em "Emitir"). OS já emitida
 * ("OK"), marcada para nova versão ou fora do fluxo não é tocada — a reversão
 * nunca pode apagar um estado que veio do processo real.
 */
export function reverterAprovacaoLinha(l: EcLinha): EcLinha {
  if (l.statusAprovacao !== "OK") return l;
  return { ...l, statusAprovacao: "Pendente", statusOs: l.statusOs === "Emitir" ? "Pendente" : l.statusOs };
}

/* --------------------- Consolidação EC -> OS --------------------- */

export interface LinhaFornecedorGrupo {
  chave: string; // cnpj || razão
  fornecedorRazao: string;
  fornecedorCnpj: string;
  linhas: EcLinha[];
  total: number;
}

/** Agrupa linhas selecionadas por fornecedor (mesmo fornecedor = 1 OS). */
export function agruparPorFornecedor(linhas: EcLinha[]): LinhaFornecedorGrupo[] {
  const mapa = new Map<string, LinhaFornecedorGrupo>();
  for (const l of linhas) {
    // Pelos DÍGITOS do CNPJ (21/10/2026): o mesmo fornecedor digitado com e
    // sem máscara não pode virar duas OSs. Sem CNPJ, a razão social sem acento
    // nem caixa.
    const cnpj = (l.fornecedorCnpj || "").replace(/\D/g, "");
    const razao = (l.fornecedorRazao || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    const chave = cnpj || razao || "—";
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        chave,
        fornecedorRazao: l.fornecedorRazao,
        fornecedorCnpj: l.fornecedorCnpj,
        linhas: [],
        total: 0,
      });
    }
    const g = mapa.get(chave)!;
    g.linhas.push(l);
    g.total = r2(g.total + (l.valorPolobh || 0));
  }
  return [...mapa.values()];
}

/**
 * Descritivo da contratação a partir dos itens consolidados na OS.
 *
 * O item da EC tem DOIS descritivos, e os dois precisam chegar ao fornecedor:
 * a "Descrição Financeiro" (a linha curta, que também vai para a nota) e a
 * "Descrição Completa" (o detalhamento da produção, escrito em texto rico). A
 * OS só levava a primeira, e era justamente a segunda que dizia o que tem de ser
 * entregue — quem recebia a OS ficava com o resumo e sem a especificação.
 *
 * Cada item vira um marcador com nome e descrição curta; o detalhamento entra
 * recuado logo abaixo, que é o que mantém a leitura hierárquica quando a OS
 * consolida vários itens. Item sem nada escrito não vira linha vazia.
 */
export function descritivoConsolidado(linhas: EcLinha[]): string {
  return linhas
    .map((l) => {
      const cabeca = `• ${l.item ? l.item + " — " : ""}${l.descricao}`.trim();
      const detalhe = htmlParaLinhas(l.descricaoCompleta)
        .filter(Boolean)
        .map((t) => `  ${t}`);
      // Sem nome nem descrição curta, o detalhamento sobe e vira o marcador —
      // some a linha "•" solta que existia antes.
      if (cabeca === "•") return detalhe.map((t) => t.trimStart()).join("\n");
      return [cabeca, ...detalhe].join("\n");
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Descritivo para a nota fiscal: só a "Descrição Financeiro" de cada item da EC
 * (o Descritivo Geral do financeiro), sem a descrição completa da produção.
 */
export function descritivoFinanceiro(linhas: EcLinha[]): string {
  return linhas
    .map((l) => (l.descricao ?? "").trim())
    .filter(Boolean)
    .map((t) => `• ${t}`)
    .join("\n");
}

/** Lista de fornecedores únicos presentes nas linhas (para fábrica de OS). */
export function fornecedorBaseDaLinha(l: EcLinha): Partial<Fornecedor> {
  return { razaoSocial: l.fornecedorRazao, cnpj: l.fornecedorCnpj };
}

/* ------------------------- Textos padrão da OS -------------------------- */
/**
 * Textos fixos do "Modelo Novo" em Excel. Entram como padrão ao criar a OS e
 * seguem editáveis; o gerador de Excel usa o valor da OS e cai nestes só quando
 * o campo estiver vazio (OSs antigas, anteriores aos campos editáveis).
 */
export const LEI_INCENTIVO_PADRAO = "Lei de Incentivo à Cultura";
export const FORMA_PAGAMENTO_PADRAO = "À vista, no ato da emissão da nota fiscal / fatura";
export const OBS_CONTRATO_PADRAO =
  "Estes valores poderão ser revistos em caso de faltas ou execução parcial dos serviços ora contratados.";

/**
 * Objeto do contrato — montado a partir dos dados de faturamento da OS.
 * Usado tanto na tela quanto no Excel, para não divergirem.
 */
export function textoObjetoContrato(fin: Os["financeiro"], incentivada = true): string {
  // Projeto corporativo não tem projeto incentivado nem lei a citar (27/10/2026).
  if (!incentivada) return "O objeto do presente é a prestação dos serviços e/ou o fornecimento dos produtos descritos a seguir:";
  const projeto = fin.projetoIncentivado?.trim() || "[projeto incentivado]";
  // `leiIncentivo` já traz a lei COM o número ("… (Rouanet) — PRONAC 26 1234"),
  // então não há mais um "sob o número" a costurar aqui: o campo é a frase.
  const lei = fin.leiIncentivo?.trim() || LEI_INCENTIVO_PADRAO;
  return `O objeto do presente é a viabilização do projeto ${projeto}, idealizado pela CONTRATANTE e aprovado pela ${lei}, sendo:`;
}
