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
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 no-print">
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
