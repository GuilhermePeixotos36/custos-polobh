/**
 * Ocultar e reexibir grupos e itens da EC (07/10/2026).
 *
 * Ocultar é para dar liberdade na hora de montar a EC: o que se oculta SOME da
 * tela — não fica uma gaveta no meio do caminho — e volta por um popup, onde se
 * escolhe o que reexibir. O item oculto continua guardado (fora dos totais e do
 * Excel), com a mesma ordem; só a visibilidade muda.
 *
 * Grupo não é um registro: é o nome que as linhas carregam. Por isso "grupo
 * oculto" é o grupo cujos itens estão TODOS ocultos.
 */
import type { EcLinha } from "@/data/types";

/** O grupo aparece na tela? Grupo vazio aparece; com itens, só se algum estiver visível. */
export const grupoVisivel = (itens: Pick<EcLinha, "oculto">[]): boolean =>
  itens.length === 0 || itens.some((i) => !i.oculto);

/**
 * "Ocultar tudo": oculta TODO item que existe agora. O que for criado depois
 * nasce visível — é o ponto: esvaziar a tela para montar a EC do zero sem
 * perder o que já estava feito.
 */
export function ocultarTudo<T extends Pick<EcLinha, "oculto">>(linhas: T[]): T[] {
  return linhas.map((l) => (l.oculto ? l : { ...l, oculto: true }));
}

/** Reexibe só os itens escolhidos (por id). */
export function reexibirItens<T extends Pick<EcLinha, "id" | "oculto">>(linhas: T[], ids: Iterable<string>): T[] {
  const alvo = new Set(ids);
  return linhas.map((l) => (alvo.has(l.id) && l.oculto ? { ...l, oculto: false } : l));
}

export interface GrupoComOcultos {
  grupo: string;
  /** Todos os itens do grupo estão ocultos (o grupo inteiro sumiu da tela). */
  inteiro: boolean;
  itens: { id: string; titulo: string }[];
}

/** O que está oculto, na ordem da EC, agrupado — a lista do popup. */
export function ocultosPorGrupo(
  linhas: Pick<EcLinha, "id" | "grupo" | "item" | "descricao" | "oculto">[]
): GrupoComOcultos[] {
  const ordem: string[] = [];
  const porGrupo = new Map<string, typeof linhas>();
  for (const l of linhas) {
    if (!porGrupo.has(l.grupo)) {
      porGrupo.set(l.grupo, []);
      ordem.push(l.grupo);
    }
    porGrupo.get(l.grupo)!.push(l);
  }
  const out: GrupoComOcultos[] = [];
  for (const nome of ordem) {
    const todos = porGrupo.get(nome)!;
    const ocultos = todos.filter((l) => l.oculto);
    if (!ocultos.length) continue;
    out.push({
      grupo: nome,
      inteiro: ocultos.length === todos.length,
      itens: ocultos.map((l) => ({ id: l.id, titulo: l.item.trim() || l.descricao.trim() || "(item sem título)" })),
    });
  }
  return out;
}

export const totalOcultos = (linhas: Pick<EcLinha, "oculto">[]): number => linhas.filter((l) => l.oculto).length;
