import { useDeferredValue, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { Card, Button, Badge, Table, Tr, Td, AvisoErro, ProgressBar, type Tom } from "@/components/ui";
import { IcPlus } from "@/components/icons";
import { FolderOpen, Search } from "lucide-react";
import { BarraFiltros } from "@/components/padrao/BarraFiltros";
import { FilterPills } from "@/components/padrao/FilterPills";
import { EsqueletoTabela } from "@/components/padrao/EsqueletoTabela";
import { EstadoVazio } from "@/components/padrao/EstadoVazio";
import { CabecalhoDeColuna, useFiltrosDeColuna, type ColunaDeLista } from "@/components/padrao/CabecalhoDeColuna";
import { useOrdenacao } from "@/components/padrao/CabecalhoOrdenavel";
import { ordenarPorColuna, type ValorOrdenavel } from "@/components/padrao/ordenacaoTabela";
import { filtrarPorColunas, type ExtratoresDeFiltro } from "@/components/padrao/filtrosColuna";
import { SeloPendencias, filtroPendencias } from "@/components/listas/celulas";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { useMinhasPendencias } from "@/store/pendencias";
import { useAuth } from "@/store/auth";
import { cx } from "@/lib/format";
import { statusProjetoAutomatico } from "@/domain/statusProjeto";
import { periodoDoProjeto } from "@/domain/calendario";
import { dataBR } from "@/lib/format";
import { resumirChecklist, type ResumoChecklist } from "@/domain/checklist";
import type { Projeto, StatusProjeto } from "@/data/types";

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

type LinhaProjeto = Projeto & { status: StatusProjeto };

/** O período como valor de filtro: "inicio|fim" em ISO — ordena como data e vira o texto da célula. */
function chavePeriodo(p: Projeto): string {
  const periodo = periodoDoProjeto(p);
  return periodo ? `${periodo.inicio}|${periodo.fim}` : "";
}
function formatarPeriodo(chave: string): string {
  const [inicio, fim] = chave.split("|");
  return !fim || inicio === fim ? dataBR(inicio) : `${dataBR(inicio)} › ${dataBR(fim)}`;
}

/** A situação do check-list em poucas palavras — é o que se procura ao filtrar a coluna. */
function situacaoChecklist(resumo: ResumoChecklist | undefined): string {
  if (!resumo || resumo.total === 0) return "";
  if (resumo.atrasados > 0) return "Com atraso";
  return resumo.abertos === 0 ? "Completo" : "Em andamento";
}

/** Desempate estável: projeto, depois id — colunas com o mesmo empate desenham a mesma ordem. */
const desempate = (a: LinhaProjeto, b: LinhaProjeto) =>
  a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }) || a.id.localeCompare(b.id);

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
  const buscaAdiada = useDeferredValue(busca);
  const filtrosColuna = useFiltrosDeColuna();
  // Ordem padrão mantida em Cliente A→Z: é a que a equipe já usa para achar o projeto pelo cliente.
  const { ordem, ordenarPor } = useOrdenacao({ chave: "cliente", sentido: "asc" });

  const hoje = new Date().toISOString().slice(0, 10);
  /** Resumo do check-list por projeto — alimenta a coluna de progresso. */
  const resumoPorProjeto = useMemo(() => {
    const mapa = new Map<string, ResumoChecklist>();
    for (const c of data?.checklists ?? []) mapa.set(c.projetoId, resumirChecklist(c, hoje));
    return mapa;
  }, [data?.checklists, hoje]);

  /**
   * UMA lista de colunas para desenhar, ordenar e filtrar. Pendências virou coluna como as outras
   * (24/11/2026): antes era a coluna estreita do "!", com ordenação à parte.
   */
  const colunas: (ColunaDeLista | false)[] = [
    { rotulo: "Cliente", chave: "cliente", tipo: "texto" },
    { rotulo: "Projeto", chave: "projeto", tipo: "texto" },
    // Produtora e datas do evento (15/09/2026): as duas perguntas que faziam abrir projeto por
    // projeto — "de quem é?" e "quando é?".
    { rotulo: "Produtora", chave: "produtora", tipo: "texto" },
    { rotulo: "Datas do evento", chave: "datas", tipo: "data", classe: "whitespace-nowrap", formatarFiltro: formatarPeriodo },
    podeVerChecklist && { rotulo: "Check-list", chave: "checklist", tipo: "numero", classe: "text-center" },
    { rotulo: "Pendências", chave: "pendencias", tipo: "numero", classe: "text-center" },
    { rotulo: "Status", chave: "status", tipo: "texto", classe: "text-center" },
  ];

  const valoresOrdem: Record<string, (p: LinhaProjeto) => ValorOrdenavel> = {
    cliente: (p) => p.cliente?.nome,
    projeto: (p) => p.nome,
    produtora: (p) => p.info?.produtoraResponsavel,
    // Pela data de início do evento; projeto sem data vai para o fim (o vazio vai sempre).
    datas: (p) => periodoDoProjeto(p)?.inicio,
    // Pelo que falta fazer, não pelo percentual: o projeto com mais tarefas em aberto é o que
    // precisa de atenção primeiro.
    checklist: (p) => resumoPorProjeto.get(p.id)?.abertos,
    // Zero pendência é "nada a fazer": vai com os vazios para o fim, e o primeiro clique
    // (maior primeiro) abre a lista pelo projeto que mais pede ação.
    pendencias: (p) => porProjeto[p.id] || null,
    status: (p) => p.status,
  };
  const valoresFiltro: ExtratoresDeFiltro<LinhaProjeto> = {
    cliente: (p) => p.cliente?.nome,
    projeto: (p) => p.nome,
    produtora: (p) => p.info?.produtoraResponsavel,
    datas: chavePeriodo,
    checklist: (p) => situacaoChecklist(resumoPorProjeto.get(p.id)),
    pendencias: (p) => filtroPendencias(porProjeto[p.id] ?? 0),
    status: (p) => p.status,
  };

  /** A lista depois da busca e das pílulas — é dela que o painel de cada coluna tira os valores. */
  const base = useMemo(() => {
    const q = buscaAdiada.trim().toLowerCase();
    return (data?.projetos ?? [])
      .map((p): LinhaProjeto => ({ ...p, status: statusProjetoAutomatico(p, data?.ecs ?? []) }))
      // "Arquivados" agrupa tudo que não está Ativo (Arquivado/Concluído/Cancelado).
      .filter((p) => filtro === "Todos" || (filtro === "Ativo" ? p.status === "Ativo" : p.status !== "Ativo"))
      .filter((p) => !q || `${p.nome} ${p.cliente?.nome ?? ""} ${p.info?.produtoraResponsavel ?? ""}`.toLowerCase().includes(q));
  }, [data, filtro, buscaAdiada]);

  const lista = ordenarPorColuna(filtrarPorColunas(base, filtrosColuna.filtros, valoresFiltro), colunas, ordem, valoresOrdem, desempate);

  /** O "Limpar filtros" do estado vazio limpa TUDO: busca, pílula e filtros de coluna. */
  function limparTudo() {
    setBusca("");
    setFiltro("Todos");
    filtrosColuna.limpar();
  }

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
            busca à direita; os filtros de coluna (o funil de cada cabeçalho) somam no contador do
            botão "Filtros". O `data-tour` continua no mesmo bloco, para o tour achar os filtros. */}
        <div data-tour="projetos-filtros" className="border-b border-border-soft">
          <BarraFiltros
            busca={busca}
            onBusca={setBusca}
            placeholderBusca="Buscar projeto ou cliente…"
            contagem={loading || error ? undefined : `${lista.length} projeto(s)`}
            acoes={<FilterPills value={filtro} options={FILTROS} onChange={setFiltro} ariaLabel="Situação do projeto" />}
            filtrosDeColuna={filtrosColuna.ativos}
            onLimpar={filtrosColuna.limpar}
            className="movel:[&_input]:h-10"
          />
        </div>
        {error ? (
          <AvisoErro erro={error} oQue="os projetos" onTentarDeNovo={reload} />
        ) : loading ? (
          <EsqueletoTabela
            colunas={colunas.filter((c): c is ColunaDeLista => Boolean(c)).map((c) => c.rotulo)}
            rotulo="Carregando os projetos…"
          />
        ) : lista.length === 0 ? (
          (data?.projetos.length ?? 0) === 0 ? (
            <EstadoVazio semCartao icone={FolderOpen} titulo="Nenhum projeto" descricao="Crie o primeiro projeto para começar." />
          ) : (
            // Vazio por filtro ou busca: o "Limpar filtros" volta para Todos, sem busca e sem filtro de coluna.
            <EstadoVazio
              semCartao
              icone={Search}
              titulo="Nenhum projeto encontrado."
              descricao="Nenhum projeto com essa situação, esses filtros ou essa busca."
              acao={<Button variant="secondary" onClick={limparTudo}>Limpar filtros</Button>}
            />
          )
        ) : (
          <Table>
            <CabecalhoDeColuna
              colunas={colunas}
              ordem={ordem}
              onOrdenar={ordenarPor}
              itens={base}
              valoresFiltro={valoresFiltro}
              filtros={filtrosColuna.filtros}
              onFiltros={filtrosColuna.setFiltros}
              grudado
            />
            <tbody>
              {lista.map((p) => (
                <Tr key={p.id} onClick={() => navigate(`/projetos/${p.id}`)}>
                  <Td className="text-ink font-medium">{p.cliente?.nome || "—"}</Td>
                  {/* Sem thumbnail: as iniciais não informavam nada e saíam quebradas em
                      títulos com travessão ("BM – Convenção…" virava "B–"). O nome é um botão de
                      verdade: a linha abre pelo teclado também. */}
                  <Td className="font-bold text-ink">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navigate(`/projetos/${p.id}`); }}
                      className="rounded-sm text-left hover:text-brand-forte focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      {p.nome || "(sem título)"}
                    </button>
                  </Td>
                  <Td className="text-ink font-medium">{p.info?.produtoraResponsavel || "—"}</Td>
                  <Td className="text-ink font-medium whitespace-nowrap tabular-nums">{datasDoProjeto(p)}</Td>
                  {podeVerChecklist && (
                    <Td align="center">
                      <ProgressoChecklist resumo={resumoPorProjeto.get(p.id)} />
                    </Td>
                  )}
                  <Td align="center"><SeloPendencias n={porProjeto[p.id] ?? 0} rotulo="pendência(s) neste projeto" /></Td>
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
