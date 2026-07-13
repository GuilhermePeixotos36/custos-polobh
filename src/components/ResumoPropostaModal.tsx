import { useState } from "react";
import { createPortal } from "react-dom";
import { Input, Field, Button } from "@/components/ui";
import { IcSpark, IcTrash, IcPlus } from "@/components/icons";
import { resumirProposta } from "@/lib/resumoProposta";

interface Props {
  onInserir: (html: string) => void;
  onClose: () => void;
}

/** Converte o texto em tópicos ("• …" por linha) devolvido pela IA em HTML. */
export function bulletsParaHtml(texto: string): string {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const itens = linhas.map((l) => l.replace(/^([•\-*]\s*|\d+[.)]\s*)/, ""));
  if (!itens.length) return "";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<ul>${itens.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

/**
 * Modal do "Resumo da Proposta": recebe orçamentos (JPG/PNG/PDF/Excel) ou um
 * link, chama a IA (OpenRouter via Edge Function) e insere o descritivo em
 * tópicos na Descrição Completa do item.
 */
export function ResumoPropostaModal({ onInserir, onClose }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    setFiles((prev) => [...prev, ...Array.from(fl)]);
  };

  async function gerar() {
    setErro("");
    if (!files.length && !link.trim()) {
      setErro("Anexe ao menos um orçamento ou informe um link.");
      return;
    }
    setLoading(true);
    try {
      const r = await resumirProposta({ files, link });
      if (!r.ok) {
        setErro(r.erro || "Falha ao gerar o resumo.");
        return;
      }
      onInserir(bulletsParaHtml(r.resumo || ""));
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="no-print fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={loading ? undefined : onClose} />
      <div className="relative w-full max-w-[520px] bg-surface rounded-card-lg shadow-modal border border-border p-6 animate-[fadein_.12s_ease] max-h-[85vh] overflow-y-auto">
        <h3 className="font-display font-bold text-[17px] text-ink tracking-[-0.3px] flex items-center gap-2">
          <IcSpark width={18} height={18} className="text-primary" /> Resumo da Proposta (IA)
        </h3>
        <p className="text-ink-2 text-[13px] mt-1.5 leading-relaxed">
          Anexe os orçamentos do fornecedor (imagem, PDF ou Excel) ou cole um link. A IA sintetiza os
          descritivos e valores individuais em tópicos, e insere na Descrição Completa.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block rounded-card border-2 border-dashed border-border hover:border-primary/50 cursor-pointer p-4 text-center transition-colors">
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
            />
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary-dark">
              <IcPlus width={16} height={16} /> Adicionar arquivos
            </span>
            <div className="text-[11.5px] text-ink-3 mt-1">JPG, PNG, PDF, Excel/CSV</div>
          </label>

          {files.length > 0 && (
            <ul className="space-y-1.5">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-[12.5px] bg-white border border-border-soft rounded-btn px-2.5 py-1.5">
                  <span className="truncate flex-1 text-ink">{f.name}</span>
                  <span className="text-ink-3 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-ink-3 hover:text-danger shrink-0" title="Remover">
                    <IcTrash width={15} height={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Field label="Ou um link (opcional)">
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" inputMode="url" />
          </Field>

          {erro && <div className="text-[12.5px] text-danger bg-danger-soft rounded-btn px-3 py-2">{erro}</div>}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button size="sm" icon={<IcSpark width={16} height={16} />} onClick={gerar} disabled={loading}>
            {loading ? "Gerando…" : "Gerar resumo"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
