import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cx(
        "bg-surface border border-border rounded-card shadow-card",
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
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="mt-1 h-4 w-1.5 rounded-full bg-progress-grad shrink-0" />
        <div className="min-w-0">
          <h3 className="font-display font-bold text-[15px] text-ink">{children}</h3>
          {hint && <p className="text-[12.5px] text-ink-2 mt-0.5">{hint}</p>}
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
