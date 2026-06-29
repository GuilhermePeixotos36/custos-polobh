/** Utilitários de formatação (pt-BR, BRL, datas dd/mm/aaaa). */

export const brl = (v: number | null | undefined): string =>
  (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

export const num = (v: number | null | undefined): string =>
  (v ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Aceita "2026-02-22" ou Date e devolve dd/mm/aaaa. */
export const dataBR = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = iso.length <= 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
};

export const pct = (v: number): string =>
  `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** Data + hora dd/mm/aaaa hh:mm:ss (para trilha de auditoria/logs). */
export const dataHoraBR = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
};

/** Máscara visual de CNPJ/CPF. */
export const maskDoc = (raw: string): string => {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length === 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14)
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return raw;
};

export const onlyDigits = (s: string): string => (s || "").replace(/\D/g, "");

export const iniciais = (nome: string): string =>
  (nome || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

export const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(" ");
