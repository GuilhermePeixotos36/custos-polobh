import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui";
import { IcBell, IcLogout } from "@/components/icons";
import { useAuth } from "@/store/auth";

export function Topbar({
  breadcrumb,
  action,
}: {
  breadcrumb: ReactNode;
  action?: ReactNode;
}) {
  const navigate = useNavigate();
  const sair = useAuth((s) => s.sair);

  return (
    <header className="no-print h-[66px] shrink-0 bg-surface border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-2 text-sm text-ink-2 font-semibold min-w-0">
        {breadcrumb}
      </div>
      <div className="flex items-center gap-2.5">
        {action}
        <button className="h-10 w-10 rounded-btn border border-border text-ink-2 hover:text-ink flex items-center justify-center relative">
          <IcBell />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
        </button>
        <Button
          variant="text"
          size="sm"
          icon={<IcLogout width={16} height={16} />}
          onClick={async () => {
            await sair();
            navigate("/login");
          }}
        >
          Sair
        </Button>
      </div>
    </header>
  );
}
