/**
 * O lugar da tabela enquanto ela carrega: o mesmo cabeçalho navy e linhas de barras pulsantes,
 * então a chegada dos dados é uma troca no lugar, sem a tela pular de altura.
 *
 * O atraso de 200ms é o do `EsqueletoLista` (classe `esqueleto-lista`, em `styles.css`): carga
 * rápida não pisca esqueleto. Regra de carregamento do app: lista → este; ação → spinner no botão;
 * painel ou operação longa → `CarregadorMatriz`.
 */
export function EsqueletoTabela({ colunas, linhas = 6, rotulo = "Carregando…" }: {
  /** Rótulos do cabeçalho, um por coluna. */
  colunas: string[];
  linhas?: number;
  /** O que está carregando, para o leitor de tela. */
  rotulo?: string;
}) {
  return (
    <div role="status" aria-label={rotulo} className="esqueleto-lista">
      <table className="lista-matriz w-full" aria-hidden>
        <thead>
          <tr>{colunas.map((coluna, i) => <th key={i} className="px-5 py-3 text-left">{coluna}</th>)}</tr>
        </thead>
        <tbody>
          {Array.from({ length: linhas }, (_, linha) => (
            <tr key={linha}>
              {colunas.map((_, coluna) => (
                <td key={coluna} className="px-5 py-3">
                  {/* Larguras variam: barras todas iguais parecem uma grade vazia. */}
                  <div className="esqueleto h-3.5" style={{ width: `${[70, 55, 80, 45, 62][(linha + coluna) % 5]}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
