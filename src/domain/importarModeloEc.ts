/**
 * Importar grupos e itens do MODELO da modalidade para dentro de uma EC.
 *
 * A EC nasce em branco (09/10/2026): os grupos e itens padrão da modalidade
 * deixaram de entrar sozinhos e viraram opções — a pessoa abre o seletor, marca
 * o que quer, e só isso entra. Marcar o grupo traz o grupo com todos os itens;
 * dá para desmarcar itens soltos, ou deixar o grupo marcado SEM nenhum item
 * (entra o grupo com uma linha em branco, porque na EC o grupo só existe
 * enquanto tem ao menos uma linha).
 */
import { itensDoTemplate, type TemplateItem } from "@/domain/ecTemplates";
import type { ModalidadeProjeto } from "@/data/types";

export interface ItemDoModelo {
  /** Identidade estável dentro do modelo (o mesmo nome de item repete em grupos). */
  chave: string;
  item: string;
  descricao: string;
}

export interface GrupoDoModelo {
  nome: string;
  itens: ItemDoModelo[];
}

export interface SelecaoModelo {
  grupos: Set<string>;
  itens: Set<string>;
}

/** Entrada pronta para virar linha da EC. `item` vazio = só o grupo. */
export interface EntradaImportada {
  grupo: string;
  item: string;
  descricao: string;
}

export const chaveDoItem = (grupo: string, indice: number) => `${grupo}\u0000${indice}`;

/** O modelo agrupado, na ordem em que os grupos aparecem. */
export function gruposDoModelo(modelo: TemplateItem[]): GrupoDoModelo[] {
  const mapa = new Map<string, GrupoDoModelo>();
  modelo.forEach((t, i) => {
    let g = mapa.get(t.grupo);
    if (!g) {
      g = { nome: t.grupo, itens: [] };
      mapa.set(t.grupo, g);
    }
    g.itens.push({ chave: chaveDoItem(t.grupo, i), item: t.item, descricao: t.descricao });
  });
  return [...mapa.values()];
}

export const gruposDaModalidade = (m: ModalidadeProjeto): GrupoDoModelo[] =>
  gruposDoModelo(itensDoTemplate(m));

export const selecaoVazia = (): SelecaoModelo => ({ grupos: new Set(), itens: new Set() });

/** Marca ou desmarca um grupo inteiro (com todos os itens). */
export function alternarGrupo(sel: SelecaoModelo, g: GrupoDoModelo, marcar: boolean): SelecaoModelo {
  const grupos = new Set(sel.grupos);
  const itens = new Set(sel.itens);
  if (marcar) grupos.add(g.nome);
  else grupos.delete(g.nome);
  for (const i of g.itens) (marcar ? itens.add(i.chave) : itens.delete(i.chave));
  return { grupos, itens };
}

/** Marca ou desmarca um item; marcar um item marca o grupo dele. */
export function alternarItem(sel: SelecaoModelo, g: GrupoDoModelo, chave: string, marcar: boolean): SelecaoModelo {
  const grupos = new Set(sel.grupos);
  const itens = new Set(sel.itens);
  if (marcar) {
    itens.add(chave);
    grupos.add(g.nome);
  } else {
    itens.delete(chave);
  }
  return { grupos, itens };
}

export const totalSelecionado = (sel: SelecaoModelo) => sel.grupos.size;

/**
 * Transforma a seleção nas entradas a importar.
 *
 * `existentes` são os grupos que a EC já tem: o item cai dentro do grupo de
 * mesmo nome (sem criar um segundo), e marcar só o grupo que já existe não
 * faz nada.
 */
export function montarImportacao(
  grupos: GrupoDoModelo[],
  sel: SelecaoModelo,
  existentes: string[] = [],
): EntradaImportada[] {
  const jaTem = new Set(existentes);
  const saida: EntradaImportada[] = [];
  for (const g of grupos) {
    if (!sel.grupos.has(g.nome)) continue;
    const marcados = g.itens.filter((i) => sel.itens.has(i.chave));
    if (marcados.length) {
      for (const i of marcados) saida.push({ grupo: g.nome, item: i.item, descricao: i.descricao });
    } else if (!jaTem.has(g.nome)) {
      saida.push({ grupo: g.nome, item: "", descricao: "" });
    }
  }
  return saida;
}
