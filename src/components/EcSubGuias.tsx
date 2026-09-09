import { SubGuias } from "@/components/layout/SubGuias";

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
  return (
    <SubGuias
      rotulo="Seções da EC"
      atual={atual}
      onChange={onChange}
      // Secundária: estas são VISTAS da EC que já está aberta, e ficam logo
      // abaixo da barra do projeto — desenhadas igual, as duas liam como uma
      // fileira só, com "EC" aceso nas duas.
      variante="secundaria"
      abas={[
        { key: "ec", label: "Itens da EC" },
        ...(temResumo ? ([{ key: "resumo", label: "Resumo dos Custos" }] as const) : []),
        ...(temRentabilidade ? ([{ key: "rentabilidade", label: "Rentabilidade" }] as const) : []),
      ]}
    />
  );
}
