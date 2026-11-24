import { useState, type ReactNode } from "react";

/**
 * Faixa de indicadores: os números de uma tela numa superfície só, divididos por régua.
 *
 * É o mesmo desenho do Painel do DP (`_app.painel.tsx`), tirado para cá para as telas de RH não
 * copiarem a régua cada uma do seu jeito. Substitui o `KpiCard` legado, que punha cada número numa
 * caixa própria com rótulo em caixa alta: quatro caixas pesavam mais que os próprios números.
 *
 * `colunas` diz quantas células cabem na linha larga. Com três indicadores e grade de quatro,
 * sobrava um buraco branco que parecia número faltando.
 */
export function FaixaIndicadores({
  colunas = 4, children, className = "", style,
}: {
  colunas?: 2 | 3 | 4;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const grade = colunas === 2 ? "sm:grid-cols-2" : colunas === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4";
  return (
    <dl data-colunas={colunas} className={`faixa-indicadores card-surface grid ${grade} ${className}`} style={style}>
      {children}
    </dl>
  );
}

/**
 * Uma célula da faixa. `apagado` é para o valor que não pede atenção (zero, "Nenhum",
 * "Sem movimento"): zero é notícia boa e não merece número grande.
 *
 * O valor da primeira pintura entra junto com a tela; só a TROCA (filtro, período) ganha o
 * `valor-troca`. Fade, nunca contagem.
 */
export function Indicador({
  rotulo, valor, detalhe, apagado, titulo,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  apagado?: boolean;
  /** Dica nativa com a fórmula — para quem quer saber de onde veio o número, sem texto na tela. */
  titulo?: string;
}) {
  const chave = typeof valor === "string" || typeof valor === "number" ? String(valor) : undefined;
  const [inicial] = useState(chave);
  return (
    /*
      Centrado e com as três linhas sempre presentes. Alinhado à esquerda numa célula de 400px, o
      número ficava colado no canto com um vazio à direita; e a célula sem detalhe, ou com o
      "Nenhum" menor, desalinhava a linha dos valores entre as vizinhas. O apagado muda só a cor,
      não o tamanho — é o que mantém os números na mesma altura.
    */
    <div className="celula-indicador flex flex-col items-center justify-center px-5 py-4 text-center" title={titulo}>
      <dt className="text-xs font-medium text-muted-foreground">{rotulo}</dt>
      <dd key={chave} className={`mt-1.5 text-2xl leading-tight tabular-nums ${apagado ? "font-medium text-muted-foreground/60" : "font-semibold text-navy"} ${chave !== undefined && chave !== inicial ? "valor-troca" : ""}`}>
        {valor}
      </dd>
      <dd className="mt-1 min-h-4 text-xs text-muted-foreground tabular-nums">{detalhe ?? " "}</dd>
    </div>
  );
}
