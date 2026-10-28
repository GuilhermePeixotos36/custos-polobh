import type { ReactNode } from "react";
import { cx, iniciais } from "@/lib/format";
import { flags } from "@/lib/flags";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative w-[46px] h-[27px] rounded-pill transition-colors",
          checked ? "bg-primary" : "bg-[#CDD0D6]"
        )}
      >
        <span
          className={cx(
            "absolute top-[3px] h-[21px] w-[21px] rounded-full bg-white shadow-sm transition-all",
            checked ? "left-[22px]" : "left-[3px]"
          )}
        />
      </button>
      {label && <span className="text-sm text-ink">{label}</span>}
    </label>
  );
}

export function Avatar({
  nome,
  size = 40,
}: {
  nome: string;
  size?: number;
}) {
  return (
    <div
      className="bg-avatar-grad flex items-center justify-center rounded-[12px] shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        className="font-display font-extrabold text-amber"
        style={{ fontSize: size * 0.36 }}
      >
        {iniciais(nome)}
      </span>
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full rounded-pill bg-[#EDEEF2] overflow-hidden">
      <div
        className="h-full rounded-pill bg-progress-grad"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/**
 * Aviso de que o envio de e-mail está aguardando a conexão com o Brevo da
 * Pólobh. Aparece só quando a integração está desligada (flags.email = false).
 * Renderizar perto de qualquer ação que dispara e-mail.
 */
export function AvisoEmailPendente({ className }: { className?: string }) {
  if (flags.email) return null;
  return (
    <div className={cx("flex items-start gap-2 rounded-btn bg-warning-soft text-warning px-3 py-2 text-[12.5px]", className)}>
      <span className="mt-0.5 shrink-0" aria-hidden>✉️</span>
      <span>
        <b>Envio de e-mail aguardando conexão</b> com o e-mail da Pólobh (Brevo). Até a
        integração ser concluída, os disparos são apenas <b>simulados</b> nos testes — nada é
        enviado de fato ao destinatário.
      </span>
    </div>
  );
}

/**
 * Aviso de que o app está em homologação e nenhum e-mail chega a quem deveria.
 *
 * Fica ao lado dos botões de envio, e não escondido nas Configurações: quem
 * clica em "Enviar a todos" precisa saber ANTES que aquilo não vai sair para os
 * fornecedores — descobrir depois, pelo silêncio deles, é pior do que não ter o
 * botão.
 */
export function AvisoHomologacaoEmail({ className }: { className?: string }) {
  if (flags.emailDestinoReal) return null;
  return (
    <div className={cx("flex items-start gap-2 rounded-btn bg-warning-soft text-warning px-3 py-2 text-[12.5px]", className)}>
      <span className="mt-0.5 shrink-0" aria-hidden>🔒</span>
      <span>
        <b>Sistema em homologação.</b> Nenhum e-mail chega a fornecedor ou cliente: o que for
        enviado vai para a caixa de teste da equipe, com o destinatário original no assunto.
        {!flags.disparoFornecedor && (
          <> Os disparos de <b>OS</b> e de <b>cronograma</b> estão desabilitados até a virada.</>
        )}
      </span>
    </div>
  );
}

/** Motivo do botão de envio desabilitado — o mesmo texto em todas as telas. */
export const MOTIVO_DISPARO_DESLIGADO =
  "Disparo por e-mail desativado enquanto o sistema está em homologação.";

/**
 * Falha de carregamento — some com o "lista vazia parece que não tem dados".
 * Sempre que uma tela usa `useAsync`, mostre isto quando `error` vier
 * preenchido, em vez de cair no estado vazio.
 */
export function AvisoErro({
  erro,
  oQue,
  onTentarDeNovo,
}: {
  erro: string;
  oQue?: string;
  onTentarDeNovo?: () => void;
}) {
  return (
    <div className="m-5 rounded-btn bg-danger-soft text-danger px-4 py-3 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-bold text-[13.5px]">
          Não foi possível carregar {oQue ?? "os dados"}.
        </p>
        <p className="text-[12.5px] opacity-90 wrap-break-word">{erro}</p>
      </div>
      {onTentarDeNovo && (
        <button onClick={onTentarDeNovo} className="shrink-0 font-bold underline text-[13px]">
          Tentar de novo
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-14 px-6">
      <p className="font-display font-bold text-ink text-[15px]">{title}</p>
      {hint && <p className="text-ink-2 text-sm mt-1 max-w-md mx-auto">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
