/**
 * A RENTABILIDADE como documento A4 — a mesma tabela da aba, para imprimir.
 *
 * Pedido de 15/09/2026, no par com a planilha. O conteúdo sai do MESMO cálculo
 * da tela e da planilha (`domain/rentabilidade`): três leituras diferentes da
 * margem seriam três respostas para a mesma pergunta, e a divergência só
 * apareceria na reunião em que os números aparecem juntos.
 *
 * É documento INTERNO. Não leva assinatura, nem o bloco contratual da EC, nem o
 * rodapé do fornecedor: a margem da casa não vai para cliente nenhum. O
 * cabeçalho diz de que EC ela saiu, que é o que se precisa para conferir — e o
 * aviso no rodapé existe para o papel não circular achando que é orçamento.
 */
import type { Ec } from "@/data/types";
import { brl, dataBR, pct, cx } from "@/lib/format";
import { calcularRentabilidade } from "@/domain/rentabilidade";

export function RentabilidadeDocumento({
  ec,
  gastoPorLinha,
}: {
  ec: Ec;
  gastoPorLinha: Record<string, number>;
}) {
  const r = calcularRentabilidade(ec, gastoPorLinha, ec.custosInternos ?? []);
  const tom = (p: number | null) => (p === null ? "" : p < 0 ? "text-danger" : p < 0.1 ? "text-warning" : "");

  return (
    <div className="doc-sheet p-[14mm] text-ink">
      <div className="flex items-center justify-between border-b-2 border-primary pb-3">
        <img src="/polobh-logo.png" alt="Pólobh" className="h-9 w-auto object-contain" />
        <div className="text-right">
          <div className="font-bold text-[13px]">Rentabilidade do Projeto</div>
          <div className="text-[11px] text-ink-2">{ec.numero}</div>
          <div className="text-[11px] text-ink-2">{dataBR(new Date().toISOString())}</div>
        </div>
      </div>

      <div className="mt-3 text-[11px]">
        <div><b>Cliente:</b> {ec.cliente?.razaoSocial || ec.cliente?.nome || "—"}</div>
        <div><b>Projeto:</b> {ec.projeto?.titulo || "—"}</div>
      </div>

      <table className="w-full text-[11px] border-collapse mt-4">
        <thead>
          <tr className="bg-[#595959] text-white">
            <th className="text-left px-2 py-1.5">Item</th>
            <th className="text-right px-2 py-1.5 w-[15%]">Valor na EC</th>
            <th className="text-right px-2 py-1.5 w-[15%]">Valor Líquido OS</th>
            <th className="text-right px-2 py-1.5 w-[12%]">Rentab.</th>
            <th className="text-left px-2 py-1.5 w-[26%]">Justificativa</th>
          </tr>
        </thead>
        <tbody>
          {r.linhas.map((l) => (
            <tr key={l.id} className="border-b border-[#D9D9D9] align-top">
              <td className="px-2 py-1.5">
                <span className="text-ink-2">{l.grupo} · </span>
                {l.item}
              </td>
              <td className="px-2 py-1.5 text-right">{brl(l.valorEc)}</td>
              <td className="px-2 py-1.5 text-right">{brl(l.valorLiquidoOs)}</td>
              <td className={cx("px-2 py-1.5 text-right font-bold", tom(l.percent))}>
                {l.percent === null ? "—" : pct(l.percent)}
              </td>
              <td className="px-2 py-1.5">{l.justificativa || ""}</td>
            </tr>
          ))}
          <tr className="bg-[#F2F2F2] font-bold">
            <td className="px-2 py-1.5">Total do projeto</td>
            <td className="px-2 py-1.5 text-right">{brl(r.totalEc)}</td>
            <td className="px-2 py-1.5 text-right">{brl(r.totalLiquidoOs)}</td>
            <td className={cx("px-2 py-1.5 text-right", tom(r.percentSobreEc))}>
              {r.percentSobreEc === null ? "—" : pct(r.percentSobreEc)}
            </td>
            <td className="px-2 py-1.5 font-normal">Percentual sobre o valor total da EC</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-4 text-[10px] text-ink-2">
        Documento interno da Pólobh. Honorários e encargos entram como linha porque compõem o valor total da EC;
        custos internos são o que a casa gasta e não cobra item a item.
      </p>
    </div>
  );
}
