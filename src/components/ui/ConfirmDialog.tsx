import { useEffect } from "react";
import { useConfirm } from "@/store/confirm";
import { cx } from "@/lib/format";
import { Button } from "./Button";

/** Modal de confirmação — montado uma vez no AppLayout. */
export function ConfirmDialog() {
  const { aberto, opts, responder } = useConfirm();

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") responder(false);
      if (e.key === "Enter") responder(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, responder]);

  if (!aberto || !opts) return null;

  const danger = opts.tom === "danger";

  return (
    /* z-90: acima dos modais (z-[70]) e do painel do Help Desk. Em z-60 a
       confirmação abria ATRÁS de quem a pediu — invisível e inclicável, então a
       promessa nunca resolvia e o botão ficava travado em "…". */
    <div className="no-print fixed inset-0 z-90 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={() => responder(false)}
      />
      <div className="relative w-full max-w-[420px] bg-surface rounded-card-lg shadow-modal p-6 animate-[fadein_.12s_ease]">
        <h3 className="font-bold text-lg text-ink tracking-[-0.3px]">{opts.titulo}</h3>
        {/* `whitespace-pre-line`: a mensagem às vezes traz um parágrafo extra
            (ex.: os itens que ficaram de fora da emissão de OS). */}
        {opts.mensagem && <p className="text-ink-2 text-sm mt-2 leading-relaxed whitespace-pre-line">{opts.mensagem}</p>}

        <div className="flex justify-end gap-2 mt-6">
          {!opts.somenteOk && (
            <Button variant="secondary" onClick={() => responder(false)}>
              {opts.cancelarTexto ?? "Cancelar"}
            </Button>
          )}
          {/* Confirmação de perigo segue vermelha cheia: é a resposta que apaga. */}
          <Button
            autoFocus
            onClick={() => responder(true)}
            className={cx(danger && "bg-destructive text-destructive-foreground shadow-none hover:bg-destructive/90")}
          >
            {opts.confirmarTexto ?? "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
