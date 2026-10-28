/**
 * Detalhamento de um mês do calendário — a régua de dias, com os dias de cada
 * projeto PINTADOS.
 *
 * É a resposta à pergunta que o card do mês não responde: "em QUE dias isso
 * acontece?". Cada projeto vira uma linha, e cada dia em que ele acontece fica
 * pintado de ponta a ponta na célula; a seta na ponta aparece quando o projeto
 * começa antes ou termina depois do mês que está aberto.
 *
 * SEM PÍLULAS, SEM RÓTULOS, UMA COR SÓ (25/09/2026). Antes cada projeto tinha a
 * sua cor, cada etapa tinha o seu tom, e dentro da pílula vinha escrito
 * "MONTAGEM", "EVENTO", "DESMONTAGEM". A Pólobh pediu o contrário de tudo isso,
 * e o motivo é bom: num mês cheio, doze cores e três tons viram um mosaico em
 * que não se lê nada — e a pergunta que se faz aqui é só uma, "que dias estão
 * ocupados". Uma cor só, a laranja da casa, responde melhor. O que cada etapa
 * é continua a um passo de distância, no projeto.
 *
 * Pintar a CÉLULA, e não uma barra por cima dela, é o que mantém as divisórias
 * dos dias visíveis: a pessoa consegue contar os dias com o dedo.
 */
import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { IcChevron, IcFechar } from "@/components/icons";
import { cx } from "@/lib/format";
import {
  INICIAIS_SEMANA,
  MESES,
  diaDaSemana,
  blocosDoPeriodoNoMes,
  diasNoMes,
  fimDeSemana,
  hojeIso,
  isoDoDia,
  segmentosDoMes,
  type ProjetoNoCalendario,
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
    <div className="no-print fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-6">
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
                const encerrado = item.status === "Arquivado";
                // Bloco (etapa) de cada dia: a divisória entre etapas é mais
                // grossa que a divisória entre dias.
                const blocos = blocosDoPeriodoNoMes(item, ano, mes);
                const blocoDoDia = (d: number) => blocos.findIndex((b) => d >= b.diaInicio && d <= b.diaFim);
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
                      {/* Uma cor só, como no resto do quadro: a identidade do
                          projeto é o nome, não o tom. */}
                      <span className="h-6 w-1.5 rounded-full shrink-0 bg-primary" />
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

                    {/* OS DIAS. Cada célula é pintada por inteiro quando o
                        projeto acontece naquele dia — é isto que substituiu a
                        pílula. A célula pintada é clicável: quem vê o dia
                        ocupado quer, quase sempre, abrir o projeto. */}
                    {Array.from({ length: dias }, (_, i) => {
                      const d = i + 1;
                      const iso = isoDoDia(ano, mes, d);
                      const ocupado = d >= seg.diaInicio && d <= seg.diaFim;
                      const ehHoje = iso === hoje;

                      if (!ocupado) {
                        return (
                          <div
                            key={d}
                            style={{ gridRow: 1, gridColumn: d + 1 }}
                            className={cx(
                              "h-[46px] border-l border-border-soft",
                              fimDeSemana(ano, mes, d) && "bg-[#F1F3F7]",
                              feriados?.has(iso) && "bg-[#EFE7FB]",
                              ehHoje && "bg-primary-soft"
                            )}
                          />
                        );
                      }

                      const viraEtapa = d > seg.diaInicio && blocoDoDia(d) !== blocoDoDia(d - 1);
                      return (
                        <button
                          key={d}
                          onClick={() => navigate(`/projetos/${item.id}`)}
                          title={`${item.titulo}${item.local ? ` · ${item.local}` : ""}`}
                          style={{ gridRow: 1, gridColumn: d + 1 }}
                          className={cx(
                            "h-[46px] bg-primary",
                            viraEtapa ? "border-l-[3px] border-white" : "border-l border-white/25",
                            "hover:brightness-105 transition-all",
                            // O dia de hoje precisa continuar localizável mesmo
                            // dentro de uma sequência pintada — sem isto, a
                            // coluna de hoje some no meio do laranja.
                            ehHoje && "ring-2 ring-inset ring-white/80",
                            encerrado && "opacity-45"
                          )}
                        />
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
            O dia pintado é dia ocupado — a marcação cobre o período completo do projeto; a
            divisória mais grossa separa montagem, evento e desmontagem.
          </span>
          <span className="ml-auto flex items-center gap-3 text-[11px] text-ink-3 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] bg-primary" /> projeto</span>
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
