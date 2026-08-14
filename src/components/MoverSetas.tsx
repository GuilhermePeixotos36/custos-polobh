/**
 * Setas de subir/descer — o padrão ÚNICO de movimentação por setas do sistema.
 *
 * Usado no Cronograma Geral, no Roteiro e nos itens da EC (e deve ser usado em
 * qualquer nova tela com itens ordenáveis). Onde também há arrastar-e-soltar, as
 * duas formas convivem: o arraste serve para saltos grandes e para tirar o item
 * do bloco; as setas movem uma posição por vez, sem sair do bloco — mais
 * confortável quando a lista é longa.
 */
import { IcChevron } from "@/components/icons";
import { cx } from "@/lib/format";

export function MoverSetas({
  onSubir,
  onDescer,
  podeSubir,
  podeDescer,
  rotulo,
  orientacao = "vertical",
  className,
}: {
  onSubir: () => void;
  onDescer: () => void;
  podeSubir: boolean;
  podeDescer: boolean;
  /** Complemento do aria-label, ex.: 'o item "Buffet"'. */
  rotulo: string;
  /** `vertical` empilha as setas (ocupa pouca largura); `horizontal` lado a lado. */
  orientacao?: "vertical" | "horizontal";
  className?: string;
}) {
  return (
    <div
      className={cx("flex shrink-0", orientacao === "vertical" ? "flex-col" : "flex-row items-center gap-0.5", className)}
      role="group"
      aria-label={`Mover ${rotulo}`}
    >
      <Seta direcao="cima" onClick={onSubir} disabled={!podeSubir} rotulo={rotulo} />
      <Seta direcao="baixo" onClick={onDescer} disabled={!podeDescer} rotulo={rotulo} />
    </div>
  );
}

function Seta({
  direcao,
  onClick,
  disabled,
  rotulo,
}: {
  direcao: "cima" | "baixo";
  onClick: () => void;
  disabled: boolean;
  rotulo: string;
}) {
  const paraCima = direcao === "cima";
  return (
    <button
      type="button"
      onClick={(e) => {
        // Fica dentro de cards clicáveis e de alças de arraste — o clique é só nosso.
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-label={`Mover ${rotulo} para ${paraCima ? "cima" : "baixo"}`}
      title={disabled ? `Já está no ${paraCima ? "início" : "fim"}` : `Mover para ${paraCima ? "cima" : "baixo"}`}
      className={cx(
        "inline-flex h-5 w-5 items-center justify-center rounded text-ink-3 transition-colors",
        disabled ? "opacity-25 cursor-default" : "hover:bg-primary-soft hover:text-primary-dark"
      )}
    >
      <IcChevron width={14} height={14} className={paraCima ? "-rotate-90" : "rotate-90"} />
    </button>
  );
}

/**
 * Move um item de uma lista uma posição para cima (-1) ou para baixo (+1).
 * Devolve a MESMA referência quando o movimento é impossível (topo/fim), para
 * que a tela não marque alteração à toa.
 */
export function moverNaLista<T>(lista: T[], indice: number, direcao: -1 | 1): T[] {
  const destino = indice + direcao;
  if (indice < 0 || destino < 0 || destino >= lista.length) return lista;
  const copia = [...lista];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}
