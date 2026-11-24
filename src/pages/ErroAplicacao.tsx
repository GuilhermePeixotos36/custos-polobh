import { useEffect } from "react";
import { useRouteError } from "react-router-dom";
import { registrarErroJs, registrarLogoutAntesDeSair } from "@/lib/logs/registrarLog";
import { Button } from "@/components/ui";
import { ehErroDeChunk } from "@/lib/lazyComRecuperacao";
import { supabase } from "@/lib/supabaseClient";

/**
 * Último recurso quando a tela quebra: encerra a sessão e apaga o que o navegador
 * guardou dela (o aplicativo guarda a sessão em chaves `sb-…`). Uma sessão
 * desencontrada — a senha acabou de mudar noutro aparelho, por exemplo — faz toda
 * tela quebrar até ser descartada.
 */
async function sairEEntrarDeNovo() {
  // Saída de verdade: vai para a tela Logs antes do signOut (depois não há sessão para a RPC);
  // espera no máximo 1,5 s e nunca falha.
  await registrarLogoutAntesDeSair();
  try {
    await supabase.auth.signOut();
  } catch {
    /* sem rede ou sessão já inválida: limpa o que está guardado mesmo assim */
  }
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("sb-")).forEach((k) => localStorage.removeItem(k));
  } catch {
    /* armazenamento bloqueado */
  }
  window.location.assign("/login");
}

/** O motivo técnico em uma linha: é o que permite achar a causa de um print. */
function motivoTecnico(erro: unknown): string {
  if (erro instanceof Error) return `${erro.name}: ${erro.message}`;
  if (erro && typeof erro === "object" && "statusText" in erro) return String((erro as { statusText: unknown }).statusText);
  return String(erro ?? "erro desconhecido");
}

export function ErroAplicacao() {
  const erro = useRouteError();
  const erroDeAtualizacao = ehErroDeChunk(erro);
  console.error("[rota] Falha ao abrir tela", erro);
  // LOGS: esta é a rede de segurança das telas (o `errorElement` de cada rota), então o erro vai
  // para a aba Erros da tela Logs — mensagem e 5 linhas da pilha, nada de props nem estado. A
  // versão velha aberta depois de uma publicação (erro de chunk) não é defeito: fica de fora.
  useEffect(() => {
    if (!erroDeAtualizacao) registrarErroJs(erro instanceof Error ? erro : motivoTecnico(erro), "rota");
  }, [erro, erroDeAtualizacao]);

  return (
    <main className="min-h-screen grid place-items-center bg-page p-5">
      <div className="w-full max-w-lg rounded-card-lg border border-border bg-white p-7 text-center shadow-card">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-danger-soft text-xl font-bold text-danger">!</div>
        <h1 className="text-xl font-bold text-ink">
          {erroDeAtualizacao ? "O aplicativo foi atualizado" : "Não foi possível abrir esta tela"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-2">
          {erroDeAtualizacao
            ? "A versão aberta no navegador ficou desatualizada após uma publicação. Recarregue para usar a versão mais recente."
            : "Ocorreu uma falha inesperada. Recarregue a página e tente novamente."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Recarregar aplicativo</Button>
          <Button variant="secondary" onClick={() => window.location.assign("/")}>Ir para o início</Button>
        </div>
        {!erroDeAtualizacao && (
          <>
            <button
              type="button"
              onClick={() => void sairEEntrarDeNovo()}
              className="mt-3 text-sm font-bold text-primary-dark hover:underline"
            >
              Sair e entrar de novo
            </button>
            <p className="mt-4 wrap-break-word rounded-btn bg-muted/60 px-3 py-2 text-left text-2xs leading-snug text-ink-3">
              Detalhe técnico (envie este texto ao suporte): {motivoTecnico(erro)} · {window.location.pathname}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
