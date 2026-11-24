/**
 * Senha que o ADMINISTRADOR define na tela de Acessos (cadastro e "Definir nova senha"): a regra
 * de força e o gerador. A senha só vive no campo do formulário até o envio — nunca em log, URL,
 * armazenamento local ou estado global — e aparece uma vez para ser copiada.
 *
 * Adaptação Pólobh (24/11/2026): a pessoa também troca a própria senha ("Alterar senha" do cartão
 * da conta) e recupera pelo "Esqueci minha senha"; essas regras moram em `domain/senha.ts`. O
 * mínimo é o mesmo (8), para nenhuma das portas aceitar senha que a outra recusaria.
 */
import { TAMANHO_MINIMO_SENHA } from "@/domain/senha";

export { TAMANHO_MINIMO_SENHA };
export const TAMANHO_SENHA_GERADA = 16;

const MAIUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sem I e O: confundem com 1 e 0 ao ditar
const MINUSCULAS = "abcdefghijkmnopqrstuvwxyz"; // sem l
const DIGITOS = "23456789";
const SIMBOLOS = "!@#$%&*?-_+=";
const TODOS = MAIUSCULAS + MINUSCULAS + DIGITOS + SIMBOLOS;

/** Fonte de números aleatórios; injetável para teste. */
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

export const senhaValida = (senha: string): boolean =>
  senha.length >= TAMANHO_MINIMO_SENHA && bytesDe(senha) <= LIMITE_BYTES_SENHA;

export function motivoDaSenhaInvalida(senha: string): string | null {
  if (senha.length < TAMANHO_MINIMO_SENHA) return `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`;
  if (bytesDe(senha) > LIMITE_BYTES_SENHA) return `A senha pode ter no máximo ${LIMITE_BYTES_SENHA} bytes (menos caracteres se tiver acentos).`;
  return null;
}
