/**
 * A legenda do cabeçalho: data e local do evento e o(a) Produtor(a) Responsável,
 * logo abaixo do título — do projeto, da EC, da OS e de cada aba (29/09/2026).
 *
 * É pequena de propósito: serve para saber de qual evento se está falando sem
 * voltar à lista. Quem não tem data, local ou produtor(a) preenchidos simplesmente
 * não mostra aquele pedaço, e sem nenhum dos três a legenda some.
 */
import { legendaDoProjeto } from "@/domain/calendario";
import { dataBR } from "@/lib/format";
import type { ProjetoInfo } from "@/data/types";

export function LegendaProjeto({ info }: { info?: ProjetoInfo }) {
  const { evento, local, produtora } = legendaDoProjeto(info);
  const partes: { rotulo: string; valor: string }[] = [];
  if (evento) {
    partes.push({
      rotulo: "Data",
      valor: evento.inicio === evento.fim ? dataBR(evento.inicio) : `${dataBR(evento.inicio)} a ${dataBR(evento.fim)}`,
    });
  }
  if (local) partes.push({ rotulo: "Local", valor: local });
  if (produtora) partes.push({ rotulo: "Produtor(a) Responsável", valor: produtora });
  if (!partes.length) return null;
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[12.5px] text-ink-2">
      {partes.map((p) => (
        <span key={p.rotulo}>
          <span className="text-ink-3">{p.rotulo}:</span> <span className="font-semibold text-ink">{p.valor}</span>
        </span>
      ))}
    </p>
  );
}
