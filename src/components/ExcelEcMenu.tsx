/** Botão "EC Excel" com menu para escolher o modelo (Financeiro ou Completa) — o mesmo na leitura e na edição da EC. */
import { useState } from "react";
import { Button } from "@/components/ui";
import { IcChevron, IcDownload } from "@/components/icons";
import { gerarEcExcel } from "@/lib/excel";
import { cx } from "@/lib/format";
import type { Ec } from "@/data/types";
import { toast } from "@/store/toast";
import { mudouDesdeAPasta } from "@/lib/salvarEcNaPasta";

/**
 * `onSalvarNaPasta` (07/11/2026): o "Salvar na pasta" também fica DENTRO deste
 * menu. Quem quer a EC na pasta procura pelo Excel — a Carol baixou a EC e
 * esperou que ela fosse para o Dropbox, como era antes de 06/11.
 */
export function ExcelEcMenu({ ec, onSalvarNaPasta }: { ec: Ec; onSalvarNaPasta?: () => void }) {
  const [aberto, setAberto] = useState(false);
  /** Baixar não leva à pasta: se a versão ainda não está lá, o aviso diz como levar. */
  const baixar = async (modelo: "financeiro" | "completa") => {
    setAberto(false);
    const r = await gerarEcExcel(ec, { modelo });
    if (r !== "cancelado" && onSalvarNaPasta && mudouDesdeAPasta(ec.atualizadoEm, ec.baixadaEm)) {
      toast('EC baixada no seu computador. Para colocar na pasta Dropbox do projeto, use "Salvar na pasta" (no menu EC Excel).', "info");
    }
  };
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
          <div className="absolute left-0 mt-1 z-50 w-56 rounded-btn border border-border bg-white shadow-2xl py-1">
            <button
              className="w-full text-left px-3 py-2 text-[13px] font-semibold text-ink hover:bg-[#FAFAFB]"
              onClick={() => void baixar("financeiro")}
            >
              Baixar Financeiro
            </button>
            <button
              className="w-full text-left px-3 py-2 text-[13px] font-semibold text-ink hover:bg-[#FAFAFB]"
              onClick={() => void baixar("completa")}
            >
              Baixar Completa
            </button>
            {onSalvarNaPasta && (
              <>
                <div className="my-1 border-t border-border" />
                <button
                  className="w-full text-left px-3 py-2 text-[13px] font-semibold text-primary-dark hover:bg-[#FAFAFB]"
                  title="Revisa os textos e coloca a EC na pasta Dropbox do projeto, na versão certa"
                  onClick={() => { setAberto(false); onSalvarNaPasta(); }}
                >
                  Salvar na pasta do projeto
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
