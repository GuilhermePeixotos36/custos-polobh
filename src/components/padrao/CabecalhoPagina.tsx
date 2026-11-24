/**
 * Título de página do design system: 26px negrito, sobrelinha opcional, descrição curta e as
 * ações à direita (que descem para baixo do título no celular). Toda tela abre com ele.
 */
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function CabecalhoPagina({ titulo, sobretitulo, descricao, acoes, antes, className }: {
    titulo: ReactNode
    /** Linha pequena acima do título (o projeto, a área). */
    sobretitulo?: ReactNode
    descricao?: ReactNode
    /** Botões à direita — um primário no máximo. */
    acoes?: ReactNode
    /** Antes do título (o "Voltar" de uma tela de detalhe). */
    antes?: ReactNode
    className?: string
}) {
    return (
        <header className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
            <div className="flex min-w-0 items-start gap-3">
                {antes}
                <div className="min-w-0">
                    {sobretitulo && <p className="mb-1 text-2xs font-medium text-muted-foreground">{sobretitulo}</p>}
                    <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.01em] text-foreground">{titulo}</h1>
                    {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
                </div>
            </div>
            {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
        </header>
    )
}
