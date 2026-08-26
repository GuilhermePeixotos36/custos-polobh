/**
 * Cálculos da EC (seção 4 do brief) e helpers de numeração/consolidação.
 * Percentuais fixos: honorários 15%, encargos 16,33%.
 */
import type { Ec, EcLinha, OpcaoValorItem, Producao, Fornecedor, Os, TaxaConfig } from "@/data/types";
import { brl, dataBRCurta } from "@/lib/format";

export const HONORARIOS = 0.15;
export const ENCARGOS = 0.1633;

export const honorariosPadrao = (): TaxaConfig => ({ modo: "percentual", valor: HONORARIOS, minimo: 0 });
export const encargosPadrao = (): TaxaConfig => ({ modo: "percentual", valor: ENCARGOS, minimo: 0 });

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

const r2 = (n: number) => Math.round(n * 100) / 100;

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

/** Numeração da OS derivada da EC: "{numeroEc} – OS-{NN}". */
export function numeroOs(ec: Ec, seq: number): string {
  const baseSemVersao = ec.numero.replace(/\s–\sV\d+$/, "");
  return `${baseSemVersao} – OS-${String(seq).padStart(2, "0")}`;
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

/* --------------------- Opções de valor por item (OS) --------------------- */

/**
 * As três formas de cobrar um item, na ordem em que aparecem no modelo de OS da
 * Pólobh. O rótulo é o mesmo na tela e na planilha — é ele que a OS imprime
 * logo abaixo do valor do item na EC.
 */
export const OPCOES_VALOR_ITEM = [
  { opcao: "comBvNf", rotulo: "Valor com BV e NF", campo: "valorComBvNf" },
  { opcao: "semBvComNf", rotulo: "Valor Sem BV e Com Nota Fiscal", campo: "valorSemBvComNf" },
  { opcao: "semBvSemNf", rotulo: "Valor Sem BV e Sem NF", campo: "valorSemBvSemNf" },
] as const satisfies readonly { opcao: Exclude<OpcaoValorItem, "">; rotulo: string; campo: keyof EcLinha }[];

/** "Valor do Item na EC do Projeto": o que o item custa na EC (Pólobh + Cliente). */
export function valorItemNaEc(l: Pick<EcLinha, "valorPolobh" | "valorCliente">): number {
  return r2((l.valorPolobh || 0) + (l.valorCliente || 0));
}

/** Valor de uma das três opções do item. */
export function valorDaOpcao(l: EcLinha, opcao: OpcaoValorItem): number {
  const def = OPCOES_VALOR_ITEM.find((o) => o.opcao === opcao);
  return def ? Number(l[def.campo] ?? 0) || 0 : 0;
}

/**
 * A opção que a produção escolheu para o item — rótulo e valor prontos para a
 * planilha. `null` quando ninguém escolheu ainda: nesse caso a OS imprime só o
 * valor do item na EC, sem inventar uma forma de cobrança.
 */
export function opcaoEscolhidaDoItem(l: EcLinha): { opcao: OpcaoValorItem; rotulo: string; valor: number } | null {
  const def = OPCOES_VALOR_ITEM.find((o) => o.opcao === l.opcaoValor);
  if (!def) return null;
  return { opcao: def.opcao, rotulo: def.rotulo, valor: Number(l[def.campo] ?? 0) || 0 };
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
export function faltasParaEmitirOs(l: EcLinha): string[] {
  const faltas: string[] = [];
  if (l.statusAprovacao !== "OK") faltas.push("Aprovação (item ainda pendente)");
  if (!l.fornecedorRazao?.trim()) faltas.push("Fornecedor (razão social)");
  if (l.fornecedorCnpj.replace(/\D/g, "").length !== 14) faltas.push("CNPJ do fornecedor");
  if (!l.faturaNf?.trim()) faltas.push("Documento PG");
  if (!l.codigoServico?.trim()) faltas.push("Código de Serviço");
  if (!l.pedidoCompra?.trim()) faltas.push("Pedido de Compra");
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
export function analisarEmissaoOs(linhas: EcLinha[]): AnaliseEmissaoOs {
  const prontos: EcLinha[] = [];
  const bloqueados: ItemEmissaoOs[] = [];
  for (const l of linhas) {
    if (l.statusOs !== "Emitir" && l.statusOs !== "Emitir Nova Versão") continue;
    const faltas = faltasParaEmitirOs(l);
    if (faltas.length) bloqueados.push({ linha: l, faltas });
    else prontos.push(l);
  }
  return { prontos, bloqueados };
}

/* ------------------- Aprovação em bloco dos itens da EC ------------------- */

/**
 * Aprova um item e, junto, deixa a OS pronta para ser emitida.
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
    const chave = (l.fornecedorCnpj || l.fornecedorRazao || "—").trim();
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

/** Junta os descritivos das linhas consolidadas num único bloco. */
export function descritivoConsolidado(linhas: EcLinha[]): string {
  return linhas
    .map((l) => `• ${l.item ? l.item + " — " : ""}${l.descricao}`.trim())
    .filter((s) => s !== "•")
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
export function textoObjetoContrato(fin: Os["financeiro"]): string {
  const projeto = fin.projetoIncentivado?.trim() || "[projeto incentivado]";
  const lei = fin.leiIncentivo?.trim() || LEI_INCENTIVO_PADRAO;
  const numero = fin.numeroProjetoIncentivado?.trim() || "[número do projeto incentivado]";
  return `O objeto do presente é a viabilização do projeto ${projeto}, idealizado pela CONTRATANTE e aprovado pela ${lei} sob o número ${numero}, sendo:`;
}
