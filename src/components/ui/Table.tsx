import type { ReactNode } from "react";
import { cx } from "@/lib/format";

/**
 * Tabela da casa.
 *
 * A rolagem horizontal só existe em tela estreita (`md:overflow-visible`), e
 * isso não é enfeite: um elemento com `overflow-x: auto` vira container de
 * rolagem nos DOIS eixos, e um `position: sticky` dentro dele passa a grudar
 * nesse container — que não rola na vertical — em vez de grudar na tela. Era o
 * que impedia o cabeçalho das colunas de acompanhar a rolagem (ver `Th`). Da
 * largura `md` para cima, onde as listas longas de fato são lidas, o container
 * deixa de existir e o cabeçalho gruda; abaixo dela, a rolagem lateral vale
 * mais do que o grude.
 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto md:overflow-visible">
      <table className={cx("lista-matriz w-full text-sm", className)}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="text-left">{children}</tr>
    </thead>
  );
}

/**
 * Cabeçalho de coluna — GRUDADO logo abaixo do cabeçalho da página.
 *
 * Numa lista longa (projetos, OSs, fornecedores, itens de credenciamento) os
 * nomes das colunas saíam de cena na primeira rolagem, e a partir dali cada
 * célula era um valor sem rótulo: adivinhar se aquela data é a do evento ou a
 * do contrato. Agora eles acompanham a rolagem, como o congelamento de painéis
 * da planilha.
 *
 * O `top` é topnav + cabeçalho da página, lido das variáveis que o `PageShell`
 * publica — nenhuma medida chutada aqui.
 *
 * A borda de baixo vira `box-shadow`: com `border-collapse: collapse`, a borda
 * de uma célula grudada é pintada pela TABELA e fica para trás na rolagem. A
 * sombra pertence à célula e acompanha.
 */
export function Th({
  children,
  className,
  align = "left",
  ariaSort,
  grudado = true,
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  /** Direção da ordenação quando a coluna é ordenável (ver ui/Ordenacao). */
  ariaSort?: "ascending" | "descending" | "none";
  /** Desliga o grude — para tabela dentro de diálogo, que rola por conta própria. */
  grudado?: boolean;
}) {
  return (
    <th
      aria-sort={ariaSort}
      className={cx(
        // Design system (24/11/2026): a `.lista-matriz` da tabela pinta o cabeçalho grafite cheio,
        // as réguas e o traço laranja — a célula só dá o espaço e o tamanho do rótulo.
        "px-4 py-3 text-xs font-semibold",
        // No celular a tabela rola de lado dentro do próprio contêiner, e o `sticky` passava a
        // contar a partir DELE: o cabeçalho descia 150px e cobria as linhas (12/10/2026). Grudar
        // só vale da tela média para cima, onde a tabela não tem rolagem própria.
        grudado && "md:sticky md:top-[calc(var(--altura-topnav)+var(--altura-cabecalho))] md:z-10",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Tr({
  children,
  onClick,
  className,
  id,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  /**
   * Endereço da linha na tela — usado pelo navegador de pendências para rolar
   * até ela e fazê-la latejar (ver `idAncoraPendencia`). Numa listagem longa, a
   * pendência contada no badge da linha só é "achável" se a linha tiver id.
   */
  id?: string;
}) {
  return (
    <tr
      id={id}
      onClick={onClick}
      className={cx(
        // Divisória e realce da linha vêm da `.lista-matriz`; nunca na `<tr>`.
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  className,
  align = "left",
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={cx(
        "px-4 py-3 text-foreground align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </td>
  );
}
