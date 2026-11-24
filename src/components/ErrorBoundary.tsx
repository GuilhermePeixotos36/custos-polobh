/**
 * Rede de segurança da RAIZ (padrão de Logs, 24/11/2026).
 *
 * As telas já têm a sua: o `errorElement` de cada rota (`pages/ErroAplicacao`), que também manda o
 * erro para a tela Logs. Esta fica por fora do roteador e só pega o que quebrar fora de uma rota —
 * o próprio `RouterProvider`. Sem ela, esse erro deixaria a tela em branco.
 *
 * O aviso usa o mesmo cartão da `ErroAplicacao`; os textos são os do padrão.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { registrarErroJs } from "@/lib/logs/registrarLog";

type Estado = { falhou: boolean };

export const TEXTOS_ERRO_INESPERADO = {
  titulo: "Algo deu errado",
  mensagem: "Aconteceu um erro inesperado nesta tela. Recarregue a página para continuar; se voltar a acontecer, avise a TI.",
  botao: "Recarregar",
} as const;

function AvisoErroInesperado({ recarregar }: { recarregar: () => void }) {
  return (
    <main className="min-h-screen grid place-items-center bg-page p-5">
      <div role="alert" className="w-full max-w-lg rounded-card-lg border border-border bg-white p-7 text-center shadow-card">
        <h1 className="text-xl font-bold text-ink">{TEXTOS_ERRO_INESPERADO.titulo}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-2">{TEXTOS_ERRO_INESPERADO.mensagem}</p>
        <div className="mt-5 flex justify-center">
          <Button onClick={recarregar}>{TEXTOS_ERRO_INESPERADO.botao}</Button>
        </div>
      </div>
    </main>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { falhou: false };

  static getDerivedStateFromError(): Estado {
    return { falhou: true };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    // O console fica: é o que a TI abre quando alguém manda o print.
    console.error("[ErrorBoundary]", erro, info.componentStack);
    // Só mensagem e 5 linhas da pilha. A pilha de componentes e as props NÃO vão para o log.
    registrarErroJs(erro, "renderizacao");
  }

  render() {
    if (!this.state.falhou) return this.props.children;
    return <AvisoErroInesperado recarregar={() => window.location.reload()} />;
  }
}
