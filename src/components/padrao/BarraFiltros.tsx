import { useId, useState, type ReactNode } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { filterSearchClass } from "@/components/padrao/FilterPills";
import { cn } from "@/lib/utils";

/**
 * A barra de filtros padrão das listas (o desenho da tela de Férias, nov/2026, pedido do
 * usuário: "padronize todos os filtros").
 *
 * À esquerda o botão "Filtros" com o contador de filtros ligados — filtro escondido sem contador
 * é filtro esquecido — e a contagem do que a lista mostra; à direita a busca, sempre à vista. Os
 * outros controles (selects com `filterControlClass`, caixas combinadas, checkboxes) moram no
 * painel que o botão abre, com "Limpar filtros" quando há algum ligado. A busca não conta como
 * filtro: ela já está à vista.
 *
 * Tela sem nenhum filtro além da busca não passa `children`, e o botão não aparece.
 *
 * Filtro por coluna (`CabecalhoDeColuna`, 24/11/2026): os controles moram no funil de cada
 * cabeçalho, mas a contagem mora aqui — `filtrosDeColuna` soma no contador do botão, o painel diz
 * quantas colunas estão filtradas e o "Limpar filtros" (`onLimpar`, que a tela faz limpar as
 * duas coisas) desliga também esses. Passar `filtrosDeColuna`, mesmo zero, já mostra o botão:
 * ele não pode aparecer e sumir conforme o funil é usado, empurrando a barra.
 */
export function BarraFiltros({
  busca, onBusca, placeholderBusca = "Buscar", rotuloBusca, ativos = 0, onLimpar, contagem, acoes, children,
  abertoInicial = false, larguraBusca = "w-72", className, filtrosDeColuna,
}: {
  busca?: string;
  onBusca?: (valor: string) => void;
  placeholderBusca?: string;
  /** Nome acessível da busca quando difere do placeholder (ex.: "Buscar usuário"). */
  rotuloBusca?: string;
  /** Quantos filtros do painel estão diferentes do padrão. */
  ativos?: number;
  onLimpar?: () => void;
  /** Texto curto à direita do botão, ex.: "12 colaborador(es)". */
  contagem?: ReactNode;
  /** Controles que ficam sempre à vista, entre o botão e a busca (ex.: competência, pílulas). */
  acoes?: ReactNode;
  /** Os controles do painel. */
  children?: ReactNode;
  abertoInicial?: boolean;
  larguraBusca?: string;
  className?: string;
  /** Quantas colunas da tabela estão filtradas pelo funil do cabeçalho. Soma em `ativos`. */
  filtrosDeColuna?: number;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
  const idPainel = useId();
  const temPainel = !!children || filtrosDeColuna !== undefined;
  const colunas = filtrosDeColuna ?? 0;
  const total = ativos + colunas;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {temPainel && (
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
              aria-controls={idPainel}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-input bg-card px-3.5 text-sm font-medium text-foreground hover:border-brand/50"
            >
              <SlidersHorizontal className="h-4 w-4" /> Filtros
              {total > 0 && (
                <span aria-label={`${total} filtro(s) ativo(s)`} className="rounded-full bg-brand px-1.5 text-2xs font-semibold text-primary-foreground tabular-nums">
                  {total}
                </span>
              )}
            </button>
          )}
          {acoes}
          {contagem !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{contagem}</span>}
        </div>
        {onBusca && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca ?? ""}
              onChange={(e) => onBusca(e.target.value)}
              placeholder={placeholderBusca}
              aria-label={rotuloBusca ?? placeholderBusca}
              className={cn(filterSearchClass, larguraBusca, "max-w-full")}
            />
          </div>
        )}
      </div>

      {temPainel && aberto && (
        <div id={idPainel} className="flex flex-wrap items-center gap-3 border-t border-border bg-muted/25 px-4 py-3">
          {children}
          {filtrosDeColuna !== undefined && (
            <span className="text-xs text-muted-foreground">
              {colunas > 0
                ? `${colunas} coluna(s) filtrada(s) pelo funil do cabeçalho.`
                : "Para filtrar uma coluna, use o funil ao lado do nome dela no cabeçalho da tabela."}
            </span>
          )}
          {total > 0 && onLimpar && (
            <button type="button" onClick={onLimpar} className="text-xs font-semibold text-brand-forte hover:underline">
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Checkbox de filtro no mesmo desenho do painel de Férias. */
export function FiltroCheckbox({ checked, onChange, children }: {
  checked: boolean;
  onChange: (valor: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-navy">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-input accent-brand"
      />
      {children}
    </label>
  );
}
