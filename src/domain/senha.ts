/**
 * A regra da senha nova — separada da tela para poder ser testada e para valer
 * igual em qualquer lugar que venha a trocar senha.
 *
 * O tamanho mínimo é 8, e não os 6 que o Supabase aceita por padrão: seis
 * caracteres é o piso do que o servidor tolera, não o que a casa considera
 * razoável. Fora isso não há exigência de símbolo nem de maiúscula, de
 * propósito — regra de composição empurra a pessoa para "Polobh@2026", que é
 * previsível, e para o papelzinho colado no monitor. Uma frase que só ela sabe
 * vale mais.
 */

/** Piso do tamanho da senha nova. */
export const TAMANHO_MINIMO_SENHA = 8;

/**
 * Por que esta troca não pode ser feita — ou `null` quando pode.
 *
 * Devolve o motivo pronto para a tela: quem errou precisa saber o que corrigir,
 * não que "falhou". A ordem das checagens é a ordem em que a pessoa preenche.
 */
export function motivoSenhaInvalida(atual: string, nova: string, confirmacao: string): string | null {
  if (!atual) return "Digite a sua senha atual.";
  // Espaço conta como caractere (a senha não é aparada), mas uma senha só de
  // espaços é um acidente de teclado, não uma escolha.
  if (!nova.trim()) return "Digite a nova senha.";
  if (nova.length < TAMANHO_MINIMO_SENHA) {
    return `A nova senha precisa de pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`;
  }
  if (nova === atual) return "A nova senha precisa ser diferente da atual.";
  if (nova !== confirmacao) return "A confirmação não confere com a nova senha.";
  return null;
}

/**
 * Traduz o que o Supabase devolve ao trocar a senha.
 *
 * As mensagens dele chegam em inglês e falam a língua da API ("New password
 * should be different..."), o que numa tela em português lê como defeito. O que
 * não for reconhecido volta como veio — inventar uma tradução genérica
 * esconderia justamente o caso raro que a gente precisa ver.
 */
export function traduzirErroDeSenha(mensagem: string): string {
  const m = (mensagem || "").toLowerCase();
  if (m.includes("should be different")) return "A nova senha precisa ser diferente da atual.";
  if (m.includes("at least") || m.includes("password should be")) {
    return `A senha é curta demais — use pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`;
  }
  if (m.includes("weak") || m.includes("pwned") || m.includes("compromised")) {
    return "Esta senha aparece em vazamentos conhecidos. Escolha outra.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  }
  if (m.includes("session") || m.includes("jwt") || m.includes("token")) {
    return "Sua sessão expirou. Entre de novo e refaça a troca.";
  }
  return mensagem;
}
