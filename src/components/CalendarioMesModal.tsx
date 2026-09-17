/**
 * Detalhamento de um mês do calendário — a régua de dias com a barrinha de
 * cada projeto.
 *
 * É a resposta à pergunta que o card do mês não responde: "em QUE dias isso
 * acontece?". Cada projeto vira uma linha; a barra percorre do primeiro ao
 * último dia do evento, e ganha uma seta na ponta quando o projeto começa antes
 * ou termina depois do mês que está aberto.
 */
import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { IcChevron, IcFechar } from "@/components/icons";
import { cx } from "@/lib/format";
import {
  ETAPAS_DO_QUADRO,
  INICIAIS_SEMANA,
  MESES,
  OPACIDADE_ETAPA,
  ROTULO_ETAPA,
  diaDaSemana,
  diasNoMes,
  fimDeSemana,
  hojeIso,
  isoDoDia,
  segmentosDoMes,
  trechosDeEtapaNoMes,
  type ProjetoNoCalendario,
  type TrechoEtapaMes,
} from "@/domain/calendario";

/** Largura mínima de um dia. Abaixo disso a régua vira um borrão e passa a rolar. */
const LARGURA_DIA = 30;
/**
 * Coluna dos nomes: encolhe no celular para sobrar régua, e para de crescer no
 * desktop para o mês não ficar espremido num canto.
 */
const COLUNA_NOME = "clamp(132px, 38vw, 260px)";

