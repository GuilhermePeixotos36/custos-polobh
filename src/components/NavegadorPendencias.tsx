/**
 * Navegador de pendências da EC.
 *
 * Uma EC longa pode ter observações em aberto espalhadas por dezenas de itens, e
 * até aqui só dava para achá-las rolando a tela. Esta pill flutuante mostra
 * quantas existem e salta de uma para a outra com as setas ▲ / ▼: o item entra
 * na tela e "lateja" duas vezes, devagar, marcando onde a rolagem parou.
 *
 * O contrato com quem renderiza os itens é só um: cada item precisa ter
 * `id={idAncoraPendencia(linhaId)}`.
 */
import { useEffect, useState } from "react";
import { IcChevron, IcComment } from "@/components/icons";
import { cx } from "@/lib/format";
import type { EcLinha } from "@/data/types";

/** Id do elemento que o navegador procura no DOM para rolar até o item. */
export const idAncoraPendencia = (linhaId: string) => `pendencia-${linhaId}`;

/** Uma observação em aberto (não resolvida, com texto) é uma pendência do item. */
export const temPendencia = (l: EcLinha) => (l.observacoes ?? []).some((o) => !o.resolvida && o.texto.trim());

/** Ids das linhas com pendência, na ordem em que aparecem na tela. */
export function linhasComPendencia(linhas: EcLinha[]): string[] {
  return linhas.filter((l) => !l.oculto && temPendencia(l)).map((l) => l.id);
}

export function NavegadorPendencias({ ids }: { ids: string[] }) {
  const [posicao, setPosicao] = useState(0);

  // A lista muda conforme observações são resolvidas/criadas: o índice precisa
  // acompanhar, senão as setas apontariam para uma pendência que já não existe.
  useEffect(() => {
    setPosicao((p) => (ids.length === 0 ? 0 : Math.min(p, ids.length - 1)));
  }, [ids.length]);

  if (!ids.length) return null;

  const irPara = (indice: number) => {
    const alvo = (indice + ids.length) % ids.length; // circular: do fim volta ao início
    setPosicao(alvo);
    const el = document.getElementById(idAncoraPendencia(ids[alvo]));
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Reinicia a animação mesmo quando é o mesmo elemento de antes.
    el.classList.remove("destaque-pendencia");
    void el.offsetWidth;
    el.classList.add("destaque-pendencia");
    window.setTimeout(() => el.classList.remove("destaque-pendencia"), 2600);
  };

  return (
    <div
      className="fixed right-5 bottom-5 z-40 flex items-center gap-2 rounded-pill border border-danger/30 bg-white px-3 py-2 shadow-modal"
      role="group"
      aria-label="Navegar pelas pendências da EC"
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-danger text-white shrink-0">
        <IcComment width={14} height={14} />
      </span>
      <div className="leading-tight">
        <div className="text-[12.5px] font-extrabold text-ink whitespace-nowrap">
          {ids.length} {ids.length === 1 ? "pendência" : "pendências"}
        </div>
        <div className="text-[11px] text-ink-3 whitespace-nowrap">
          {posicao + 1} de {ids.length}
        </div>
      </div>
      {/* Setas empilhadas: ▲ em cima de ▼, como um seletor de posição. */}
      <div className="flex flex-col">
        <SetaPendencia direcao="anterior" onClick={() => irPara(posicao - 1)} />
        <SetaPendencia direcao="proxima" onClick={() => irPara(posicao + 1)} />
      </div>
    </div>
  );
}

function SetaPendencia({ direcao, onClick }: { direcao: "anterior" | "proxima"; onClick: () => void }) {
  const acima = direcao === "anterior";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={acima ? "Pendência anterior" : "Próxima pendência"}
      title={acima ? "Pendência anterior" : "Próxima pendência"}
      className={cx(
        "inline-flex h-5 w-6 items-center justify-center rounded text-ink-2",
        "hover:bg-danger-soft hover:text-danger transition-colors"
      )}
    >
      <IcChevron width={14} height={14} className={acima ? "-rotate-90" : "rotate-90"} />
    </button>
  );
}
