/**
 * Aviso em linha, dentro da tela ou do formulário (o balão de `AvisoInfo` é outra coisa).
 * Erro é `role="alert"` (o leitor de tela interrompe); os demais, `role="status"` (esperam a vez).
 * A cor sai de tokens: vermelho só no erro, azul da marca em atenção, verde no sucesso.
 */
import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

const TONS = {
  erro: { icone: AlertCircle, classe: "border-destructive/30 bg-destructive/10 text-destructive", role: "alert" },
  atencao: { icone: AlertTriangle, classe: "border-brand/25 bg-brand-soft text-brand-forte", role: "status" },
  sucesso: { icone: CheckCircle2, classe: "border-success/30 bg-success/10 text-success", role: "status" },
  info: { icone: Info, classe: "border-border bg-muted text-foreground", role: "status" },
} as const;

export function AvisoEmLinha({ tom, children, className }: {
  tom: keyof typeof TONS;
  children: ReactNode;
  className?: string;
}) {
  const { icone: Icone, classe, role } = TONS[tom];
  return (
    <div role={role} className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-xs font-medium", classe, className)}>
      <Icone aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
