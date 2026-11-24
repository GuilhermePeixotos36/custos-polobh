import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Estilo matriz das listas de colaboradores dos benefícios.
 *
 * As tabelas dos benefícios são as mais largas do app — quinze colunas no vale-transporte — e
 * longas, uma linha por pessoa do grupo. Elas são a mesma grade das outras listas, e a grade em
 * si mora em `.lista-matriz` (`src/styles.css`): régua vertical entre as colunas, traço de 2px
 * sob o cabeçalho e o `border-separate` que mantém tudo isso visível debaixo de célula fixa.
 * O que sobra aqui é só o que é particular dos benefícios — cabeçalho preso no topo, coluna do
 * nome presa à esquerda, valor centralizado — e não deve ser copiado para as listas comuns.
 *
 * Nada que fica preso pode ter fundo translúcido. Célula fixa não empurra o conteúdo, ela
 * passa por cima: com `bg-muted/50` no cabeçalho as outras colunas atravessavam o vidro e os
 * rótulos apareciam embaralhados durante a rolagem. Por isso cores cheias aqui, inclusive no
 * realce da linha sob o cursor. A cor do cabeçalho (navy, texto branco) é da `.lista-matriz`.
 */
export const matriz = {
  /** Rola nos dois eixos dentro da própria tabela, senão o cabeçalho fixo grudaria na janela. */
  scroll: "max-h-[65vh] overflow-auto",
  tabela: "lista-matriz w-full text-left text-xs",
  // 11px em caixa normal ocupa a largura dos 10px em CAIXA ALTA de antes: a matriz de quinze
  // colunas não alarga, e o rótulo fica mais fácil de ler.
  cabecalho: "sticky top-0 z-20 whitespace-nowrap bg-navy px-3 py-2.5 text-center text-2xs font-semibold text-navy-foreground",
  /**
   * Valor centralizado na célula. Com rótulos longos como "saldo até a próxima recarga", o
   * número encostado na borda ficava longe do próprio cabeçalho; no centro, o olho desce em
   * linha reta do título até o valor.
   */
  celula: "whitespace-nowrap px-3 py-2 text-center",
  linha: "group hover:bg-muted",
  numero: "tabular-nums",
} as const;

/**
 * Largura, em caracteres, do maior texto de um conjunto de valores.
 *
 * Centralizar valor de tamanhos diferentes desalinha a vírgula: "R$ 52,45" e "R$ 1.203,75"
 * centralizados deixam as casas decimais em colunas distintas. Medindo o maior de uma vez e
 * dando essa largura a todos, o bloco fica centralizado na célula e as vírgulas se empilham,
 * porque dentro do bloco o número continua alinhado à direita.
 */
export function larguraEmCaracteres(valores: readonly string[]): number {
  return valores.reduce((maior, valor) => Math.max(maior, valor.length), 0);
}

/** Canto superior esquerdo — precisa vencer o cabeçalho e a coluna fixa ao mesmo tempo. */
/** O nome é o rótulo da linha, não um valor: fica à esquerda, alinhado com o cabeçalho dele. */
export const matrizCabecalhoNome = cn(matriz.cabecalho, "divisor-congelado left-0 z-30 text-left");

export const matrizCelulaNome = cn(
  matriz.celula,
  "divisor-congelado sticky left-0 z-10 bg-card text-left font-semibold text-navy group-hover:bg-muted",
);

/**
 * Valor de tabela: bloco de largura fixa centralizado na célula, número à direita dentro dele.
 * `ch` é exato aqui porque a fonte roda com `tabular-nums` — todo dígito ocupa a mesma caixa.
 */
export function ValorMatriz({ largura, children }: { largura: number; children: ReactNode }) {
  return (
    <span className="inline-block text-right tabular-nums" style={{ minWidth: `${largura}ch` }}>
      {children}
    </span>
  );
}

export function CabecalhoMatriz({ colunas }: { colunas: readonly string[] }) {
  return (
    <thead>
      <tr>
        {colunas.map((coluna, indice) => (
          <th key={coluna} className={indice === 0 ? matrizCabecalhoNome : matriz.cabecalho}>{coluna}</th>
        ))}
      </tr>
    </thead>
  );
}

/**
 * Nomes em grade, para as listas que não têm colunas de valor — as pendências da conciliação.
 *
 * Mesma leitura de matriz das tabelas ao lado, sem inventar colunas que não existem ali.
 */
export function GradeNomesMatriz({ nomes, vazio }: { nomes: readonly string[]; vazio?: ReactNode }) {
  if (!nomes.length) return <>{vazio ?? null}</>;
  return (
    <div className="max-h-56 overflow-auto rounded-lg border border-border">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {nomes.map((nome) => (
          <span
            key={nome}
            title={nome}
            className="truncate border-b border-r border-border/70 px-2.5 py-1.5 text-2xs text-foreground"
          >
            {nome}
          </span>
        ))}
      </div>
    </div>
  );
}

