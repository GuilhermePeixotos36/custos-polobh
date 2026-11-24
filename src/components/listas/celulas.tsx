/**
 * Peças de célula repetidas nas listas de Projetos, ECs e OSs (24/11/2026).
 *
 * Moram juntas porque são a MESMA leitura em quatro tabelas: o ID simples escrito do mesmo jeito,
 * a contagem de pendências com o mesmo selo e o mesmo vazio. Cada tela montava a sua e o "—" de
 * uma virava "0" na outra.
 */
import { Selo } from "@/components/padrao/Selo";
import { dataBR } from "@/lib/format";

/** "#12" — ou "—" antes da migração do ID simples, quando a coluna ainda não existe. */
export function textoId(codigo: number | undefined): string {
  return codigo != null ? `#${codigo}` : "—";
}

/** Rótulo do filtro de ID: o valor chega como texto ("12"). */
export const formatarFiltroId = (valor: string) => `#${valor}`;

/** Rótulo do filtro de data: o valor chega como dia ISO ("2026-11-09") e sai como na tela. */
export const formatarFiltroData = (valor: string) => dataBR(valor);

/** O valor de filtro das pendências: "tem ou não tem" diz mais do que a lista de contagens. */
export const filtroPendencias = (n: number) => (n > 0 ? "Com pendência" : "Sem pendência");

/**
 * Pendências como coluna normal (24/11/2026): o selo vermelho com a contagem, ou o traço. Antes
 * era uma coluna estreita com "!" no cabeçalho e ordenação própria; agora ordena e filtra pelo
 * cabeçalho como qualquer outra.
 */
export function SeloPendencias({ n, rotulo = "pendência(s)" }: { n: number; rotulo?: string }) {
  if (!n) return <span className="text-muted-foreground">—</span>;
  return (
    <Selo tom="perigo" title={`${n} ${rotulo}`} className="tabular-nums">
      {n > 99 ? "99+" : n}
    </Selo>
  );
}
