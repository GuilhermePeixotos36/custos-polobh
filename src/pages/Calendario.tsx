/**
 * Calendário anual dos projetos — o quadro do ano da produção.
 *
 * Nasceu para substituir o quadro preto onde a equipe escrevia à mão tudo o que
 * aconteceria no ano: bater o olho e ver o ano inteiro. São doze cards, um por
 * mês; clicar num mês abre a régua de dias, onde cada projeto vira uma barrinha
 * que corre do primeiro ao último dia do evento.
 *
 * O que entra é a DATA DO PROJETO (etapa "Evento" do cronograma). Montagem,
 * desmontagem, alinhamentos e ensaios ficam de fora: aqui interessa quando o
 * projeto acontece. Nada é digitado duas vezes — o quadro lê os projetos que já
 * existem e se preenche sozinho conforme a equipe cadastra as datas.
 */
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { Card, Badge, Button, EmptyState, AvisoErro, Select, type Tom } from "@/components/ui";
import { IcChevron, IcSearch, IcCalendar, IcGrid, IcList } from "@/components/icons";
import { CalendarioMesModal } from "@/components/CalendarioMesModal";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { cx, dataBR } from "@/lib/format";
import {
  MESES,
  anosComProjetos,
  contagemPorMes,
  diasNoMes,
  hojeIso,
  montarCalendario,
  projetosDoAno,
  rotuloDias,
  rotuloPeriodo,
  segmentosDoMes,
  trilhasDoMes,
  type ProjetoNoCalendario,
  type SegmentoMes,
} from "@/domain/calendario";
import type { StatusProjeto } from "@/data/types";

const tomStatus: Record<StatusProjeto, Tom> = {
  Ativo: "success",
  Arquivado: "neutral",
  Concluido: "info",
  Cancelado: "danger",
};

type FiltroStatus = "Todos" | "Ativos" | "Encerrados";
const FILTROS: { key: FiltroStatus; label: string }[] = [
  { key: "Todos", label: "Todos" },
  { key: "Ativos", label: "Ativos" },
  { key: "Encerrados", label: "Encerrados" },
];

/**
 * Quantas trilhas cabem no mini-gráfico do card do mês sem ele virar um borrão.
 *
 * Isto é a MANCHA do mês — a leitura de "quão cheio está" —, não a lista. Ela
 * continua limitada de propósito: com dez trilhas de 7px o desenho vira um
 * borrão cinza que não diz nada. Quem precisa do detalhe tem a lista logo
 * abaixo, que agora mostra tudo.
 */
const TRILHAS_NO_CARD = 3;

