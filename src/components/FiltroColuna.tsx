// Cabeçalho de coluna no jeito do Excel: o rótulo, o botão de ordenar (↑ ↓) e o funil que abre a
// lista de valores para marcar. Usado na tabela do check-list (26/11/2026).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/format";

export type DirecaoOrdem = "asc" | "desc";

const IcFunil = ({ ativo }: { ativo: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill={ativo ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden>
    <path d="M3 4h18l-7 8.5V19l-4 2v-8.5L3 4z" />
  </svg>
);

const IcOrdem = ({ dir }: { dir: DirecaoOrdem | null }) => (
  <svg width="12" height="13" viewBox="0 0 12 14" aria-hidden>
    <path d="M6 1 L10 5.5 H2 Z" fill="currentColor" opacity={dir === "asc" ? 1 : 0.3} />
    <path d="M6 13 L10 8.5 H2 Z" fill="currentColor" opacity={dir === "desc" ? 1 : 0.3} />
  </svg>
);

export function CabecalhoColuna({
  rotulo,
  ordem,
  onOrdenar,
  filtro,
  className,
}: {
  rotulo: string;
  /** A direção desta coluna, se for ela a ordenar. */
  ordem?: DirecaoOrdem | null;
  /** Sem `onOrdenar`, a coluna não ordena. Ciclo: crescente → decrescente → sem ordem. */
  onOrdenar?: () => void;
  filtro?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx("inline-flex items-center gap-1 min-w-0", className)}>
      <span className="leading-tight">{rotulo}</span>
      {onOrdenar && (
        <button
          type="button"
          onClick={onOrdenar}
          className={cx("rounded p-0.5 hover:bg-[#EDEEF1]", ordem ? "text-primary-dark" : "text-ink-3")}
          title={ordem === "asc" ? "Ordenado do menor para o maior — clique para inverter" : ordem === "desc" ? "Ordenado do maior para o menor — clique para tirar a ordenação" : `Ordenar por ${rotulo.toLowerCase()}`}
          aria-label={`Ordenar por ${rotulo}`}
        >
          <IcOrdem dir={ordem ?? null} />
        </button>
      )}
      {filtro}
    </span>
  );
}

/**
 * O funil: lista de valores com caixa de marcar. `selecionados` = null quer dizer "todos" (sem
 * filtro); um conjunto vazio esconde tudo, como no Excel.
 */
export function FiltroLista<T extends string>({
  rotulo,
  opcoes,
  selecionados,
  onChange,
  busca,
  onBusca,
  alinharDireita,
}: {
  rotulo: string;
  opcoes: { valor: T; rotulo: string; contagem?: number }[];
  selecionados: ReadonlySet<T> | null;
  onChange: (selecionados: Set<T> | null) => void;
  /** Texto de busca livre (só a coluna Tarefa usa). */
  busca?: string;
  onBusca?: (texto: string) => void;
  /** Abre para a esquerda (colunas da ponta direita). */
  alinharDireita?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLSpanElement>(null);
  const ativo = selecionados !== null || !!busca;

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const marcado = (v: T) => selecionados === null || selecionados.has(v);
  const alternar = (v: T, marcar: boolean) => {
    const atual = new Set(selecionados ?? opcoes.map((o) => o.valor));
    if (marcar) atual.add(v);
    else atual.delete(v);
    onChange(atual.size === opcoes.length ? null : atual);
  };

  return (
    <span ref={caixa} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className={cx("rounded p-0.5 hover:bg-[#EDEEF1]", ativo ? "text-primary-dark" : "text-ink-3")}
        title={ativo ? `Filtro ativo em ${rotulo.toLowerCase()}` : `Filtrar ${rotulo.toLowerCase()}`}
        aria-label={`Filtrar ${rotulo}`}
        aria-expanded={aberto}
      >
        <IcFunil ativo={ativo} />
      </button>
      {aberto && (
        <div className={cx("absolute top-full z-[60] mt-1", alinharDireita ? "right-0" : "left-0", " w-[240px] rounded-btn border border-border bg-surface p-2 shadow-modal normal-case tracking-normal text-[12.5px] font-semibold text-ink")}>
          {onBusca && (
            <input
              autoFocus
              value={busca ?? ""}
              onChange={(e) => onBusca(e.target.value)}
              placeholder="Buscar…"
              className="mb-2 h-8 w-full rounded-btn border-[1.5px] border-[#BFC4CE] px-2 text-[12.5px] font-normal input-focus"
            />
          )}
          {opcoes.length > 0 && (
            <>
              <label className="flex items-center gap-2 px-1 py-1 border-b border-border-soft mb-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#F2820D]"
                  checked={selecionados === null}
                  onChange={(e) => onChange(e.target.checked ? null : new Set())}
                />
                (Selecionar tudo)
              </label>
              <div className="max-h-56 overflow-y-auto">
                {opcoes.map((o) => (
                  <label key={o.valor} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-[#F5F6F8] cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 accent-[#F2820D]" checked={marcado(o.valor)} onChange={(e) => alternar(o.valor, e.target.checked)} />
                    <span className="flex-1 truncate">{o.rotulo}</span>
                    {o.contagem !== undefined && <span className="text-ink-3 tabular-nums">{o.contagem}</span>}
                  </label>
                ))}
              </div>
            </>
          )}
          {ativo && (
            <button
              type="button"
              className="mt-2 w-full rounded-btn px-2 py-1 text-[12px] font-bold text-primary-dark hover:bg-primary-soft"
              onClick={() => {
                onChange(null);
                onBusca?.("");
                setAberto(false);
              }}
            >
              Limpar filtro
            </button>
          )}
        </div>
      )}
    </span>
  );
}
