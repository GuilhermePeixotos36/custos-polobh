import { NavLink, useNavigate } from "react-router-dom";
import { NAV } from "./nav";
import { useAuth, ROTULO_PAPEL } from "@/store/auth";
import { Avatar, Button } from "@/components/ui";
import { NotifDot } from "@/components/NotifDot";
import { IcLogout } from "@/components/icons";
import { cx } from "@/lib/format";
import { useMinhasPendencias } from "@/store/pendencias";

/** Barra de navegação superior (substitui a antiga sidebar lateral). */
export function TopNav() {
  const { usuario, pode, sair } = useAuth();
  const navigate = useNavigate();
  const { porRecurso } = useMinhasPendencias();
  if (!usuario) return null;

  const itens = NAV.filter((i) => pode(i.recurso));

  return (
    <header className="no-print sticky top-0 z-30 h-[var(--altura-topnav)] bg-surface border-b border-border flex items-center gap-3 px-3 md:px-5">
      <img src="/polobh-logo.png" alt="Pólobh" className="h-6 w-auto object-contain shrink-0" />

      <nav className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
        {itens.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.to === "/"}
            className={({ isActive }) =>
              cx(
                "flex items-center gap-2 px-3 h-9 rounded-btn text-[13px] font-semibold whitespace-nowrap transition-colors",
                isActive
                  ? "bg-primary-soft text-primary-dark"
                  : "text-ink-2 hover:text-ink hover:bg-[#F5F6F8]"
              )
            }
          >
            <span className="shrink-0 relative">
              {i.icon}
              <NotifDot n={porRecurso[i.recurso] ?? 0} title={`${porRecurso[i.recurso] ?? 0} pendência(s)`} className="left-auto -right-2 -top-2" />
            </span>
            <span className="hidden lg:inline">{i.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex items-center gap-2">
          <Avatar nome={usuario.nome} size={32} />
          <div className="leading-tight min-w-0">
            <div className="text-[12.5px] font-bold text-ink truncate max-w-[150px]">{usuario.nome}</div>
            <div className="text-[10.5px] text-ink-3">{usuario.areaNome ?? ROTULO_PAPEL[usuario.papel]}</div>
          </div>
        </div>
        <Button
          variant="text"
          size="sm"
          icon={<IcLogout width={16} height={16} />}
          onClick={async () => {
            await sair();
            navigate("/login");
          }}
        >
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>
    </header>
  );
}
