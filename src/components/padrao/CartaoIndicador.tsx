/**
 * Cartão de indicador: rótulo, número grande e detalhe.
 *
 * Com `onClick` ou `ativo` vira o cartão-filtro (um `<button aria-pressed>`): clicar filtra a
 * lista pelo número que o cartão mostra. O ativo é marcado por borda e fundo da marca, sem anel.
 * O valor que TROCA (filtro, período) entra com fade; o da primeira pintura não anima.
 */
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const TOM_DO_VALOR = {
  neutro: "text-navy",
  marca: "text-brand-forte",
  sucesso: "text-success",
  perigo: "text-destructive",
  // Tons de pendência/previsão (Férias: saem em 30 dias, folhas a conferir). Âmbar não é `warning`, que é azul aqui.
  roxo: "text-[oklch(0.45_0.19_295)]",
  ambar: "text-[oklch(0.5_0.13_65)]",
} as const;

export function CartaoIndicador({ rotulo, valor, detalhe, icone, tom = "neutro", onClick, ativo, title, className }: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  icone?: ReactNode;
  tom?: keyof typeof TOM_DO_VALOR;
  /** Presente (ou `ativo` definido): o cartão é um botão-filtro. */
  onClick?: () => void;
  ativo?: boolean;
  title?: string;
  className?: string;
}) {
  const chave = typeof valor === "string" || typeof valor === "number" ? String(valor) : undefined;
  const [inicial] = useState(chave);
  const corpo = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
        {icone}
      </span>
      <span key={chave} className={cn("mt-3 block text-2xl font-semibold leading-none tabular-nums", TOM_DO_VALOR[tom], chave !== undefined && chave !== inicial && "valor-troca")}>
        {valor}
      </span>
      {detalhe && <span className="mt-3 block text-xs text-muted-foreground">{detalhe}</span>}
    </>
  );

  if (onClick || ativo !== undefined) {
    return (
      <button
        type="button"
        aria-pressed={!!ativo}
        title={title}
        onClick={onClick}
        className={cn(
          "card-surface block w-full cursor-pointer p-5 text-left transition-colors hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          // `!`: o `.card-surface` sai depois dos utilitários no CSS e venceria borda e fundo do ativo.
          ativo && "border-brand! bg-brand-soft/60!",
          className,
        )}
      >
        {corpo}
      </button>
    );
  }
  return <div className={cn("card-surface p-5", className)}>{corpo}</div>;
}
