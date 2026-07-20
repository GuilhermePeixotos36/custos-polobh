import type {
  ChangeEvent,
  FocusEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useLayoutEffect, useRef } from "react";
import { cx, maskTelefone, onlyDigits, colapsarEspacos, tituloProprio, capitalizarFrase } from "@/lib/format";

const fieldBase =
  "w-full bg-surface border-[1.5px] border-[#BFC4CE] rounded-btn px-3.5 text-sm text-ink placeholder:text-ink-3 input-focus disabled:bg-[#EDEEF1] disabled:text-ink-2";

export function Label({
  children,
  htmlFor,
  hint,
}: {
  children: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block mb-1.5">
      <span className="text-[12.5px] font-bold text-ink">{children}</span>
      {hint && <span className="text-[12px] text-ink-3 font-medium ml-1">{hint}</span>}
    </label>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <Label hint={hint}>{label}</Label>}
      {children}
    </div>
  );
}

const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formatação aplicada ao SAIR do campo (blur), padronizando a informação:
 * - "titulo": Primeira Letra de Cada Palavra Maiúscula (nomes, endereços)
 * - "titulo-empresa": idem, preservando siglas (LTDA, ME…) — para Razão Social
 * - "frase": maiúscula no início das frases (títulos/textos curtos)
 * Sem `formato`, o blur ainda apara espaços repetidos (colapsarEspacos).
 */
export type FormatoCampo = "titulo" | "titulo-empresa" | "frase";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { formato?: FormatoCampo };

function aplicarFormato(v: string, formato?: FormatoCampo): string {
  switch (formato) {
    case "titulo":
      return tituloProprio(v);
    case "titulo-empresa":
      return tituloProprio(v, { preservarSiglas: true });
    case "frase":
      return capitalizarFrase(v);
    default:
      return colapsarEspacos(v);
  }
}

export function Input({ className, type, onChange, value, onBlur, formato, ...rest }: InputProps) {
  if (type === "date") {
    return (
      <input
        type="date"
        min="1900-01-01"
        max="2100-12-31"
        className={cx(fieldBase, "h-11", className)}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          // navegadores aceitam ano com mais de 4 dígitos ao digitar (ex.: "22226");
          // rejeita e restaura o último valor válido no próprio input do DOM.
          if (v !== "" && (!DATA_ISO_RE.test(v) || Number(v.slice(0, 4)) > 2100)) {
            e.target.value = typeof value === "string" ? value : "";
            return;
          }
          onChange?.(e);
        }}
        {...rest}
      />
    );
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
  return <input className={cx(fieldBase, "h-11", className)} type={type} onChange={onChange} value={value} onBlur={handleBlur} {...rest} />;
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
  const digitos = onlyDigits(value).slice(0, 11);
  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  const numeroFormatado =
    numero.length <= 4 ? numero
      : numero.length <= 8 ? numero.replace(/^(\d{4})(\d)/, "$1-$2")
      : numero.replace(/^(\d{5})(\d)/, "$1-$2");

  return (
    <div className={cx("flex gap-2", className)}>
      <input
        className={cx(fieldBase, "h-11 w-[4.5rem] text-center")}
        inputMode="numeric"
        placeholder="DDD"
        value={ddd}
        onChange={(e) => onChange(maskTelefone(onlyDigits(e.target.value).slice(0, 2) + numero))}
      />
      <input
        className={cx(fieldBase, "h-11 flex-1")}
        inputMode="tel"
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
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(fieldBase, "h-11 pr-8 appearance-none bg-no-repeat", className)}
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

/** Input numérico que mantém number no estado. */
export function NumberInput({
  value,
  onValue,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: number;
  onValue: (n: number) => void;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={cx(fieldBase, "h-11 text-right", className)}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onValue(parseFloat(e.target.value) || 0)}
      {...rest}
    />
  );
}

/**
 * Input de valor monetário (R$) — máscara progressiva ao digitar (os dígitos
 * viram centavos, padrão dos campos de valor no Brasil): digitar "150" mostra
 * "R$ 1,50"; "15000" mostra "R$ 150,00". Sempre exibe formatado.
 */
export function CurrencyInput({
  value,
  onValue,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: number;
  onValue: (n: number) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const centavos = Math.round((Number.isFinite(value) ? value : 0) * 100);
  const exibido = (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

  // mantém o cursor no fim (não faz sentido "editar o meio" de um valor mascarado)
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement === el) {
      const fim = el.value.length;
      el.setSelectionRange(fim, fim);
    }
  });

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      className={cx(fieldBase, "h-11 text-right", className)}
      value={exibido}
      onChange={(e) => {
        const digitos = e.target.value.replace(/\D/g, "");
        onValue(digitos ? parseInt(digitos, 10) / 100 : 0);
      }}
      {...rest}
    />
  );
}
