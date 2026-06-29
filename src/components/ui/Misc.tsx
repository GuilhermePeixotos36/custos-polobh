import type { ReactNode } from "react";
import { cx, iniciais } from "@/lib/format";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative w-[46px] h-[27px] rounded-pill transition-colors",
          checked ? "bg-primary" : "bg-[#CDD0D6]"
        )}
      >
        <span
          className={cx(
            "absolute top-[3px] h-[21px] w-[21px] rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-[3px]"
          )}
        />
      </button>
      {label && <span className="text-sm text-ink">{label}</span>}
    </label>
  );
}

export function Avatar({
  nome,
  size = 40,
}: {
  nome: string;
  size?: number;
}) {
  return (
    <div
      className="bg-avatar-grad flex items-center justify-center rounded-[12px] shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        className="font-display font-extrabold text-amber"
        style={{ fontSize: size * 0.36 }}
      >
        {iniciais(nome)}
      </span>
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full rounded-pill bg-[#EDEEF2] overflow-hidden">
      <div
        className="h-full rounded-pill bg-progress-grad"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-14 px-6">
      <p className="font-display font-bold text-ink text-[15px]">{title}</p>
      {hint && <p className="text-ink-2 text-sm mt-1 max-w-md mx-auto">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
