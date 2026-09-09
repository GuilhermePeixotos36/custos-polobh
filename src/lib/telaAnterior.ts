/**
 * De onde a pessoa veio — para o chamado do Help Desk já nascer dizendo em que
 * tela o problema aconteceu.
 *
 * Mora aqui, e não na página de suporte, por uma razão prática: quem GRAVA é a
 * casca do aplicativo, a cada navegação, e ela não pode importar uma página
 * carregada sob demanda sem arrastá-la para o pacote inicial.
 *
 * `sessionStorage` porque a informação é da aba e da sessão: dura o suficiente
 * para atravessar a navegação até o Help Desk e não sobrevive ao fechar.
 */
const CHAVE = "polobh:tela-anterior";

export function lembrarTelaParaSuporte(pathname: string): void {
  // A própria tela de suporte não conta: gravá-la faria todo chamado dizer
  // "tela: /suporte", que é a única tela que não interessa.
  if (pathname.startsWith("/suporte")) return;
  try {
    sessionStorage.setItem(CHAVE, pathname);
  } catch {
    // Navegador com armazenamento bloqueado: o chamado sai sem a tela de origem.
  }
}

export function telaAnterior(): string {
  try {
    return sessionStorage.getItem(CHAVE) ?? "";
  } catch {
    return "";
  }
}
