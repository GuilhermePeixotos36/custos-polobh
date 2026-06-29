import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "@/lib/format";

const fieldBase =
  "w-full bg-surface border-[1.5px] border-[#E2E3E8] rounded-btn px-3.5 text-sm text-ink placeholder:text-ink-3 input-focus disabled:bg-[#F7F8FA] disabled:text-ink-2";

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

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldBase, "h-11", className)} {...rest} />;
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldBase, "py-2.5 min-h-[80px]", className)} {...rest} />;
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
