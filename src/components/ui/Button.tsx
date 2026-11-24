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

// Design system Pólobh (24/11/2026): mesmo desenho do `button` do padrão LSPRO
// (components/padrao/button.tsx), com a API antiga do app para as telas não mudarem.
const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-md whitespace-nowrap select-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:shrink-0";

const variants: Record<Variant, string> = {
  // O laranja é claro: texto escuro sobre ele (`primary-foreground`, 6,7:1). Um primário por tela.
  primary: "bg-brand text-primary-foreground shadow-(--sombra-botao) hover:bg-brand-vivid disabled:shadow-none",
  dark: "bg-navy text-navy-foreground hover:bg-navy/90",
  // Secundário = contorno: borda de campo, fundo branco, sem sombra.
  secondary: "border border-input bg-card text-foreground hover:bg-muted hover:border-input",
  soft: "bg-brand-soft text-brand-forte hover:bg-brand-soft/70",
  text: "text-muted-foreground hover:text-foreground hover:bg-muted",
  // Perigo suave: texto vermelho, fundo só no hover.
  danger: "text-destructive hover:bg-destructive/10",
};

const sizes: Record<Size, string> = {
  md: "h-9 px-4 text-sm",
  sm: "h-8 px-3 text-sm",
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
