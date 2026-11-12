/**
 * Como os dados das partes aparecem no CONTRATO (11/11/2026).
 *
 * O cadastro guarda o que a pessoa digitou: CNPJ só com números, razão social
 * em caixa alta, endereço de um jeito ou de outro. O contrato é o documento que
 * o fornecedor assina, e nele CNPJ e inscrição saem com a pontuação completa e
 * o "Ltda." com a grafia certa. Estas funções só APRESENTAM — não mexem no
 * cadastro, e o que não reconhecem devolvem como veio, em vez de adivinhar.
 */

const soDigitos = (s: string) => (s ?? "").replace(/\D/g, "");

/** 07128230000180 → 07.128.230/0001-80 · 11144477735 → 111.444.777-35. Outro formato fica como está. */
export function formatarCnpjCpf(valor: string): string {
  const v = (valor ?? "").trim();
  const d = soDigitos(v);
  if (/[^\d.\-/\s]/.test(v)) return v; // tem letras ("Isento"): não é número de documento
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return v;
}

/** 3132715531 → (31) 3271-5531 · 31984892098 → (31) 98489-2098. O que já tem formato ou outro tamanho fica como está. */
export function formatarTelefone(valor: string): string {
  const v = (valor ?? "").trim();
  if (/[^\d\s().+-]/.test(v)) return v;
  const d = soDigitos(v);
  // 0800 e 0300 não são DDD + número.
  if (d.startsWith("0")) return v;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return v;
}

/**
 * Inscrição Estadual de Minas Gerais: 13 dígitos, no formato 003.007.740/0011.
 * "Isento" e inscrições de outros estados (outro tamanho) ficam como vieram.
 */
export function formatarInscricaoEstadual(valor: string): string {
  const v = (valor ?? "").trim();
  if (/[^\d.\-/\s]/.test(v)) return v;
  const d = soDigitos(v);
  if (d.length !== 13) return v;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}/${d.slice(9)}`;
}

/**
 * O tipo societário no fim da razão social, em caixa alta e baixa e com o ponto:
 * "POLOBH PROMOÇÕES LTDA" → "POLOBH PROMOÇÕES Ltda." · "X EIRELI" → "X Eireli".
 * O resto do nome não é tocado — não há como saber, sem cadastro, como a
 * empresa grafa o próprio nome.
 */
export function formatarRazaoSocial(valor: string): string {
  const v = (valor ?? "").trim().replace(/\s+/g, " ");
  return v.replace(/\s+(ltda|eireli)\.?$/i, (_t, tipo: string) => (tipo.toLowerCase() === "ltda" ? " Ltda." : " Eireli"));
}

const UFS = new Set(
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ")
);

/**
 * "Belo Horizonte - MG", lido do endereço completo.
 *
 * O sistema guarda o endereço num campo só, e o contrato tem uma linha
 * "Município". Em vez de pedir a cidade de novo, ela é lida do que já está lá:
 * a sigla do estado (válida) logo depois de um "-" ou "/", e a cidade é o
 * trecho que vem antes dela, depois da última vírgula ou hífen. Funciona para
 * "Rua X, 1 - Centro - Contagem - MG", "Av. Y, 2 - Bairro, Belo Horizonte - MG,
 * 30000-000" e "Av. Z, 3 — Belo Horizonte/MG". Quando o endereço não traz
 * cidade e estado, devolve vazio — a linha sai em branco para ser completada,
 * e não com um palpite errado no documento que alguém assina.
 */
export function municipioDoEndereco(endereco: string): string {
  const texto = (endereco ?? "").trim();
  const re = /(?:[-–—/])\s*([A-Z]{2})(?=\s*(?:[,.\-–—]|\s|$))/g;
  let achado: { uf: string; antes: string } | null = null;
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    if (UFS.has(m[1])) achado = { uf: m[1], antes: texto.slice(0, m.index) };
  }
  if (!achado) return "";
  const cidade = achado.antes.split(/\s[-–—]\s|,|\//).map((x) => x.trim()).filter(Boolean).pop() ?? "";
  // "Rua A, 10" ou só números não são cidade.
  if (!cidade || /\d/.test(cidade)) return "";
  return `${cidade} - ${achado.uf}`;
}
