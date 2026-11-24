/**
 * Selo: a pílula de status e de categoria.
 *
 * Cada tela montava a sua com classe de paleta crua (`bg-emerald-100 text-emerald-800`…) e o
 * mesmo "Ativo" saía em três verdes. Aqui o tom é nome (neutro, marca, sucesso…) e a cor mora
 * em `styles.css` (`.selo-*`), junto dos tons de status da lista. Sem anel de contorno.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TomDoSelo =
  | "neutro" | "marca" | "sucesso" | "perigo" | "atencao" | "roxo" | "cinza"
  | "vinculo-clt" | "vinculo-pj" | "vinculo-estagio" | "vinculo-aprendiz";

export function Selo({ tom = "neutro", ponto = false, children, className, title }: {
  tom?: TomDoSelo;
  /** Bolinha na cor do texto antes do rótulo — para status. */
  ponto?: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span title={title} className={cn("selo-" + tom, "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-semibold", className)}>
      {ponto && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}
