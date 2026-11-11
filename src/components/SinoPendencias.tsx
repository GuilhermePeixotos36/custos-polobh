/**
 * Sininho de pendências — o atalho do canto superior direito.
 *
 * A pílula do canto inferior anda pelas pendências DA TELA aberta; o sininho é o
 * lugar onde a pessoa vê tudo o que está devendo no sistema, sem precisar
 * adivinhar em qual projeto olhar. Clicar num bloco leva à tela da pendência com
 * a câmera em cima dela e o item latejando — exatamente o mesmo salto da pílula
 * (ver `rotaDaPendencia` e `focarPendencia`).
 *
 * A lista é a MESMA de todos os badges do sistema (`useMinhasPendencias`): o
 * número do sininho é a soma dos blocos que ele abre, sempre.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { IcBell } from "@/components/icons";
import { NotifDot } from "@/components/NotifDot";
import { AvisosNoAparelho } from "@/components/AvisosNoAparelho";
import { focarPendencia } from "@/lib/focoPendencia";
import { cx } from "@/lib/format";
import { rotaDaPendencia, type Pendencia } from "@/domain/pendencias";
import { usePendencias, useMinhasPendencias } from "@/store/pendencias";

/** Etiqueta curta do bloco — diz de que natureza é a cobrança. */
const ETIQUETA: Record<string, string> = {
  "ec.observacao": "Comentário",
  "os.observacao": "Comentário",
  "checklist.observacao": "Comentário",
  "checklist.atrasado": "Atrasada",
  "checklist.vencendo": "Para hoje",
  "ec.emitir": "A emitir",
  "ec.fornecedor": "Fornecedor",
  "os.emitir": "OS a enviar",
  "os.fase": "Etapa da OS",
  "os.cronograma": "Cronograma",
  "os.credenciamento": "Credenciamento",
  "projeto.semEc": "Sem EC",
  "projeto.semPastaDropbox": "Pasta Dropbox",
};

/** Vermelho para o que já passou do prazo; o resto é aviso normal. */
const urgente = (tipo: string) => tipo === "checklist.atrasado";

export function SinoPendencias() {
  const { itens } = useMinhasPendencias();
  const projetos = usePendencias((s) => s.projetos);
  const navigate = useNavigate();
  const local = useLocation();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou apertar Esc — é um menu, não um painel fixo.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  /** Agrupado por projeto: a mesma pendência solta numa lista longa não diz nada. */
  const grupos = useMemo(() => {
    const nome = new Map(projetos.map((p) => [p.id, p.nome || p.info.titulo || "Projeto"]));
    const porProjeto = new Map<string, { titulo: string; itens: Pendencia[] }>();
    for (const p of itens) {
      const chave = p.projetoId ?? "";
      const grupo = porProjeto.get(chave) ?? { titulo: nome.get(chave) ?? "Outras", itens: [] };
      grupo.itens.push(p);
      porProjeto.set(chave, grupo);
    }
    return [...porProjeto.values()];
  }, [itens, projetos]);

  /**
   * Leva à pendência: guarda o alvo, navega e deixa a tela de destino rolar até
   * o item e fazê-lo latejar. Se já estamos na tela certa, `focarPendencia`
   * resolve na hora e a navegação nem acontece.
   */
  const irPara = (p: Pendencia) => {
    setAberto(false);
    if (p.ancora) focarPendencia({ ancora: p.ancora, observacaoId: p.observacaoId, campos: p.campos });
    const rota = rotaDaPendencia(p);
    if (rota !== `${local.pathname}${local.search}`) navigate(rota);
  };

  return (
    <div className="relative shrink-0" ref={caixa}>
      <button
        data-tour="sino"
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={`${itens.length} pendência(s)`}
        aria-expanded={aberto}
        title={itens.length ? `${itens.length} pendência(s)` : "Nenhuma pendência"}
        className={cx(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-btn transition-colors",
          aberto ? "bg-primary-soft text-primary-dark" : "text-ink-2 hover:text-ink hover:bg-[#F5F6F8]"
        )}
      >
        <IcBell width={18} height={18} />
        <NotifDot n={itens.length} className="left-auto -right-1 -top-1" />
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Minhas pendências"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(24rem,calc(100vw-1.5rem))] rounded-card border border-border bg-white shadow-modal overflow-hidden"
        >
          <div className="flex items-baseline gap-2 px-3.5 py-2.5 border-b border-border-soft">
            <span className="text-[13px] font-extrabold text-ink">Minhas pendências</span>
            <span className="text-[11.5px] font-bold text-ink-3 ml-auto">{itens.length}</span>
          </div>

          {itens.length === 0 ? (
            <p className="px-3.5 py-6 text-[12.5px] text-ink-3 text-center">
              Nada pendente por aqui. O que for cobrado de você aparece neste sino.
            </p>
          ) : (
            <div className="max-h-[min(28rem,70vh)] overflow-y-auto py-1.5">
              {grupos.map((g) => (
                <div key={g.titulo} className="px-1.5 pb-1.5">
                  <div className="px-2 pt-1.5 pb-1 text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-ink-3 truncate">
                    {g.titulo}
                  </div>
                  {g.itens.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => irPara(p)}
                      className="w-full text-left rounded-btn px-2 py-2 hover:bg-[#F5F6F8] transition-colors"
                    >
                      <span
                        className={cx(
                          "inline-block text-[10px] font-extrabold uppercase tracking-[0.04em] rounded-full px-1.5 py-0.5 mb-1",
                          urgente(p.tipo) ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary-dark"
                        )}
                      >
                        {ETIQUETA[p.tipo] ?? "Pendência"}
                      </span>
                      <span className="block text-[12.5px] leading-snug text-ink-2 line-clamp-2">{p.titulo}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Liga os avisos do aparelho — aqui todo mundo alcança (11/11/2026). */}
          <div className="border-t border-border-soft px-3.5 py-2.5 bg-[#FAFBFC]">
            <AvisosNoAparelho compacto />
          </div>
        </div>
      )}
    </div>
  );
}
