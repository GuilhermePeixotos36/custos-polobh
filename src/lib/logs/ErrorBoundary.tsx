// Padrão de Logs — rede de segurança da raiz. Copie para `src/components/ErrorBoundary.tsx`.
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

// ADAPTAR: use o cartão, a tipografia e o botão primário do design system do app.
function AvisoPadrao({ recarregar }: { recarregar: () => void }) {
  return (
    <div style={{ display: "grid", minHeight: "100vh", placeItems: "center", padding: 24 }}>
      <div role="alert" style={{ maxWidth: 448, textAlign: "center" }}>
        <h1>{TEXTOS_ERRO_INESPERADO.titulo}</h1>
        <p>{TEXTOS_ERRO_INESPERADO.mensagem}</p>
        <button type="button" onClick={recarregar}>{TEXTOS_ERRO_INESPERADO.botao}</button>
      </div>
    </div>
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
