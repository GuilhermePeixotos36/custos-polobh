/**
 * ITEM COM PARTES (20/10/2026): um serviço da EC atendido por mais de um
 * fornecedor.
 *
 * Cada parte é uma linha da EC com o seu fornecedor, os seus valores e a sua OS
 * — a emissão continua sendo uma OS por fornecedor. O que as junta é a chave
 * `divisao`, igual em todas as partes de um mesmo item; a primeira (na ordem da
 * EC) é o item principal. Para o CLIENTE o item continua sendo um só: no PDF e
 * na planilha que vai para ele, as partes voltam a ser uma linha, com a soma
 * dos valores (ver `juntarDivisoes`).
 *
 * A chave é um texto, e não o id da linha principal, de propósito: a nova
 * versão e a importação de EC copiam as linhas com ids novos, e um texto
 * copiado continua juntando as mesmas partes.
 */
import type { EcLinha } from "@/data/types";

export interface InfoDivisao {
  /** 1 = item principal. */
  parte: number;
  total: number;
  principal: EcLinha;
  somaPolobh: number;
  somaCliente: number;
}

const soma = (ls: EcLinha[], f: (l: EcLinha) => number) =>
  Math.round(ls.reduce((s, l) => s + (Number(f(l)) || 0), 0) * 100) / 100;

/** Partes de cada divisão, na ordem em que aparecem — só as visíveis. */
function partesPorChave(linhas: EcLinha[]): Map<string, EcLinha[]> {
  const mapa = new Map<string, EcLinha[]>();
  for (const l of linhas) {
    if (!l.divisao || l.oculto) continue;
    const lista = mapa.get(l.divisao) ?? [];
    lista.push(l);
    mapa.set(l.divisao, lista);
  }
  return mapa;
}

/** Para cada linha que faz parte de um item dividido (com 2+ partes visíveis): qual parte é e o total do item. */
export function infoDasDivisoes(linhas: EcLinha[]): Map<string, InfoDivisao> {
  const info = new Map<string, InfoDivisao>();
  for (const partes of partesPorChave(linhas).values()) {
    if (partes.length < 2) continue;
    const base = {
      total: partes.length,
      principal: partes[0],
      somaPolobh: soma(partes, (l) => l.valorPolobh),
      somaCliente: soma(partes, (l) => l.valorCliente),
    };
    partes.forEach((l, i) => info.set(l.id, { ...base, parte: i + 1 }));
  }
  return info;
}

/**
 * As linhas como o CLIENTE as vê: cada item dividido volta a ser uma linha só,
 * no lugar do principal, com nome e descrições dele e a soma dos valores.
 */
export function juntarDivisoes(linhas: EcLinha[]): EcLinha[] {
  const grupos = partesPorChave(linhas);
  const saida: EcLinha[] = [];
  for (const l of linhas) {
    const partes = l.divisao && !l.oculto ? grupos.get(l.divisao) : undefined;
    if (!partes || partes.length < 2) {
      saida.push(l);
      continue;
    }
    if (partes[0].id !== l.id) continue; // parte secundária: já somada no principal
    saida.push({
      ...l,
      valorPolobh: soma(partes, (p) => p.valorPolobh),
      valorCliente: soma(partes, (p) => p.valorCliente),
      valorGasto: soma(partes, (p) => p.valorGasto),
      valorComBvNf: soma(partes, (p) => p.valorComBvNf),
      valorSemBvComNf: soma(partes, (p) => p.valorSemBvComNf),
      valorSemBvSemNf: soma(partes, (p) => p.valorSemBvSemNf),
    });
  }
  return saida;
}

/** Chave nova para uma divisão (ou a que o item já tem). */
export const chaveDeDivisao = (l: EcLinha): string => l.divisao || `div-${l.id}`;
