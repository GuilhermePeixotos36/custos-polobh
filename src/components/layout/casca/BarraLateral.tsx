/**
 * Barra lateral clara do computador (design system LSPRO).
 *
 * Recolhível: 256px aberta, 72px recolhida (só ícones, com o nome no `title` e no `aria-label`).
 * Quem decide aberta/recolhida é a casca (`CascaDoApp`): recolhida abaixo de 1280px e a escolha da
 * pessoa guardada no navegador. A barra não escreve cor: só lê os tokens `sidebar-*` (e os do tema
 * no cartão da conta).
 *
 * - Topo: marca, nome do app e o botão de recolher à direita, sem subtítulo. Recolhida, a própria
 *   marca é o botão de abrir (o ícone de abrir aparece ao passar o mouse ou focar).
 * - Itens: os da lista já filtrada por permissão; o bloco "Administração" ganha rótulo (aberta) ou
 *   um traço (recolhida).
 * - Rodapé, lugar ÚNICO da conta: foto (iniciais sem foto), nome e grupo; o clique abre o
 *   `CartaoDaConta` (e-mail, forma de entrada, "Alterar senha"); "Sair" logo abaixo.
 *
 * No celular e no tablet ela não existe (`desktop:flex`) — a navegação mora no `MenuInferior`.
 *
 * Origem: Diário de Projetos (nov/2026). Sem dependência do app: marca e nome chegam por props.
 * Depende de: `cn`, `usePresenca` (lib/presenca), `useFecharComEsc` (lib/modalEsc), `AvatarUsuario`,
 * classes `sidebar-rolagem`, `entrada-popover`/`saida-popover` e a variante `desktop:` (layout.css).
 */
import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from './LinkDoApp' // troque o roteador só em LinkDoApp.tsx
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { cn } from '@/lib/utils'
import { rotaAtiva, type ItemDeNavegacao } from '@/config/navegacao'
import { usePresenca } from '@/lib/presenca'
import { useFecharComEsc } from '@/lib/modalEsc'
import { AvatarUsuario } from '@/components/padrao/AvatarUsuario'
import { CartaoDaConta, type PessoaDaConta } from './CartaoDaConta'

export function BarraLateral({ marca, nomeDoApp, itens, caminho, recolhida, pessoa, fotoUrl, onAlternar, onSair, onAlterarSenha, extraDoRodape }: {
    /** URL da imagem da marca do app (quadrada; desenhada em 36px). */
    marca: string
    nomeDoApp: string
    itens: ItemDeNavegacao[]
    caminho: string
    recolhida: boolean
    pessoa: PessoaDaConta
    fotoUrl?: string | null
    onAlternar: () => void
    onSair: () => void
    /** Só para quem entra com e-mail e senha; sem ela, o cartão não mostra "Alterar senha". */
    onAlterarSenha?: () => void
    /** Pólobh: o sino de pendências, logo acima da conta. Recebe se a barra está recolhida. */
    extraDoRodape?: (recolhida: boolean) => React.ReactNode
}) {
    return (
        <aside
            aria-label="Navegação principal"
            className={cn(
                'hidden h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-(--duracao-painel) ease-saida desktop:flex',
                recolhida ? 'w-[72px]' : 'w-64',
            )}
        >
            <div className={cn('flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border', recolhida ? 'justify-center px-2' : 'pl-4 pr-2')}>
                {recolhida ? (
                    // Recolhida: a marca é o botão de abrir (o ícone de abrir aparece ao passar o mouse ou focar).
                    <button
                        type="button"
                        onClick={onAlternar}
                        aria-label="Abrir barra lateral"
                        aria-expanded={false}
                        title="Abrir barra lateral"
                        className="group relative flex h-10 w-10 items-center justify-center rounded-md hover:bg-sidebar-hover focus-visible:bg-sidebar-hover"
                    >
                        <img src={marca} alt="" className="h-9 w-9 rounded-md object-contain group-hover:opacity-0 group-focus-visible:opacity-0" />
                        <PanelLeftOpen aria-hidden className="absolute h-[18px] w-[18px] text-sidebar-strong opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                    </button>
                ) : (
                    <>
                        <img src={marca} alt="" className="h-9 w-9 shrink-0 rounded-md object-contain" />
                        <p className="min-w-0 flex-1 truncate text-sm font-bold text-sidebar-strong">{nomeDoApp}</p>
                        <button
                            type="button"
                            onClick={onAlternar}
                            aria-label="Recolher barra lateral"
                            aria-expanded
                            title="Recolher barra lateral"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-hover hover:text-sidebar-strong"
                        >
                            <PanelLeftClose aria-hidden className="h-[18px] w-[18px]" />
                        </button>
                    </>
                )}
            </div>

            <nav className="sidebar-rolagem flex-1 space-y-1 overflow-y-auto px-3 py-4" data-recolhida={recolhida || undefined}>
                {itens.map((item, indice) => {
                    const ativo = rotaAtiva(item.to, caminho, item.ativoEm)
                    const Icone = item.icone
                    // O bloco de administração começa com um rótulo (aberta) ou um traço (recolhida).
                    const abreAdministracao = item.administracao && !itens[indice - 1]?.administracao
                    const classe = cn(
                        'flex h-10 w-full items-center gap-3 rounded-md text-sm font-medium',
                        recolhida ? 'justify-center px-0' : 'px-3',
                        ativo
                            ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-strong',
                    )
                    const conteudo = (
                        <>
                            <span className="relative shrink-0">
                                <Icone aria-hidden className="h-[18px] w-[18px]" />
                                {/* Recolhida, o contador vira um ponto sobre o ícone. */}
                                {recolhida && !!item.contador && <span aria-hidden className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />}
                            </span>
                            {!recolhida && <span className="min-w-0 flex-1 truncate text-left">{item.rotulo}</span>}
                            {!recolhida && !!item.contador && (
                                <span className="rounded-full bg-destructive px-1.5 text-2xs font-semibold tabular-nums text-destructive-foreground" aria-label={`${item.contador} pendência(s)`}>
                                    {item.contador}
                                </span>
                            )}
                        </>
                    )
                    const rotuloAcessivel = recolhida ? (item.contador ? `${item.rotulo} (${item.contador} pendência(s))` : item.rotulo) : undefined
                    return (
                        <Fragment key={item.to}>
                            {abreAdministracao && (recolhida
                                ? <div aria-hidden className="mx-2 my-3 border-t border-sidebar-border" />
                                : <p className="px-3 pb-1 pt-4 text-2xs font-semibold text-muted-foreground">Administração</p>)}
                            {/* Item de painel (Help Desk) não navega: abre sobre a tela. */}
                            {item.aoClicar ? (
                                <button type="button" onClick={item.aoClicar} aria-label={rotuloAcessivel} title={rotuloAcessivel} className={classe}>
                                    {conteudo}
                                </button>
                            ) : (
                                <Link
                                    to={item.to}
                                    aria-current={ativo ? 'page' : undefined}
                                    aria-label={rotuloAcessivel}
                                    title={rotuloAcessivel}
                                    className={classe}
                                >
                                    {conteudo}
                                </Link>
                            )}
                        </Fragment>
                    )
                })}
            </nav>

            {extraDoRodape && <div className="shrink-0 border-t border-sidebar-border px-3 pt-3">{extraDoRodape(recolhida)}</div>}

            <RodapeDaConta
                recolhida={recolhida}
                pessoa={pessoa}
                fotoUrl={fotoUrl}
                onSair={onSair}
                onAlterarSenha={onAlterarSenha}
            />
        </aside>
    )
}

