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

export interface ItemConsolidado extends CronogramaItem {
  fornecedor?: string;
}

/** Sigla de dia da semana (pt-BR) a partir de uma data ISO. */
function diaSemana(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return "";
  return ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()];
}

/**
 * Linha do tempo consolidada: junta as etapas de TODOS os fornecedores numa
 * única timeline em ordem cronológica, agrupando por dia. Cada etapa mostra um
 * chip com o fornecedor responsável.
 */
export function TimelineConsolidada({ itens }: { itens: ItemConsolidado[] }) {
  const validos = itens.filter((c) => c.etapa || c.atividades || c.data);
  if (validos.length === 0) return <p className="text-ink-3 text-sm">Sem etapas cadastradas ainda.</p>;

  const ordenado = [...validos].sort(
    (a, b) => (a.data || "").localeCompare(b.data || "") || (a.horario || "").localeCompare(b.horario || "")
  );

  // agrupa por data
  const grupos: { data: string; itens: ItemConsolidado[] }[] = [];
  for (const it of ordenado) {
    const ult = grupos[grupos.length - 1];
    if (ult && ult.data === it.data) ult.itens.push(it);
    else grupos.push({ data: it.data, itens: [it] });
  }

  return (
    <div className="space-y-5">
      {grupos.map((g, gi) => (
        <div key={gi} className="relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center min-w-[2.6rem] h-7 px-2 rounded-pill bg-black text-white text-[11.5px] font-bold">
              {dataBR(g.data) || "—"}
            </span>
            {diaSemana(g.data) && <span className="text-[11px] uppercase tracking-wide text-ink-3 font-bold">{diaSemana(g.data)}</span>}
          </div>
          <ol className="relative border-l-2 border-border-soft ml-3 space-y-3">
            {g.itens.map((c, i) => (
              <li key={i} className="ml-5 relative">
                <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-primary-grad ring-4 ring-surface" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-bold text-ink text-[13.5px]">{c.etapa || "Etapa"}</span>
                  {c.horario && <span className="text-[12px] text-primary-dark font-bold">{c.horario}</span>}
                  {c.fornecedor && (
                    <span className="text-[10.5px] font-bold uppercase tracking-wide bg-[#F0F1F4] text-ink-2 rounded-pill px-2 py-0.5">
                      {c.fornecedor}
                    </span>
                  )}
                </div>
                {c.atividades && <p className="text-[12.5px] text-ink-2 mt-0.5">{c.atividades}</p>}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
