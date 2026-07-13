import { useEffect, useRef, type ReactNode } from "react";
import { IcBold, IcList } from "@/components/icons";
import { cx } from "@/lib/format";

interface Props {
  value: string; // HTML
  onChange: (html: string) => void;
  placeholder?: string;
  /** Ação extra na barra (ex.: botão "Resumo da Proposta"). */
  toolbarExtra?: ReactNode;
  className?: string;
}

/**
 * Editor rich-text minimalista (negrito + bullets) baseado em contentEditable.
 * Guarda HTML simples. Sincroniza o value externo só quando difere do DOM e o
 * campo não está com foco (evita "pular" o cursor ao digitar).
 */
export function RichTextField({ value, onChange, placeholder, toolbarExtra, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerHTML !== (value || "")) el.innerHTML = value || "";
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const html = el.innerHTML === "<br>" ? "" : el.innerHTML;
    onChange(html);
  };

  const cmd = (comando: string) => {
    ref.current?.focus();
    document.execCommand(comando, false);
    emit();
  };

  const vazio = !value || value === "<br>";

  return (
    <div className={cx("rounded-btn border-[1.5px] border-[#E2E3E8] bg-surface overflow-hidden focus-within:border-primary/60", className)}>
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-border-soft bg-[#FAFAFB]">
        <ToolBtn title="Negrito" onClick={() => cmd("bold")}><IcBold width={15} height={15} /></ToolBtn>
        <ToolBtn title="Lista com marcadores" onClick={() => cmd("insertUnorderedList")}><IcList width={15} height={15} /></ToolBtn>
        <div className="ml-auto">{toolbarExtra}</div>
      </div>
      <div className="relative">
        {vazio && placeholder && (
          <span className="pointer-events-none absolute left-2.5 top-2 text-[13px] text-ink-3">{placeholder}</span>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          className="min-h-[64px] px-2.5 py-2 text-[13.5px] text-ink outline-none leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
        />
      </div>
    </div>
  );
}

function ToolBtn({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // não perde o foco/seleção do editor
      onClick={onClick}
      className="h-7 w-7 grid place-items-center rounded-md text-ink-2 hover:bg-primary-soft hover:text-primary-dark"
    >
      {children}
    </button>
  );
}
