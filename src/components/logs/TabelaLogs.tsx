/**
 * Lista da tela Logs + páginas (padrão LSPRO, 24/11/2026).
 *
 * Ordem, página e total vêm do BANCO: a tabela nunca ordena nem filtra em memória. A única coluna
 * ordenável é "Data/hora", e o clique troca a ordem da consulta (`onAlternarOrdem`).
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CabecalhoOrdenavel, type ColunaOpcional } from "@/components/padrao/CabecalhoOrdenavel";
import { Selo, type TomDoSelo } from "@/components/padrao/Selo";
import { Button } from "@/components/padrao/button";
import { cn } from "@/lib/utils";
import { dataHoraBr } from "@/lib/logs/csv";
import {
  POR_PAGINA, ROTULO_NIVEL, ROTULO_ORIGEM_LOG, ROTULO_RESULTADO, rotuloDaAcao, rotuloDaTela, type AbaLogs, type ItemLog,
} from "@/lib/logs/logsStore";

const TOM_RESULTADO: Record<string, TomDoSelo> = { ok: "sucesso", negado: "atencao", falha: "perigo" };
const TOM_NIVEL: Record<string, TomDoSelo> = { info: "neutro", aviso: "atencao", erro: "perigo", critico: "perigo" };

/** "Alvo / tela": o rótulo do alvo; senão o nome da tela; senão a mensagem; senão "—". */
function alvoOuTela(item: ItemLog): string {
  return item.alvoRotulo?.trim() || rotuloDaTela(item.tela) || item.alvoTipo?.trim() || item.mensagem?.trim() || "—";
}

export function TabelaLogs({ aba, itens, total, pagina, ordem, recarregando, onAbrir, onAlternarOrdem, onPagina }: {
  aba: AbaLogs;
  itens: ItemLog[];
  total: number;
  pagina: number;
  ordem: "em_desc" | "em_asc";
  /** Troca de filtro ou de página com a lista na tela: esmaece, não some. */
  recarregando: boolean;
  onAbrir: (item: ItemLog) => void;
  onAlternarOrdem: () => void;
  onPagina: (pagina: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const erros = aba === "erros";
  const colunas: ColunaOpcional[] = [
    { rotulo: "Data/hora", chave: "em", tipo: "data", classe: "whitespace-nowrap" },
    { rotulo: "Usuário" },
    { rotulo: "Ação" },
    { rotulo: "Alvo / tela" },
    { rotulo: erros ? "Nível" : "Resultado" },
    { rotulo: "Origem" },
    { rotulo: "IP" },
  ];

  return (
    <>
      <div className="overflow-x-auto">
        <table
          aria-busy={recarregando || undefined}
          className={cn("lista-matriz w-full text-sm transition-opacity duration-(--duracao-rapida)", recarregando && "opacity-60")}
        >
          <CabecalhoOrdenavel
            colunas={colunas}
            ordem={{ chave: "em", sentido: ordem === "em_asc" ? "asc" : "desc" }}
            onOrdenar={onAlternarOrdem}
          />
          <tbody>
            {itens.map((item) => {
              const quando = dataHoraBr(item.em);
              const alvo = alvoOuTela(item);
              return (
                <tr key={item.id} onClick={() => onAbrir(item)} className="cursor-pointer">
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                    {/* A linha inteira abre o detalhe; o botão é o caminho do teclado e do leitor de tela. */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onAbrir(item); }}
                      aria-label={`Abrir o evento de ${quando}`}
                      className="rounded-sm font-semibold text-brand-forte hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      {quando}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-foreground">{item.atorNome?.trim() || "—"}</td>
                  <td className="px-4 py-3 text-foreground">{rotuloDaAcao(item.acao)}</td>
                  <td className="max-w-[22rem] truncate px-4 py-3 text-muted-foreground" title={item.mensagem ?? undefined}>{alvo}</td>
                  <td className="px-4 py-3">
                    {erros ? (
                      <Selo tom={TOM_NIVEL[item.nivel] ?? "neutro"} ponto={item.nivel === "critico"}>{ROTULO_NIVEL[item.nivel] ?? item.nivel}</Selo>
                    ) : (
                      <Selo tom={TOM_RESULTADO[item.resultado] ?? "neutro"}>{ROTULO_RESULTADO[item.resultado] ?? item.resultado}</Selo>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ROTULO_ORIGEM_LOG[item.origem ?? ""] ?? item.origem ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">{item.ip || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav aria-label="Páginas" className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        <span className="text-xs tabular-nums text-muted-foreground">{total} evento(s)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Página anterior" disabled={pagina <= 1 || recarregando} onClick={() => onPagina(pagina - 1)}>
            <ChevronLeft aria-hidden />
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">Página {pagina} de {paginas}</span>
          <Button variant="outline" size="icon" aria-label="Próxima página" disabled={pagina >= paginas || recarregando} onClick={() => onPagina(pagina + 1)}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </nav>
    </>
  );
}
