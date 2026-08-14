import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cx("w-full border-collapse text-sm", className)}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="text-left">{children}</tr>
    </thead>
  );
}

export function Th({
  children,
  className,
  align = "left",
  ariaSort,
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  /** Direção da ordenação quando a coluna é ordenável (ver ui/Ordenacao). */
  ariaSort?: "ascending" | "descending" | "none";
}) {
  return (
    <th
      aria-sort={ariaSort}
      className={cx(
        "px-3 py-2.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-ink-3 border-b border-border",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Tr({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cx(
        "border-b border-border-soft last:border-0",
        onClick && "cursor-pointer hover:bg-[#FAFAFB]",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  className,
  align = "left",
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={cx(
        "px-3 py-3 text-ink align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </td>
  );
}
