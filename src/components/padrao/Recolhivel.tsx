import { useState, type ReactNode } from "react";

/**
 * Conteúdo de uma seção retrátil que abre crescendo em altura.
 *
 * Quem mantém o botão (e o `aria-expanded` dele) é a tela: cada seção retrátil do app tem um
 * cabeçalho diferente — rótulo de grupo no sino, linha de colaborador com quatro valores no
 * comparativo, título de formulário no cadastro —, e um acordeão que desenhasse o próprio botão
 * obrigaria todos a caber no mesmo molde. O que é igual em todos é só o corpo, e é isto.
 *
 * Só a abertura anima; fechar é imediato, e o conteúdo sai do DOM. É a mesma regra das entradas
 * do `styles.css` ("só aparecer, nunca sair"): animar a saída obrigaria a manter montado o que a
 * tela já fechou — itens clicáveis no Tab e na busca por texto durante a animação, ou `inert`
 * que o React 18 nem aceita como atributo. E fechar é quando a pessoa quer o espaço de volta.
 *
 * A altura cresce por `grid-template-rows` de `0fr` a `1fr` (`.recolhivel`, em styles.css), que
 * é animável sem medir nada em JS. O `overflow: hidden` que isso exige vale só enquanto abre:
 * aberto e parado, o conteúdo não pode cortar anel de foco nem lista suspensa que não saiu por
 * portal (a de bancos, no cadastro de colaborador).
 */
export function Recolhivel({ aberto, id, className, children }: {
  aberto: boolean;
  /** Para o `aria-controls` do botão que abre. */
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  // Anima só a abertura que a pessoa pediu. A seção que já nasce aberta (os grupos urgentes do
  // sino, a primeira seção do cadastro) chega junto com a tela ou o painel que a contém, e crescer
  // ali seria um segundo movimento em cima da entrada do painel — e o painel inteiro esticando.
  // Ajuste durante o render, o padrão do React para estado que acompanha prop.
  const [animarAbertura, setAnimarAbertura] = useState(!aberto);
  if (!aberto && !animarAbertura) setAnimarAbertura(true);

  if (!aberto) return null;
  return <CorpoRecolhivel id={id} className={className} animar={animarAbertura}>{children}</CorpoRecolhivel>;
}

/** Separado para o "abrindo" nascer verdadeiro a cada abertura: fechar desmonta, abrir remonta. */
function CorpoRecolhivel({ id, className, animar, children }: {
  id?: string;
  className?: string;
  animar: boolean;
  children: ReactNode;
}) {
  const [abrindo, setAbrindo] = useState(animar);
  return (
    <div
      id={id}
      className="recolhivel"
      data-abrindo={abrindo || undefined}
      data-animar={animar || undefined}
      // Só o fim da PRÓPRIA abertura: `animationend` sobe dos filhos (o fade da aba, um spinner)
      // e soltaria o `overflow` no meio do crescimento.
      onAnimationEnd={(evento) => {
        if (evento.target === evento.currentTarget) setAbrindo(false);
      }}
    >
      {/* Borda e respiro vão numa caixa por dentro, nunca na que encolhe: padding não encolhe
          com a trilha de `0fr`, e a abertura começaria já com a altura dele, num salto. */}
      <div className="recolhivel-conteudo">
        {className ? <div className={className}>{children}</div> : children}
      </div>
    </div>
  );
}
