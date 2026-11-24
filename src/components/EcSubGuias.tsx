import { FolderTabs } from "@/components/padrao/FolderTabs";

/** Subguias da EC: guia principal + Resumo dos Custos + Rentabilidade (esta só p/ financeiro). */
export type SubGuiaEc = "ec" | "resumo" | "rentabilidade";

/**
 * As VISTAS da EC aberta — a fileira de abas do design system no alto do painel.
 *
 * Vai pelo slot `subabasDoPainel` do `PageShell` (24/11/2026): a barra do projeto
 * é a pasta de cima (a aba "EC" acesa) e estas são as abas de dentro dela, no
 * branco do painel. Antes eram pílulas logo abaixo da barra do projeto, e as duas
 * fileiras liam como uma só, com "EC" aceso nas duas.
 */
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
    <FolderTabs<SubGuiaEc>
      ariaLabel="Seções da EC"
      value={atual}
      onChange={onChange}
      options={[
        { value: "ec", label: "Itens da EC", atributos: { "data-subguia": "ec-itens" } },
        ...(temResumo ? [{ value: "resumo" as const, label: "Resumo dos Custos", atributos: { "data-subguia": "ec-resumo" } }] : []),
        ...(temRentabilidade ? [{ value: "rentabilidade" as const, label: "Rentabilidade", atributos: { "data-subguia": "ec-rentabilidade" } }] : []),
      ]}
    />
  );
}
