/**
 * "Dividir item" da EC — o mesmo serviço feito por dois fornecedores.
 *
 * Pergunta só o que sai do item original (nome e valores da nova parte); o
 * resto fica onde está. A regra mora em `domain/ec` (`dividirLinha`).
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Button, CurrencyInput, Input, MarcaObrigatorio } from "@/components/ui";
import { IcFechar } from "@/components/icons";
import { motivoDivisaoInvalida, type ParteDaDivisao } from "@/domain/ec";
import { brl } from "@/lib/format";
import type { EcLinha } from "@/data/types";

export function DividirItemModal({
  linha,
  verFinanceiro,
  onDividir,
  onFechar,
}: {
  linha: EcLinha;
  verFinanceiro: boolean;
  onDividir: (parte: ParteDaDivisao) => void;
  onFechar: () => void;
}) {
  const [parte, setParte] = useState<ParteDaDivisao>({
    item: linha.item ? `${linha.item} (2)` : "",
    descricao: "",
    valorPolobh: 0,
    valorCliente: 0,
  });
  const motivo = motivoDivisaoInvalida(linha, parte);
  const upd = (p: Partial<ParteDaDivisao>) => setParte((x) => ({ ...x, ...p }));

  return createPortal(
    <div className="no-print fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onFechar} />
      <div
        role="dialog"
        aria-label="Dividir item"
        className="relative w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-surface rounded-card-lg shadow-modal border border-border"
      >
        <div className="flex items-start gap-3 px-5 py-4 border-b border-border-soft">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-[18px] text-ink tracking-[-0.3px]">Dividir item</h3>
            <p className="text-[12.5px] text-ink-2 mt-1">
              Para quando <b>{linha.item || "este item"}</b> é atendido por mais de um fornecedor. A parte nova
              entra logo abaixo, sem fornecedor, e o original fica com o que sobrar — o total não muda. As partes
              ficam ligadas: cada uma gera a sua OS, e para o cliente o item segue sendo um só.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            title="Fechar"
            className="ml-auto shrink-0 h-9 w-9 grid place-items-center rounded-btn text-ink-2 hover:text-ink hover:bg-[#F1F2F5]"
          >
            <IcFechar width={18} height={18} />
          </button>
        </div>

        <form
          className="px-5 py-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (motivo) return;
            onDividir(parte);
            onFechar();
          }}
        >
          <label className="block">
            <span className="block text-[11px] font-extrabold uppercase tracking-[0.05em] text-ink-3 mb-1">Nome do novo item<MarcaObrigatorio /></span>
            <Input formato="item" value={parte.item} onChange={(e) => upd({ item: e.target.value })} autoFocus />
          </label>
          <label className="block">
            <span className="block text-[11px] font-extrabold uppercase tracking-[0.05em] text-ink-3 mb-1">
              Descrição financeiro <span className="normal-case font-semibold">(opcional — vazio usa o nome)</span>
            </span>
            <Input value={parte.descricao} onChange={(e) => upd({ descricao: e.target.value })} />
          </label>

          {verFinanceiro && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[11px] font-extrabold uppercase tracking-[0.05em] text-ink-3 mb-1">
                  Pólobh da nova parte
                </span>
                <CurrencyInput value={parte.valorPolobh} onValue={(v) => upd({ valorPolobh: v })} />
                <span className="block text-[11.5px] text-ink-3 mt-1">
                  Fica no original: {brl(Math.max(0, linha.valorPolobh - parte.valorPolobh))}
                </span>
              </label>
              <label className="block">
                <span className="block text-[11px] font-extrabold uppercase tracking-[0.05em] text-ink-3 mb-1">
                  Cliente da nova parte
                </span>
                <CurrencyInput value={parte.valorCliente} onValue={(v) => upd({ valorCliente: v })} />
                <span className="block text-[11.5px] text-ink-3 mt-1">
                  Fica no original: {brl(Math.max(0, linha.valorCliente - parte.valorCliente))}
                </span>
              </label>
            </div>
          )}

          <p className="text-[12px] text-ink-3">
            Depois de dividir: informe o fornecedor e as Alternativas de Custos do item novo e salve a EC.
            {linha.statusAprovacao === "OK" && " Como o item já está aprovado, a parte nova nasce pedindo a OS dela."}
          </p>

          {motivo && <p className="text-[12.5px] font-bold text-danger">{motivo}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={onFechar}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={!!motivo}>Dividir</Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
