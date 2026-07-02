import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input, Field, Button } from "@/components/ui";
import { IcCheck } from "@/components/icons";
import { onlyDigits, maskCpfCnpjInput, maskTelefone } from "@/lib/format";
import { cnpjValido } from "@/lib/cnpj";
import type { Fornecedor } from "@/data/types";

interface Props {
  razao: string;
  cnpj: string;
  contato: string;
  fornecedores: Fornecedor[];
  /** id de um <datalist> compartilhado (renderizado uma vez pelo pai). */
  datalistId: string;
  onChange: (patch: { fornecedorRazao?: string; fornecedorCnpj?: string; fornecedorContato?: string }) => void;
  /** Consulta o CNPJ na API e registra o fornecedor no sistema. Retorna a razão social ou null. */
  onValidar: (cnpj: string) => Promise<string | null>;
}

/* -------- contato como texto "Nome · telefone · e-mail" (partes opcionais) -------- */
interface Contato {
  nome: string;
  telefone: string;
  email: string;
}
const SEP = " · ";
function parseContato(s: string): Contato {
  const c: Contato = { nome: "", telefone: "", email: "" };
  for (const p of (s || "").split(SEP).map((x) => x.trim()).filter(Boolean)) {
    if (p.includes("@") && !c.email) c.email = p;
    else if (onlyDigits(p).length >= 6 && !c.telefone) c.telefone = p;
    else c.nome = c.nome ? `${c.nome} ${p}` : p;
  }
  return c;
}
const comporContato = (c: Contato) => [c.nome.trim(), c.telefone.trim(), c.email.trim()].filter(Boolean).join(SEP);

/**
 * Campo de fornecedor da linha da EC.
 * - Ao digitar o CNPJ, a lista suspensa mostra os fornecedores já registrados
 *   (prova de que existe cadastro) e, ao escolher, traz o nome automaticamente.
 * - Se o CNPJ é válido mas ainda não existe no sistema, aparece o botão "Validar"
 *   que chama a API do CNPJ e registra o fornecedor.
 * - O contato abre um popup com Nome / Telefone / E-mail (todos opcionais).
 */
export function FornecedorField({ razao, cnpj, contato, fornecedores, datalistId, onChange, onValidar }: Props) {
  const [validando, setValidando] = useState(false);
  const [contatoAberto, setContatoAberto] = useState(false);
  const contatoBtnRef = useRef<HTMLButtonElement>(null);
  const digits = onlyDigits(cnpj);

  const registrado = useMemo(
    () => (digits.length === 14 ? fornecedores.find((f) => onlyDigits(f.cnpj) === digits) : undefined),
    [fornecedores, digits]
  );
  const podeValidar = digits.length === 14 && !registrado && cnpjValido(digits);

  function setCnpj(v: string) {
    const masked = maskCpfCnpjInput(v);
    const d = onlyDigits(masked);
    const match = d.length === 14 ? fornecedores.find((f) => onlyDigits(f.cnpj) === d) : undefined;
    onChange(
      match
        ? { fornecedorCnpj: masked, fornecedorRazao: match.nomeFantasia || match.razaoSocial }
        : { fornecedorCnpj: masked }
    );
  }

  async function validar() {
    setValidando(true);
    try {
      const nome = await onValidar(cnpj);
      if (nome) onChange({ fornecedorRazao: nome });
    } finally {
      setValidando(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Input
          list={datalistId}
          className="!h-9 !px-2 !text-[12.5px]"
          placeholder="CNPJ do fornecedor"
          inputMode="numeric"
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
        />
        {registrado && (
          <span title="Fornecedor já registrado no sistema" className="text-success shrink-0">
            <IcCheck width={16} height={16} />
          </span>
        )}
        {podeValidar && (
          <button
            type="button"
            onClick={validar}
            disabled={validando}
            title="Validar CNPJ na Receita e registrar o fornecedor no sistema"
            className="shrink-0 h-9 px-2 rounded-btn bg-primary-soft text-primary-dark text-[11px] font-extrabold hover:bg-active-border disabled:opacity-50 whitespace-nowrap"
          >
            {validando ? "…" : "Validar"}
          </button>
        )}
      </div>
      <Input
        className="!h-9 !px-2 !text-[12.5px]"
        placeholder="Razão social"
        value={razao}
        onChange={(e) => onChange({ fornecedorRazao: e.target.value })}
      />

      {/* Contato: botão que abre o popup */}
      <button
        ref={contatoBtnRef}
        type="button"
        onClick={() => setContatoAberto((v) => !v)}
        className="w-full text-left h-8 px-2 rounded-btn border-[1.5px] border-[#E2E3E8] bg-surface text-[12px] truncate hover:border-primary/60 input-focus"
        title="Editar contato do fornecedor"
      >
        {contato ? <span className="text-ink">{contato}</span> : <span className="text-ink-3">Contato (nome · telefone · e-mail)</span>}
      </button>
      {contatoAberto && (
        <ContatoPopup
          anchor={contatoBtnRef.current}
          valor={contato}
          onChange={(v) => onChange({ fornecedorContato: v })}
          onClose={() => setContatoAberto(false)}
        />
      )}
    </div>
  );
}

function ContatoPopup({
  anchor,
  valor,
  onChange,
  onClose,
}: {
  anchor: HTMLElement | null;
  valor: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inicial = useMemo(() => parseContato(valor), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [c, setC] = useState<Contato>(inicial);
  const primeiro = useRef(true);

  // Propaga a composição (pula o 1º disparo para não reescrever o valor ao abrir).
  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }
    onChange(comporContato(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c]);

  // Fecha ao clicar fora (exceto no próprio botão âncora) ou com Esc.
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

  const rect = anchor?.getBoundingClientRect();
  const largura = 300;
  const style: React.CSSProperties = {
    position: "fixed",
    width: largura,
    top: rect ? Math.min(rect.bottom + 6, window.innerHeight - 250) : 120,
    left: rect ? Math.max(8, Math.min(rect.left, window.innerWidth - largura - 8)) : 120,
    zIndex: 60,
  };

  return createPortal(
    <div ref={ref} style={style} className="bg-white rounded-card border border-border shadow-2xl p-3.5 space-y-2.5 animate-[fadein_.12s_ease-out]">
      <div className="text-[12.5px] font-bold text-ink">
        Contato do fornecedor <span className="text-ink-3 font-medium">(campos opcionais)</span>
      </div>
      <Field label="Nome">
        <Input className="!h-9" autoFocus value={c.nome} onChange={(e) => setC((x) => ({ ...x, nome: e.target.value }))} placeholder="Ex.: Maria Silva" />
      </Field>
      <Field label="Telefone">
        <Input className="!h-9" inputMode="tel" value={c.telefone} onChange={(e) => setC((x) => ({ ...x, telefone: maskTelefone(e.target.value) }))} placeholder="(31) 90000-0000" />
      </Field>
      <Field label="E-mail">
        <Input className="!h-9" inputMode="email" value={c.email} onChange={(e) => setC((x) => ({ ...x, email: e.target.value }))} placeholder="contato@fornecedor.com" />
      </Field>
      <div className="flex justify-end pt-0.5">
        <Button size="sm" onClick={onClose}>Concluir</Button>
      </div>
    </div>,
    document.body
  );
}
