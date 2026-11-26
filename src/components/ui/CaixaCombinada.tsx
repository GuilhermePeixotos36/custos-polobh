// Caixa combinada com busca: escolhe UM valor de uma lista fechada (sem digitação livre).
// Digitar filtra as opções; Enter escolhe a destacada; Esc fecha; sair do campo sem escolher
// devolve o valor que estava. Usada no Setor e no Cargo/função do usuário.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cx } from "@/lib/format";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function CaixaCombinada({
  valor, opcoes, onChange, placeholder = "Buscar…", vazio = "Nada encontrado", disabled, permitirLimpar = true,
}: {
  valor: string;
  opcoes: string[];
  onChange: (valor: string) => void;
  placeholder?: string;
  vazio?: string;
  disabled?: boolean;
  permitirLimpar?: boolean;
}) {
  const idLista = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [destaque, setDestaque] = useState(0);

  const filtradas = useMemo(() => {
    const q = semAcento(texto);
    return q ? opcoes.filter((o) => semAcento(o).includes(q)) : opcoes;
  }, [opcoes, texto]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) fechar();
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  function abrir() {
    if (disabled) return;
    setTexto("");
    setDestaque(Math.max(0, opcoes.indexOf(valor)));
    setAberto(true);
  }
  function fechar() {
    setAberto(false);
    setTexto("");
  }
  function escolher(o: string) {
    onChange(o);
    fechar();
  }

  return (
    <div ref={caixa} className="relative">
      <input
        role="combobox"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-autocomplete="list"
        disabled={disabled}
        className={cx(
          "w-full h-11 bg-surface border-[1.5px] border-[#BFC4CE] rounded-btn pl-3.5 pr-9 text-sm text-ink placeholder:text-ink-3 input-focus disabled:bg-[#EDEEF1] disabled:text-ink-2",
          !aberto && !valor && "text-ink-3",
        )}
        value={aberto ? texto : valor}
        placeholder={aberto ? (valor || placeholder) : "Escolha…"}
        onFocus={abrir}
        onClick={() => !aberto && abrir()}
        onChange={(e) => { setTexto(e.target.value); setDestaque(0); if (!aberto) setAberto(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); if (!aberto) abrir(); else setDestaque((d) => Math.min(d + 1, filtradas.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setDestaque((d) => Math.max(d - 1, 0)); }
          else if (e.key === "Enter") { if (aberto && filtradas[destaque]) { e.preventDefault(); escolher(filtradas[destaque]); } }
          else if (e.key === "Escape") { if (aberto) { e.preventDefault(); e.stopPropagation(); fechar(); } }
          else if (e.key === "Tab") fechar();
        }}
      />
      <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6A6E78" strokeWidth="2.5"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"><path d="M6 9l6 6 6-6" /></svg>
      {aberto && (
        <ul id={idLista} role="listbox" className="absolute z-[90] mt-1 max-h-60 w-full overflow-y-auto rounded-btn border border-border bg-surface py-1 shadow-modal">
          {permitirLimpar && valor && !texto && (
            <li role="option" aria-selected={false} className="cursor-pointer px-3 py-2 text-[13px] text-ink-3 hover:bg-[#F5F6F8]"
              onMouseDown={(e) => { e.preventDefault(); escolher(""); }}>
              Limpar
            </li>
          )}
          {filtradas.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-ink-3">{vazio}</li>
          ) : (
            filtradas.map((o, i) => (
              <li key={o} role="option" aria-selected={o === valor}
                className={cx("cursor-pointer px-3 py-2 text-[13px]", i === destaque ? "bg-[#FFF1E3]" : "hover:bg-[#F5F6F8]", o === valor && "font-semibold")}
                onMouseEnter={() => setDestaque(i)}
                onMouseDown={(e) => { e.preventDefault(); escolher(o); }}>
                {o}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
