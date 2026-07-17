import { brl, pct, cx } from "@/lib/format";
import { rentabilidadeItem, rentabilidadeTotal } from "@/domain/calc";
import type { EcLinha } from "@/data/types";

/** Cor do percentual de rentabilidade. */
function tomRent(p: number | null): string {
  if (p === null) return "text-ink-3";
  if (p < 0) return "text-danger";
  if (p < 0.1) return "text-warning";
  return "text-success";
}

/**
 * Rentabilidade por item da EC: A = estimado, B = gasto (automático das OS's),
 * C = (A − B) / A. O "Gasto" vem do valor a pagar das OS's rateado por item
 * (via `gastoPorLinha`), não é digitado. Só aparecem itens que tiveram custo na
 * EC ou pagamento por OS; itens ocultos ficam de fora.
 */
export function RentabilidadeItens({
  linhas,
  gastoPorLinha,
}: {
  linhas: EcLinha[];
  gastoPorLinha?: Record<string, number>;
}) {
  const gastoDe = (l: EcLinha) => gastoPorLinha?.[l.id] ?? l.valorGasto ?? 0;
  const comValores = linhas.map((l) => ({ ...l, valorGasto: gastoDe(l) }));
  const visiveis = comValores.filter(
    (l) => !l.oculto && ((l.valorPolobh || 0) + (l.valorCliente || 0) > 0 || l.valorGasto > 0)
  );
  const total = rentabilidadeTotal(visiveis);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-y border-border bg-[#FAFAFB]">
            <th className="px-3 py-2 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Item</th>
            <th className="px-3 py-2 text-right text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Estimado (A)</th>
            <th className="px-3 py-2 text-right text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Gasto OS (B)</th>
            <th className="px-3 py-2 text-right text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Rentab. (C)</th>
          </tr>
        </thead>
        <tbody>
          {visiveis.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-ink-3 text-[12.5px]">
                Nenhum item com custo na EC ou pagamento por OS ainda.
              </td>
            </tr>
          )}
          {visiveis.map((l) => {
            const r = rentabilidadeItem(l);
            return (
              <tr key={l.id} className="border-b border-border-soft">
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-ink">{l.item || l.descricao || "—"}</div>
                  {l.grupo && <div className="text-[11px] text-ink-3">{l.grupo}</div>}
                </td>
                <td className="px-3 py-2.5 text-right font-display font-bold text-ink whitespace-nowrap">{brl(r.estimado)}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-ink whitespace-nowrap">{brl(r.gasto)}</td>
                <td className={cx("px-3 py-2.5 text-right font-display font-bold whitespace-nowrap", tomRent(r.percent))}>
                  {r.percent === null ? "—" : pct(r.percent)}
                </td>
              </tr>
            );
          })}
          {visiveis.length > 0 && (
            <tr className="bg-[#FAFAFB]">
              <td className="px-3 py-2.5 font-bold text-ink">Total da EC</td>
              <td className="px-3 py-2.5 text-right font-display font-bold text-ink">{brl(total.estimado)}</td>
              <td className="px-3 py-2.5 text-right font-display font-bold text-ink">{brl(total.gasto)}</td>
              <td className={cx("px-3 py-2.5 text-right font-display font-bold", tomRent(total.percent))}>
                {total.percent === null ? "—" : pct(total.percent)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[11.5px] text-ink-3">
        A = estimado na EC · B = gasto (valor a pagar das OS's, rateado por item) · C = (A − B) ÷ A.
      </p>
    </div>
  );
}
