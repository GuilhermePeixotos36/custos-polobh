import { Suspense, type ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { TopNav } from "./TopNav";
import { Topbar } from "./Topbar";
import { Toaster } from "@/components/ui/Toaster";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/store/auth";

/** Casca autenticada: sidebar + área de conteúdo. */
export function AppLayout() {
  const usuario = useAuth((s) => s.usuario);
  const carregando = useAuth((s) => s.carregando);

  // Aguarda a sessão inicial resolver antes de decidir redirecionar.
  if (carregando) {
    return <div className="min-h-screen grid place-items-center text-ink-3">Carregando…</div>;
  }
  if (!usuario) return <Navigate to="/login" replace />;

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav />
      <div className="flex-1 min-w-0 flex flex-col">
        <Suspense fallback={<div className="flex-1 grid place-items-center text-ink-3 text-sm">Carregando…</div>}>
          <Outlet />
        </Suspense>
      </div>
      <Toaster />
      <ConfirmDialog />
    </div>
  );
}

/** Cabeçalho de página + área de conteúdo padronizada (topbar 66px + padding). */
export function PageShell({
  breadcrumb,
  title,
  subtitle,
  topAction,
  children,
}: {
  breadcrumb: ReactNode;
  title: string;
  subtitle?: string;
  topAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <Topbar breadcrumb={breadcrumb} action={topAction} />
      <main className="flex-1 px-[34px] py-[30px] max-w-[1280px] w-full mx-auto">
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-[27px] tracking-[-0.7px] text-ink leading-none">
              {title}
            </h1>
            {subtitle && <p className="text-ink-2 text-sm mt-2">{subtitle}</p>}
          </div>
        </div>
        {children}
      </main>
    </>
  );
}

/** Item de breadcrumb simples. */
export function Crumb({ children }: { children: ReactNode }) {
  return <span className="text-ink font-bold">{children}</span>;
}
