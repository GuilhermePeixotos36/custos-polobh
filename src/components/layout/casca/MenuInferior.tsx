/**
 * Menu inferior do celular e do tablet — a navegação ao alcance do polegar, para o uso em campo.
 *
 * Até quatro destinos do dia a dia (`noMenuInferior`) e o "Mais", que abre
 * uma gaveta de baixo com o que é de administração, a pessoa logada e o "Sair". Cada botão tem
 * 64px de altura útil (alvo de toque confortável de luva fina) e respeita a faixa do gesto do
 * sistema (`safe-area-inset-bottom`). No computador ele não existe: lá é a `BarraLateral`.
 *
 * Origem: Diário de Projetos (nov/2026). Depende de `usePresenca`, `useFecharComEsc`, `AvatarUsuario`,
 * das animações `entrada-sobe`/`saida-desce`/`entrada-overlay`/`saida-overlay` e das utilidades
 * `movel:`, `seguro-inferior` (layout.css).
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from './LinkDoApp' // troque o roteador só em LinkDoApp.tsx
import { KeyRound, LogOut, MoreHorizontal, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { rotaAtiva, type ItemDeNavegacao } from '@/config/navegacao'
import { usePresenca } from '@/lib/presenca'
import { useFecharComEsc } from '@/lib/modalEsc'
import { AvatarUsuario } from '@/components/padrao/AvatarUsuario'

import type { PessoaDaConta } from './CartaoDaConta'

type Pessoa = PessoaDaConta

export function MenuInferior({ itens, caminho, pessoa, fotoUrl, onSair, onAlterarSenha }: {
    itens: ItemDeNavegacao[]
    caminho: string
    pessoa: Pessoa
    fotoUrl?: string | null
    onSair: () => void
    onAlterarSenha?: () => void
}) {
    const [maisAberto, setMaisAberto] = useState(false)
    const principais = itens.filter((i) => i.noMenuInferior).slice(0, 4)
    const extras = itens.filter((i) => !principais.includes(i))
    const extraAtivo = extras.some((i) => rotaAtiva(i.to, caminho, i.ativoEm))

    // Trocou de tela (inclusive por um link de dentro da gaveta): a gaveta fecha.
    useEffect(() => { setMaisAberto(false) }, [caminho])

    return (
        <>
            <nav
                aria-label="Navegação principal"
                className="seguro-inferior fixed inset-x-0 bottom-0 z-40 hidden border-t border-border bg-card shadow-[0_-6px_16px_-10px_rgb(24_24_27/0.14)] movel:block"
            >
                <ul className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${principais.length + 1}, minmax(0, 1fr))` }}>
                    {principais.map((item) => (
                        <li key={item.to}>
                            <BotaoDoMenu
                                to={item.to}
                                rotulo={item.rotuloCurto}
                                rotuloCompleto={item.rotulo}
                                icone={item.icone}
                                ativo={rotaAtiva(item.to, caminho, item.ativoEm)}
                                contador={item.contador}
                            />
                        </li>
                    ))}
                    <li>
                        <button
                            type="button"
                            onClick={() => setMaisAberto(true)}
                            aria-haspopup="dialog"
                            aria-expanded={maisAberto}
                            className={cn(
                                'flex h-16 w-full flex-col items-center justify-center gap-1 text-2xs font-semibold',
                                extraAtivo ? 'text-brand-forte' : 'text-muted-foreground',
                            )}
                        >
                            <span className={cn('flex h-7 w-12 items-center justify-center rounded-full', extraAtivo && 'bg-brand-soft')}>
                                <MoreHorizontal aria-hidden className="h-5 w-5" />
                            </span>
                            Mais
                        </button>
                    </li>
                </ul>
            </nav>

            <GavetaMais aberta={maisAberto} onFechar={() => setMaisAberto(false)} itens={extras} caminho={caminho} pessoa={pessoa} fotoUrl={fotoUrl} onSair={onSair} onAlterarSenha={onAlterarSenha} />
        </>
    )
}

function BotaoDoMenu({ to, rotulo, rotuloCompleto, icone: Icone, ativo, contador }: {
    to: string
    rotulo: string
    rotuloCompleto: string
    icone: ItemDeNavegacao['icone']
    ativo: boolean
    contador?: number
}) {
    return (
        <Link
            to={to}
            aria-current={ativo ? 'page' : undefined}
            aria-label={rotulo !== rotuloCompleto ? rotuloCompleto : undefined}
            className={cn(
                'flex h-16 flex-col items-center justify-center gap-1 px-1 text-2xs font-semibold',
                ativo ? 'text-brand-forte' : 'text-muted-foreground active:text-foreground',
            )}
        >
            <span className={cn('relative flex h-7 w-12 items-center justify-center rounded-full transition-colors', ativo && 'bg-brand-soft')}>
                <Icone aria-hidden className="h-5 w-5" />
                {!!contador && (
                    <span className="absolute -top-1 right-1 min-w-4 rounded-full bg-destructive px-1 text-center text-2xs font-semibold leading-4 text-destructive-foreground tabular-nums" aria-label={`${contador} pendência(s)`}>
                        {contador}
                    </span>
                )}
            </span>
            <span className="max-w-full truncate">{rotulo}</span>
        </Link>
    )
}

function GavetaMais({ aberta, onFechar, itens, caminho, pessoa, fotoUrl, onSair, onAlterarSenha }: {
    aberta: boolean
    onFechar: () => void
    itens: ItemDeNavegacao[]
    caminho: string
    pessoa: Pessoa
    fotoUrl?: string | null
    onSair: () => void
    onAlterarSenha?: () => void
}) {
    const { montado, saindo } = usePresenca(aberta)
    useFecharComEsc(onFechar, aberta)
    if (!montado) return null

    return createPortal(
        <div className="fixed inset-0 z-[9990] flex items-end justify-center" aria-hidden={saindo || undefined} inert={saindo ? '' : undefined}>
            <div aria-hidden className={cn('fixed inset-0 bg-navy/40', saindo ? 'saida-overlay' : 'entrada-overlay')} onClick={onFechar} />
            <section
                role="dialog"
                aria-modal="true"
                aria-label="Mais opções"
                className={cn(
                    'seguro-inferior relative w-full max-w-2xl rounded-t-[14px] bg-card shadow-(--sombra-flutuante)',
                    saindo ? 'saida-desce' : 'entrada-sobe',
                )}
            >
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" aria-hidden />
                <div className="flex items-center gap-3 px-5 pb-4 pt-3">
                    <AvatarUsuario nome={pessoa.nome} fotoUrl={fotoUrl} className="h-11 w-11" textoClassName="text-sm" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-foreground">{pessoa.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">{pessoa.grupo}</p>
                        <p className="truncate text-xs text-muted-foreground">{pessoa.email} · {pessoa.formaDeEntrada}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onFechar}
                        aria-label="Fechar"
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {itens.length > 0 && (
                    <ul className="border-t border-border px-3 py-2">
                        {itens.map((item) => {
                            const ativo = rotaAtiva(item.to, caminho, item.ativoEm)
                            const Icone = item.icone
                            const classe = cn(
                                'flex h-12 w-full items-center gap-3 rounded-md px-3 text-sm font-medium',
                                ativo ? 'bg-brand-soft font-semibold text-sidebar-accent-foreground' : 'text-foreground hover:bg-muted',
                            )
                            return (
                                <li key={item.to}>
                                    {/* Item de painel (Help Desk) abre sobre a tela, sem navegar. */}
                                    {item.aoClicar ? (
                                        <button type="button" onClick={() => { onFechar(); item.aoClicar?.() }} className={classe}>
                                            <Icone aria-hidden className="h-5 w-5 shrink-0" />
                                            {item.rotulo}
                                        </button>
                                    ) : (
                                        <Link to={item.to} aria-current={ativo ? 'page' : undefined} className={classe}>
                                            <Icone aria-hidden className="h-5 w-5 shrink-0" />
                                            {item.rotulo}
                                        </Link>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                )}

                <div className="border-t border-border px-3 py-2">
                    {onAlterarSenha && (
                        <button
                            type="button"
                            onClick={() => { onFechar(); onAlterarSenha() }}
                            className="flex h-12 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-foreground hover:bg-muted"
                        >
                            <KeyRound aria-hidden className="h-5 w-5 shrink-0" />
                            Alterar senha
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onSair}
                        className="flex h-12 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-destructive hover:bg-destructive/10"
                    >
                        <LogOut aria-hidden className="h-5 w-5 shrink-0" />
                        Sair do app
                    </button>
                </div>
            </section>
        </div>,
        document.body,
    )
}
