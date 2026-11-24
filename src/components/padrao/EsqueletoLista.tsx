/**
 * O lugar da lista enquanto ela carrega.
 *
 * O "Carregando…" centralizado num card vazio ocupava uma altura qualquer e, quando a lista
 * chegava, a tela inteira pulava para a altura dela. O esqueleto já tem a forma do que vem —
 * linhas de card com nome e detalhe —, então a chegada é uma troca no lugar, e o `.painel-pasta`
 * (ou quem a envolve) funde a lista por cima com o fade de entrada.
 *
 * Só aparece se a espera passar de 200ms (`esqueleto-lista`, em `styles.css`): carga rápida vai
 * direto do vazio para a lista, sem piscar esqueleto.
 */

export function EsqueletoLista({ rotulo, linhas = 4 }: {
  /** O que está carregando, para o leitor de tela: "Carregando vagas…". */
  rotulo: string;
  linhas?: number;
}) {
  return (
    <div role="status" aria-label={rotulo} className="esqueleto-lista card-surface divide-y divide-border">
      {Array.from({ length: linhas }, (_, indice) => (
        <div key={indice} aria-hidden className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1 space-y-2">
            {/* Larguras que variam por linha: todas iguais, o esqueleto parece uma grade vazia e
                não uma lista de nomes. */}
            <div className="esqueleto h-3.5" style={{ width: `${[42, 55, 36, 48][indice % 4]}%` }} />
            <div className="esqueleto h-3" style={{ width: `${[64, 50, 58, 44][indice % 4]}%` }} />
          </div>
          <div className="esqueleto h-7 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}
