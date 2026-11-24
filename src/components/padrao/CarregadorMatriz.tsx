/**
 * Indicador de operação longa: uma grade pequena de células que acendem em onda diagonal, com a
 * frase do que está acontecendo ao lado.
 *
 * Existe para a espera que a pessoa sente — importar planilha, sincronizar o ponto com o Secullum,
 * a primeira carga do app. Ali o spinner seco com "Carregando…" não respondia a pergunta que a
 * pessoa faz ao olhar a tela ("travou ou está andando?"); a mensagem de etapa e o "32 de 140"
 * respondem. Para lista chegando, o padrão continua sendo o `EsqueletoLista`: o esqueleto tem a
 * forma do que vem, e a matriz é para operação, não para conteúdo.
 *
 * Só aparece depois de `atrasoMs` (300ms de padrão): operação rápida vai direto ao resultado sem
 * piscar indicador. O atraso é por timer, e não por `animation-delay` como no esqueleto, porque
 * antes dele não deve haver `role="status"` nenhum na árvore — um leitor de tela anunciaria
 * "carregando" para algo que terminou em 80ms.
 *
 * A onda é CSS puro (`carregador-matriz-*`, em `styles.css`). Com movimento reduzido a grade fica
 * parada, com a diagonal acesa, e a frase continua lá: parado, o texto é que diz que está andando.
 */
import { useEffect, useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

/** Espera mínima antes de o carregador aparecer. Abaixo disso a pessoa nem percebe a espera. */
export const ATRASO_CARREGADOR_MS = 300;

/** Atraso entre uma diagonal e a seguinte na onda. Com 3 ou 4 colunas, a onda cruza a grade em ~0,5s. */
const PASSO_ONDA_MS = 110;

const LADO = { sm: 3, md: 4 } as const;

export interface ProgressoCarregador {
  atual: number;
  total: number;
  /** Quando "N de M" sozinho seria ambíguo: "páginas" (OCR) em vez de linhas gravadas. */
  unidade?: string;
}

export function CarregadorMatriz({
  mensagem,
  progresso,
  detalhe,
  tamanho = "sm",
  atrasoMs = ATRASO_CARREGADOR_MS,
  className,
}: {
  /** O que está acontecendo agora, no gerúndio: "Lendo planilha…", "Gravando atestados". */
  mensagem: string;
  /** Andamento contável ("32 de 140"). Sem ele, só a frase — melhor que um número inventado. */
  progresso?: ProgressoCarregador | null;
  /** Linha de apoio, menor: "Mantenha esta página aberta até concluir." */
  detalhe?: string;
  /** `sm` dentro de card ou modal (grade 3×3, em linha); `md` para tela ou cartão central (4×4, empilhado). */
  tamanho?: "sm" | "md";
  /** 0 quando quem chama já só monta o carregador numa espera longa (o cartão que bloqueia a tela). */
  atrasoMs?: number;
  className?: string;
}) {
  const visivel = useAposAtraso(atrasoMs);
  if (!visivel) return null;

  const lado = LADO[tamanho];
  const temProgresso = Boolean(progresso && progresso.total > 0);
  const atual = temProgresso ? Math.min(progresso!.atual, progresso!.total) : 0;
  const pct = temProgresso ? Math.round((atual / progresso!.total) * 100) : 0;
  const md = tamanho === "md";

  return (
    <div
      role="status"
      className={cn(
        "carregador-matriz",
        md
          ? "flex flex-col items-center gap-3 text-center"
          : "flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3",
        className,
      )}
    >
      <span aria-hidden className="carregador-matriz-grade" data-tamanho={tamanho}>
        {Array.from({ length: lado * lado }, (_, indice) => {
          const linha = Math.floor(indice / lado);
          const coluna = indice % lado;
          return (
            <span
              key={indice}
              className="carregador-matriz-celula"
              // A diagonal principal é o desenho que sobra com movimento reduzido.
              data-diagonal={linha === coluna ? "" : undefined}
              style={{ "--atraso": `${(linha + coluna) * PASSO_ONDA_MS}ms` } as CSSProperties}
            />
          );
        })}
      </span>

      <div className={cn("min-w-0", md ? "w-full max-w-xs" : "flex-1")}>
        {/* A `key` remonta a frase quando a etapa muda: o fade curto de entrada é o que faz a
            pessoa notar que a etapa andou, e o nó novo é o que o leitor de tela anuncia. */}
        <p key={mensagem} className={cn("entrada-fade font-semibold text-navy", md ? "text-sm" : "text-xs")}>
          {mensagem}
        </p>
        {temProgresso ? (
          <>
            <p className={cn("tabular-nums text-muted-foreground", md ? "mt-1 text-lg font-semibold text-navy" : "mt-0.5 text-2xs")}>
              {atual} de {progresso!.total}{progresso!.unidade ? ` ${progresso!.unidade}` : ""}
            </p>
            <div aria-hidden className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", md ? "mt-2" : "mt-1.5")}>
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-(--duracao-painel) ease-saida"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        ) : null}
        {detalhe ? <p className={cn("text-2xs text-muted-foreground", md ? "mt-2" : "mt-0.5")}>{detalhe}</p> : null}
      </div>
    </div>
  );
}

function useAposAtraso(atrasoMs: number): boolean {
  const [passou, setPassou] = useState(atrasoMs <= 0);
  useEffect(() => {
    if (atrasoMs <= 0) return;
    const timer = window.setTimeout(() => setPassou(true), atrasoMs);
    return () => window.clearTimeout(timer);
  }, [atrasoMs]);
  return passou;
}
