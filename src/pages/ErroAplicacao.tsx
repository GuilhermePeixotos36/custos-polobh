import { useRouteError } from "react-router-dom";
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
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Recarregar aplicativo</Button>
          <Button variant="secondary" onClick={() => window.location.assign("/")}>Ir para o início</Button>
        </div>
        {!erroDeAtualizacao && (
          <>
            <button
              type="button"
              onClick={() => void sairEEntrarDeNovo()}
              className="mt-3 text-[13px] font-bold text-primary-dark hover:underline"
            >
              Sair e entrar de novo
            </button>
            <p className="mt-4 break-words rounded-btn bg-[#F5F6F8] px-3 py-2 text-left text-[11px] leading-snug text-ink-3">
              Detalhe técnico (envie este texto ao suporte): {motivoTecnico(erro)} · {window.location.pathname}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
