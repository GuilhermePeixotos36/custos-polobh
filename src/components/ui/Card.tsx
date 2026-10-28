import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export function Card({
  children,
  className,
  padded = true,
  /** Âncora do tour guiado (src/tour) — só uma marca de posição no DOM. */
  "data-tour": marcaTour,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  "data-tour"?: string;
}) {
  return (
    <div
      data-tour={marcaTour}
      className={cx(
        // Visual do card do HeroUI v3: superfície branca, cantos largos e a
        // sombra suave dele. O espaçamento interno segue o do app.
        "card card--default !block !gap-0 !rounded-2xl border border-border/70",
        padded ? "p-5 md:p-6" : "!p-0",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  hint,
  action,
}: {
  children: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="mt-1 h-4 w-1 rounded-full bg-accent shrink-0" />
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-[15px] text-foreground">{children}</h3>
          {hint && <p className="text-[12.5px] text-muted mt-0.5">{hint}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Eyebrow / rótulo de seção (uppercase). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-ink-3">
      {children}
    </div>
  );
}
