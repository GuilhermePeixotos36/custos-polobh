/**
 * Menções @Nome dentro do texto de uma observação. Casam apenas contra
 * usuários cadastrados no sistema (evita falsos positivos tipo "@gmail.com").
 */

/** Escapa caracteres especiais de regex num nome de usuário. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Monta a regex que reconhece "@Nome Completo" para os usuários informados.
 * Nomes mais longos entram primeiro para casar corretamente nomes compostos
 * (ex.: "@Marisa M. Coelho" antes de um possível "@Marisa" solto).
 */
export function regexMencoes(usuarios: string[]): RegExp | null {
  const nomes = [...new Set(usuarios.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!nomes.length) return null;
  // O nome termina onde não vem mais letra nem número. Era `\b`, que só entende
  // ASCII: "@José " e "@GPX Automação (dev) " não casavam (o "é" e o ")" não
  // são "caractere de palavra" para ele), a menção não era reconhecida e a
  // pendência não nascia (27/11/2026).
  return new RegExp(`@(${nomes.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}_])`, "gu");
}

/** Lista (sem duplicatas, na ordem de aparição) das pessoas @mencionadas no texto. */
export function extrairMencoes(texto: string, usuarios: string[]): string[] {
  const re = regexMencoes(usuarios);
  if (!re || !texto) return [];
  const achados: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    if (!achados.includes(m[1])) achados.push(m[1]);
  }
  return achados;
}
