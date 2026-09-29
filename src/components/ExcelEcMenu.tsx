/** Botão "EC Excel" com menu para escolher o modelo (Financeiro ou Completa) — o mesmo na leitura e na edição da EC. */
import { useState } from "react";
import { Button } from "@/components/ui";
import { IcChevron, IcDownload } from "@/components/icons";
import { gerarEcExcel } from "@/lib/excel";
import { cx } from "@/lib/format";
import type { Ec } from "@/data/types";

export function ExcelEcMenu({ ec }: { ec: Ec }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="relative">
      <Button variant="secondary" size="sm" icon={<IcDownload width={16} height={16} />} onClick={() => setAberto((v) => !v)}>
        <span className="inline-flex items-center gap-1">
          EC Excel <IcChevron width={13} height={13} className={cx("transition-transform", aberto && "rotate-90")} />
        </span>
      </Button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute left-0 mt-1 z-50 w-44 rounded-btn border border-border bg-white shadow-2xl py-1">
            <button
              className="w-full text-left px-3 py-2 text-[13px] font-semibold text-ink hover:bg-[#FAFAFB]"
              onClick={() => { gerarEcExcel(ec, { modelo: "financeiro" }); setAberto(false); }}
            >
              Financeiro
            </button>
            <button
              className="w-full text-left px-3 py-2 text-[13px] font-semibold text-ink hover:bg-[#FAFAFB]"
              onClick={() => { gerarEcExcel(ec, { modelo: "completa" }); setAberto(false); }}
            >
              Completa
            </button>
          </div>
        </>
      )}
    </div>
  );
}
