import { cx } from "@/lib/format";

/**
 * Bolinha vermelha com número em branco (badge de notificação/pendência).
 * - `inline`: fica no fluxo (ex.: ao lado do texto do item da subguia).
 * - padrão (não inline): absoluto no canto — o pai precisa ser `relative`.
 */
export function NotifDot({
  n,
  title,
  inline = false,
  className,
}: {
  n: number;
  title?: string;
  inline?: boolean;
  className?: string;
}) {
  if (!n || n < 1) return null;
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[11px] font-extrabold leading-none ring-2 ring-white select-none",
        !inline && "absolute -top-1.5 -left-1.5 z-10",
        className
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
