/**
 * Listagem de bancos (BrasilAPI — `/banks/v1`, a lista do Banco Central).
 *
 * Alimenta o autocompletar do campo "Banco" da OS: o nome sai padronizado
 * ("341 - Itaú Unibanco S.A."), em vez de cada pessoa escrever de um jeito.
 * A consulta é feita uma vez por sessão; se a API não responder, a lista dos
 * bancos mais comuns segura a tela — o campo continua aceitando texto livre.
 */
export interface Banco {
  code: number | null;
  name: string;
  fullName?: string;
}

const MAIS_COMUNS = [
  "001 - Banco do Brasil S.A.",
  "033 - Banco Santander (Brasil) S.A.",
  "077 - Banco Inter S.A.",
  "104 - Caixa Econômica Federal",
  "237 - Banco Bradesco S.A.",
  "260 - Nu Pagamentos S.A. (Nubank)",
  "336 - Banco C6 S.A.",
  "341 - Itaú Unibanco S.A.",
  "748 - Banco Cooperativo Sicredi S.A.",
  "756 - Banco Cooperativo do Brasil S.A. (Sicoob)",
];

/** "341 - Itaú Unibanco S.A." — o código com três dígitos, como o cliente digita. */
export function rotuloDoBanco(b: Banco): string {
  const nome = (b.name || b.fullName || "").trim();
  if (b.code == null) return nome;
  return `${String(b.code).padStart(3, "0")} - ${nome}`;
}

export function rotulosDosBancos(bancos: Banco[]): string[] {
  return bancos
    .filter((b) => (b.name || b.fullName) && b.code != null)
    .map(rotuloDoBanco)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

let cache: Promise<string[]> | null = null;

export function listarBancos(): Promise<string[]> {
  if (!cache) {
    cache = (async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const resp = await fetch("https://brasilapi.com.br/api/banks/v1", { signal: ctrl.signal });
        clearTimeout(timer);
        if (!resp.ok) throw new Error(String(resp.status));
        const lista = rotulosDosBancos((await resp.json()) as Banco[]);
        return lista.length ? lista : MAIS_COMUNS;
      } catch {
        cache = null; // tenta de novo na próxima vez
        return MAIS_COMUNS;
      }
    })();
  }
  return cache;
}
