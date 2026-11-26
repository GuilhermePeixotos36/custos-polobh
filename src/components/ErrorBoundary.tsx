// Padrão de Logs — rede de segurança da raiz (26/11/2026).
//
// Um erro de renderização que ninguém tratou derrubaria a tela em branco. Aqui vira um aviso
// simples com "Recarregar", e o erro vai para o log (`erro_js`, origem "renderizacao").
//
// A LÓGICA é esta e não muda. A APARÊNCIA do aviso é do design system do app: o padrão abaixo usa
// HTML puro para funcionar em qualquer app; troque pelo cartão e pelo botão do app passando
// `aviso`, ou edite o `AvisoPadrao`. Os TEXTOS ficam como estão.
//
// Se o app já tem um ErrorBoundary, não crie outro: acrescente a linha do `registrarErroJs` no
// `componentDidCatch` dele.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { registrarErroJs } from "@/lib/logs/registrarLog";

type Estado = { falhou: boolean };

type Props = {
  children: ReactNode;
  /** O aviso no visual do app. Recebe a ação de recarregar. */
  aviso?: (recarregar: () => void) => ReactNode;
};

export const TEXTOS_ERRO_INESPERADO = {
  titulo: "Algo deu errado",
  mensagem: "Aconteceu um erro inesperado nesta tela. Recarregue a página para continuar; se voltar a acontecer, avise a TI.",
  botao: "Recarregar",
} as const;

// O cartão do Pólobh (o mesmo visual de `ErroAplicacao`), sem depender de componente nenhum: é a
// última rede, e tem de desenhar mesmo que o resto do app esteja quebrado.
function AvisoPadrao({ recarregar }: { recarregar: () => void }) {
  return (
    <main className="min-h-screen grid place-items-center bg-page p-5">
      <div role="alert" className="w-full max-w-lg rounded-card-lg border border-border bg-white p-7 text-center shadow-card">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-danger-soft text-xl font-bold text-danger">!</div>
        <h1 className="font-display text-xl font-bold text-ink">{TEXTOS_ERRO_INESPERADO.titulo}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-2">{TEXTOS_ERRO_INESPERADO.mensagem}</p>
        <button
          type="button"
          onClick={recarregar}
          className="mt-5 inline-flex h-10 items-center rounded-btn bg-primary px-5 text-sm font-bold text-white hover:bg-primary-dark"
        >
          {TEXTOS_ERRO_INESPERADO.botao}
        </button>
      </div>
    </main>
  );
}

export class ErrorBoundary extends Component<Props, Estado> {
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
    const recarregar = () => window.location.reload();
    return this.props.aviso ? this.props.aviso(recarregar) : <AvisoPadrao recarregar={recarregar} />;
  }
}
