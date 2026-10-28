import type {
  ChangeEvent,
  FocusEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import {
  cx, maskTelefone, onlyDigits, colapsarEspacos, tituloProprio, capitalizarFrase,
  brl, limparEntradaNumerica, parseNumeroBR,
} from "@/lib/format";
import { padronizarNomeGrupo, padronizarNomeItem } from "@/domain/textos";

const fieldBase =
  "w-full bg-surface border-[1.5px] border-[#BFC4CE] rounded-btn px-3.5 text-sm text-ink placeholder:text-ink-3 input-focus disabled:bg-[#EDEEF1] disabled:text-ink-2";
/** Destaque de campo obrigatório não preenchido: contorno + preenchimento vermelhos. */
const fieldErro = "!border-danger !bg-danger-soft";
const dataIsoValida = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const ano = Number(v.slice(0, 4));
  const d = new Date(`${v}T00:00:00`);
  return ano >= 1900 && ano <= 2100 && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/** Asterisco vermelho de campo obrigatório. */
export function MarcaObrigatorio({ title = "Preenchimento obrigatório" }: { title?: string }) {
  return (
    <span className="text-danger font-bold" title={title} aria-label="obrigatório">
      {" "}*
    </span>
  );
}

export function Label({
  children,
  htmlFor,
  hint,
  obrigatorio,
}: {
  children: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  /** Marca o campo com * vermelho. */
  obrigatorio?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block mb-1.5">
      <span className="text-[12.5px] font-bold text-ink">{children}{obrigatorio && <MarcaObrigatorio />}</span>
      {hint && <span className="text-[12px] text-ink-3 font-medium ml-1">{hint}</span>}
    </label>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
  obrigatorio,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Marca o rótulo com * vermelho. */
  obrigatorio?: boolean;
}) {
  return (
    <div className={className}>
      {label && <Label hint={hint} obrigatorio={obrigatorio}>{label}</Label>}
      {children}
    </div>
  );
}

/**
 * Formatação aplicada ao SAIR do campo (blur), padronizando a informação:
 * - "titulo": Primeira Letra de Cada Palavra Maiúscula (nomes, endereços)
 * - "titulo-empresa": idem, preservando siglas (LTDA, ME…) — para Razão Social
 * - "frase": maiúscula no início das frases (títulos/textos curtos)
 * - "grupo": CAIXA ALTA (nome de grupo da EC e da OS)
 * - "item": primeira letra maiúscula; o que vem todo em maiúsculas vira frase,
 *   preservando siglas (nome de item da EC e da OS)
 * Sem `formato`, o blur ainda apara espaços repetidos (colapsarEspacos).
 */
export type FormatoCampo = "titulo" | "titulo-empresa" | "frase" | "grupo" | "item";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  formato?: FormatoCampo;
  erro?: boolean;
  /**
   * Valores que a Pólobh já usou neste campo em outros projetos/ECs/OSs — vira
   * uma lista de autocompletar do próprio navegador (ver `domain/sugestoes`).
   * É atalho, não trava: qualquer texto novo continua valendo.
   */
  sugestoes?: string[];
};

function aplicarFormato(v: string, formato?: FormatoCampo): string {
  switch (formato) {
    case "titulo":
      return tituloProprio(v);
    case "titulo-empresa":
      return tituloProprio(v, { preservarSiglas: true });
    case "frase":
      return capitalizarFrase(v);
    case "grupo":
      return padronizarNomeGrupo(v);
    case "item":
      return padronizarNomeItem(v);
    default:
      return colapsarEspacos(v);
  }
}

