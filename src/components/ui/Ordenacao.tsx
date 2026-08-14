/**
 * Ordenação e classificação padronizadas para TODAS as listagens do sistema.
 *
 * Uso típico:
 *   const { ordem, ordenarPor, ordenados } = useOrdenacao(lista, {
 *     cliente: (p) => p.cliente?.nome,
 *     projeto: (p) => p.nome,
 *   }, { col: "cliente", dir: "asc" });
 *
 *   <THead><ThOrd col="cliente" ordem={ordem} onSort={ordenarPor}>Cliente</ThOrd>…</THead>
 *
 * Um único componente de cabeçalho garante que a seta, o alinhamento e a
 * acessibilidade (aria-sort) fiquem iguais em todas as telas.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Th } from "./Table";
import { cx } from "@/lib/format";

export type DirOrdem = "asc" | "desc";

export interface EstadoOrdem<C extends string = string> {
  col: C;
  dir: DirOrdem;
}

/** Valor comparável extraído de uma coluna. */
export type ValorOrdenavel = string | number | boolean | null | undefined;

/** Mapa coluna → como extrair o valor comparável do item. */
export type ExtratoresOrdem<T, C extends string> = Record<C, (item: T) => ValorOrdenavel>;

/**
 * Compara dois valores respeitando o tipo: números por grandeza, booleanos por
 * verdadeiro-primeiro e textos por collation pt-BR (ignora acento/caixa e
 * ordena "Item 2" antes de "Item 10"). Vazio vai sempre para o fim.
 */
export function compararValores(a: ValorOrdenavel, b: ValorOrdenavel): number {
  const vazioA = a === null || a === undefined || a === "";
  const vazioB = b === null || b === undefined || b === "";
  if (vazioA && vazioB) return 0;
  if (vazioA) return 1;
  if (vazioB) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" || typeof b === "boolean") return Number(b) - Number(a);
  return String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base", numeric: true });
}

export function useOrdenacao<T, C extends string>(
  itens: T[],
  extratores: ExtratoresOrdem<T, C>,
  // `NoInfer` faz as colunas serem deduzidas SÓ das chaves de `extratores`;
  // sem ele, o TypeScript fecharia o tipo na única coluna citada aqui.
  inicial: EstadoOrdem<NoInfer<C>>
): { ordem: EstadoOrdem<C>; ordenarPor: (col: C) => void; ordenados: T[] } {
  const [ordem, setOrdem] = useState<EstadoOrdem<C>>(inicial);

  /** Clicar na mesma coluna inverte a direção; em outra coluna recomeça em ascendente. */
  const ordenarPor = (col: C) =>
    setOrdem((o) => (o.col === col ? { col, dir: o.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }));

  const ordenados = useMemo(() => {
    const extrair = extratores[ordem.col];
    if (!extrair) return itens;
    const sinal = ordem.dir === "asc" ? 1 : -1;
    // `sort` é estável em todos os motores atuais: itens de mesmo valor mantêm a ordem original.
    return [...itens].sort((a, b) => compararValores(extrair(a), extrair(b)) * sinal);
    // `extratores` é recriado a cada render (objeto literal na chamada) e por isso
    // fica fora das dependências — ele só depende do próprio item, nunca de estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, ordem]);

  return { ordem, ordenarPor, ordenados };
}

/** Cabeçalho de coluna clicável, com indicador de direção. */
export function ThOrd<C extends string>({
  col,
  ordem,
  onSort,
  children,
  align = "left",
  className,
}: {
  col: C;
  ordem: EstadoOrdem<C>;
  onSort: (col: C) => void;
  children: ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  const ativo = ordem.col === col;
  return (
    <Th align={align} className={className} ariaSort={ativo ? (ordem.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(col)}
        title={`Ordenar por ${typeof children === "string" ? children : "esta coluna"}`}
        className={cx(
          "inline-flex items-center gap-1 uppercase tracking-[0.08em] hover:text-ink-2 transition-colors",
          align === "center" && "justify-center w-full",
          align === "right" && "justify-end w-full"
        )}
      >
        {children}
        <span className={cx("text-[9px] leading-none", ativo ? "text-ink-2" : "text-ink-3/40")}>
          {ativo ? (ordem.dir === "asc" ? "▲" : "▼") : "▲"}
        </span>
      </button>
    </Th>
  );
}
