import { cx } from "@/lib/format";

/** Subguias da EC: guia principal + Resumo dos Custos + Rentabilidade (esta só p/ financeiro). */
export type SubGuiaEc = "ec" | "resumo" | "rentabilidade";

export function EcSubGuias({
  atual,
  onChange,
  temResumo = true,
  temRentabilidade = true,
}: {
  atual: SubGuiaEc;
  onChange: (v: SubGuiaEc) => void;
  /** Resumo dos Custos é restrito ao financeiro na tela de leitura — oculta a aba quando false. */
  temResumo?: boolean;
  /** Rentabilidade é restrita ao financeiro — oculta a aba quando false. */
  temRentabilidade?: boolean;
}) {
  const abas: { key: SubGuiaEc; label: string }[] = [
    { key: "ec", label: "EC" },
    ...(temResumo ? ([{ key: "resumo", label: "Resumo dos Custos" }] as const) : []),
    ...(temRentabilidade ? ([{ key: "rentabilidade", label: "Rentabilidade" }] as const) : []),
  ];
  return (
    <div className="mb-4 flex items-center gap-1 border-b border-border-soft" role="tablist" aria-label="Seções da EC">
      {abas.map((a) => (
        <button
          key={a.key}
          type="button"
          role="tab"
          aria-selected={atual === a.key}
          onClick={() => onChange(a.key)}
          className={cx(
            "h-9 px-4 text-[13px] font-bold -mb-px border-b-2 transition-colors",
            atual === a.key
              ? "border-primary-dark text-primary-dark"
              : "border-transparent text-ink-2 hover:text-ink"
          )}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