/** Rodapé: a pessoa (abre o cartão da conta) e "Sair". Recolher/abrir mora no topo, ao lado do nome. */
function RodapeDaConta({ recolhida, pessoa, fotoUrl, onSair, onAlterarSenha }: {
    recolhida: boolean
    pessoa: PessoaDaConta
    fotoUrl?: string | null
    onSair: () => void
    onAlterarSenha?: () => void
}) {
    const [aberto, setAberto] = useState(false)
    const { montado, saindo } = usePresenca(aberto)
    const caixa = useRef<HTMLDivElement>(null)
    const botao = useRef<HTMLButtonElement>(null)
    const fechar = () => { setAberto(false); botao.current?.focus() }
    useFecharComEsc(fechar, aberto)

    // Clique fora fecha.
    useEffect(() => {
        if (!aberto) return
        const aoClicar = (e: PointerEvent) => {
            if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false)
        }
        document.addEventListener('pointerdown', aoClicar)
        return () => document.removeEventListener('pointerdown', aoClicar)
    }, [aberto])

    return (
        <div className="shrink-0 space-y-1 border-t border-sidebar-border p-3">
            <div ref={caixa} className="relative">
                <button
                    ref={botao}
                    type="button"
                    onClick={() => setAberto((v) => !v)}
                    aria-haspopup="dialog"
                    aria-expanded={aberto}
                    aria-label={recolhida ? `Sua conta: ${pessoa.nome}` : undefined}
                    title={recolhida ? pessoa.nome : undefined}
                    className={cn(
                        'flex w-full items-center gap-3 rounded-md hover:bg-sidebar-hover',
                        recolhida ? 'h-11 justify-center' : 'p-2 text-left',
                    )}
                >
                    <AvatarUsuario nome={pessoa.nome} fotoUrl={fotoUrl} className="h-9 w-9" />
                    {!recolhida && (
                        <span className="min-w-0 flex-1 leading-tight">
                            <span className="block truncate text-sm font-semibold text-sidebar-strong">{pessoa.nome}</span>
                            <span className="block truncate text-2xs font-medium text-muted-foreground">{pessoa.grupo}</span>
                        </span>
                    )}
                </button>

                {montado && (
                    <div
                        role="dialog"
                        aria-label="Sua conta"
                        className={cn(
                            'absolute z-50 w-80 overflow-hidden rounded-lg border border-border bg-popover shadow-(--sombra-flutuante)',
                            // Aberta: o cartão sobe acima da pessoa. Recolhida: abre ao lado da barra.
                            recolhida ? 'bottom-0 left-full ml-5' : 'bottom-full left-0 mb-2',
                            saindo ? 'saida-popover' : 'entrada-popover',
                        )}
                    >
                        <CartaoDaConta
                            pessoa={pessoa}
                            fotoUrl={fotoUrl}
                            onAlterarSenha={onAlterarSenha && (() => { setAberto(false); onAlterarSenha() })}
                        />
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={onSair}
                aria-label="Sair do app"
                title={recolhida ? 'Sair do app' : undefined}
                className={cn(
                    'flex h-10 w-full items-center gap-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive',
                    recolhida ? 'justify-center' : 'px-3',
                )}
            >
                <LogOut aria-hidden className="h-[18px] w-[18px] shrink-0" />
                {!recolhida && 'Sair'}
            </button>
        </div>
    )
}
