/**
 * Casca das telas autenticadas (o `DashboardLayout` do Diário de Projetos, sem o que é do Diário).
 *
 * - Computador: só a `BarraLateral` clara recolhível. **Sem topo (header) no computador**: marca,
 *   nome do app, recolher e conta moram na barra. O título de cada tela é o `CabecalhoPagina`.
 * - Celular e tablet: topo enxuto só com a marca e o nome + `MenuInferior` (o "Mais" guarda a
 *   administração, a pessoa, "Alterar senha" e "Sair").
 *
 * Qual dos dois aparece é decidido por CSS (`desktop:` / `movel:`, em layout.css), não por
 * JavaScript: a primeira pintura já sai certa e girar o tablet troca o layout na hora.
 *
 * Aberta/recolhida: recolhida abaixo de 1280px na primeira visita; depois vale a escolha da pessoa,
 * guardada em `localStorage` (try/catch — sem armazenamento, cai na regra da largura).
 *
 * O que trocar ao adaptar:
 * - `itens`: a lista de `navegacao.ts` JÁ filtrada pelo que o grupo vê (padrão de Acessos:
 *   `ITENS_DE_NAVEGACAO.filter((i) => podeVerRota(i.to))`).
 * - `pessoa`: nome, grupo de permissão ("Sem grupo de permissão" quando não há), e-mail e forma de
 *   entrada ("Microsoft 365" / "E-mail e senha"), montados pelo app a partir do Auth.
 * - `onAlterarSenha`: só para quem entra com senha (o popup é do padrão de Acessos).
 * - `antesDoConteudo`: faixas do app (versão nova, "Somente leitura", acesso negado…).
 * - `telaCheia`: telas que usam a área inteira sem recuo (ex.: Gantt).
 */
import { useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'
import type { ItemDeNavegacao } from '@/config/navegacao'
import { BarraLateral } from './BarraLateral'
import { MenuInferior } from './MenuInferior'
import type { PessoaDaConta } from './CartaoDaConta'

const CHAVE_RECOLHIDA = 'barraLateralRecolhida'

function lerRecolhida(): boolean {
    try {
        const salvo = localStorage.getItem(CHAVE_RECOLHIDA)
        if (salvo !== null) return salvo === 'true'
    } catch {
        // sem armazenamento: cai na regra da largura
    }
    return typeof window !== 'undefined' && window.innerWidth < 1280
}

export function CascaDoApp({
    marca, nomeDoApp, itens, caminho, pessoa, fotoUrl, onSair, onAlterarSenha, faixaDoTopo, antesDoConteudo, extraDoRodape, extraDoTopoMovel, telaCheia = false, children,
}: {
    marca: string
    nomeDoApp: string
    itens: ItemDeNavegacao[]
    caminho: string
    pessoa: PessoaDaConta
    fotoUrl?: string | null
    onSair: () => void
    onAlterarSenha?: () => void
    /** Faixa acima de tudo, na largura toda (ex.: "Versão nova disponível"). */
    faixaDoTopo?: ReactNode
    /** Faixa acima do conteúdo, ao lado da barra (ex.: "Somente leitura…"). */
    antesDoConteudo?: ReactNode
    /** Pólobh: o sino de pendências no rodapé da barra lateral (computador). */
    extraDoRodape?: (recolhida: boolean) => ReactNode
    /** Pólobh: o mesmo sino, à direita do topo do celular. */
    extraDoTopoMovel?: ReactNode
    telaCheia?: boolean
    children: ReactNode
}) {
    const [recolhida, setRecolhida] = useState(lerRecolhida)

    const alternarBarra = () => {
        setRecolhida((atual) => {
            const proxima = !atual
            try { localStorage.setItem(CHAVE_RECOLHIDA, String(proxima)) } catch { /* sem armazenamento */ }
            return proxima
        })
    }

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-background">
            {faixaDoTopo}
            <div className="flex min-h-0 flex-1">
                <BarraLateral
                    marca={marca}
                    nomeDoApp={nomeDoApp}
                    itens={itens}
                    caminho={caminho}
                    recolhida={recolhida}
                    pessoa={pessoa}
                    fotoUrl={fotoUrl}
                    onAlternar={alternarBarra}
                    onSair={onSair}
                    onAlterarSenha={onAlterarSenha}
                    extraDoRodape={extraDoRodape}
                />

                <div className="flex min-w-0 flex-1 flex-col">
                    {/* Topo só do celular e do tablet: a marca — a navegação mora embaixo. */}
                    <header className={cn(
                        'z-30 hidden h-14 shrink-0 items-center gap-2.5 border-b border-border bg-card px-4 movel:flex',
                        // Com uma faixa na tela, é ela que cobre a área segura do topo.
                        !faixaDoTopo && 'pt-[env(safe-area-inset-top)]',
                    )}>
                        <img src={marca} alt="" className="h-8 w-8 rounded-md object-contain" />
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{nomeDoApp}</span>
                        {extraDoTopoMovel}
                    </header>

                    {antesDoConteudo}

                    <main
                        id="rolagem-principal"
                        className={cn(
                            'min-h-0 min-w-0 flex-1 overflow-y-auto movel:pb-menu-inferior',
                            !telaCheia && 'p-4 sm:p-6 2xl:p-8',
                        )}
                    >
                        <div className={cn(telaCheia ? 'h-full' : 'mx-auto w-full max-w-[1600px]')}>
                            {children}
                        </div>
                    </main>
                </div>

                <MenuInferior itens={itens} caminho={caminho} pessoa={pessoa} fotoUrl={fotoUrl} onSair={onSair} onAlterarSenha={onAlterarSenha} />
            </div>
        </div>
    )
}
