import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { teclaNoGrupo, usePilulaDeslizante } from "./pilulaDeslizante";

export type FilterPillOption<T extends string> = { value: T; label: string; count?: number };

/**
 * Filtros em pílula, com o fundo azul que desliza até o filtro escolhido.
 *
 * A pílula azul é UMA só, posicionada por cima do fundo branco dos botões e por baixo do texto
 * deles (o rótulo vai num `<span relative>`, que pinta depois dela). Assim os botões inativos
 * continuam brancos onde quer que o grupo esteja — no painel ou no cinza da página — e a pílula
 * passa por cima deles no caminho. Sem medida (primeira pintura, jsdom), o botão ativo pinta o
 * próprio fundo, e o grupo nunca aparece sem escolha marcada.
 */
export function FilterPills<T extends string>({ value, options, onChange, ariaLabel = "Filtros", className }: {
  value: T;
  options: readonly FilterPillOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const { grupo, refBotao, botao, pilula } = usePilulaDeslizante(value);
  return (
    <div
      ref={grupo}
      className={cn("relative flex flex-wrap items-center gap-2", className)}
      role="group"
      aria-label={ariaLabel}
      onKeyDown={(evento) => teclaNoGrupo(evento, options, value, onChange, botao)}
    >
      {pilula && (
        <span
          aria-hidden
          className="pilula-deslizante absolute left-0 top-0 rounded-full bg-brand"
          data-animar={pilula.animar || undefined}
          style={{ width: pilula.largura, height: pilula.altura, transform: `translate(${pilula.x}px, ${pilula.y}px)` } as CSSProperties}
        />
      )}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={refBotao(option.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-3.5 text-xs font-semibold transition-colors",
              active
                ? cn("border-brand text-white", pilula ? "bg-card" : "bg-brand")
                : "border-brand/30 bg-card text-navy hover:bg-brand/5",
            )}
          >
            <span className="relative inline-flex items-center gap-1.5">
              {option.label}
              {option.count !== undefined && <span className={cn("min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums transition-colors", active ? "bg-white/20 text-white" : "bg-brand/10 text-brand-forte")}>{option.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const filterControlClass = "h-9 rounded-full border border-input bg-card px-3.5 text-sm text-foreground outline-none transition-colors hover:border-brand/50 focus:border-brand focus:ring-2 focus:ring-brand/15";
export const filterSearchClass = "h-9 rounded-full border border-input bg-card pl-8 pr-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-brand/50 focus:border-brand focus:ring-2 focus:ring-brand/15";

export function YearFilter({ value, onChange, min = 2000, max = new Date().getFullYear() + 10, ariaLabel = "Ano", className }: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  ariaLabel?: string;
  className?: string;
}) {
  const inicio = Math.min(min, value || min);
  const fim = Math.max(max, value || max);
  const anos = Array.from({ length: fim - inicio + 1 }, (_, indice) => fim - indice);
  return <select value={value} onChange={(event) => onChange(Number(event.target.value))} aria-label={ariaLabel} className={cn(filterControlClass, "w-24 tabular-nums", className)}>{anos.map((ano) => <option key={ano} value={ano}>{ano}</option>)}</select>;
}