export function Calendario() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const hoje = hojeIso();
  const anoAtual = Number(hoje.slice(0, 4));

  const { data, loading, error, reload } = useAsync(
    async () => {
      const [projetos, ecs] = await Promise.all([repo.projetos.listar(), repo.ecs.listar()]);
      return { projetos, ecs };
    },
    [],
    { oQue: "o calendário de projetos" }
  );

  /**
   * Ano, mês aberto e vista moram na URL: quem manda o link do calendário para
   * a colega manda o que está vendo, e recarregar a página não joga a pessoa de
   * volta para janeiro.
   */
  const ano = Number(params.get("ano")) || anoAtual;
  const mesParam = Number(params.get("mes"));
  const mesAberto = mesParam >= 1 && mesParam <= 12 ? mesParam - 1 : null;
  const vista = params.get("vista") === "lista" ? "lista" : "calendario";

  const mudarParams = (patch: Record<string, string | null>) => {
    const proximos = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) proximos.delete(k);
      else proximos.set(k, v);
    }
    setParams(proximos, { replace: true });
  };

  const irParaAno = (novo: number) => mudarParams({ ano: String(novo), mes: null });
  const abrirMes = (mes: number) => mudarParams({ ano: String(ano), mes: String(mes + 1) });

  /** Vira o ano quando as setas do mês passam de dezembro ou de janeiro. */
  const trocarMes = (mes: number) => {
    if (mes < 0) mudarParams({ ano: String(ano - 1), mes: "12" });
    else if (mes > 11) mudarParams({ ano: String(ano + 1), mes: "1" });
    else mudarParams({ mes: String(mes + 1) });
  };

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroStatus>("Todos");
  const [modalidade, setModalidade] = useState("");

  const { itens, semData } = useMemo(
    () => montarCalendario(data?.projetos ?? [], data?.ecs ?? []),
    [data]
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens
      .filter((i) => (filtro === "Todos" ? true : filtro === "Ativos" ? i.status === "Ativo" : i.status !== "Ativo"))
      .filter((i) => !modalidade || i.modalidade === modalidade)
      .filter((i) => !q || `${i.titulo} ${i.cliente} ${i.local}`.toLowerCase().includes(q));
  }, [itens, busca, filtro, modalidade]);

  const doAno = useMemo(() => projetosDoAno(filtrados, ano), [filtrados, ano]);
  const contagem = useMemo(() => contagemPorMes(doAno, ano), [doAno, ano]);
  const anosDisponiveis = useMemo(() => anosComProjetos(itens), [itens]);

  const mesMaisCheio = useMemo(() => {
    const pico = Math.max(0, ...contagem);
    return pico === 0 ? null : { mes: contagem.indexOf(pico), n: pico };
  }, [contagem]);

  /** O próximo projeto a acontecer (ou o que está em cartaz hoje) — de qualquer ano. */
  const proximo = useMemo(
    () => filtrados.find((i) => i.fim >= hoje) ?? null,
    [filtrados, hoje]
  );

  const filtrando = Boolean(busca.trim() || modalidade || filtro !== "Todos");

  return (
    <PageShell
      title="Calendário Pólobh"
      subtitle="O ano inteiro num quadro só: todo projeto do primeiro ao último dia."
      topAction={
        <div className="flex items-center gap-2">
          {ano !== anoAtual && (
            <Button size="sm" variant="text" onClick={() => irParaAno(anoAtual)}>
              Voltar para {anoAtual}
            </Button>
          )}
          <div className="flex items-center gap-1 rounded-pill border-[1.5px] border-border bg-surface p-1">
            <SetaAno titulo="Ano anterior" onClick={() => irParaAno(ano - 1)} virada />
            <span className="font-display font-extrabold text-[19px] text-ink tabular-nums px-2 leading-none">{ano}</span>
            <SetaAno titulo="Próximo ano" onClick={() => irParaAno(ano + 1)} />
          </div>
        </div>
      }
      acoes={
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 rounded-btn border-[1.5px] border-border bg-surface p-1">
              <BotaoVista ativo={vista === "calendario"} onClick={() => mudarParams({ vista: null })} icone={<IcGrid width={15} height={15} />}>
                Calendário
              </BotaoVista>
              <BotaoVista ativo={vista === "lista"} onClick={() => mudarParams({ vista: "lista" })} icone={<IcList width={15} height={15} />}>
                Lista
              </BotaoVista>
            </div>
            <div className="flex gap-1.5">
              {FILTROS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFiltro(f.key)}
                  className={cx(
                    "h-9 px-3.5 rounded-btn text-[13px] font-bold border-[1.5px] transition-colors",
                    filtro === f.key
                      ? "bg-primary-soft border-active-border text-primary-dark"
                      : "bg-surface border-[#D6D9E0] text-ink-2 hover:text-ink"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select className="!h-9 !w-auto min-w-[150px]" value={modalidade} onChange={(e) => setModalidade(e.target.value)}>
              <option value="">Toda modalidade</option>
              <option value="Corporativo">Corporativo</option>
              <option value="Cultural">Cultural</option>
            </Select>
            <div className="relative min-w-[220px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"><IcSearch width={16} height={16} /></span>
              <input
                className="w-full h-9 bg-surface border-[1.5px] border-[#BFC4CE] rounded-btn pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-3 input-focus"
                placeholder="Buscar projeto, cliente ou local…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
        </>
      }
    >
      {error ? (
        <AvisoErro erro={error} oQue="o calendário de projetos" onTentarDeNovo={reload} />
      ) : loading ? (
        <Card><div className="py-10 text-center text-ink-3 text-sm">Carregando o calendário…</div></Card>
      ) : (
        <>
          <FaixaResumo
            mesMaisCheio={mesMaisCheio}
            proximo={proximo}
            hoje={hoje}
            onAbrirMes={abrirMes}
          />

          {anosDisponiveis.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-3">Anos com projeto</span>
              {anosDisponiveis.map((a) => (
                <button
                  key={a}
                  onClick={() => irParaAno(a)}
                  className={cx(
                    "h-7 px-3 rounded-pill text-[12px] font-bold tabular-nums border transition-colors",
                    a === ano ? "bg-black text-white border-black" : "bg-surface text-ink-2 border-border hover:text-ink hover:border-ink-3"
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          )}

          {doAno.length === 0 ? (
            <Card>
              <EmptyState
                title={filtrando ? `Nenhum projeto em ${ano} com esses filtros` : `Nenhum projeto marcado em ${ano}`}
                hint={
                  filtrando
                    ? "Ajuste a busca ou os filtros — o quadro mostra tudo o que existe no ano."
                    : "Assim que um projeto receber a data do evento no cronograma, ele aparece aqui sozinho."
                }
                action={<Button size="sm" variant="secondary" onClick={() => navigate("/projetos")}>Ver projetos</Button>}
              />
            </Card>
          ) : vista === "lista" ? (
            <VistaLista itens={doAno} ano={ano} hoje={hoje} onAbrirMes={abrirMes} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {MESES.map((_, mes) => (
                <CardMes key={mes} ano={ano} mes={mes} itens={doAno} hoje={hoje} onAbrir={() => abrirMes(mes)} />
              ))}
            </div>
          )}

          {semData.length > 0 && <AvisoSemData semData={semData} />}
        </>
      )}

      {mesAberto !== null && (
        <CalendarioMesModal
          ano={ano}
          mes={mesAberto}
          itens={doAno}
          onTrocarMes={trocarMes}
          onFechar={() => mudarParams({ mes: null })}
        />
      )}
    </PageShell>
  );
}

/* ------------------------------- resumo ---------------------------------- */

/**
 * A faixa de resumo do ano — DUAS caixas, não quatro (revisão de 09/09/2026).
 *
 * A primeira linha eram dois contadores: "Projetos em 2026" e "Dias ocupados".
 * Os dois respondiam perguntas que ninguém faz olhando um calendário — o número
 * de projetos do ano já está escrito no badge de cada mês, somado a olho, e
 * "dias ocupados" é uma estatística, não uma informação de trabalho. Ocupavam
 * a primeira dobra inteira antes do quadro, que é o que a tela existe para
 * mostrar.
 *
 * Ficaram as duas que levam a algum lugar: o mês mais cheio (que abre o mês) e
 * o que está acontecendo agora ou vem a seguir.
 */
function FaixaResumo({
  mesMaisCheio,
  proximo,
  hoje,
  onAbrirMes,
}: {
  mesMaisCheio: { mes: number; n: number } | null;
  proximo: ProjetoNoCalendario | null;
  hoje: string;
  onAbrirMes: (mes: number) => void;
}) {
  const emCartaz = proximo ? proximo.inicio <= hoje : false;
  return (
    <div className="grid gap-3 sm:grid-cols-2 mb-5">
      <Bloco
        titulo="Mês mais cheio"
        valor={mesMaisCheio ? MESES[mesMaisCheio.mes] : "—"}
        legenda={mesMaisCheio ? `${mesMaisCheio.n} projeto${mesMaisCheio.n > 1 ? "s" : ""}` : "sem projetos no ano"}
        onClick={mesMaisCheio ? () => onAbrirMes(mesMaisCheio.mes) : undefined}
      />
      <div className="bg-surface border border-border rounded-card shadow-card p-4 min-w-0">
        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-ink-3">
          {emCartaz ? "Acontecendo agora" : "Próximo projeto"}
        </div>
        {proximo ? (
          <div className="mt-1.5 flex items-start gap-2 min-w-0">
            <span className="mt-1 h-4 w-1.5 rounded-full shrink-0" style={{ background: proximo.cor.forte }} />
            <div className="min-w-0">
              <div className="font-display font-bold text-[15px] text-ink truncate">{proximo.titulo}</div>
              <div className="text-[12px] text-ink-2 truncate">{rotuloPeriodo(proximo)}</div>
            </div>
          </div>
        ) : (
          <div className="mt-1.5 font-display font-bold text-[15px] text-ink-3">Nada à frente</div>
        )}
      </div>
    </div>
  );
}

function Bloco({
  titulo,
  valor,
  legenda,
  onClick,
}: {
  titulo: string;
  valor: string;
  legenda: string;
  onClick?: () => void;
}) {
  const conteudo = (
    <>
      <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-ink-3">{titulo}</div>
      <div className="font-display font-extrabold text-[24px] text-ink leading-tight mt-1 truncate">{valor}</div>
      <div className="text-[12px] text-ink-2 truncate">{legenda}</div>
    </>
  );
  if (!onClick) return <div className="bg-surface border border-border rounded-card shadow-card p-4 min-w-0">{conteudo}</div>;
  return (
    <button
      onClick={onClick}
      className="text-left bg-surface border border-border rounded-card shadow-card p-4 min-w-0 hover:border-primary/50 hover:bg-[#FFFDFA] transition-colors"
    >
      {conteudo}
    </button>
  );
}

/* ----------------------------- card do mês -------------------------------- */

function CardMes({
  ano,
  mes,
  itens,
  hoje,
  onAbrir,
}: {
  ano: number;
  mes: number;
  itens: ProjetoNoCalendario[];
  hoje: string;
  onAbrir: () => void;
}) {
  const segmentos = useMemo(() => segmentosDoMes(itens, ano, mes), [itens, ano, mes]);
  const trilhas = useMemo(() => trilhasDoMes(segmentos), [segmentos]);
  const dias = diasNoMes(ano, mes);
  const ehMesAtual = hoje.slice(0, 7) === `${ano}-${String(mes + 1).padStart(2, "0")}`;
  const diaDeHoje = ehMesAtual ? Number(hoje.slice(8, 10)) : 0;

  return (
    <button
      onClick={onAbrir}
      className={cx(
        "group text-left bg-surface border rounded-card-lg shadow-card p-4 flex flex-col gap-3 transition-all duration-150",
        "hover:-translate-y-[2px] hover:shadow-[0_18px_32px_-24px_rgba(16,30,66,.55)] hover:border-primary/45",
        ehMesAtual ? "border-primary/55 ring-2 ring-primary/15" : "border-border",
        segmentos.length === 0 && "bg-[#FBFBFC]"
      )}
    >
      <div className="flex items-center gap-2">
        <h3 className={cx("font-display font-bold text-[15px] tracking-[-0.2px]", segmentos.length ? "text-ink" : "text-ink-3")}>
          {MESES[mes]}
        </h3>
        {ehMesAtual && <span className="text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-primary-dark bg-primary-soft rounded-pill px-2 py-0.5">agora</span>}
        <span className="ml-auto">
          <Badge tom={segmentos.length ? "warning" : "neutral"}>
            {segmentos.length === 0 ? "livre" : `${segmentos.length} projeto${segmentos.length > 1 ? "s" : ""}`}
          </Badge>
        </span>
      </div>

      {/* mini-régua: a mancha do mês em três trilhas */}
      <div className="relative">
        <div className="flex flex-col gap-[3px]">
          {Array.from({ length: TRILHAS_NO_CARD }, (_, t) => (
            <div key={t} className="relative h-[7px] rounded-pill bg-[#EFF1F4] overflow-hidden">
              {(trilhas[t] ?? []).map((seg) => (
                <span
                  key={seg.item.id}
                  className="absolute inset-y-0 rounded-pill"
                  style={{
                    left: `${((seg.diaInicio - 1) / dias) * 100}%`,
                    width: `${((seg.diaFim - seg.diaInicio + 1) / dias) * 100}%`,
                    background: seg.item.cor.forte,
                    opacity: seg.item.status === "Cancelado" ? 0.4 : 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        {diaDeHoje > 0 && (
          <span
            className="absolute -top-[3px] -bottom-[3px] w-[2px] rounded-pill bg-ink/70"
            style={{ left: `${((diaDeHoje - 0.5) / dias) * 100}%` }}
            title="hoje"
          />
        )}
        <div className="flex justify-between text-[9px] font-bold text-ink-3 mt-1 tabular-nums">
          <span>01</span>
          <span>{dias}</span>
        </div>
      </div>

      {/* TODOS os projetos do mês, e não os quatro primeiros com um "+N" no fim
          (pedido de 09/09/2026). O corte economizava altura numa grade de doze
          cards iguais, mas escondia justamente o que se vem ver: num mês cheio,
          "+6 projetos" obrigava a abrir o mês para descobrir quais. O card cresce
          o quanto precisar, e a grade acompanha — as linhas de cards já se
          alinham pela altura do mais alto. */}
      <div className="flex flex-col gap-1.5 min-h-[52px]">
        {segmentos.length === 0 ? (
          <span className="text-[12px] text-ink-3 italic">Nenhum projeto neste mês</span>
        ) : (
          segmentos.map((seg) => <LinhaProjetoCard key={seg.item.id} seg={seg} />)
        )}
      </div>

      <span className="text-[11.5px] font-bold text-ink-3 group-hover:text-primary-dark transition-colors flex items-center gap-1 mt-auto">
        Ver os dias <IcChevron width={13} height={13} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function LinhaProjetoCard({ seg }: { seg: SegmentoMes }) {
  const { item } = seg;
  return (
    <span className="flex items-center gap-2 min-w-0" title={`${item.titulo} — ${rotuloPeriodo(item)}`}>
      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: item.cor.forte }} />
      <span className={cx("text-[12.5px] font-semibold text-ink truncate flex-1 min-w-0", item.status === "Cancelado" && "line-through text-ink-3")}>
        {item.titulo}
      </span>
      <span className="text-[11px] font-bold text-ink-3 tabular-nums shrink-0">
        {seg.continuaAntes ? "◄ " : ""}{rotuloDias(seg)}{seg.continuaDepois ? " ►" : ""}
      </span>
    </span>
  );
}

/* -------------------------------- lista ----------------------------------- */

/**
 * A mesma informação do quadro, em lista.
 *
 * É a leitura que a equipe fazia no quadro preto: um mês embaixo do outro, tudo
 * na mesma coluna, sem precisar clicar em nada — dá para imprimir e pendurar.
 */
function VistaLista({
  itens,
  ano,
  hoje,
  onAbrirMes,
}: {
  itens: ProjetoNoCalendario[];
  ano: number;
  hoje: string;
  onAbrirMes: (mes: number) => void;
}) {
  const navigate = useNavigate();
  const meses = useMemo(
    () => MESES.map((_, mes) => ({ mes, segmentos: segmentosDoMes(itens, ano, mes) })).filter((m) => m.segmentos.length),
    [itens, ano]
  );

  return (
    <div className="flex flex-col gap-4">
      {meses.map(({ mes, segmentos }) => {
        const ehMesAtual = hoje.slice(0, 7) === `${ano}-${String(mes + 1).padStart(2, "0")}`;
        return (
          <Card key={mes} padded={false} className={cx("overflow-hidden", ehMesAtual && "ring-2 ring-primary/15 border-primary/45")}>
            <div className="flex items-center gap-2.5 px-5 py-3 border-b border-border-soft bg-[#FCFCFD]">
              <span className="h-4 w-1.5 rounded-full bg-progress-grad" />
              <h3 className="font-display font-bold text-[15px] text-ink">
                {MESES[mes]} <span className="text-ink-3 font-semibold">de {ano}</span>
              </h3>
              {ehMesAtual && <span className="text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-primary-dark bg-primary-soft rounded-pill px-2 py-0.5">agora</span>}
              <Badge tom="warning">{segmentos.length} projeto{segmentos.length > 1 ? "s" : ""}</Badge>
              <button
                onClick={() => onAbrirMes(mes)}
                className="ml-auto text-[12px] font-bold text-ink-2 hover:text-primary-dark transition-colors flex items-center gap-1"
              >
                <IcCalendar width={14} height={14} /> Ver os dias
              </button>
            </div>
            <div className="divide-y divide-border-soft">
              {segmentos.map((seg) => {
                const { item } = seg;
                const acontecendo = item.inicio <= hoje && item.fim >= hoje;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/projetos/${item.id}`)}
                    className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-[#FAFAFB] transition-colors"
                  >
                    <span className="h-9 w-1.5 rounded-full shrink-0" style={{ background: item.cor.forte }} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className={cx("text-[14px] font-bold text-ink truncate", item.status === "Cancelado" && "line-through text-ink-3")}>
                          {item.titulo}
                        </span>
                        {acontecendo && <Badge tom="success">acontecendo</Badge>}
                      </span>
                      <span className="block text-[12px] text-ink-2 truncate">
                        {[item.cliente, item.local].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                    <span className="hidden md:block text-right shrink-0">
                      <span className="block text-[12.5px] font-bold text-ink tabular-nums">
                        {dataBR(item.inicio)}{item.inicio !== item.fim ? ` › ${dataBR(item.fim)}` : ""}
                      </span>
                      <span className="block text-[11px] text-ink-3">
                        {item.dias} dia{item.dias > 1 ? "s" : ""}
                        {item.modalidade ? ` · ${item.modalidade}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0"><Badge tom={tomStatus[item.status]}>{item.status}</Badge></span>
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------ sem data ---------------------------------- */

/**
 * Projeto sem data de evento não pode ser desenhado — e some do quadro em
 * silêncio, que é justamente o que o quadro preto não deixava acontecer. Então
 * ele é cobrado aqui, com o caminho para preencher.
 */
function AvisoSemData({ semData }: { semData: { id: string; titulo: string; cliente: string }[] }) {
  const navigate = useNavigate();
  return (
    <div className="mt-5 rounded-card border border-warning/30 bg-warning-soft/60 px-4 py-3">
      <div className="text-[12.5px] font-bold text-warning">
        {semData.length} projeto{semData.length > 1 ? "s" : ""} ainda sem data de evento — não aparece
        {semData.length > 1 ? "m" : ""} no calendário.
      </div>
      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        {semData.map((p) => (
          <button
            key={p.id}
            onClick={() => navigate(`/projetos/${p.id}`)}
            title={`Abrir ${p.titulo} e preencher a data do evento`}
            className="h-7 px-3 rounded-pill bg-surface border border-border text-[12px] font-semibold text-ink-2 hover:text-ink hover:border-warning transition-colors max-w-[280px] truncate"
          >
            {p.titulo}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- controles -------------------------------- */

function SetaAno({ titulo, onClick, virada }: { titulo: string; onClick: () => void; virada?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className="h-8 w-8 grid place-items-center rounded-full text-ink-2 hover:text-primary-dark hover:bg-primary-soft transition-colors"
    >
      <IcChevron width={16} height={16} className={virada ? "rotate-180" : undefined} />
    </button>
  );
}

function BotaoVista({
  ativo,
  onClick,
  icone,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "h-7 px-3 rounded-[8px] text-[12.5px] font-bold flex items-center gap-1.5 transition-colors",
        ativo ? "bg-primary-soft text-primary-dark" : "text-ink-2 hover:text-ink hover:bg-[#F5F6F8]"
      )}
    >
      {icone}
      {children}
    </button>
  );
}
