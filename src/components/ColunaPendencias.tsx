/**
 * Coluna dedicada às pendências nas listagens.
 *
 * Antes o badge vermelho ficava DENTRO da célula do nome (Projeto, EC, OS), o
 * que empurrava o texto e desalinhava as linhas entre si — uma com badge, outra
 * sem. Aqui ele ganha uma coluna estreita própria, à esquerda do nome, de modo
 * que todos os badges fiquem alinhados verticalmente e o nome sempre comece na
 * mesma posição.
 */
import { Th, Td, ThOrd, type EstadoOrdem } from "@/components/ui";
import { NotifDot } from "@/components/NotifDot";
import { cx } from "@/lib/format";

/** Largura fixa da coluna: cabe o badge (18px) com folga, sem roubar espaço do nome. */
const LARGURA = "w-[46px] min-w-[46px] px-2";

/**
 * Cabeçalho da coluna. Passando `ordem`/`onSort` ele também ordena — útil para
 * puxar para o topo tudo o que está pendente.
 */
export function ThPendencias<C extends string>({
  className,
  col,
  ordem,
  onSort,
}: {
  className?: string;
  col?: C;
  ordem?: EstadoOrdem<C>;
  onSort?: (col: C) => void;
}) {
  const rotulo = (
    <>
      <span className="sr-only">Pendências</span>
      <span aria-hidden="true">!</span>
    </>
  );
  if (col && ordem && onSort) {
    return (
      <ThOrd col={col} ordem={ordem} onSort={onSort} align="center" className={cx(LARGURA, className)}>
        {rotulo}
      </ThOrd>
    );
  }
  return (
    <Th align="center" className={cx(LARGURA, className)} >
      <span title="Pendências">{rotulo}</span>
    </Th>
  );
}

export function TdPendencias({ n, title, className }: { n: number; title?: string; className?: string }) {
  return (
    <Td align="center" className={cx(LARGURA, className)}>
      <NotifDot inline n={n} title={title ?? `${n} pendência(s)`} />
    </Td>
  );
}
