import { useRouteError } from "react-router-dom";
import { Button } from "@/components/ui";
import { ehErroDeChunk } from "@/lib/lazyComRecuperacao";

export function ErroAplicacao() {
  const erro = useRouteError();
  const erroDeAtualizacao = ehErroDeChunk(erro);
  console.error("[rota] Falha ao abrir tela", erro);

  return (
    <main className="min-h-screen grid place-items-center bg-page p-5">
      <div className="w-full max-w-lg rounded-card-lg border border-border bg-white p-7 text-center shadow-card">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-danger-soft text-xl font-bold text-danger">!</div>
        <h1 className="font-display text-xl font-bold text-ink">
          {erroDeAtualizacao ? "O aplicativo foi atualizado" : "Não foi possível abrir esta tela"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-2">
          {erroDeAtualizacao
            ? "A versão aberta no navegador ficou desatualizada após uma publicação. Recarregue para usar a versão mais recente."
            : "Ocorreu uma falha inesperada. Recarregue a página e tente novamente."}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Recarregar aplicativo</Button>
          <Button variant="secondary" onClick={() => window.location.assign("/")}>Ir para o início</Button>
        </div>
      </div>
    </main>
  );
}
