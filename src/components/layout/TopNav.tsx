import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { NAV } from "./nav";
import { useAuth, ROTULO_PAPEL } from "@/store/auth";
import { Avatar, Button } from "@/components/ui";
import { NotifDot } from "@/components/NotifDot";
import { SinoPendencias } from "@/components/SinoPendencias";
import { MinhaContaModal } from "@/components/MinhaContaModal";
import { IcLogout } from "@/components/icons";
import { cx } from "@/lib/format";
import { useMinhasPendencias } from "@/store/pendencias";
import { abrirSuporte, useSuporte } from "@/store/suporte";

/** Barra de navegação superior (substitui a antiga sidebar lateral). */
export function TopNav() {
  const { usuario, pode, sair } = useAuth();
  const navigate = useNavigate();
  const { porRecurso } = useMinhasPendencias();
  const painelAberto = useSuporte((s) => s.aberto);
  const [minhaConta, setMinhaConta] = useState(false);
  if (!usuario) return null;

  const itens = NAV.filter((i) => pode(i.recurso));

  return (
    <header className="no-print sticky top-0 z-30 h-[var(--altura-topnav)] bg-surface border-b border-border flex items-center gap-3 px-3 md:px-5">
      <img src="/polobh-logo.png" alt="Pólobh" className="h-6 w-auto object-contain shrink-0" />

      {/* `data-tour`: âncoras do tour guiado (src/tour). São só marcas de
          posição — nada de comportamento depende delas. */}
      <nav data-tour="topnav" className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
        {itens.map((i) =>
          /* Quem abre painel não navega: a tela de trás continua inteira, que é
             o ponto do Help Desk (ver `NavItem.painel`). */
          i.painel ? (
            <button
              key={i.to}
              type="button"
              data-tour={`nav-${i.to.replace("/", "")}`}
              onClick={() => abrirSuporte()}
              className={cx(
                "flex items-center gap-2 px-3 h-9 rounded-btn text-[13px] font-semibold whitespace-nowrap transition-colors",
                painelAberto ? "bg-primary-soft text-primary-dark" : "text-ink-2 hover:text-ink hover:bg-[#F5F6F8]"
              )}
            >
              <span className="shrink-0">{i.icon}</span>
              <span className="hidden md:inline">{i.label}</span>
            </button>
          ) : (
            <NavLink
              key={i.to}
              data-tour={`nav-${i.to.replace("/", "")}`}
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
                {/* Só onde a pendência pode ser resolvida — ver `NavItem.pendencias`. */}
                {i.pendencias && (
                  <NotifDot
                    n={porRecurso[i.recurso] ?? 0}
                    title={`${porRecurso[i.recurso] ?? 0} pendência(s)`}
                    className="left-auto -right-2 -top-2"
                  />
                )}
              </span>
              {/* O rótulo agora cabe: são cinco botões, não sete. Ele some só no
                  celular, onde nem cinco cabem. */}
              <span className="hidden md:inline">{i.label}</span>
            </NavLink>
          )
        )}
      </nav>

      <div className="flex items-center gap-2 shrink-0">
        {/* Tudo o que é cobrado da pessoa, em qualquer projeto — ver SinoPendencias. */}
        <SinoPendencias />
        {/* O nome deixou de ser enfeite: é o botão da PRÓPRIA CONTA, onde se
            troca a senha (ver `MinhaContaModal`). No celular fica só o avatar —
            o rótulo não cabe —, mas a porta continua existindo, que é o que
            importa: trocar a senha não pode depender de estar no computador. */}
        <button
          type="button"
          onClick={() => setMinhaConta(true)}
          title="Minha conta — trocar senha"
          className="flex items-center gap-2 rounded-btn px-1.5 py-1 hover:bg-[#F5F6F8] transition-colors"
        >
          <Avatar nome={usuario.nome} size={32} />
          <div className="hidden sm:block leading-tight min-w-0 text-left">
            <div className="text-[12.5px] font-bold text-ink truncate max-w-[150px]">{usuario.nome}</div>
            <div className="text-[10.5px] text-ink-3">{usuario.areaNome ?? ROTULO_PAPEL[usuario.papel]}</div>
          </div>
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
          <span className="hidden sm:inline">Sair</span>
        </Button>
        {minhaConta && <MinhaContaModal onClose={() => setMinhaConta(false)} />}
      </div>
    </header>
  );
}
