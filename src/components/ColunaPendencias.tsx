/**
 * A coluna ID e o balão de pendência das listagens (27/11/2026).
 *
 * Projeto, EC e OS ganharam um ID sequencial, e ele é a primeira coluna das
 * listas. A coluna estreita "!" que só carregava o balão vermelho saiu: o
 * balão passou para o canto superior esquerdo do NOME — no respiro da própria
 * célula, sem empurrar o texto —, e o lugar dela ficou para o ID.
 *
 * (A coluna "!" tinha nascido para o balão não desalinhar os nomes. Pendurado
 * no canto, fora do fluxo do texto, ele continua não desalinhando.)
 */
import type { ReactNode } from "react";
import { Td, ThOrd, type EstadoOrdem } from "@/components/ui";
import { NotifDot } from "@/components/NotifDot";
import { cx } from "@/lib/format";

/** O ID como se lê nas listas: "0042". Sem número ainda, um traço. */
export const rotuloId = (codigo: number | null | undefined): string =>
  typeof codigo === "number" && codigo > 0 ? String(codigo).padStart(4, "0") : "—";

/** Largura da coluna ID: cabe "0000" e o ícone de ordenação. */
const LARGURA_ID = "w-[72px] min-w-[72px]";

/** Cabeçalho da coluna ID, com ordenação. */
export function ThId<C extends string>({ col, ordem, onSort }: { col: C; ordem: EstadoOrdem<C>; onSort: (col: C) => void }) {
  return (
    <ThOrd col={col} ordem={ordem} onSort={onSort} className={LARGURA_ID}>
      ID
    </ThOrd>
  );
}

/** A célula do ID. */
export function TdId({ codigo }: { codigo: number | null | undefined }) {
  return <Td className={cx(LARGURA_ID, "text-[12.5px] font-bold text-ink-2 tabular-nums whitespace-nowrap")}>{rotuloId(codigo)}</Td>;
}

/**
 * O nome com o balão de pendência no canto superior esquerdo. Sem pendência,
 * é só o nome. O balão fica FORA do fluxo (absoluto), para a linha com balão e
 * a linha sem balão começarem o texto no mesmo lugar.
 */
export function NomeComPendencia({ n, title, children }: { n: number; title?: string; children: ReactNode }) {
  return (
    <span className="relative inline-block">
      {n > 0 && <NotifDot n={n} title={title ?? `${n} pendência(s)`} className="!-left-4 !-top-2.5" />}
      {children}
    </span>
  );
}
