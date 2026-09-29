import { useState } from "react";
import { brl, pct, cx } from "@/lib/format";
import { Button, Input, CurrencyInput } from "@/components/ui";
import { IcDownload, IcEye, IcPlus } from "@/components/icons";
import { calcularRentabilidade, type CustoInterno, type LinhaRentabilidade } from "@/domain/rentabilidade";
import type { Ec } from "@/data/types";

/** Cor do percentual de rentabilidade. */
function tomRent(p: number | null): string {
  if (p === null) return "text-ink-3";
  if (p < 0) return "text-danger";
  if (p < 0.1) return "text-warning";
  return "text-success";
}

const novoId = () =>
  globalThis.crypto?.randomUUID?.() ?? `ci-${Math.random().toString(36).slice(2)}`;

/**
 * A RENTABILIDADE do projeto — redesenhada em 15/09/2026 (ver
 * `domain/rentabilidade`, onde mora a conta).
 *
 * As colunas passaram a ser as do check-list: **Item · Valor na EC · Valor
 * Líquido OS · Rentabilidade · Justificativa**. Entraram as linhas de
 * honorários e encargos (elas estão no total da EC, e sem elas a tabela não
 * batia com o documento) e os **custos internos**, lançados aqui — a diária da
 * equipe, o combustível, o que a casa gasta e não cobra item a item.
 *
 * A JUSTIFICATIVA é a do BV do item, e abre no clique: o texto costuma ter duas
 * linhas e, em coluna fixa, empurraria os valores para fora da tela. Era a
 * informação que obrigava a abrir a EC item a item para achar.
 *
 * O percentual do rodapé é sobre o **valor total da EC**, como pedido.
 */
