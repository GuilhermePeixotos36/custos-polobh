/**
 * Cálculos da EC (seção 4 do brief) e helpers de numeração/consolidação.
 * Percentuais fixos: honorários 15%, encargos 16,33%.
 */
import type { Ec, EcLinha, Producao, Fornecedor } from "@/data/types";

export const HONORARIOS = 0.15;
export const ENCARGOS = 0.1633;

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

export function calcularTotais(linhas: EcLinha[], producao: Producao): EcTotais {
  const somaLinhasPolobh = r2(
    linhas.reduce((s, l) => s + (l.valorPolobh || 0), 0)
  );
  const somaLinhasCliente = r2(
    linhas.reduce((s, l) => s + (l.valorCliente || 0), 0)
  );
  const somaProducao = totalProducao(producao);

  const somaFornecedores = r2(somaLinhasPolobh + somaProducao);
  const somaCliente = somaLinhasCliente;

  const honorariosPolobh = r2(somaFornecedores * HONORARIOS);
  const honorariosCliente = r2(somaCliente * HONORARIOS);
  const encargos = r2(somaFornecedores * ENCARGOS);

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
  return `EC – ${slug(clienteNome)} – ${slug(projetoTitulo)} – V${v}`;
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
