import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { IcBold, IcList } from "@/components/icons";
import { cx } from "@/lib/format";
import { sanitizarHtmlEditor } from "@/lib/sanitizeHtml";

interface Props {
  value: string; // HTML
  onChange: (html: string) => void;
  placeholder?: string;
  /** Ação extra na barra (ex.: botão "Resumo da Proposta"). */
  toolbarExtra?: ReactNode;
  className?: string;
  /**
   * Modo leitura: some com a barra de formatação e trava a digitação.
   *
   * `contentEditable` ignora o `disabled` de um `<fieldset>` em volta — é por
   * isso que o modo leitura precisa ser dito aqui dentro, e não herdado como
   * acontece com input, select e textarea.
   */
  somenteLeitura?: boolean;
}

/**
 * Editor rich-text minimalista (negrito + bullets) baseado em contentEditable.
 * Guarda HTML simples. Sincroniza o value externo só quando difere do DOM e o
 * campo não está com foco (evita "pular" o cursor ao digitar).
 */
export function RichTextField({ value, onChange, placeholder, toolbarExtra, className, somenteLeitura }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const seguro = sanitizarHtmlEditor(value || "");
    if (el.innerHTML !== seguro) el.innerHTML = seguro;
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const atual = el.innerHTML === "<br>" ? "" : el.innerHTML;
    const html = sanitizarHtmlEditor(atual);
    if (el.innerHTML !== html) el.innerHTML = html;
    onChange(html);
  };

  const cmd = (comando: string, valor?: string) => {
    ref.current?.focus();
    document.execCommand(comando, false, valor);
    emit();
  };

  const onKeyDown = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key !== "Tab") return;
    const selecao = window.getSelection();
    const noInicial = selecao?.anchorNode;
    const elemento = noInicial instanceof Element ? noInicial : noInicial?.parentElement;
    const itemLista = elemento?.closest("li");
    if (!itemLista || !ref.current?.contains(itemLista)) return;

    evento.preventDefault();
    document.execCommand(evento.shiftKey ? "outdent" : "indent", false);
    emit();
  };

  const onPaste = (evento: ClipboardEvent<HTMLDivElement>) => {
    evento.preventDefault();
    const html = evento.clipboardData.getData("text/html");
    const texto = evento.clipboardData.getData("text/plain");
    const conteudo = html ? sanitizarHtmlEditor(html) : texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
    document.execCommand("insertHTML", false, conteudo);
    emit();
  };

  const vazio = !value || value === "<br>";

  return (
    <div className={cx("rounded-btn border-[1.5px] border-[#BFC4CE] bg-surface overflow-hidden focus-within:border-primary/60", className)}>
      {!somenteLeitura && (
      <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-border-soft bg-[#FAFAFB]">
        <ToolBtn title="Parágrafo" onClick={() => cmd("formatBlock", "p")}><span className="text-[11px] font-extrabold">¶</span></ToolBtn>
        <ToolBtn title="Negrito" onClick={() => cmd("bold")}><IcBold width={15} height={15} /></ToolBtn>
        <ToolBtn title="Itálico" onClick={() => cmd("italic")}><span className="font-serif italic font-bold">I</span></ToolBtn>
        <ToolBtn title="Sublinhado" onClick={() => cmd("underline")}><span className="font-serif underline font-bold">U</span></ToolBtn>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <ToolBtn title="Lista com marcadores" onClick={() => cmd("insertUnorderedList")}><IcList width={15} height={15} /></ToolBtn>
        <ToolBtn title="Lista numerada" onClick={() => cmd("insertOrderedList")}><span className="text-[11px] font-extrabold">1.</span></ToolBtn>
        <ToolBtn title="Aumentar recuo" onClick={() => cmd("indent")}><span className="text-[12px] font-extrabold">→|</span></ToolBtn>
        <ToolBtn title="Diminuir recuo" onClick={() => cmd("outdent")}><span className="text-[12px] font-extrabold">|←</span></ToolBtn>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <ToolBtn title="Alinhar à esquerda" onClick={() => cmd("justifyLeft")}><span className="text-[13px] font-extrabold">≡</span></ToolBtn>
        <ToolBtn title="Centralizar" onClick={() => cmd("justifyCenter")}><span className="text-[13px] font-extrabold">≣</span></ToolBtn>
        <ToolBtn title="Desfazer" onClick={() => cmd("undo")}><span className="text-base leading-none">↶</span></ToolBtn>
        <ToolBtn title="Refazer" onClick={() => cmd("redo")}><span className="text-base leading-none">↷</span></ToolBtn>
        <div className="ml-auto">{toolbarExtra}</div>
      </div>
      )}
      <div className="relative">
        {vazio && placeholder && (
          <span className="pointer-events-none absolute left-2.5 top-2 text-[13px] text-ink-3">{placeholder}</span>
        )}
        <div
          ref={ref}
          contentEditable={!somenteLeitura}
          lang="pt-BR"
          spellCheck
          autoCapitalize="sentences"
          autoCorrect="on"
          onFocus={() => document.execCommand("defaultParagraphSeparator", false, "p")}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          className="min-h-[96px] px-2.5 py-2 text-[13.5px] text-ink outline-none leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_li_>_ul]:ml-3 [&_li_>_ol]:ml-3"
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
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()} // não perde o foco/seleção do editor
      onClick={onClick}
      className="h-7 w-7 grid place-items-center rounded-md text-ink-2 hover:bg-primary-soft hover:text-primary-dark"
    >
      {children}
    </button>
  );
}
