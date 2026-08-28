/**
 * Navegador de pendências — a pílula flutuante do canto inferior direito.
 *
 * Ela conta e mostra exatamente o que se ALCANÇA daqui: as pendências desta
 * tela, com um elemento para a câmera achar (ver `pendenciasDaTela`). Sai da
 * mesma lista dos badges (`useMinhasPendencias`), então tudo que ela conta pode
 * ser encontrado — que é o ponto: antes o badge contava as pendências da pessoa
 * e a pílula varria só as observações da EC aberta, e quem era Produtor
 * Responsável via um número que não conseguia localizar.
 *
 * O recorte por tela também é o que mantém o círculo fechado. A pílula anda em
 * roda, e uma pendência de outra tela quebrava a roda: o salto virava navegação,
 * a tela de destino trazia outra lista, e não havia como voltar para continuar
 * de onde se parou. Atravessar o sistema é papel do sininho, que existe para
 * isso; aqui a promessa é menor e inteira — dar conta do que está na frente.
 *
 * As setas ▲ / ▼ saltam de uma para a outra: a tela rola até o item, ele "lateja"
 * duas vezes e, quando a pendência é um comentário, a thread daquele item se
 * abre e o comentário exato pisca em vermelho (ver `focarPendencia`); quando é
 * "OS/Contrato a emitir", quem pisca são os campos de status.
 *
 * O pisca acontece a CADA clique, inclusive quando as duas pendências moram no
 * mesmo item e a câmera não precisa se mexer — é o único sinal de que a seta fez
 * alguma coisa.
 *
 * O contrato com quem renderiza os itens é só um: cada item precisa ter
 * `id={idAncoraPendencia(id)}`.
 */
import { useEffect, useState } from "react";
import { IcChevron, IcComment } from "@/components/icons";
import { focarPendencia } from "@/lib/focoPendencia";
import { cx } from "@/lib/format";
import type { Pendencia } from "@/domain/pendencias";

export function NavegadorPendencias({ pendencias }: { pendencias: Pendencia[] }) {
  const [posicao, setPosicao] = useState(0);

  // A lista muda conforme observações são resolvidas/criadas: o índice precisa
  // acompanhar, senão as setas apontariam para uma pendência que já não existe.
  useEffect(() => {
    setPosicao((p) => (pendencias.length === 0 ? 0 : Math.min(p, pendencias.length - 1)));
  }, [pendencias.length]);

  if (!pendencias.length) return null;

  const atual = pendencias[Math.min(posicao, pendencias.length - 1)];

  const irPara = (indice: number) => {
    const alvo = (indice + pendencias.length) % pendencias.length; // circular: do fim volta ao início
    setPosicao(alvo);
    const p = pendencias[alvo];
    // `pendenciasDaTela` já garantiu a âncora: toda seta tem para onde levar.
    if (p.ancora) focarPendencia({ ancora: p.ancora, observacaoId: p.observacaoId, campos: p.campos });
  };

  return (
    <div
      className="fixed right-5 bottom-5 z-40 flex items-center gap-2 rounded-card border border-danger/30 bg-white px-3 py-2 shadow-modal max-w-[min(28rem,calc(100vw-2.5rem))]"
      role="group"
      aria-label="Navegar pelas pendências desta tela"
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-danger text-white shrink-0">
        <IcComment width={14} height={14} />
      </span>
      <div className="leading-tight min-w-0">
        <div className="text-[12.5px] font-extrabold text-ink whitespace-nowrap">
          {pendencias.length} {pendencias.length === 1 ? "pendência" : "pendências"}
          <span className="font-bold text-ink-3"> · {posicao + 1} de {pendencias.length}</span>
        </div>
        {/* O título vem junto: diz o que a próxima seta vai mostrar, em vez de
            deixar a pessoa saltar às cegas para descobrir. */}
        <div className="text-[11px] text-ink-2 truncate" title={atual.titulo}>
          {atual.titulo}
        </div>
      </div>
      {/* Setas empilhadas: ▲ em cima de ▼, como um seletor de posição. */}
      <div className="flex flex-col ml-auto shrink-0">
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
