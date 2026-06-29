import { NavLink } from "react-router-dom";
import { NAV } from "./nav";
import { useAuth, ROTULO_PAPEL } from "@/store/auth";
import { Avatar } from "@/components/ui";
import { cx } from "@/lib/format";

export function Sidebar() {
  const { usuario, pode } = useAuth();
  if (!usuario) return null;

  const itens = NAV.filter((i) => pode(i.recurso));
  const grupos = ["Operação", "Sistema"] as const;

  return (
    <aside className="no-print w-[262px] shrink-0 bg-surface border-r border-border flex flex-col h-screen sticky top-0">
      <div className="px-5 pt-5 pb-4">
        <img src="/polobh-logo.png" alt="Pólobh" className="h-7 w-auto object-contain" />
        <div className="text-[10.5px] text-ink-3 font-semibold mt-2 ml-0.5">Custos de Eventos</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
        {grupos.map((g) => {
          const itensG = itens.filter((i) => i.grupo === g);
          if (!itensG.length) return null;
          return (
            <div key={g}>
              <div className="px-3 mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
                {g}
              </div>
              <div className="space-y-0.5">
                {itensG.map((i) => (
                  <NavLink
                    key={i.to}
                    to={i.to}
                    end={i.to === "/"}
                    className={({ isActive }) =>
                      cx(
                        "relative flex items-center gap-3 px-3 h-10 rounded-[11px] text-[13.5px] font-semibold transition-colors",
                        isActive
                          ? "bg-[linear-gradient(90deg,#FDF1E3,#FCE7CD)] text-primary-dark"
                          : "text-ink-2 hover:text-ink hover:bg-[#F5F6F8]"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={cx(
                            "absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r bg-primary transition-opacity",
                            isActive ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="shrink-0">{i.icon}</span>
                        {i.label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-3">
        <div className="flex items-center gap-3 p-2.5 rounded-card bg-[#F7F8FA] border border-border-soft">
          <Avatar nome={usuario.nome} size={38} />
          <div className="min-w-0 leading-tight">
            <div className="text-[13px] font-bold text-ink truncate">{usuario.nome}</div>
            <div className="text-[11px] text-ink-3 truncate">{ROTULO_PAPEL[usuario.papel]}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
