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

const novaObservacao = (): Observacao => ({
  id: globalThis.crypto?.randomUUID?.() ?? `obs-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  texto: "",
  pessoa: "",
});

/** Linha completa abaixo do item; a edição acontece num modal amplo e central. */
export function ObservacoesInline({ observacoes, usuarios, onChange }: Props) {
  const [aberto, setAberto] = useState(false);
  const preenchidas = observacoes.filter((observacao) => observacao.texto.trim());
  const pessoas = [...new Set(preenchidas.map((observacao) => observacao.pessoa).filter(Boolean))];

  return (
    <>
      <section className="border-t border-border-soft bg-primary-soft/30 px-3 py-3" aria-label="Observações e responsáveis do item">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <IcComment width={17} height={17} className="mt-0.5 shrink-0 text-primary-dark" />
            <div className="min-w-0">
              <div className="text-[12px] font-extrabold uppercase tracking-[0.04em] text-ink-2">
                Observações por pessoa {preenchidas.length > 0 && `(${preenchidas.length})`}
              </div>
              <p className="mt-0.5 truncate text-[12.5px] text-ink-3">
                {preenchidas.length === 0
                  ? "Nenhuma observação atribuída."
                  : `${preenchidas[0].texto}${pessoas.length ? ` — ${pessoas.join(", ")}` : ""}`}
              </p>
            </div>
          </div>
          <Button variant={preenchidas.length ? "soft" : "secondary"} size="sm" icon={<IcComment width={14} height={14} />} onClick={() => setAberto(true)}>
            {preenchidas.length ? "Ver e editar" : "Adicionar observação"}
          </Button>
        </div>
      </section>
      {aberto && (
        <ObservacoesModal
          observacoes={observacoes}
          usuarios={usuarios}
          onChange={onChange}
          onClose={() => setAberto(false)}
        />
      )}
    </>
  );
}

function ObservacoesModal({ observacoes, usuarios, onChange, onClose }: Props & { onClose: () => void }) {
  useEffect(() => {
    const fecharComEsc = (evento: KeyboardEvent) => evento.key === "Escape" && onClose();
    document.addEventListener("keydown", fecharComEsc);
    return () => document.removeEventListener("keydown", fecharComEsc);
  }, [onClose]);

  const upd = (i: number, patch: Partial<Observacao>) =>
    onChange(observacoes.map((observacao, indice) => indice === i ? { ...observacao, ...patch } : observacao));
  const del = (i: number) => onChange(observacoes.filter((_, indice) => indice !== i));

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-observacoes"
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-card-lg border border-border bg-white shadow-modal animate-[fadein_.12s_ease-out]"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border-soft px-5 py-4">
          <div>
            <h2 id="titulo-modal-observacoes" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
              <IcComment width={19} height={19} /> Observações do item
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-3">Cadastre vários textos e atribua cada pendência a uma pessoa.</p>
          </div>
          <Button variant="text" size="sm" onClick={onClose}>Fechar</Button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {observacoes.length === 0 && (
            <div className="rounded-btn border border-dashed border-border p-6 text-center text-sm text-ink-3">
              Nenhuma observação cadastrada.
            </div>
          )}
          {observacoes.map((observacao, indice) => (
            <div key={observacao.id || `observacao-${indice}`} className="grid grid-cols-1 gap-3 rounded-card border border-border-soft bg-[#FCFCFD] p-4 md:grid-cols-[minmax(320px,1fr)_260px_auto] md:items-end">
              <label>
                <span className="mb-1 block text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-ink-3">Texto da observação</span>
                <AutoTextarea rows={4} value={observacao.texto} placeholder="Descreva a pendência ou orientação…" onChange={(evento) => upd(indice, { texto: evento.target.value })} />
              </label>
              <label>
                <span className="mb-1 block text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-ink-3">Pessoa responsável</span>
                <Select value={observacao.pessoa} onChange={(evento) => upd(indice, { pessoa: evento.target.value })}>
                  <option value="">Selecione um usuário</option>
                  {usuarios.map((usuario) => <option key={usuario} value={usuario}>{usuario}</option>)}
                  {observacao.pessoa && !usuarios.includes(observacao.pessoa) && <option value={observacao.pessoa}>{observacao.pessoa}</option>}
                </Select>
              </label>
              <Button type="button" variant="text" size="sm" aria-label="Remover observação" title="Remover observação" icon={<IcTrash width={17} height={17} />} onClick={() => del(indice)} />
            </div>
          ))}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border-soft bg-[#FAFAFB] px-5 py-4">
          <Button variant="secondary" size="sm" icon={<IcPlus width={15} height={15} />} onClick={() => onChange([...observacoes, novaObservacao()])}>
            Nova observação
          </Button>
          <Button size="sm" onClick={onClose}>Concluir</Button>
        </footer>
      </div>
    </div>,
    document.body
  );
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
  const add = () => onChange([...observacoes, novaObservacao()]);
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
