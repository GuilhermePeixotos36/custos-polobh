/**
 * Faixa no topo de um item que faz parte de um ITEM COM PARTES (ver
 * `domain/divisaoEc`): diz qual parte é, de quantas, e o total do item.
 */
import type { InfoDivisao } from "@/domain/divisaoEc";
import { brl, cx } from "@/lib/format";

export function FaixaDivisao({ info, verFinanceiro }: { info: InfoDivisao; verFinanceiro: boolean }) {
  const nome = info.principal.item || "item sem nome";
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-1.5 border-b border-border-soft rounded-t-card",
        "bg-primary-soft/50 text-[11.5px] font-bold text-primary-dark"
      )}
    >
      <span>
        Parte {info.parte} de {info.total} · {info.parte === 1 ? "item principal" : <>de “{nome}”</>}
      </span>
      <span className="font-semibold text-ink-3">
        Para o cliente sai como um item só
        {verFinanceiro && <> · total do item {brl(info.somaPolobh)}</>}
      </span>
    </div>
  );
}