export function Input({ className, type, onChange, value, onBlur, formato, erro, sugestoes, ...rest }: InputProps) {
  // Chamado sempre (antes de qualquer retorno): a lista precisa de um id estável.
  const idLista = useId();
  if (type === "date") {
    return <CampoData className={className} erro={erro} value={value} onChange={onChange} onBlur={onBlur} {...rest} />;
  }
  // Ao sair de um campo de texto, padroniza a formatação (espaços + capitalização).
  const semFormatacao = type === "email" || type === "password" || type === "url" || type === "number";
  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (!semFormatacao && typeof value === "string" && onChange) {
      const novo = aplicarFormato(value, formato);
      if (novo !== value) {
        onChange({ ...e, target: { ...e.target, value: novo } } as unknown as ChangeEvent<HTMLInputElement>);
      }
    }
    onBlur?.(e);
  };
  const temSugestoes = !!sugestoes?.length;
  const campo = (
    <input
      className={cx(fieldBase, "h-11", erro && fieldErro, className)}
      type={type}
      list={temSugestoes ? idLista : undefined}
      onChange={onChange}
      value={value}
      onBlur={handleBlur}
      {...rest}
    />
  );
  if (!temSugestoes) return campo;
  return (
    <>
      {campo}
      {/* <datalist> nativo: filtra, navega pelo teclado e não rouba o campo de
          quem quer digitar um valor novo. */}
      <datalist id={idLista}>
        {sugestoes!.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </>
  );
}

/** Telefone em dois campos (DDD + número), mas guarda/emite uma única string mascarada — como antes. */
export function TelefoneInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const numeroRef = useRef<HTMLInputElement>(null);
  const digitos = onlyDigits(value).slice(0, 11);
  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  const numeroFormatado =
    numero.length <= 4 ? numero
      : numero.length <= 8 ? numero.replace(/^(\d{4})(\d)/, "$1-$2")
      : numero.replace(/^(\d{5})(\d)/, "$1-$2");

  return (
    <div className={cx("grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 min-w-0", className)}>
      <input
        className={cx(fieldBase, "h-11 !w-[4.5rem] !px-2 text-center")}
        inputMode="numeric"
        maxLength={2}
        placeholder="DDD"
        value={ddd}
        onChange={(e) => {
          const novoDdd = onlyDigits(e.target.value).slice(0, 2);
          onChange(maskTelefone(novoDdd + numero));
          if (novoDdd.length === 2) requestAnimationFrame(() => numeroRef.current?.focus());
        }}
      />
      <input
        ref={numeroRef}
        className={cx(fieldBase, "h-11 !w-auto min-w-0")}
        inputMode="tel"
        maxLength={10}
        placeholder="90000-0000"
        value={numeroFormatado}
        onChange={(e) => onChange(maskTelefone(ddd + onlyDigits(e.target.value).slice(0, 9)))}
      />
    </div>
  );
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldBase, "py-2.5 min-h-[80px]", className)} {...rest} />;
}

/**
 * Textarea que cresce automaticamente para mostrar todo o conteúdo (sem esconder
 * texto). A altura acompanha o conteúdo já no primeiro render e a cada digitação.
 */
