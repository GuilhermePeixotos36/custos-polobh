/**
 * A memória dos campos de texto LONGO.
 *
 * Campo de uma linha resolve isso com o `datalist` do próprio navegador (ver
 * `Input`), mas `<textarea>` não aceita `datalist` — e é justamente onde moram
 * os textos que a casa mais repete palavra por palavra: a forma de acerto
 * financeiro, as observações padrão do contrato, as informações complementares.
 *
 * Então a memória aparece como uma fileira de atalhos SOB o campo, e só
 * enquanto ele está vazio: com conteúdo escrito, a fileira some, porque aí ela
 * não seria mais um atalho e sim um convite a apagar o que já se digitou. Um
 * clique preenche; nada é aplicado sozinho.
 */
import { cx } from "@/lib/format";

/** Quantos atalhos mostrar — é uma fileira, não um catálogo. */
const QUANTOS = 4;
/** Corte do rótulo do atalho: o texto inteiro fica no `title`. */
const RESUMO = 52;

export function TextosJaUsados({
  valor,
  opcoes,
  onEscolher,
  className,
}: {
  /** Conteúdo atual do campo — com texto escrito, os atalhos somem. */
  valor: string;
  opcoes: string[];
  onEscolher: (texto: string) => void;
  className?: string;
}) {
  if (valor.trim() || !opcoes.length) return null;
  return (
    <div className={cx("mt-1.5 flex flex-wrap items-center gap-1.5", className)}>
      <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-ink-3">Já usados</span>
      {opcoes.slice(0, QUANTOS).map((texto) => (
        <button
          key={texto}
          type="button"
          title={texto}
          onClick={() => onEscolher(texto)}
          className={cx(
            "max-w-full truncate rounded-full border border-border-soft bg-[#F5F6F8] px-2.5 py-1",
            "text-[11.5px] font-semibold text-ink-2 transition-colors",
            "hover:border-primary hover:bg-primary-soft hover:text-primary-dark"
          )}
        >
          {texto.length > RESUMO ? `${texto.slice(0, RESUMO - 1)}…` : texto}
        </button>
      ))}
    </div>
  );
}
