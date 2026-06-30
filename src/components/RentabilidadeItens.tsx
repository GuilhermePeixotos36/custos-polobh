import { brl, pct, cx } from "@/lib/format";
import { rentabilidadeItem, rentabilidadeTotal } from "@/domain/calc";
import { NumberInput } from "@/components/ui";
import type { EcLinha } from "@/data/types";

/** Cor do percentual de rentabilidade. */
function tomRent(p: number | null): string {
  if (p === null) return "text-ink-3";
  if (p < 0) return "text-danger";
  if (p < 0.1) return "text-warning";
  return "text-success";
}

/**
 * Rentabilidade por item da EC: A = estimado, B = gasto até a data,
 * C = (A − B) / A automático. Se `onGasto` for passado, o "Gasto" fica editável.
 */
export function RentabilidadeItens({
  linhas,
  onGasto,
}: {
  linhas: EcLinha[];
  onGasto?: (id: string, valor: number) => void;
}) {
  const total = rentabilidadeTotal(linhas);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-y border-border bg-[#FAFAFB]">
            <th className="px-3 py-2 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Item</th>
            <th className="px-3 py-2 text-right text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Estimado (A)</th>
            <th className="px-3 py-2 text-right text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Gasto (B)</th>
            <th className="px-3 py-2 text-right text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Rentab. (C)</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const r = rentabilidadeItem(l);
            return (
              <tr key={l.id} className="border-b border-border-soft">
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-ink">{l.item || l.descricao || "—"}</div>
                  {l.grupo && <div className="text-[11px] text-ink-3">{l.grupo}</div>}
                </td>
                <td className="px-3 py-2.5 text-right font-display font-bold text-ink whitespace-nowrap">{brl(r.estimado)}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {onGasto ? (
                    <NumberInput className="!h-9 !px-2 !text-[12.5px] max-w-[120px] ml-auto" value={l.valorGasto || 0} onValue={(v) => onGasto(l.id, v)} />
                  ) : (
                    <span className="font-semibold text-ink">{brl(r.gasto)}</span>
                  )}
                </td>
                <td className={cx("px-3 py-2.5 text-right font-display font-bold whitespace-nowrap", tomRent(r.percent))}>
                  {r.percent === null ? "—" : pct(r.percent)}
                </td>
              </tr>
            );
          })}
          <tr className="bg-[#FAFAFB]">
            <td className="px-3 py-2.5 font-bold text-ink">Total da EC</td>
            <td className="px-3 py-2.5 text-right font-display font-bold text-ink">{brl(total.estimado)}</td>
            <td className="px-3 py-2.5 text-right font-display font-bold text-ink">{brl(total.gasto)}</td>
            <td className={cx("px-3 py-2.5 text-right font-display font-bold", tomRent(total.percent))}>
              {total.percent === null ? "—" : pct(total.percent)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="px-3 py-2 text-[11.5px] text-ink-3">
        A = estimado na EC · B = gasto até hoje · C = (A − B) ÷ A. A rentabilidade atualiza conforme os gastos são lançados.
      </p>
    </div>
  );
}
