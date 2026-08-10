import { cx } from "@/lib/format";

export type Tom = "success" | "warning" | "danger" | "info" | "neutral";

const tons: Record<Tom, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-[#F0F1F4] text-ink-2",
};

export function Badge({
  children,
  tom = "neutral",
  className,
}: {
  children: React.ReactNode;
  tom?: Tom;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-pill px-2.5 py-1 text-[11.5px] font-bold leading-none whitespace-nowrap",
        tons[tom],
        className
      )}
    >
      {children}
    </span>
  );
}

/* Mapeamentos de status do domínio -> tom do badge */
export const tomStatusEc: Record<string, Tom> = {
  Rascunho: "neutral",
  Aguardando: "warning",
  Aprovada: "success",
  Reprovada: "danger",
  Cancelada: "danger",
  Arquivada: "neutral",
};

export const tomStatusOs: Record<string, Tom> = {
  Rascunho: "neutral",
  Emitida: "info",
  Disparada: "success",
  Cancelada: "danger",
  Arquivada: "neutral",
};

export const tomAprovacao: Record<string, Tom> = {
  Pendente: "warning",
  OK: "success",
  Emitir: "info",
  "Não se Aplica": "neutral",
};
