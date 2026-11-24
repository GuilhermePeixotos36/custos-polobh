/**
 * Cabeçalho e seção DENTRO do painel de uma sub-aba (`FolderPanel`).
 *
 * Cada aba do projeto, da EC e do credenciamento escrevia o próprio título de bloco: um
 * `CardTitle` dentro de `<div className="p-5">`, outro com `p-5 pb-3`, outro com `pb-2`, e a
 * descrição às vezes ao lado, às vezes embaixo. Somado ao `mb-4` do `CardTitle`, o título
 * "Ordens de Serviço" ficava com mais ar embaixo do que em cima e a descrição parecia solta
 * (queixa do dono do app, 24/11/2026). Aqui o desenho é um só: título `text-base` negrito,
 * descrição `text-xs` apagada logo embaixo, ações à direita na mesma linha — igual em toda aba.
 *
 * E a seção não é um cartão. Dentro do painel branco da aba, um `Card` por bloco virava
 * cartão dentro de cartão, com borda dupla na lateral; as seções agora se separam por um fio
 * (`border-t`), e o painel é a única superfície.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function CabecalhoSecao({ titulo, descricao, acoes, className }: {
  titulo: ReactNode;
  descricao?: ReactNode;
  /** Botões à direita — secundários; o primário da tela mora no cabeçalho da página. */
  acoes?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-base font-bold leading-tight text-foreground">{titulo}</h2>
        {descricao && <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

/**
 * Uma seção do painel: cabeçalho e conteúdo, com o fio de cima separando-a da anterior.
 *
 * Pensada para o `FolderPanel semRecuo` — quem dá o respiro é a própria seção (`px-5`), e por
 * isso uma tabela pode ir de ponta a ponta (`sangrado`) logo abaixo do cabeçalho, sem a
 * moldura de outro cartão em volta.
 */
export function SecaoPainel({ titulo, descricao, acoes, sangrado = false, id, className, children, "data-tour": marcaTour }: {
  titulo?: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  /** O conteúdo vai de borda a borda (tabela, lista com fios próprios). */
  sangrado?: boolean;
  /** `id` da seção — âncora de pendência ou de destaque. */
  id?: string;
  className?: string;
  children?: ReactNode;
  /** Âncora do tour guiado (src/tour). */
  "data-tour"?: string;
}) {
  return (
    <section id={id} data-tour={marcaTour} className={cn("border-t border-border first:border-t-0", className)}>
      {titulo && <CabecalhoSecao className="px-5 pt-5 pb-4" titulo={titulo} descricao={descricao} acoes={acoes} />}
      {children !== undefined && children !== null && children !== false && (
        <div className={cn(!sangrado && "px-5 pb-5", !titulo && !sangrado && "pt-5")}>{children}</div>
      )}
    </section>
  );
}
