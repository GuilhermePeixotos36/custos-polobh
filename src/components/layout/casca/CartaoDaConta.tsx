/**
 * Cartão da conta (computador): foto, nome, grupo, e-mail, forma de entrada e "Alterar senha".
 *
 * É o conteúdo do popup que abre ao clicar na pessoa, no rodapé da `BarraLateral`. O "Sair" mora só
 * no rodapé da barra, não aqui. "Alterar senha" só aparece quando a casca passa `onAlterarSenha`
 * (quem entra com e-mail e senha); quem entra pela Microsoft não tem senha no app.
 *
 * Origem: Diário de Projetos (nov/2026).
 */
import { KeyRound } from 'lucide-react'

import { AvatarUsuario } from '@/components/padrao/AvatarUsuario'

/**
 * A pessoa logada, já em texto de tela.
 * - `grupo`: o nome do grupo de permissão (padrão de Acessos) ou, sem grupo, "Sem grupo de permissão".
 * - `formaDeEntrada`: "Microsoft 365" ou "E-mail e senha".
 */
export type PessoaDaConta = { nome: string; grupo: string; email: string; formaDeEntrada: string }

export function CartaoDaConta({ pessoa, fotoUrl, onAlterarSenha }: {
    pessoa: PessoaDaConta
    fotoUrl?: string | null
    onAlterarSenha?: () => void
}) {
    return (
        <>
            <div className="flex items-center gap-3 p-4">
                <AvatarUsuario nome={pessoa.nome} fotoUrl={fotoUrl} className="h-11 w-11" textoClassName="text-sm" />
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{pessoa.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">{pessoa.grupo}</p>
                </div>
            </div>
            <dl className="space-y-3 border-t border-border px-4 py-3">
                <div>
                    <dt className="text-xs font-semibold text-muted-foreground">E-mail</dt>
                    <dd className="truncate text-sm text-foreground">{pessoa.email}</dd>
                </div>
                <div>
                    <dt className="text-xs font-semibold text-muted-foreground">Forma de entrada</dt>
                    <dd className="text-sm text-foreground">{pessoa.formaDeEntrada}</dd>
                </div>
            </dl>
            {onAlterarSenha && (
                <div className="border-t border-border p-2">
                    <button
                        type="button"
                        onClick={onAlterarSenha}
                        className="flex h-10 w-full items-center gap-2 rounded-md px-2.5 text-sm font-semibold text-foreground hover:bg-muted"
                    >
                        <KeyRound aria-hidden className="h-4 w-4" />
                        Alterar senha
                    </button>
                </div>
            )}
        </>
    )
}
