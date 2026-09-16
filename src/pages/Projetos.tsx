import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { Card, Button, Badge, Table, THead, Tr, Td, EmptyState, AvisoErro, ThOrd, useOrdenacao, ProgressBar, type Tom } from "@/components/ui";
import { IcPlus, IcSearch } from "@/components/icons";
import { ThPendencias, TdPendencias } from "@/components/ColunaPendencias";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { useMinhasPendencias } from "@/store/pendencias";
import { useAuth } from "@/store/auth";
import { cx } from "@/lib/format";
import { statusProjetoAutomatico } from "@/domain/statusProjeto";
import { periodoDoProjeto } from "@/domain/calendario";
import { dataBR } from "@/lib/format";
import { resumirChecklist, type ResumoChecklist } from "@/domain/checklist";
import type { StatusProjeto } from "@/data/types";

const tomStatusProjeto: Record<StatusProjeto, Tom> = {
  Ativo: "success",
  Arquivado: "neutral",
  Concluido: "info",
  Cancelado: "danger",
};

type FiltroProjeto = "Todos" | "Ativo" | "Arquivado";
const FILTROS: { key: FiltroProjeto; label: string }[] = [
  { key: "Todos", label: "Todos" },
  { key: "Ativo", label: "Ativos" },
  { key: "Arquivado", label: "Arquivados" },
];

