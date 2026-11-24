/**
 * O bloco de "nada por aqui": ícone discreto, título, uma frase e, se couber, a ação que resolve.
 * Estava repetido em cada lista com `card-surface p-10 text-center`; `semCartao` é para quando
 * ele já mora dentro de um painel ou de uma tabela e não deve ganhar outra borda.
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function EstadoVazio({ icone: Icone, titulo, descricao, acao, semCartao, className }: {
  icone?: LucideIcon;
  titulo: string;
  descricao?: ReactNode;
  acao?: ReactNode;
  semCartao?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(semCartao ? "p-10 text-center" : "card-surface p-10 text-center", className)}>
      {Icone && <Icone aria-hidden className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />}
      <p className="text-sm font-semibold text-foreground">{titulo}</p>
      {descricao && <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-4 flex justify-center">{acao}</div>}
    </div>
  );
}
