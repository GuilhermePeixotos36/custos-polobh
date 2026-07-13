import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AutoTextarea, Select, Button } from "@/components/ui";
import { IcComment, IcTrash, IcPlus } from "@/components/icons";
import { cx } from "@/lib/format";
import type { Observacao } from "@/data/types";

interface Props {
  observacoes: Observacao[];
  usuarios: string[]; // nomes dos usuários do sistema (para atribuir)
  onChange: (obs: Observacao[]) => void;
}

/**
 * Botão de comentário que abre um pop-up com as observações do item.
 * Permite múltiplas observações, cada uma com texto e pessoa responsável
 * (um usuário do sistema). Mantém a tela limpa — só o contador aparece.
 */
export function ObservacoesButton({ observacoes, usuarios, onChange }: Props) {
  const [aberto, setAberto] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const n = observacoes.filter((o) => o.texto.trim()).length;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setAberto((v) => !v)}
        title="Observações do item"
        className={cx(
          "relative inline-flex items-center gap-1.5 h-9 px-2.5 rounded-btn border-[1.5px] text-[12px] font-bold input-focus",
          n > 0 ? "border-primary/50 bg-primary-soft text-primary-dark" : "border-[#E2E3E8] bg-surface text-ink-2 hover:text-ink"
        )}
      >
        <IcComment width={15} height={15} />
        Observação
        {n > 0 && <span className="ml-0.5 rounded-pill bg-primary text-white text-[10px] font-extrabold px-1.5 py-0.5 leading-none">{n}</span>}
      </button>
      {aberto && (
        <ObsPopup
          anchor={btnRef.current}
          observacoes={observacoes}
          usuarios={usuarios}
          onChange={onChange}
          onClose={() => setAberto(false)}
        />
      )}
    </>
  );
}

function ObsPopup({
  anchor,
  observacoes,
  usuarios,
  onChange,
  onClose,
}: {
  anchor: HTMLElement | null;
  observacoes: Observacao[];
  usuarios: string[];
  onChange: (obs: Observacao[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t) && anchor && !anchor.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor, onClose]);

  const upd = (i: number, patch: Partial<Observacao>) =>
    onChange(observacoes.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const add = () => onChange([...observacoes, { texto: "", pessoa: "" }]);
  const del = (i: number) => onChange(observacoes.filter((_, idx) => idx !== i));

  const rect = anchor?.getBoundingClientRect();
  const largura = 340;
  const style: React.CSSProperties = {
    position: "fixed",
    width: largura,
    top: rect ? Math.min(rect.bottom + 6, window.innerHeight - 320) : 120,
    left: rect ? Math.max(8, Math.min(rect.left, window.innerWidth - largura - 8)) : 120,
    zIndex: 60,
  };

  return createPortal(
    <div ref={ref} style={style} className="bg-white rounded-card border border-border shadow-2xl p-3.5 space-y-3 animate-[fadein_.12s_ease-out] max-h-[70vh] overflow-y-auto">
      <div className="text-[12.5px] font-bold text-ink flex items-center gap-1.5">
        <IcComment width={15} height={15} /> Observações do item
      </div>

      {observacoes.length === 0 && (
        <p className="text-[12px] text-ink-3">Nenhuma observação. Adicione uma e atribua a uma pessoa.</p>
      )}

      {observacoes.map((o, i) => (
        <div key={i} className="rounded-btn border border-border-soft p-2 space-y-1.5 bg-[#FCFCFD]">
          <AutoTextarea
            className="!text-[12.5px]"
            placeholder="Escreva a observação…"
            value={o.texto}
            onChange={(e) => upd(i, { texto: e.target.value })}
          />
          <div className="flex items-center gap-1.5">
            <Select className="!h-8 !text-[12px]" value={o.pessoa} onChange={(e) => upd(i, { pessoa: e.target.value })}>
              <option value="">Atribuir a…</option>
              {usuarios.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
              {/* mantém o valor mesmo que a pessoa não esteja mais na lista */}
              {o.pessoa && !usuarios.includes(o.pessoa) && <option value={o.pessoa}>{o.pessoa}</option>}
            </Select>
            <button type="button" onClick={() => del(i)} title="Remover observação" className="text-ink-3 hover:text-danger p-1.5 shrink-0">
              <IcTrash width={16} height={16} />
            </button>
          </div>
        </div>
      ))}

      <div className="flex justify-between pt-0.5">
        <Button variant="secondary" size="sm" icon={<IcPlus width={15} height={15} />} onClick={add}>
          Nova observação
        </Button>
        <Button size="sm" onClick={onClose}>Concluir</Button>
      </div>
    </div>,
    document.body
  );
}
