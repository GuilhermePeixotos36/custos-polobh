import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { Card, Button, Badge, Table, THead, Tr, Td, AvisoErro, ThOrd, useOrdenacao, ProgressBar, type Tom } from "@/components/ui";
import { IcPlus } from "@/components/icons";
import { FolderOpen, Search } from "lucide-react";
import { BarraFiltros } from "@/components/padrao/BarraFiltros";
import { FilterPills } from "@/components/padrao/FilterPills";
import { EsqueletoTabela } from "@/components/padrao/EsqueletoTabela";
import { EstadoVazio } from "@/components/padrao/EstadoVazio";
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
};

type FiltroProjeto = "Todos" | "Ativo" | "Arquivado";
const FILTROS: { value: FiltroProjeto; label: string }[] = [
  { value: "Todos", label: "Todos" },
  { value: "Ativo", label: "Ativos" },
  { value: "Arquivado", label: "Arquivados" },
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
      <Card padded={false}>
        {/* Barra de filtros do padrão (24/11/2026): pílulas de situação à vista, contagem e
            busca à direita. O `data-tour` continua no mesmo bloco, para o tour achar os filtros. */}
        <div data-tour="projetos-filtros" className="border-b border-border-soft">
          <BarraFiltros
            busca={busca}
            onBusca={setBusca}
            placeholderBusca="Buscar projeto ou cliente…"
            contagem={loading || error ? undefined : `${lista.length} projeto(s)`}
            acoes={<FilterPills value={filtro} options={FILTROS} onChange={setFiltro} ariaLabel="Situação do projeto" />}
            className="movel:[&_input]:h-10"
          />
        </div>
        {error ? (
          <AvisoErro erro={error} oQue="os projetos" onTentarDeNovo={reload} />
        ) : loading ? (
          <EsqueletoTabela
            colunas={["", "Cliente", "Projeto", "Produtora", "Datas do evento", ...(podeVerChecklist ? ["Check-list"] : []), "Status"]}
            rotulo="Carregando os projetos…"
          />
        ) : lista.length === 0 ? (
          (data?.projetos.length ?? 0) === 0 ? (
            <EstadoVazio semCartao icone={FolderOpen} titulo="Nenhum projeto" descricao="Crie o primeiro projeto para começar." />
          ) : (
            // Vazio por filtro ou busca: o "Limpar filtros" volta para Todos, sem busca.
            <EstadoVazio
              semCartao
              icone={Search}
              titulo="Nenhum projeto encontrado."
              descricao="Nenhum projeto com essa situação ou essa busca."
              acao={<Button variant="secondary" onClick={() => { setBusca(""); setFiltro("Todos"); }}>Limpar filtros</Button>}
            />
          )
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
                  <Td className="text-ink font-medium">{p.info?.produtoraResponsavel || "—"}</Td>
                  <Td className="text-ink font-medium whitespace-nowrap tabular-nums">{datasDoProjeto(p)}</Td>
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
    return <span className="text-xs text-ink-3">—</span>;
  }
  const completo = resumo.abertos === 0;
  return (
    <div className="inline-flex flex-col items-center gap-1 min-w-[84px]">
      <div className="flex items-center gap-1.5">
        <span className={cx("text-xs font-bold", completo ? "text-success" : "text-ink")}>
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
