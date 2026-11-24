import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/format";

type Variant = "primary" | "dark" | "secondary" | "soft" | "text" | "danger";
type Size = "md" | "sm";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  block?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 font-bold rounded-btn transition-colors select-none disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  // laranja é claro -> texto escuro (#2A1602)
  primary:
    "bg-primary-grad text-[#2A1602] shadow-btn hover:brightness-[1.03] disabled:bg-none disabled:bg-[#EEF1F7] disabled:text-[#A3ADC2] disabled:shadow-none",
  dark: "bg-avatar-grad text-white hover:brightness-110",
  secondary:
    "bg-surface text-ink border-[1.5px] border-border hover:bg-[#FAFAFB]",
  soft: "bg-primary-soft text-primary-dark hover:bg-[#FBE7CF]",
  text: "text-ink-2 hover:text-ink hover:bg-[#F1F2F5]",
  danger: "bg-danger-soft text-danger hover:bg-[#F7D9D9]",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-4 text-sm",
  sm: "h-9 px-3 text-[13px]",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  block,
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      className={cx(base, variants[variant], sizes[size], block && "w-full", className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
