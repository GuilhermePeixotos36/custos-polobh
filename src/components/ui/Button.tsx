import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonVariants } from "@heroui/styles";
import { cx } from "@/lib/format";

/**
 * Botão do app com o visual do HeroUI v3 (`buttonVariants`). As variantes
 * antigas continuam valendo — cada uma aponta para a do HeroUI mais próxima —,
 * então nenhuma tela precisou mudar.
 */
type Variant = "primary" | "dark" | "secondary" | "soft" | "text" | "danger";
type Size = "md" | "sm";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  block?: boolean;
}

const PARA_HEROUI = {
  primary: "primary",
  dark: "primary",
  secondary: "outline",
  soft: "secondary",
  text: "ghost",
  danger: "danger-soft",
} as const;

/** Ajustes de cor por cima da variante do HeroUI (escuro e "soft" laranja). */
const EXTRA: Partial<Record<Variant, string>> = {
  primary: "font-semibold shadow-btn",
  dark: "font-semibold [--button-bg:var(--foreground)] [--button-bg-hover:#2b2d33] [--button-fg:#fff]",
  soft: "[--button-bg:var(--color-primary-soft)] [--button-bg-hover:#fbe7cf] [--button-fg:var(--color-primary-dark)]",
  secondary: "bg-surface",
};

export function Button({ variant = "primary", size = "md", icon, block, className, children, ...rest }: Props) {
  return (
    <button
      className={cx(
        buttonVariants({ variant: PARA_HEROUI[variant], size, fullWidth: !!block, isIconOnly: !children && !!icon }),
        EXTRA[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
