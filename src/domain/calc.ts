/**
 * Cálculos da EC (seção 4 do brief) e helpers de numeração/consolidação.
 * Percentuais fixos: honorários 15%, encargos 16,33%.
 */
import type { Ec, EcLinha, Producao, Fornecedor, Os, TaxaConfig } from "@/data/types";
import { dataBRCurta } from "@/lib/format";

export const HONORARIOS = 0.15;
export const ENCARGOS = 0.1633;

export const honorariosPadrao = (): TaxaConfig => ({ modo: "percentual", valor: HONORARIOS });
export const encargosPadrao = (): TaxaConfig => ({ modo: "percentual", valor: ENCARGOS });

/** Rótulos padrão do resumo de custos (usados quando a EC não tem rótulo personalizado). */
export const ROTULO_HONORARIOS_PADRAO = "Honorários Pólobh (Organização e Planejamento)";
export const ROTULO_ENCARGOS_PADRAO = "Encargos (sobre serviços de terceiros)";

/** Valor de uma taxa: se fixo, o próprio valor; se percentual, base × fração. */
export function valorTaxa(cfg: TaxaConfig, base: number): number {
  return cfg.modo === "fixo" ? (cfg.valor || 0) : base * (cfg.valor || 0);
}

export interface EcTotais {
  somaLinhasPolobh: number;
  somaLinhasCliente: number;
  somaProducao: number;
  somaFornecedores: number; // Σ valor Pólobh (linhas) + Σ produção
  somaCliente: number;
  honorariosPolobh: number;
  honorariosCliente: number;
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

  const honorariosPolobh = r2(valorTaxa(honorariosCfg, somaFornecedores));
  // Honorários sobre o lado Cliente só fazem sentido no modo percentual.
  const honorariosCliente = r2(
    honorariosCfg.modo === "percentual" ? somaCliente * (honorariosCfg.valor || 0) : 0
  );
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
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .slice(0, max)
    .trim();

/** Numeração automática: "EC – {Cliente} – {Projeto} – V{NN}". */
export function numeroEc(
  clienteNome: string,
  projetoTitulo: string,
  versao: number
): string {
  const v = String(versao).padStart(2, "0");
  // título do projeto com folga maior (evita "comer" parte do título no número).
  return `EC – ${slug(clienteNome)} – ${slug(projetoTitulo, 60)} – V${v}`;
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
