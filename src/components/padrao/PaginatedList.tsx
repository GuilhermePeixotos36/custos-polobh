import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { deslizarPagina } from "./animacaoLista";

type PaginatedListProps<T> = {
  items: readonly T[];
  /**
   * `deslocamento` é quantos itens ficaram nas páginas anteriores. Quem numera linha precisa
   * dele: sem ele, a numeração recomeça em 1 a cada página e deixa de identificar o registro.
   */
  children: (pageItems: readonly T[], deslocamento: number) => ReactNode;
  itemLabel?: string;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  resetKey?: string | number;
  className?: string;
  contentClassName?: string;
  /**
   * Identidade da lista para lembrar quantas linhas a pessoa escolheu. Cai no `itemLabel` quando
   * não vem — só precisa ser informada quando duas listas de rótulo igual devem lembrar separado.
   */
  preferenciaId?: string;
};

const DEFAULT_PAGE_SIZES = [10, 25, 50] as const;

/**
 * Quantas linhas a pessoa escolheu, por lista, entre visitas.
 *
 * Quem trabalha numa lista longa escolhe 50 e volta ali dez vezes no dia; sem lembrar, é remarcar
 * dez vezes. A preferência é POR LISTA, e não uma só para o app inteiro, porque os cartões do
 * painel abrem com 6 linhas de propósito — um 50 global transformaria o resumo da tela inicial
 * numa página de rolagem.
 *
 * Só vale valor que aquela lista de fato oferece: preferência antiga de uma lista que mudou de
 * opções é descartada em vez de virar página de tamanho impossível.
 */
const CHAVE_PREFERENCIA = "dp:linhas-por-pagina";

function lerPreferencias(): Record<string, number> {
  // localStorage falha em aba anônima e com dado de site bloqueado: a lista tem de abrir do mesmo
  // jeito, no tamanho padrão, em vez de a tela inteira morrer por causa de uma conveniência.
  try {
    const bruto = localStorage.getItem(CHAVE_PREFERENCIA);
    const lido: unknown = bruto ? JSON.parse(bruto) : null;
    return lido && typeof lido === "object" ? (lido as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function guardarPreferencia(chave: string, tamanho: number) {
  try {
    localStorage.setItem(CHAVE_PREFERENCIA, JSON.stringify({ ...lerPreferencias(), [chave]: tamanho }));
  } catch {
    // Sem lembrar: a escolha continua valendo nesta tela, só não sobrevive à próxima visita.
  }
}

export function PaginatedList<T>({
  items,
  children,
  itemLabel = "itens",
  pageSize: initialPageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  resetKey,
  className,
  contentClassName,
  preferenciaId,
}: PaginatedListProps<T>) {
  const chavePreferencia = preferenciaId ?? itemLabel;
  const tamanhosOferecidos = useMemo(
    () => [...new Set([initialPageSize, ...pageSizeOptions])].sort((a, b) => a - b),
    [initialPageSize, pageSizeOptions],
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const lembrado = lerPreferencias()[chavePreferencia];
    return lembrado && tamanhosOferecidos.includes(lembrado) ? lembrado : initialPageSize;
  });

  function escolherTamanho(tamanho: number) {
    setPageSize(tamanho);
    guardarPreferencia(chavePreferencia, tamanho);
  }
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, pageSize, safePage]);

  // A página só anda de lado quando foi a PESSOA que andou. Voltar à página 1 porque a ordem, o
  // filtro ou o tamanho mudaram não é virar a folha: é outra lista, e deslizar para a esquerda
  // ali diria "você voltou" para quem não voltou para lugar nenhum. Por isso o sentido fica
  // guardado no clique das setas e é consumido aqui, e não deduzido da troca de `safePage`.
  const conteudo = useRef<HTMLDivElement>(null);
  const sentidoPendente = useRef<1 | -1 | null>(null);
  function andar(sentido: 1 | -1) {
    sentidoPendente.current = sentido;
    setPage((current) => Math.min(pageCount, Math.max(1, current + sentido)));
  }
  useLayoutEffect(() => {
    const sentido = sentidoPendente.current;
    sentidoPendente.current = null;
    const area = conteudo.current;
    if (!sentido || !area) return;
    // A página nova começa do topo. Sem isto, quem rolou até a linha 50 e clicou em "próxima"
    // caía no fim da página seguinte e tinha de subir para achar onde ela começa.
    area.scrollTop = 0;
    // O `<tbody>`, e não a área inteira: o cabeçalho preso fica parado e só o miolo anda. Lista
    // que não é tabela (cartões) anda pelo primeiro filho.
    deslizarPagina(area.querySelector("tbody") ?? area.firstElementChild, sentido);
  }, [safePage]);

  const firstItem = items.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(safePage * pageSize, items.length);

  return (
    <div className={cn("min-w-0", className)}>
      <div ref={conteudo} className={cn("max-h-[min(62vh,36rem)] overflow-auto overscroll-contain", contentClassName)}>
        {children(pageItems, (safePage - 1) * pageSize)}
      </div>
      <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-3 py-2.5" aria-label={`Paginação de ${itemLabel}`}>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          <span className="font-semibold text-navy tabular-nums">{firstItem}–{lastItem}</span> de {items.length} {itemLabel}
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Por página
            <select
              value={pageSize}
              onChange={(event) => escolherTamanho(Number(event.target.value))}
              className="h-8 rounded-md border border-input bg-card px-2 text-xs font-semibold text-navy outline-none transition-[border-color,box-shadow] hover:border-brand/40 focus:border-brand focus:ring-2 focus:ring-brand/15"
              aria-label={`${itemLabel} por página`}
            >
              {tamanhosOferecidos.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <span className="min-w-16 text-center text-xs font-semibold text-navy tabular-nums">{safePage} / {pageCount}</span>
          <button
            type="button"
            onClick={() => andar(-1)}
            disabled={safePage === 1}
            className="icon-button h-8 w-8 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => andar(1)}
            disabled={safePage === pageCount}
            className="icon-button h-8 w-8 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </nav>
    </div>
  );
}
