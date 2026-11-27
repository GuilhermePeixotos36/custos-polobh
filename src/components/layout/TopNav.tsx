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

/** A curva da abertura: sai rápido e assenta devagar, sem quique. */
const CURVA_MENU = "ease-[cubic-bezier(0.22,1,0.36,1)]";

/** O botão de uma tela no menu: quadrado em repouso, cresce quando o nome abre. */
const classeDoItem = (ativo: boolean) =>
  cx(
    "group flex h-9 shrink-0 items-center rounded-btn px-2.5 text-[13px] font-semibold whitespace-nowrap",
    "transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
    ativo ? "bg-primary-soft text-primary-dark" : "text-ink-2 hover:bg-[#F5F6F8] hover:text-ink"
  );

/**
 * O nome da tela, que abre para a direita. `aberto` o mantém à vista (a tela
 * atual); nos outros, quem abre é o mouse ou o foco do teclado.
 */
function RotuloDoItem({ aberto, children }: { aberto: boolean; children: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "grid transition-[grid-template-columns] duration-300 motion-reduce:transition-none",
        CURVA_MENU,
        aberto ? "grid-cols-[1fr]" : "grid-cols-[0fr] group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr]"
      )}
    >
      <span className="min-w-0 overflow-hidden">
        <span
          className={cx(
            "block pl-2 transition-[opacity,transform] duration-200 motion-reduce:transition-none",
            CURVA_MENU,
            aberto
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:delay-75 group-focus-visible:opacity-100 group-focus-visible:translate-x-0"
          )}
        >
          {children}
        </span>
      </span>
    </span>
  );
}

/** Barra de navegação superior (substitui a antiga sidebar lateral). */
export function TopNav() {
  const { usuario, pode, sair } = useAuth();
  const navigate = useNavigate();
  const { porRecurso } = useMinhasPendencias();
  const painelAberto = useSuporte((s) => s.aberto);
  const [minhaConta, setMinhaConta] = useState(false);
  if (!usuario) return null;

  const itens = NAV.filter((i) => pode(i.recurso) || !!i.ou?.some(pode));

  return (
    <header className="no-print sticky top-0 z-30 h-[var(--altura-topnav)] bg-surface border-b border-border flex items-center gap-3 px-3 md:px-5">
      <img src="/polobh-logo.png" alt="Pólobh" className="h-6 w-auto object-contain shrink-0" />

      {/* `data-tour`: âncoras do tour guiado (src/tour). São só marcas de
          posição — nada de comportamento depende delas. */}
      {/* O MENU EM ÍCONES (27/11/2026). Em repouso cada tela é só o seu ícone; o
          nome abre para a direita ao passar o mouse (ou ao chegar pelo teclado)
          e recolhe ao sair. A tela em que se está fica aberta e laranja, como
          sempre — é ela que diz "você está aqui". Com nove telas no menu, os
          nomes todos à vista já não cabiam num notebook.

          A abertura é a coluna de uma grade indo de 0fr a 1fr: a largura anima
          até o tamanho exato de cada nome, sem medir nada. O texto entra um
          instante depois, deslizando 4px — é o que dá a sensação de "abrir". */}
      <nav data-tour="topnav" className="hidden md:flex items-center gap-0.5 overflow-x-auto flex-1 min-w-0">
        {itens.map((i) =>
          /* Quem abre painel não navega: a tela de trás continua inteira, que é
             o ponto do Help Desk (ver `NavItem.painel`). */
          i.painel ? (
            <button
              key={i.to}
              type="button"
              data-tour={`nav-${i.to.replace("/", "")}`}
              onClick={() => abrirSuporte()}
              aria-label={i.label}
              className={classeDoItem(painelAberto)}
            >
              <span className="shrink-0">{i.icon}</span>
              <RotuloDoItem aberto={painelAberto}>{i.label}</RotuloDoItem>
            </button>
          ) : (
            <NavLink
              key={i.to}
              data-tour={`nav-${i.to.replace("/", "")}`}
              to={i.to}
              end={i.to === "/"}
              aria-label={i.label}
              className={({ isActive }) => classeDoItem(isActive)}
            >
              {({ isActive }) => (
                <>
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
                  <RotuloDoItem aberto={isActive}>{i.label}</RotuloDoItem>
                </>
              )}
            </NavLink>
          )
        )}
      </nav>
      {/* CELULAR (15/10/2026): os ícones do menu disputavam a barra de cima com
          logo, sino, avatar e sair — cabiam dois e meio, e o resto ficava cortado
          sem dar sinal de que rolava. No celular o menu desce para uma barra fixa
          embaixo, com todos os itens e o nome de cada um. */}
      <nav
        aria-label="Menu"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 h-[var(--altura-nav-celular)] bg-surface border-t border-border flex items-stretch overflow-x-auto pb-[env(safe-area-inset-bottom)]"
      >
        {itens.map((i) => {
          const conteudo = (ativo: boolean) => (
            <>
              <span className="relative shrink-0">
                {i.icon}
                {i.pendencias && (
                  <NotifDot
                    n={porRecurso[i.recurso] ?? 0}
                    title={`${porRecurso[i.recurso] ?? 0} pendência(s)`}
                    className="left-auto -right-2 -top-2"
                  />
                )}
              </span>
              <span className={cx("text-[10px] leading-tight truncate max-w-full", ativo ? "font-bold" : "font-semibold")}>
                {i.rotuloCurto ?? i.label}
              </span>
            </>
          );
          const base = "flex-1 min-w-[60px] flex flex-col items-center justify-center gap-0.5 px-1";
          return i.painel ? (
            <button
              key={i.to}
              type="button"
              onClick={() => abrirSuporte()}
              className={cx(base, painelAberto ? "text-primary-dark" : "text-ink-2")}
            >
              {conteudo(painelAberto)}
            </button>
          ) : (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === "/"}
              className={({ isActive }) => cx(base, isActive ? "text-primary-dark bg-primary-soft/60" : "text-ink-2")}
            >
              {({ isActive }) => conteudo(isActive)}
            </NavLink>
          );
        })}
      </nav>
      <div className="flex-1 md:hidden" />

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
