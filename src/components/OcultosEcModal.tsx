/**
 * Popup "Itens e grupos ocultos" da EC: escolhe o que volta para a tela.
 *
 * Ocultar faz o grupo/item SUMIR (ver `domain/ocultosEc`); este popup é o
 * caminho de volta. Marcar o grupo marca todos os itens ocultos dele.
 */
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { IcEye, IcFechar } from "@/components/icons";
import type { GrupoComOcultos } from "@/domain/ocultosEc";

export function OcultosEcModal({
  grupos,
  onReexibir,
  onFechar,
}: {
  grupos: GrupoComOcultos[];
  onReexibir: (ids: string[]) => void;
  onFechar: () => void;
}) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const todosIds = useMemo(() => grupos.flatMap((g) => g.itens.map((i) => i.id)), [grupos]);
  const todosMarcados = todosIds.length > 0 && todosIds.every((id) => marcados.has(id));

  const alternar = (ids: string[], marcar: boolean) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      for (const id of ids) (marcar ? novo.add(id) : novo.delete(id));
      return novo;
    });

  return createPortal(
    <div className="no-print fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onFechar} />
      <div
        role="dialog"
        aria-label="Itens e grupos ocultos"
        className="relative w-full max-w-[560px] max-h-[88vh] flex flex-col bg-surface rounded-card-lg shadow-modal border border-border overflow-hidden"
      >
        <div className="flex items-start gap-3 px-5 py-4 border-b border-border-soft">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-[18px] text-ink tracking-[-0.3px]">Itens e grupos ocultos</h3>
            <p className="text-[12.5px] text-ink-2 mt-1">
              Marque o que deve voltar para a tela. O que está oculto fica guardado, fora dos totais e do Excel.
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

        <div className="overflow-y-auto px-5 py-3 space-y-3">
          {grupos.length === 0 && <p className="text-center text-ink-3 text-sm py-6">Nada oculto.</p>}
          {grupos.map((g) => {
            const ids = g.itens.map((i) => i.id);
            const marcadosNoGrupo = ids.filter((id) => marcados.has(id)).length;
            return (
              <div key={g.grupo} className="rounded-btn border border-border-soft">
                <label className="flex items-center gap-2 px-3 py-2 bg-[#FAFAFB] cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={marcadosNoGrupo === ids.length}
                    ref={(el) => {
                      if (el) el.indeterminate = marcadosNoGrupo > 0 && marcadosNoGrupo < ids.length;
                    }}
                    onChange={(e) => alternar(ids, e.target.checked)}
                  />
                  <span className="flex-1 min-w-0 truncate text-[13.5px] font-extrabold uppercase text-ink">{g.grupo}</span>
                  <span className="shrink-0 text-[11px] font-extrabold uppercase rounded-pill bg-[#F0F1F4] text-ink-3 px-2 py-0.5">
                    {g.inteiro ? "grupo oculto" : `${ids.length} oculto${ids.length > 1 ? "s" : ""}`}
                  </span>
                </label>
                <ul className="divide-y divide-border-soft">
                  {g.itens.map((i) => (
                    <li key={i.id}>
                      <label className="flex items-center gap-2 px-3 py-1.5 pl-8 cursor-pointer hover:bg-[#FCFCFD]">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={marcados.has(i.id)}
                          onChange={(e) => alternar([i.id], e.target.checked)}
                        />
                        <span className="min-w-0 truncate text-[13px] text-ink-2">{i.titulo}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap px-5 py-3 border-t border-border-soft">
          <button
            type="button"
            className="text-[12.5px] font-bold text-ink-2 hover:text-ink"
            onClick={() => alternar(todosIds, !todosMarcados)}
            disabled={!todosIds.length}
          >
            {todosMarcados ? "Limpar seleção" : "Selecionar todos"}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="text" size="sm" onClick={onFechar}>
              Fechar
            </Button>
            <Button
              size="sm"
              icon={<IcEye width={15} height={15} />}
              disabled={marcados.size === 0}
              onClick={() => {
                onReexibir([...marcados]);
                onFechar();
              }}
            >
              Reexibir selecionados ({marcados.size})
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
