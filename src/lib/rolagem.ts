/**
 * Quem rola a página (24/11/2026).
 *
 * Com a casca do design system LSPRO a página não rola mais na janela: rola o `<main
 * id="rolagem-principal">` da `CascaDoApp`, ao lado da barra lateral. Quem precisava de
 * `window.scrollY`/`window.scrollTo` passa por aqui. Fora da casca (páginas públicas, impressão),
 * cai na janela, como antes.
 */
export function conteinerDeRolagem(): HTMLElement {
  return (document.getElementById("rolagem-principal") as HTMLElement | null) ?? (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

/** Quanto já se rolou. */
export const rolagemAtual = (): number => conteinerDeRolagem().scrollTop;

/** Onde o conteúdo rolável começa na tela (o topo do celular empurra o `<main>` para baixo). */
export function topoDaRolagem(): number {
  const el = document.getElementById("rolagem-principal");
  return el ? el.getBoundingClientRect().top : 0;
}

export function rolarPara(top: number, suave = false): void {
  conteinerDeRolagem().scrollTo({ top: Math.max(top, 0), behavior: suave ? "smooth" : "auto" });
}
