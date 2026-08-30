import { useToast, type ToastTom } from "@/store/toast";
import { cx } from "@/lib/format";

const tons: Record<ToastTom, string> = {
  success: "border-success/30 bg-success-soft text-success",
  danger: "border-danger/30 bg-danger-soft text-danger",
  info: "border-info/30 bg-info-soft text-info",
  warning: "border-warning/30 bg-warning-soft text-warning",
};

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    // Sobe acima da pílula de pendências quando ela existe (ver
    // NavegadorPendencias): os dois dividem o canto inferior direito, e o
    // aviso tapava justamente o comando que a pessoa ia usar em seguida.
    <div className="fixed right-5 bottom-[calc(1.25rem+var(--altura-pilula,0px)+0.5rem)] z-50 flex flex-col gap-2 no-print">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cx(
            "max-w-sm text-left text-[13px] font-semibold px-4 py-3 rounded-card border shadow-card animate-[fadein_.15s_ease]",
            tons[t.tom]
          )}
        >
          {t.texto}
        </button>
      ))}
    </div>
  );
}
