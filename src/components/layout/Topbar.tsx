import type { ReactNode } from "react";

/** Barra de contexto da página: breadcrumb + ação. Fica logo abaixo da TopNav. */
export function Topbar({
  breadcrumb,
  action,
}: {
  breadcrumb: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="no-print h-[60px] shrink-0 bg-surface border-b border-border flex items-center justify-between px-6 sticky top-[60px] z-10">
      <div className="flex items-center gap-2 text-sm text-ink-2 font-semibold min-w-0">
        {breadcrumb}
      </div>
      <div className="flex items-center gap-2.5">{action}</div>
    </header>
  );
}
