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

/**
 * Formato ÚNICO de data do sistema: "DD MM AA", separado por espaço — sem
 * barras, hífens ou pontos (padrão Pólobh, definido em 14/08/2026). Vale para a
 * tela, os documentos e as planilhas geradas. Campos de digitação de data
 * (`<input type="date">`) seguem o calendário nativo do navegador.
 *
 * Aceita "2026-02-22" (data pura) ou um ISO completo com hora.
 */
const partesData = (iso: string): Date => (iso.length <= 10 ? new Date(iso + "T00:00:00") : new Date(iso));

export const dataBR = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = partesData(iso);
  if (isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    .replace(/\D/g, " ");
};

/** @deprecated Use `dataBR` — desde a padronização DD MM AA os dois são idênticos. */
export const dataBRCurta = dataBR;

export const pct = (v: number): string =>
  `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/**
 * Data + hora para a trilha de auditoria/logs: "DD MM AA hh:mm:ss". A data segue
 * o padrão sem separadores; a hora mantém os dois-pontos (separador de hora, não
 * de data).
 */
export const dataHoraBR = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return `${dataBR(iso)} ${hora}`;
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

/**
 * Lê um número escrito à mão, à moda brasileira, do jeito que a pessoa digitou.
 *
 * O campo de valor não reformata nada enquanto se digita (ver `CurrencyInput`):
 * quem interpreta o que foi escrito é esta função, ao sair do campo. As regras
 * são as que a pessoa já usa no papel:
 *
 *   "1500"      -> 1500      (sem vírgula, tudo é parte inteira)
 *   "1500,5"    -> 1500,50   (a vírgula manda: o que vem depois é centavo)
 *   "1.500,50"  -> 1500,50   (ponto de milhar + vírgula decimal)
 *   "12.50"     -> 12,50     (um ponto com 1-2 casas: teclado numérico, é decimal)
 *   "1.500"     -> 1500      (um ponto com 3 casas: milhar)
 *
 * Devolve `null` quando não há número nenhum no texto (campo vazio, só lixo) —
 * quem chama decide se isso vira zero ou "não mexe no valor".
 */
export function parseNumeroBR(texto: string): number | null {
  const bruto = (texto || "").trim();
  const negativo = bruto.startsWith("-");
  const limpo = bruto.replace(/[^\d.,]/g, "");
  if (!/\d/.test(limpo)) return null;

  let normalizado: string;
  if (limpo.includes(",")) {
    // Com vírgula, ela é SEMPRE o separador decimal; os pontos são de milhar.
    // Vírgula digitada duas vezes não invalida o número: vale a primeira.
    const [inteiro, ...resto] = limpo.replace(/\./g, "").split(",");
    normalizado = resto.length ? `${inteiro}.${resto.join("")}` : inteiro;
  } else if (limpo.includes(".")) {
    const partes = limpo.split(".");
    const ultima = partes[partes.length - 1];
    normalizado = partes.length === 2 && ultima.length > 0 && ultima.length <= 2
      ? `${partes[0]}.${ultima}`   // "12.5" — ponto usado como decimal
      : partes.join("");            // "1.234.567" — pontos de milhar
  } else {
    normalizado = limpo;
  }

  const n = Number(normalizado);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** Só os caracteres que fazem sentido enquanto se digita um número (dígitos, vírgula, ponto e o sinal). */
export const limparEntradaNumerica = (s: string): string => (s || "").replace(/[^\d.,-]/g, "");

/** Máscara progressiva de CPF/CNPJ enquanto o usuário digita. */
export const maskCpfCnpjInput = (raw: string): string => {
  const d = onlyDigits(raw).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
};

/** Máscara progressiva de telefone BR: (00) 0000-0000 ou (00) 00000-0000. */
export const maskTelefone = (raw: string): string => {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/^\((\d{2})\) (\d{4})(\d)/, "($1) $2-$3");
  }
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/^\((\d{2})\) (\d{5})(\d)/, "($1) $2-$3");
};

/** Máscara de placa de veículo (Mercosul/antiga): ABC1D23 / ABC1234. */
export const maskPlaca = (raw: string): string =>
  (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);

export const iniciais = (nome: string): string =>
  (nome || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

export const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(" ");

/** Colapsa espaços repetidos e apara as pontas (padroniza a formatação de um campo). */
export const colapsarEspacos = (s: string): string => (s || "").replace(/\s+/g, " ").trim();

// Conectores que ficam em minúscula no meio de nomes próprios (pt-BR).
const CONECTORES = new Set(["de", "da", "das", "do", "dos", "e", "di", "du", "del", "la", "las", "los", "y", "à", "às"]);
// Siglas/tipos societários que devem permanecer em maiúsculas na Razão Social.
const SIGLAS = new Set(["LTDA", "EIRELI", "ME", "EPP", "MEI", "CIA", "S.A.", "S/A", "SA", "LLC", "LTD", "EPC", "SS", "SCP"]);

const capitalizarPalavra = (p: string): string =>
  p
    .split("-")
    .map((parte) => (parte ? parte.charAt(0).toLocaleUpperCase("pt-BR") + parte.slice(1) : parte))
    .join("-");

/**
 * "Primeira Letra de Cada Palavra em Maiúscula" (Title Case pt-BR): capitaliza cada
 * palavra, mantém conectores (de, da, do…) minúsculos no meio e, com `preservarSiglas`,
 * mantém siglas societárias (LTDA, ME, EIRELI…) em maiúsculas — para Razão Social.
 */
export function tituloProprio(texto: string, opts: { preservarSiglas?: boolean } = {}): string {
  const limpo = colapsarEspacos(texto);
  if (!limpo) return "";
  return limpo
    .split(" ")
    .map((palavra, i) => {
      if (opts.preservarSiglas && SIGLAS.has(palavra.toUpperCase())) return palavra.toUpperCase();
      const lower = palavra.toLocaleLowerCase("pt-BR");
      if (i > 0 && CONECTORES.has(lower)) return lower;
      return capitalizarPalavra(lower);
    })
    .join(" ");
}

/** Maiúscula no início de frases (após . ! ?), preservando o resto — padroniza títulos/textos curtos. */
export function capitalizarFrase(texto: string): string {
  const limpo = colapsarEspacos(texto);
  if (!limpo) return "";
  return limpo.replace(
    /(^|[.!?]\s+)([a-záàâãéêíóôõúüç])/gu,
    (_m, inicio: string, letra: string) => `${inicio}${letra.toLocaleUpperCase("pt-BR")}`
  );
}
