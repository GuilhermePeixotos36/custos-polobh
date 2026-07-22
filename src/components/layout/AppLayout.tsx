import { Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { TopNav } from "./TopNav";
import { Toaster } from "@/components/ui/Toaster";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/store/auth";
import { usePendencias } from "@/store/pendencias";
import { useEmpresas } from "@/store/empresas";

/** Casca autenticada: sidebar + área de conteúdo. */
export function AppLayout() {
  const usuario = useAuth((s) => s.usuario);
  const carregando = useAuth((s) => s.carregando);
  const carregarPendencias = usePendencias((s) => s.carregar);
  const carregarEmpresas = useEmpresas((s) => s.carregar);
  const { pathname } = useLocation();

  // Mantém as pendências (badges) atualizadas ao navegar entre telas.
  useEffect(() => {
    if (usuario) carregarPendencias();
  }, [usuario, pathname, carregarPendencias]);

  // Carrega as empresas do grupo ao entrar na área autenticada (login).
  useEffect(() => {
    if (usuario) carregarEmpresas();
  }, [usuario, carregarEmpresas]);

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

/** Cabeçalho de página + área de conteúdo padronizada. Breadcrumb e ação ficam
 *  direto sobre o cinza da página — não existe mais uma barra branca separada. */
export function PageShell({
  breadcrumb,
  title,
  titleAdornment,
  subtitle,
  topAction,
  children,
}: {
  breadcrumb: ReactNode;
  title: string;
  titleAdornment?: ReactNode;
  subtitle?: string;
  topAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex-1 px-[40px] py-[30px] max-w-[1720px] w-full mx-auto">
      <div className="mb-2 flex items-center gap-2 text-sm text-ink-2 font-semibold min-w-0">
        {breadcrumb}
      </div>
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-display font-bold text-[30px] tracking-[-0.7px] text-ink leading-none">
              {title}
            </h1>
            {titleAdornment}
          </div>
          {subtitle && <p className="text-ink-2 text-[15px] mt-2">{subtitle}</p>}
        </div>
        {topAction && <div className="flex items-center gap-2.5 shrink-0">{topAction}</div>}
      </div>
      {children}
    </main>
  );
}

/** Item de breadcrumb simples. */
export function Crumb({ children }: { children: ReactNode }) {
  return <span className="text-ink font-bold">{children}</span>;
}
