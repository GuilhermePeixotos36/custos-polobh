//
// Senha: a política (igual à da Edge, `validarSenha`), o gerador e as regras da troca. Todo usuário
// entra com e-mail e senha. A inicial é definida pelo administrador e é PROVISÓRIA (a pessoa troca
// no primeiro acesso); depois a pessoa troca em "Alterar minha senha", informando a atual. Não há
// recuperação por e-mail. A senha nunca vai para log, URL nem estado guardado — só vive no campo
// do formulário até o envio.

export const TAMANHO_MINIMO_SENHA = 8;
export const TAMANHO_SENHA_GERADA = 16;

const MAIUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sem I e O: confundem com 1 e 0 ao ditar
const MINUSCULAS = "abcdefghijkmnopqrstuvwxyz"; // sem l
const DIGITOS = "23456789";
const SIMBOLOS = "!@#$%&*?-_+=";
const TODOS = MAIUSCULAS + MINUSCULAS + DIGITOS + SIMBOLOS;

/** Fonte de bytes aleatórios; injetável para teste. */
export type FonteAleatoria = (tamanho: number) => Uint32Array;

const fonteDoNavegador: FonteAleatoria = (tamanho) => crypto.getRandomValues(new Uint32Array(tamanho));

/**
 * Sorteio sem viés: descarta os valores do final do intervalo que não dividem igualmente em
 * `limite` (o `%` simples favoreceria os primeiros caracteres do alfabeto).
 */
function sortear(limite: number, fonte: FonteAleatoria): number {
  const maximo = Math.floor(0x100000000 / limite) * limite;
  for (;;) {
    const valor = fonte(1)[0];
    if (valor < maximo) return valor % limite;
  }
}

/** 16 caracteres com maiúscula, minúscula, dígito e símbolo, em ordem embaralhada. */
export function gerarSenha(fonte: FonteAleatoria = fonteDoNavegador): string {
  const caracteres = [
    MAIUSCULAS[sortear(MAIUSCULAS.length, fonte)],
    MINUSCULAS[sortear(MINUSCULAS.length, fonte)],
    DIGITOS[sortear(DIGITOS.length, fonte)],
    SIMBOLOS[sortear(SIMBOLOS.length, fonte)],
  ];
  while (caracteres.length < TAMANHO_SENHA_GERADA) caracteres.push(TODOS[sortear(TODOS.length, fonte)]);
  // Fisher-Yates: os quatro obrigatórios não ficam sempre no começo.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = sortear(i + 1, fonte);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join("");
}

/** O bcrypt do Auth ignora o que passa de 72 bytes: o servidor recusa, e a tela avisa antes. */
export const LIMITE_BYTES_SENHA = 72;

const bytesDe = (senha: string) => new TextEncoder().encode(senha).length;

const temLetra = (senha: string) => /\p{L}/u.test(senha);
const temNumero = (senha: string) => /[0-9]/.test(senha);

/** A política que o servidor exige: 8 caracteres no mínimo, 72 bytes no máximo, letra e número. */
export function motivoDaSenhaInvalida(senha: string): string | null {
  if (senha.length < TAMANHO_MINIMO_SENHA) return `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`;
  if (bytesDe(senha) > LIMITE_BYTES_SENHA) return `A senha pode ter no máximo ${LIMITE_BYTES_SENHA} bytes (menos caracteres se tiver acentos).`;
  if (!temLetra(senha) || !temNumero(senha)) return "A senha precisa ter ao menos uma letra e um número.";
  return null;
}

export const senhaValida = (senha: string): boolean => motivoDaSenhaInvalida(senha) === null;

/** Os itens da política, para a lista de conferência sob o campo (cada um marca quando cumpre). */
export function requisitosDaSenha(senha: string): { rotulo: string; cumprido: boolean }[] {
  return [
    { rotulo: `Pelo menos ${TAMANHO_MINIMO_SENHA} caracteres`, cumprido: senha.length >= TAMANHO_MINIMO_SENHA && bytesDe(senha) <= LIMITE_BYTES_SENHA },
    { rotulo: "Uma letra", cumprido: temLetra(senha) },
    { rotulo: "Um número", cumprido: temNumero(senha) },
  ];
}

/**
 * "Alterar minha senha" e "Defina sua nova senha": o que impede o envio, na ordem em que a tela
 * mostra. null = pode enviar. (O servidor confere a senha atual e recusa senha vazada.)
 */
export function motivoDaTrocaInvalida(t: { senhaAtual: string; senhaNova: string; confirmacao: string }): string | null {
  if (!t.senhaAtual) return "Informe a senha atual.";
  const politica = motivoDaSenhaInvalida(t.senhaNova);
  if (politica) return politica;
  if (t.senhaNova === t.senhaAtual) return "A nova senha precisa ser diferente da atual.";
  if (t.confirmacao !== t.senhaNova) return "A confirmação não é igual à nova senha.";
  return null;
}