export function RentabilidadeItens({
  ec,
  gastoPorLinha,
  podeEditar = false,
  onCustosInternos,
  onExportar,
  onImprimir,
}: {
  ec: Ec;
  gastoPorLinha?: Record<string, number>;
  /** Custos internos são lançados aqui; a EC os guarda (ver `Ec.custosInternos`). */
  podeEditar?: boolean;
  onCustosInternos?: (custos: CustoInterno[]) => void;
  onExportar?: () => void;
  onImprimir?: () => void;
}) {
  const custos = ec.custosInternos ?? [];
  const r = calcularRentabilidade(ec, gastoPorLinha ?? {}, custos);
  const [justificativaAberta, setJustificativaAberta] = useState<string | null>(null);

  const mudarCusto = (id: string, patch: Partial<CustoInterno>) =>
    onCustosInternos?.(custos.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  // Agrupa só para exibir: preserva a ordem de aparição dos grupos na EC.
  const grupos: { nome: string; itens: LinhaRentabilidade[] }[] = [];
  for (const l of r.linhas) {
    const atual = grupos.at(-1);
    if (atual?.nome === l.grupo) atual.itens.push(l);
    else grupos.push({ nome: l.grupo, itens: [l] });
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-2 px-3 py-2 flex-wrap">
        {onExportar && (
          <Button variant="secondary" size="sm" icon={<IcDownload width={15} height={15} />} onClick={onExportar}>
            Rentabilidade Excel
          </Button>
        )}
        {onImprimir && (
          <Button variant="secondary" size="sm" icon={<IcEye width={15} height={15} />} onClick={onImprimir}>
            Rentabilidade PDF
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-y border-border bg-[#FAFAFB]">
              <th className="px-3 py-2 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Item</th>
              <th className="px-3 py-2 text-right text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Valor na EC</th>
              <th className="px-3 py-2 text-right text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Valor Líquido OS</th>
              <th className="px-3 py-2 text-right text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Rentabilidade</th>
              <th className="px-3 py-2 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Justificativa Rentabilidade</th>
            </tr>
          </thead>
          <tbody>
            {r.linhas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink-3 text-[12.5px]">
                  Nenhum item com custo na EC ou pagamento por OS ainda.
                </td>
              </tr>
            )}
            {grupos.map((g) => (
              <FragmentoGrupo key={g.nome} nome={g.nome}>
                {g.itens.map((l) => (
                  <tr key={l.id} className="border-b border-border-soft align-top">
                    <td className="px-3 py-2.5 pl-6">
                      <div className={cx("font-semibold", l.origem === "item" ? "text-ink" : "text-ink-2 italic")}>
                        {l.item}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-display font-bold text-ink whitespace-nowrap">{brl(l.valorEc)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-ink whitespace-nowrap">{brl(l.valorLiquidoOs)}</td>
                    <td className={cx("px-3 py-2.5 text-right font-display font-bold whitespace-nowrap", tomRent(l.percent))}>
                      {l.percent === null ? "—" : pct(l.percent)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-ink-2 max-w-[18rem]">
                      {l.justificativa ? (
                        justificativaAberta === l.id ? (
                          <button type="button" onClick={() => setJustificativaAberta(null)} className="text-left">
                            {l.justificativa}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setJustificativaAberta(l.id)}
                            className="font-bold text-primary-dark hover:underline"
                            title="Ver a justificativa do BV deste item"
                          >
                            ver justificativa
                          </button>
                        )
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </FragmentoGrupo>
            ))}

            {/* CUSTOS INTERNOS — lançados aqui, guardados na EC. */}
            {podeEditar && onCustosInternos && (
              <>
                <tr className="bg-[#F4F5F7]">
                  <td colSpan={5} className="px-3 py-1.5">
                    <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-ink-2">
                      Lançar custo interno
                    </span>
                    <span className="ml-2 text-[11.5px] text-ink-3">
                      o que a Pólobh gasta e não está na EC — entra no cálculo, não no documento
                    </span>
                  </td>
                </tr>
                {custos.map((c) => (
                  <tr key={c.id} className="border-b border-border-soft">
                    <td className="px-3 py-1.5 pl-6" colSpan={2}>
                      <Input
                        className="!h-9 !text-[12.5px]"
                        value={c.descricao}
                        onChange={(e) => mudarCusto(c.id, { descricao: e.target.value })}
                        placeholder="Ex.: diária da equipe de produção"
                        aria-label="Descrição do custo interno"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <CurrencyInput
                        className="!h-9 !text-[12.5px]"
                        value={c.valor}
                        onValue={(valor) => mudarCusto(c.id, { valor })}
                        aria-label="Valor do custo interno"
                      />
                    </td>
                    <td className="px-3 py-1.5" colSpan={2}>
                      <button
                        type="button"
                        onClick={() => onCustosInternos(custos.filter((x) => x.id !== c.id))}
                        className="text-[12px] font-bold text-ink-3 hover:text-danger"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} className="px-3 py-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<IcPlus width={15} height={15} />}
                      onClick={() => onCustosInternos([...custos, { id: novoId(), descricao: "", valor: 0 }])}
                    >
                      Custo interno
                    </Button>
                  </td>
                </tr>
              </>
            )}

            {r.linhas.length > 0 && (
              <tr className="bg-[#FAFAFB]">
                <td className="px-3 py-2.5 font-bold text-ink">Total do projeto</td>
                <td className="px-3 py-2.5 text-right font-display font-bold text-ink">{brl(r.totalEc)}</td>
                <td className="px-3 py-2.5 text-right font-display font-bold text-ink">{brl(r.totalLiquidoOs)}</td>
                <td className={cx("px-3 py-2.5 text-right font-display font-bold", tomRent(r.percentSobreEc))}>
                  {r.percentSobreEc === null ? "—" : pct(r.percentSobreEc)}
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-2 text-[11.5px] text-ink-3">
        Valor na EC = o que o documento cobrou · Valor Líquido OS = o que saiu, pelas OSs e pelos custos internos ·
        Rentabilidade = (EC − líquido) ÷ EC, e o total é calculado sobre o valor total da EC.
        Honorários e encargos entram como linha porque compõem esse total.
      </p>
    </div>
  );
}

/** Cabeçalho do grupo + suas linhas (o grupo é só organização visual). */
function FragmentoGrupo({ nome, children }: { nome: string; children: React.ReactNode }) {
  return (
    <>
      <tr className="bg-[#F4F5F7]">
        <td colSpan={5} className="px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-ink-2">
          {nome}
        </td>
      </tr>
      {children}
    </>
  );
}
