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
        "bg-card border border-border rounded-xl shadow-(--sombra-superficie)",
        padded && "p-5 md:p-6",
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
      <div className="min-w-0">
        <h3 className="text-base font-bold text-foreground">{children}</h3>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/** Sobrelinha acima de um título. Sem CAIXA ALTA espaçada (design system LSPRO). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-2xs font-medium text-muted-foreground">
      {children}
    </div>
  );
}