export function CalendarioMesModal({
  ano,
  mes,
  itens,
  feriados,
  onTrocarMes,
  onFechar,
}: {
  ano: number;
  mes: number;
  /** Projetos do ano inteiro — o recorte do mês é feito aqui dentro. */
  itens: ProjetoNoCalendario[];
  /** Feriados do ano, por data (ver `domain/feriados`). */
  feriados?: Map<string, { nome: string; origem: string }>;
  /** Navega para outro mês (pode passar de -1 a 12: a tela vira o ano). */
  onTrocarMes: (mes: number) => void;
  onFechar: () => void;
}) {
  const navigate = useNavigate();
  const dias = diasNoMes(ano, mes);
  const hoje = hojeIso();
  const segmentos = useMemo(() => segmentosDoMes(itens, ano, mes), [itens, ano, mes]);

  // Esc fecha e as setas do teclado trocam de mês — a tela é para folhear.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
      if (e.key === "ArrowLeft") onTrocarMes(mes - 1);
      if (e.key === "ArrowRight") onTrocarMes(mes + 1);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [mes, onFechar, onTrocarMes]);

  const diasComProjeto = useMemo(() => {
    const ocupados = new Set<number>();
    for (const s of segmentos) for (let d = s.diaInicio; d <= s.diaFim; d++) ocupados.add(d);
    return ocupados.size;
  }, [segmentos]);

  const template = `${COLUNA_NOME} repeat(${dias}, minmax(${LARGURA_DIA}px, 1fr))`;
  const larguraMinima = `calc(${COLUNA_NOME} + ${dias * LARGURA_DIA}px)`;

  return createPortal(
    <div className="no-print fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onFechar} />
      <div className="relative w-full max-w-[1280px] max-h-[92vh] flex flex-col bg-surface rounded-card-lg shadow-modal border border-border animate-[fadein_.14s_ease] overflow-hidden">
        {/* ---------------------------------- topo --------------------------------- */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border-soft">
          <div className="flex items-center gap-1 shrink-0">
            <BotaoSeta titulo="Mês anterior" onClick={() => onTrocarMes(mes - 1)} virada />
            <BotaoSeta titulo="Próximo mês" onClick={() => onTrocarMes(mes + 1)} />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-bold text-[19px] text-ink tracking-[-0.4px] leading-tight">
              {MESES[mes]} <span className="text-ink-3 font-semibold">de {ano}</span>
            </h3>
            <p className="text-[12.5px] text-ink-2 mt-0.5">
              {segmentos.length === 0
                ? "Nenhum projeto neste mês."
                : `${segmentos.length} projeto${segmentos.length > 1 ? "s" : ""} · ${diasComProjeto} dia${diasComProjeto > 1 ? "s" : ""} com projeto acontecendo`}
            </p>
          </div>
          <button
            onClick={onFechar}
            title="Fechar"
            className="ml-auto shrink-0 h-9 w-9 grid place-items-center rounded-btn text-ink-2 hover:text-ink hover:bg-[#F1F2F5] transition-colors"
          >
            <IcFechar width={18} height={18} />
          </button>
        </div>

        {/* -------------------------------- régua ---------------------------------- */}
        <div className="flex-1 overflow-auto">
          {segmentos.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-ink-2 text-sm">Nada marcado em {MESES[mes].toLowerCase()}.</p>
              <p className="text-ink-3 text-[12.5px] mt-1">
                Os projetos entram aqui sozinhos assim que recebem datas no cronograma.
              </p>
            </div>
          ) : (
            <div style={{ minWidth: larguraMinima }}>
              {/* cabeçalho dos dias */}
              <div className="grid sticky top-0 z-20 bg-surface border-b border-border" style={{ gridTemplateColumns: template }}>
                <div className="sticky left-0 z-30 bg-surface border-r border-border-soft px-4 py-2 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-ink-3 flex items-end">
                  Projeto
                </div>
                {Array.from({ length: dias }, (_, i) => {
                  const d = i + 1;
                  const iso = isoDoDia(ano, mes, d);
                  const ehHoje = iso === hoje;
                  const feriado = feriados?.get(iso);
                  return (
                    <div
                      key={d}
                      title={feriado?.nome}
                      className={cx(
                        "py-1.5 text-center border-l border-border-soft",
                        fimDeSemana(ano, mes, d) && "bg-[#F1F3F7]",
                        // FERIADO tem cor própria (15/09/2026): quem marca
                        // montagem precisa ver, antes de marcar, o dia em que a
                        // cidade para. Vem por cima do fim de semana — um
                        // feriado numa segunda é o que importa enxergar.
                        feriado && "bg-[#EFE7FB]"
                      )}
                    >
                      <div
                        className={cx(
                          "mx-auto w-6 h-6 grid place-items-center rounded-full text-[12px] font-bold tabular-nums",
                          ehHoje ? "bg-primary text-[#2A1602]" : "text-ink"
                        )}
                      >
                        {d}
                      </div>
                      <div className="text-[9.5px] font-bold uppercase text-ink-3 mt-0.5">
                        {INICIAIS_SEMANA[diaDaSemana(ano, mes, d)]}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* uma linha por projeto */}
              {segmentos.map((seg) => {
                const { item } = seg;
                const trechos = trechosDeEtapaNoMes(item, ano, mes);
                const encerrado = item.status === "Arquivado";
                return (
                  <div
                    key={item.id}
                    className="grid items-center border-b border-border-soft last:border-b-0 hover:bg-[#FBFBFC] transition-colors"
                    style={{ gridTemplateColumns: template }}
                  >
                    <button
                      onClick={() => navigate(`/projetos/${item.id}`)}
                      title={`Abrir ${item.titulo}`}
                      style={{ gridRow: 1, gridColumn: 1 }}
                      className="sticky left-0 z-10 bg-surface hover:bg-[#F7F8FA] border-r border-border-soft h-[46px] px-4 flex items-center gap-2.5 text-left min-w-0 transition-colors"
                    >
                      <span className="h-6 w-1.5 rounded-full shrink-0" style={{ background: item.cor.forte }} />
                      <span className="min-w-0">
                        <span className={cx("block text-[13px] font-bold text-ink truncate", encerrado && "line-through text-ink-3")}>
                          {item.titulo}
                        </span>
                        {/* A PRODUTORA RESPONSÁVEL no lugar do cliente
                            (15/09/2026): quem abre o detalhamento do mês está
                            procurando quem toca o quê, e o cliente já está no
                            título do projeto. */}
                        {(item.produtora || item.cliente) && (
                          <span className="block text-[11px] text-ink-3 truncate">{item.produtora || item.cliente}</span>
                        )}
                      </span>
                    </button>

                    {/* fundo dos dias (fim de semana e hoje) */}
                    {Array.from({ length: dias }, (_, i) => {
                      const d = i + 1;
                      const iso = isoDoDia(ano, mes, d);
                      return (
                        <div
                          key={d}
                          style={{ gridRow: 1, gridColumn: d + 1 }}
                          className={cx(
                            "h-[46px] border-l border-border-soft",
                            fimDeSemana(ano, mes, d) && "bg-[#F1F3F7]",
                            feriados?.has(iso) && "bg-[#EFE7FB]",
                            iso === hoje && "bg-primary-soft"
                          )}
                        />
                      );
                    })}

                    {/* A BARRA, ETAPA POR ETAPA (15/09/2026).
                        Ela cobre o período inteiro — montagem, evento e
                        desmontagem —, e cada trecho ganha um tom da MESMA cor
                        do projeto: a identidade que faz reconhecer o projeto de
                        longe continua sendo a cor, e o que muda é a intensidade.
                        Cores diferentes por etapa competiriam com ela, e o
                        quadro viraria um mosaico sem dono.
                        Quando não há etapa desenhável (projeto antigo, só com o
                        campo legado), cai na barra inteira de sempre. */}
                    {(trechos.length ? trechos : [{ etapa: "evento", diaInicio: seg.diaInicio, diaFim: seg.diaFim }] as TrechoEtapaMes[]).map((t: TrechoEtapaMes) => {
                      const larguraTrecho = t.diaFim - t.diaInicio + 1;
                      const primeiro = t.diaInicio === seg.diaInicio;
                      const ultimo = t.diaFim === seg.diaFim;
                      return (
                        <div
                          key={`${t.etapa}-${t.diaInicio}`}
                          style={{ gridRow: 1, gridColumn: `${t.diaInicio + 1} / span ${larguraTrecho}` }}
                          className="relative z-[5] px-[1px] first:pl-[3px] last:pr-[3px]"
                        >
                          <button
                            onClick={() => navigate(`/projetos/${item.id}`)}
                            title={`${item.titulo} — ${ROTULO_ETAPA[t.etapa]}${item.local ? ` · ${item.local}` : ""}`}
                            style={{
                              background: `linear-gradient(135deg, ${item.cor.forte}, ${item.cor.forte}D9)`,
                              opacity: encerrado ? 0.45 : OPACIDADE_ETAPA[t.etapa],
                            }}
                            className={cx(
                              "w-full h-[30px] flex items-center justify-center gap-1 text-white overflow-hidden",
                              "shadow-[0_4px_10px_-6px_rgba(16,30,66,.6)] hover:brightness-110 transition-all",
                              primeiro && seg.continuaAntes ? "rounded-l-[3px]" : primeiro ? "rounded-l-pill" : "rounded-l-[2px]",
                              ultimo && seg.continuaDepois ? "rounded-r-[3px]" : ultimo ? "rounded-r-pill" : "rounded-r-[2px]"
                            )}
                          >
                            {primeiro && seg.continuaAntes && <span className="text-[11px] font-bold leading-none shrink-0">◄</span>}
                            {larguraTrecho > 1 && (
                              <span className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] whitespace-nowrap truncate min-w-0">
                                {ROTULO_ETAPA[t.etapa]}
                              </span>
                            )}
                            {ultimo && seg.continuaDepois && <span className="text-[11px] font-bold leading-none shrink-0">►</span>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* -------------------------------- rodapé --------------------------------- */}
        <div className="px-5 py-3 border-t border-border-soft bg-[#FCFCFD] flex items-center gap-3 flex-wrap">
          <span className="text-[11.5px] text-ink-3">
            A barra considera todas as etapas do projeto — Montagem, Evento e Desmontagem.
          </span>
          <span className="ml-auto flex items-center gap-3 text-[11px] text-ink-3 flex-wrap">
            {ETAPAS_DO_QUADRO.map((etapa) => (
              <span key={etapa} className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-[4px] bg-ink-2"
                  style={{ opacity: OPACIDADE_ETAPA[etapa] }}
                />
                {ROTULO_ETAPA[etapa].toLowerCase()}
              </span>
            ))}
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] bg-[#F1F3F7] border border-border" /> fim de semana</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] bg-[#EFE7FB] border border-[#C9B6EA]" /> feriado</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] bg-primary-soft border border-active-border" /> hoje</span>
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Seta redonda do topo (a virada aponta para a esquerda). */
function BotaoSeta({ titulo, onClick, virada }: { titulo: string; onClick: () => void; virada?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className="h-9 w-9 grid place-items-center rounded-full border-[1.5px] border-border text-ink-2 hover:text-ink hover:border-primary/50 hover:bg-primary-soft transition-colors"
    >
      <IcChevron width={16} height={16} className={virada ? "rotate-180" : undefined} />
    </button>
  );
}