export function AutoTextarea({
  className,
  value,
  onChange,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const ajustar = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    // soma a borda (box-sizing: border-box) para não cortar a última linha
    const borda = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + borda}px`;
  };
  useLayoutEffect(ajustar, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      onChange={(e) => {
        onChange?.(e);
        ajustar();
      }}
      className={cx(fieldBase, "py-2 resize-none overflow-hidden leading-snug", className)}
      {...rest}
    />
  );
}

export function Select({
  className,
  children,
  erro,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { erro?: boolean }) {
  return (
    <select className={cx(fieldBase, "h-11 pr-8 appearance-none bg-no-repeat", erro && fieldErro, className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236A6E78' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 12px center",
      }}
      {...rest}
    >
      {children}
    </select>
  );
}

/* ========================= Motores de digitação ==========================
 *
 * Data e valor eram os dois campos que "bugavam" ao digitar, cada um por um
 * motivo próprio — e os dois pelo mesmo vício: reescrever o que a pessoa está
 * digitando, no meio da digitação. Aqui os dois passam a guardar um RASCUNHO
 * enquanto o campo está em foco, e só interpretar/normalizar na saída.
 * ======================================================================== */

/**
 * Campo de data (dd/mm/aaaa do próprio navegador) que não apaga o que já foi digitado.
 *
 * O bug: o navegador entrega o valor a cada tecla, e no meio do ano ele vem
 * como "0002-08-25" (primeira tecla de "2026"). O código antigo rejeitava esse
 * ano fora da faixa reescrevendo `e.target.value` — e escrever num input date
 * LIMPA os três campos de uma vez. Resultado: começar a digitar o ano apagava
 * o dia e o mês.
 *
 * Agora o input nunca é reescrito durante a digitação. O rascunho segue livre
 * (o salto automático dia -> mês -> ano continua sendo o do navegador), só a
 * data completa e plausível sobe para o formulário, e o que ficou pela metade
 * é descartado ao sair do campo.
 */
function CampoData({ className, value, onChange, onBlur, erro, ...rest }: InputProps) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const externo = typeof value === "string" ? value : "";
  const exibido = rascunho ?? externo;

  return (
    <input
      type="date"
      min="1900-01-01"
      max="2100-12-31"
      className={cx(fieldBase, "h-11", erro && fieldErro, className)}
      value={exibido}
      onChange={(e) => {
        setRascunho(e.target.value);
        if (e.target.value === "" || dataIsoValida(e.target.value)) onChange?.(e);
      }}
      onBlur={(e) => {
        if (rascunho !== null && rascunho !== "" && !dataIsoValida(rascunho)) {
          onChange?.({ ...e, target: { ...e.target, value: "" } } as unknown as ChangeEvent<HTMLInputElement>);
        }
        setRascunho(null);
        onBlur?.(e);
      }}
      {...rest}
    />
  );
}

/** O número como texto editável: "1234,56" — sem R$ e sem ponto de milhar atrapalhando o cursor. */
const textoEditavel = (n: number): string =>
  Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: 2, useGrouping: false }) : "";

/**
 * Digitação de números (valores e percentuais), com uma regra só: **em foco, é
 * texto livre**.
 *
 * Nada é remascarado a cada tecla, então o cursor fica exatamente onde a pessoa
 * o deixou — dá para clicar no meio do número, apagar um algarismo, digitar a
 * vírgula depois. Com o campo zerado ele nasce VAZIO (e não "R$ 0,00" para
 * sobrescrever). Quem lê o que foi escrito é `parseNumeroBR`, na saída: sem
 * vírgula, tudo é parte inteira ("1500" = mil e quinhentos reais); com vírgula,
 * o que vem depois é centavo.
 *
 * O valor sobe a cada tecla assim mesmo — os totais da EC continuam
 * acompanhando a digitação, como antes.
 */
function useCampoNumerico(value: number, onValue: (n: number) => void, formatar: (n: number) => string) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  return {
    exibido: rascunho ?? formatar(value),
    aoFocar: () => setRascunho(value ? textoEditavel(value) : ""),
    aoDigitar: (texto: string) => {
      const limpo = limparEntradaNumerica(texto);
      setRascunho(limpo);
      onValue(parseNumeroBR(limpo) ?? 0);
    },
    aoSair: () => {
      if (rascunho !== null) onValue(parseNumeroBR(rascunho) ?? 0);
      setRascunho(null);
    },
  };
}

type PropsNumerico = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> & {
  value: number;
  onValue: (n: number) => void;
};

/** Input numérico que mantém number no estado (quantidades, percentuais). */
export function NumberInput({ value, onValue, className, onFocus, onBlur, ...rest }: PropsNumerico) {
  const campo = useCampoNumerico(value, onValue, (n) =>
    Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "0"
  );
  return (
    <input
      type="text"
      inputMode="decimal"
      className={cx(fieldBase, "h-11 text-right", className)}
      {...rest}
      value={campo.exibido}
      onFocus={(e) => { campo.aoFocar(); onFocus?.(e); }}
      onChange={(e) => campo.aoDigitar(e.target.value)}
      onBlur={(e) => { campo.aoSair(); onBlur?.(e); }}
    />
  );
}

/**
 * Input de valor monetário (R$). Fora do foco mostra "R$ 1.500,00"; ao entrar,
 * vira o número puro para editar (ou vazio, se for zero). Ver `useCampoNumerico`.
 */
export function CurrencyInput({ value, onValue, className, onFocus, onBlur, ...rest }: PropsNumerico) {
  const campo = useCampoNumerico(value, onValue, brl);
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder="R$ 0,00"
      className={cx(fieldBase, "h-11 text-right", className)}
      {...rest}
      value={campo.exibido}
      onFocus={(e) => { campo.aoFocar(); onFocus?.(e); }}
      onChange={(e) => campo.aoDigitar(e.target.value)}
      onBlur={(e) => { campo.aoSair(); onBlur?.(e); }}
    />
  );
}