export function Projetos() {
  const navigate = useNavigate();
  const podeEditar = useAuth((s) => s.pode("projetos.editar"));
  const { porProjeto } = useMinhasPendencias();
  const podeVerChecklist = useAuth((s) => s.pode("checklists"));
  const { data, loading, error, reload } = useAsync(async () => {
    const [projetos, ecs, checklists] = await Promise.all([
      repo.projetos.listar(),
      repo.ecs.listar(),
      // Sem permissão de check-list a coluna nem aparece: não vale a consulta.
      podeVerChecklist ? repo.checklists.listar() : Promise.resolve([]),
    ]);
    return { projetos, ecs, checklists };
  }, [podeVerChecklist], { oQue: "os projetos" });
  const [filtro, setFiltro] = useState<FiltroProjeto>("Ativo");
  const [busca, setBusca] = useState("");

  const hoje = new Date().toISOString().slice(0, 10);
  /** Resumo do check-list por projeto — alimenta a coluna de progresso. */
  const resumoPorProjeto = useMemo(() => {
    const mapa = new Map<string, ResumoChecklist>();
    for (const c of data?.checklists ?? []) mapa.set(c.projetoId, resumirChecklist(c, hoje));
    return mapa;
  }, [data?.checklists, hoje]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data?.projetos ?? []).map((p) => ({ ...p, status: statusProjetoAutomatico(p, data?.ecs ?? []) }))
      // "Arquivados" agrupa tudo que não está Ativo (Arquivado/Concluído/Cancelado).
      .filter((p) => filtro === "Todos" || (filtro === "Ativo" ? p.status === "Ativo" : p.status !== "Ativo"))
      .filter((p) => !q || `${p.nome} ${p.cliente?.nome ?? ""} ${p.info?.produtoraResponsavel ?? ""}`.toLowerCase().includes(q));
  }, [data, filtro, busca]);

  const { ordem, ordenarPor, ordenados: lista } = useOrdenacao(
    filtrados,
    {
      pendencias: (p) => porProjeto[p.id] ?? 0,
      cliente: (p) => p.cliente?.nome,
      projeto: (p) => p.nome,
      produtora: (p) => p.info?.produtoraResponsavel ?? "",
      // Ordena pela data de início do evento; projeto sem data vai para o fim.
      datas: (p) => periodoDoProjeto(p)?.inicio ?? "9999-99-99",
      // Ordena pelo que falta fazer, não pelo percentual: o projeto com mais
      // tarefas em aberto é o que precisa de atenção primeiro.
      checklist: (p) => resumoPorProjeto.get(p.id)?.abertos ?? -1,
      status: (p) => p.status,
    },
    { col: "cliente", dir: "asc" }
  );

  return (
    <PageShell
      title="Projetos"
      topAction={
        podeEditar ? (
          <Button size="sm" icon={<IcPlus width={16} height={16} />} onClick={() => navigate("/projetos/novo")}>
            Novo projeto
          </Button>
        ) : undefined
      }
    >
      <div data-tour="projetos-filtros" className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={cx(
                "h-9 px-3.5 rounded-btn text-[13px] font-bold border-[1.5px] transition-colors",
                filtro === f.key ? "bg-primary-soft border-active-border text-primary-dark" : "bg-surface border-[#D6D9E0] text-ink-2 hover:text-ink"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"><IcSearch width={16} height={16} /></span>
          <input
            className="w-full h-10 bg-surface border-[1.5px] border-[#BFC4CE] rounded-btn pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 input-focus"
            placeholder="Buscar projeto ou cliente…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      <Card padded={false}>
        {error ? (
          <AvisoErro erro={error} oQue="os projetos" onTentarDeNovo={reload} />
        ) : loading ? (
          <div className="p-8 text-ink-3 text-sm">Carregando…</div>
        ) : lista.length === 0 ? (
          <div className="p-8"><EmptyState title="Nenhum projeto" hint="Crie o primeiro projeto para começar." /></div>
        ) : (
          <Table>
            <THead>
              {/* Pendências em coluna própria: os badges ficam alinhados entre si e o
                  nome do projeto começa sempre na mesma posição. */}
              <ThPendencias col="pendencias" ordem={ordem} onSort={ordenarPor} />
              <ThOrd col="cliente" ordem={ordem} onSort={ordenarPor}>Cliente</ThOrd>
              <ThOrd col="projeto" ordem={ordem} onSort={ordenarPor}>Projeto</ThOrd>
              {/* Produtora e datas do evento (15/09/2026): as duas perguntas que
                  faziam abrir projeto por projeto — "de quem é?" e "quando é?". */}
              <ThOrd col="produtora" ordem={ordem} onSort={ordenarPor}>Produtora</ThOrd>
              <ThOrd col="datas" ordem={ordem} onSort={ordenarPor}>Datas do evento</ThOrd>
              {podeVerChecklist && (
                <ThOrd col="checklist" align="center" ordem={ordem} onSort={ordenarPor}>Check-list</ThOrd>
              )}
              <ThOrd col="status" align="center" ordem={ordem} onSort={ordenarPor}>Status</ThOrd>
            </THead>
            <tbody>
              {lista.map((p) => (
                <Tr key={p.id} onClick={() => navigate(`/projetos/${p.id}`)}>
                  <TdPendencias n={porProjeto[p.id] ?? 0} title={`${porProjeto[p.id] ?? 0} pendência(s) neste projeto`} />
                  <Td className="text-ink font-medium">{p.cliente?.nome || "—"}</Td>
                  {/* Sem thumbnail: as iniciais não informavam nada e saíam quebradas em
                      títulos com travessão ("BM – Convenção…" virava "B–"). */}
                  <Td className="font-bold text-ink">{p.nome || "(sem título)"}</Td>
                  <Td className="text-[12.5px] text-ink-2">{p.info?.produtoraResponsavel || "—"}</Td>
                  <Td className="text-[12.5px] text-ink-2 whitespace-nowrap tabular-nums">{datasDoProjeto(p)}</Td>
                  {podeVerChecklist && (
                    <Td align="center">
                      <ProgressoChecklist resumo={resumoPorProjeto.get(p.id)} />
                    </Td>
                  )}
                  <Td align="center"><Badge tom={tomStatusProjeto[p.status]}>{p.status}</Badge></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </PageShell>
  );
}

/**
 * Progresso do check-list numa célula da lista de projetos.
 *
 * Mostra "18/25" com uma barrinha e destaca em vermelho quando há tarefa
 * atrasada — é o relance que evita entrar projeto por projeto para saber como
 * cada um está.
 */
function ProgressoChecklist({ resumo }: { resumo?: ResumoChecklist }) {
  if (!resumo || resumo.total === 0) {
    return <span className="text-[12.5px] text-ink-3">—</span>;
  }
  const completo = resumo.abertos === 0;
  return (
    <div className="inline-flex flex-col items-center gap-1 min-w-[84px]">
      <div className="flex items-center gap-1.5">
        <span className={cx("text-[12.5px] font-extrabold", completo ? "text-success" : "text-ink")}>
          {resumo.concluidos}/{resumo.contam}
        </span>
        {resumo.atrasados > 0 && (
          <Badge tom="danger">{resumo.atrasados}</Badge>
        )}
      </div>
      <div className="w-full">
        <ProgressBar value={resumo.progresso * 100} />
      </div>
    </div>
  );
}

/**
 * As datas do EVENTO, escritas curto para caber numa coluna de lista.
 *
 * Só a etapa Evento, como pede o check-list de 15/09 ("neste caso só as datas
 * do evento") — o quadro do ano é que passou a mostrar o período inteiro, com
 * montagem e desmontagem. Evento de um dia só escreve uma data.
 */
function datasDoProjeto(p: { info?: { cronograma?: unknown; evento?: string } }): string {
  const periodo = periodoDoProjeto(p as Parameters<typeof periodoDoProjeto>[0]);
  if (!periodo) return "—";
  return periodo.inicio === periodo.fim
    ? dataBR(periodo.inicio)
    : `${dataBR(periodo.inicio)} › ${dataBR(periodo.fim)}`;
}
