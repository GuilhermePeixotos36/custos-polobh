import { useCallback, type ReactNode } from "react";
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
      <table className={cx("w-full border-collapse text-sm", className)}>{children}</table>
    </div>
  );
}

/** Um topo fixo por vez na tela — um observador basta. */
let observadorTopoLista: ResizeObserver | null = null;

/**
 * O TOPO DA LISTA QUE FICA CONGELADO (27/11/2026): título do card, filtros e a
 * barra de ações em lote. Gruda logo abaixo do cabeçalho da página, e os nomes
 * das colunas (`Th`) grudam logo abaixo dele — a altura é publicada em
 * `--altura-topo-lista`, que o `Th` soma ao próprio `top`. Rolando uma lista
 * longa de ECs ou de OSs, o que se vê em cima é sempre: de que lista se trata,
 * qual filtro está ligado e o que cada coluna é.
 *
 * Só da tela média para cima, como o grude do `Th` (no celular a tabela tem
 * rolagem própria). Ao sair de cena a variável volta a zero, e as outras
 * tabelas do app seguem grudando onde sempre grudaram.
 */
export function TopoFixoDaLista({ children, className }: { children: ReactNode; className?: string }) {
  const medir = useCallback((node: HTMLDivElement | null) => {
    const raiz = document.documentElement;
    observadorTopoLista?.disconnect();
    observadorTopoLista = null;
    if (!node) {
      raiz.style.setProperty("--altura-topo-lista", "0px");
      return;
    }
    const publicar = () => raiz.style.setProperty("--altura-topo-lista", `${Math.round(node.getBoundingClientRect().height)}px`);
    publicar();
    observadorTopoLista = new ResizeObserver(publicar);
    observadorTopoLista.observe(node);
  }, []);
  return (
    <div
      ref={medir}
      className={cx(
        "bg-surface rounded-t-card md:sticky md:top-[calc(var(--altura-topnav)+var(--altura-cabecalho))] md:z-[11]",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * O GRUDE DO CABEÇALHO, para as tabelas e grades escritas à mão (27/11/2026) —
 * o Resumo dos Custos da EC, a Rentabilidade, o cronograma dentro da OS. É a
 * mesma regra do `Th`: gruda logo abaixo do cabeçalho da página, da tela média
 * para cima. Quem usa precisa dar FUNDO à própria célula (o fundo da linha não
 * acompanha a célula grudada) e não pode estar dentro de um contêiner com
 * rolagem própria (`overflow-x-auto` sem `md:overflow-visible`).
 */
export const GRUDE_CABECALHO =
  "md:sticky md:top-[calc(var(--altura-topnav)+var(--altura-cabecalho)+var(--altura-topo-lista,0px))] md:z-10 md:shadow-[inset_0_-1px_0_var(--border)]";

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
        "px-3 py-2.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-ink-3",
        grudado
          ? // No celular a tabela rola de lado dentro do próprio contêiner, e o
          // `sticky` passava a contar a partir DELE: o cabeçalho descia 150px
          // e cobria as linhas (12/10/2026). Grudar só vale da tela média
          // para cima, onde a tabela não tem rolagem própria.
          "bg-surface border-b border-border md:border-b-0 md:sticky md:top-[calc(var(--altura-topnav)+var(--altura-cabecalho)+var(--altura-topo-lista,0px))] md:z-10 md:shadow-[inset_0_-1px_0_var(--border)]"
          : "border-b border-border",
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
        "border-b border-border-soft last:border-0",
        onClick && "cursor-pointer hover:bg-[#FAFAFB]",
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
        "px-3 py-3 text-ink align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </td>
  );
}
