import type { CronogramaItem } from "@/data/types";
import { dataBR } from "@/lib/format";

export function Timeline({ itens }: { itens: CronogramaItem[] }) {
  const ordenado = [...itens].sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  if (ordenado.length === 0) return <p className="text-ink-3 text-sm">Sem etapas cadastradas.</p>;
  return (
    <ol className="relative border-l-2 border-border-soft ml-2 space-y-4">
      {ordenado.map((c, i) => (
        <li key={i} className="ml-5 relative">
          <span className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full bg-primary-grad ring-4 ring-surface" />
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-display font-bold text-ink text-[14px]">{c.etapa || "Etapa"}</span>
            <span className="text-[12.5px] text-primary-dark font-bold">{dataBR(c.data)}{c.horario ? ` · ${c.horario}` : ""}</span>
          </div>
          {c.atividades && <p className="text-[13px] text-ink-2 mt-0.5">{c.atividades}</p>}
        </li>
      ))}
    </ol>
  );
}
