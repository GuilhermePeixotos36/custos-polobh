/**
 * PREFERÊNCIAS DE TELA, POR USUÁRIO (27/11/2026).
 *
 * O filtro e a ordenação que a pessoa escolhe numa lista são dela, e valem até
 * ela trocar: sair da tela, recarregar ou voltar no dia seguinte não desfazem a
 * escolha. Antes cada tela nascia sempre no padrão, e quem trabalha só com as
 * OS ativas, por exemplo, refazia o mesmo filtro a cada entrada.
 *
 * Fica guardado NESTE NAVEGADOR, por usuário (a chave leva o id de quem está
 * logado): dois usuários no mesmo computador não herdam a escolha um do outro.
 * Em outro computador a pessoa escolhe de novo — é preferência de tela, não
 * dado do sistema.
 *
 * O que NÃO se guarda: texto de busca. Uma busca esquecida esconde a lista
 * inteira sem deixar claro por quê; filtro e ordem ficam à vista na tela.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/store/auth";

const PREFIXO = "polobh:pref:v1";

function ler(chave: string): unknown {
  try {
    const bruto = window.localStorage.getItem(chave);
    return bruto === null ? undefined : JSON.parse(bruto);
  } catch {
    // Navegador sem armazenamento (modo restrito) ou valor corrompido: vale o padrão.
    return undefined;
  }
}

function gravar(chave: string, valor: unknown): void {
  try {
    if (valor === undefined) window.localStorage.removeItem(chave);
    else window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento, a preferência vale só enquanto a tela estiver aberta.
  }
}

export interface OpcoesPreferencia<T> {
  /**
   * Confere o que veio guardado e devolve o valor, ou `undefined` para usar o
   * padrão. É o que protege a tela de um valor antigo que deixou de existir
   * (uma coluna renomeada, um status que saiu) e o que converte o que o JSON
   * não guarda (um `Set`, por exemplo).
   */
  deGuardado?: (bruto: unknown) => T | undefined;
  /** Como o valor vai para o armazenamento (o inverso de `deGuardado`). */
  paraGuardar?: (valor: T) => unknown;
}

/**
 * Um `useState` que se lembra. `chave` identifica a preferência (ex.:
 * "oss.filtro"); o usuário logado entra na chave sozinho.
 */
export function usePreferencia<T>(
  chave: string,
  inicial: T,
  opcoes: OpcoesPreferencia<T> = {}
): [T, (valor: T | ((atual: T) => T)) => void] {
  const usuarioId = useAuth((s) => s.usuario?.id ?? "");
  const completa = `${PREFIXO}:${usuarioId || "anonimo"}:${chave}`;
  // As opções vêm como objeto literal a cada render: a referência fica num ref.
  const opcoesRef = useRef(opcoes);
  opcoesRef.current = opcoes;
  const inicialRef = useRef(inicial);

  const carregar = useCallback((k: string): T => {
    const bruto = ler(k);
    if (bruto === undefined) return inicialRef.current;
    const { deGuardado } = opcoesRef.current;
    const valor = deGuardado ? deGuardado(bruto) : (bruto as T);
    return valor === undefined ? inicialRef.current : valor;
  }, []);

  const [valor, setValor] = useState<T>(() => carregar(completa));

  // Trocou o usuário (ou a chave): a preferência em tela passa a ser a dele.
  const chaveVista = useRef(completa);
  useEffect(() => {
    if (chaveVista.current === completa) return;
    chaveVista.current = completa;
    setValor(carregar(completa));
  }, [completa, carregar]);

  const definir = useCallback(
    (novo: T | ((atual: T) => T)) => {
      setValor((atual) => {
        const proximo = typeof novo === "function" ? (novo as (a: T) => T)(atual) : novo;
        const { paraGuardar } = opcoesRef.current;
        gravar(completa, paraGuardar ? paraGuardar(proximo) : proximo);
        return proximo;
      });
    },
    [completa]
  );

  return [valor, definir];
}

/** Só aceita o que estiver na lista de valores válidos; o resto cai no padrão. */
export const umDe = <T extends string>(validos: readonly T[]) => ({
  deGuardado: (bruto: unknown): T | undefined => (validos.includes(bruto as T) ? (bruto as T) : undefined),
});

/**
 * Para os filtros de coluna do check-list: um conjunto de valores marcados, ou
 * `null` quando não há filtro. Guardado como lista.
 */
export const conjuntoOuNulo = <T extends string>() => ({
  deGuardado: (bruto: unknown): Set<T> | null | undefined =>
    bruto === null ? null : Array.isArray(bruto) ? new Set(bruto.filter((x): x is T => typeof x === "string")) : undefined,
  paraGuardar: (valor: Set<T> | null): unknown => (valor === null ? null : [...valor]),
});
