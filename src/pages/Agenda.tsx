/**
 * Agenda da casa — todas as tarefas de check-list, de todos os projetos, na
 * ordem em que vencem.
 *
 * É a resposta à pergunta que a aba de check-list do projeto não responde: "o
 * que precisa acontecer esta semana na Pólobh inteira?". Dentro do projeto você
 * vê um projeto por vez; aqui você vê o dia.
 *
 * Abre filtrada em quem está logado — a leitura mais frequente é "o que é meu".
 * Trocar para "Todos" transforma a tela na pauta da reunião de produção.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { Badge, Button, Card, EmptyState, Select, AvisoErro, type Tom } from "@/components/ui";
import { IcCheck, IcCalendar } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/store/auth";
import { usePendencias } from "@/store/pendencias";
import { toast } from "@/store/toast";
import { definirStatus, diasEntre, encerrado, ordenarPorPrazo, situacaoPrazo } from "@/domain/checklist";
import { statusProjetoAutomatico } from "@/domain/statusProjeto";
import { cx, dataBR } from "@/lib/format";
import type { Checklist, ItemChecklist, Projeto } from "@/data/types";

/** Tarefa já com o projeto a que pertence — a agenda mistura projetos. */
interface TarefaNaAgenda {
  item: ItemChecklist;
  projetoId: string;
  projetoNome: string;
  clienteNome: string;
}

/**
 * Faixas de tempo da agenda.
 *
 * O corte é por urgência, não por calendário fixo: o que passou do prazo vem
 * primeiro e separado, porque é o que exige ação hoje. "Esta semana" são os
 * próximos 7 dias corridos — não a semana do calendário, que faria uma tarefa
 * de sexta parecer distante quando é depois de amanhã.
 */
const FAIXAS = [
  { chave: "atrasadas", titulo: "Atrasadas", tom: "danger" as Tom },
  { chave: "hoje", titulo: "Hoje", tom: "danger" as Tom },
  { chave: "semana", titulo: "Próximos 7 dias", tom: "warning" as Tom },
  { chave: "quinzena", titulo: "Próximos 30 dias", tom: "info" as Tom },
  { chave: "depois", titulo: "Mais adiante", tom: "neutral" as Tom },
  { chave: "sem-data", titulo: "Sem data definida", tom: "neutral" as Tom },
] as const;

type ChaveFaixa = (typeof FAIXAS)[number]["chave"];

function faixaDaTarefa(item: ItemChecklist, hoje: string): ChaveFaixa {
  if (!item.dataLimite) return "sem-data";
  const faltam = diasEntre(hoje, item.dataLimite);
  if (faltam === null) return "sem-data";
  if (faltam < 0) return "atrasadas";
  if (faltam === 0) return "hoje";
  if (faltam <= 7) return "semana";
  if (faltam <= 30) return "quinzena";
  return "depois";
}

export function Agenda() {
  const navigate = useNavigate();
  const nomeAtual = useAuth((s) => s.usuario?.nome ?? "");
  const podeEditar = useAuth((s) => s.pode("checklists.editar"));
  const recarregarPendencias = usePendencias((s) => s.carregar);
  const hoje = new Date().toISOString().slice(0, 10);

  const { data, loading, error, reload } = useAsync(
    async () => {
      const [projetos, ecs, checklists] = await Promise.all([
        repo.projetos.listar(),
        repo.ecs.listar(),
        repo.checklists.listar(),
      ]);
      return { projetos, ecs, checklists };
    },
    [],
    { oQue: "a agenda" }
  );

  // Abre no nome de quem está logado: "o que é meu" é a leitura do dia a dia.
  const [responsavel, setResponsavel] = useState(nomeAtual);
  const [projetoId, setProjetoId] = useState("");
  /** Guarda local das tarefas concluídas aqui, para sumirem sem recarregar tudo. */
  const [concluidasAgora, setConcluidasAgora] = useState<Set<string>>(new Set());

  const tarefas = useMemo<TarefaNaAgenda[]>(() => {
    if (!data) return [];
    // Projeto encerrado não cobra mais nada — mesma regra do quadro de pendências.
    const ativos = new Map<string, Projeto>();
    for (const p of data.projetos) {
      if (["Arquivado", "Cancelado"].includes(statusProjetoAutomatico(p, data.ecs))) continue;
      ativos.set(p.id, p);
    }
    const out: TarefaNaAgenda[] = [];
    for (const c of data.checklists as Checklist[]) {
      const projeto = ativos.get(c.projetoId);
      if (!projeto) continue;
      for (const item of c.itens) {
        if (encerrado(item) || concluidasAgora.has(item.id)) continue;
        out.push({
          item,
          projetoId: projeto.id,
          projetoNome: projeto.nome || projeto.info.titulo || "(projeto sem título)",
          clienteNome: projeto.cliente?.nome ?? "",
        });
      }
    }
    return out;
  }, [data, concluidasAgora]);

  const responsaveis = useMemo(() => {
    const nomes = new Set(tarefas.map((t) => t.item.responsavel).filter(Boolean));
    // O próprio nome entra sempre. Sem isto, quem está com a agenda zerada abria
    // a tela num filtro que não existia na lista — o seletor parecia em branco.
    if (nomeAtual) nomes.add(nomeAtual);
    return [...nomes].sort();
  }, [tarefas, nomeAtual]);

  const projetosComTarefa = useMemo(
    () =>
      [...new Map(tarefas.map((t) => [t.projetoId, t.projetoNome])).entries()].sort((a, b) =>
        a[1].localeCompare(b[1])
      ),
    [tarefas]
  );

  const filtradas = useMemo(() => {
    let lista = tarefas;
    if (responsavel === "__sem__") lista = lista.filter((t) => !t.item.responsavel);
    else if (responsavel) lista = lista.filter((t) => t.item.responsavel === responsavel);
    if (projetoId) lista = lista.filter((t) => t.projetoId === projetoId);
    return lista;
  }, [tarefas, responsavel, projetoId]);

  /** Agrupa nas faixas, já ordenado por prazo dentro de cada uma. */
  const porFaixa = useMemo(() => {
    const mapa = new Map<ChaveFaixa, TarefaNaAgenda[]>();
    for (const t of filtradas) {
      const chave = faixaDaTarefa(t.item, hoje);
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(t);
    }
    for (const [chave, lista] of mapa) {
      const ordenados = ordenarPorPrazo(lista.map((t) => t.item));
      mapa.set(
        chave,
        ordenados.map((i) => lista.find((t) => t.item.id === i.id)!).filter(Boolean)
      );
    }
    return mapa;
  }, [filtradas, hoje]);

  const concluir = async (t: TarefaNaAgenda) => {
    const atualizado = definirStatus(t.item, "Concluído", nomeAtual, new Date().toISOString());
    setConcluidasAgora((s) => new Set(s).add(t.item.id));
    try {
      await repo.checklists.salvarItem(atualizado);
      void recarregarPendencias(true);
    } catch (erro) {
      toast(`Não foi possível concluir a tarefa: ${(erro as Error).message}`, "danger");
      // Devolve o item à lista: a tela não pode dizer que concluiu se não gravou.
      setConcluidasAgora((s) => {
        const x = new Set(s);
        x.delete(t.item.id);
        return x;
      });
    }
  };

  const totalAtrasadas = (porFaixa.get("atrasadas") ?? []).length;

  return (
    <PageShell
      title="Agenda"
      subtitle="Tarefas de check-list de todos os projetos ativos, na ordem em que vencem."
    >
      {error && <AvisoErro erro={error} oQue="a agenda" onTentarDeNovo={reload} />}

      <Card>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            className="!h-9 !text-[13px] !w-[15rem]"
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            aria-label="Filtrar por responsável"
          >
            <option value="">Todos os responsáveis</option>
            <option value="__sem__">Sem responsável</option>
            {responsaveis.map((r) => (
              <option key={r} value={r}>
                {r === nomeAtual ? `${r} (você)` : r}
              </option>
            ))}
          </Select>
          <Select
            className="!h-9 !text-[13px] !w-[18rem]"
            value={projetoId}
            onChange={(e) => setProjetoId(e.target.value)}
            aria-label="Filtrar por projeto"
          >
            <option value="">Todos os projetos</option>
            {projetosComTarefa.map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </Select>
          <div className="ml-auto flex items-center gap-2">
            {totalAtrasadas > 0 && <Badge tom="danger">{totalAtrasadas} atrasada(s)</Badge>}
            <Badge tom="neutral">{filtradas.length} em aberto</Badge>
          </div>
        </div>
      </Card>

      {loading && <div className="text-center text-ink-3 text-sm py-8">Carregando a agenda…</div>}

      {!loading && !filtradas.length && (
        <EmptyState
          title={responsavel ? "Nada em aberto para este filtro" : "Nenhuma tarefa em aberto"}
          hint={
            responsavel
              ? "Troque o responsável ou o projeto para ver as demais."
              : "As tarefas aparecem aqui assim que os projetos ativos tiverem check-list gerado."
          }
        />
      )}

      {FAIXAS.map((faixa) => {
        const lista = porFaixa.get(faixa.chave) ?? [];
        if (!lista.length) return null;
        return (
          <Card key={faixa.chave} padded={false}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-soft">
              <IcCalendar width={16} height={16} className="text-ink-3" />
              <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-ink-2">{faixa.titulo}</h2>
              <Badge tom={faixa.tom}>{lista.length}</Badge>
            </div>
            <div className="divide-y divide-border-soft">
              {lista.map((t) => (
                <LinhaAgenda
                  key={t.item.id}
                  tarefa={t}
                  hoje={hoje}
                  podeEditar={podeEditar}
                  onAbrirProjeto={() => navigate(`/projetos/${t.projetoId}?aba=checklist`)}
                  onConcluir={() => void concluir(t)}
                />
              ))}
            </div>
          </Card>
        );
      })}
    </PageShell>
  );
}

function LinhaAgenda({
  tarefa,
  hoje,
  podeEditar,
  onAbrirProjeto,
  onConcluir,
}: {
  tarefa: TarefaNaAgenda;
  hoje: string;
  podeEditar: boolean;
  onAbrirProjeto: () => void;
  onConcluir: () => void;
}) {
  const { item } = tarefa;
  const situacao = situacaoPrazo(item, hoje);
  const atrasada = situacao === "atrasado";
  const pendencias = (item.observacoes ?? []).filter((o) => !o.resolvida && o.texto.trim()).length;

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAFAFB]">
      <button
        type="button"
        disabled={!podeEditar}
        onClick={onConcluir}
        title="Marcar como concluída"
        className={cx(
          "h-5 w-5 shrink-0 rounded-md border-[1.5px] border-[#C9CDD6] grid place-items-center transition-colors",
          podeEditar ? "hover:border-primary hover:bg-primary-soft" : "cursor-not-allowed opacity-60"
        )}
      >
        {/* Sempre presente para reservar o espaço; aparece no hover como pista
            de que a caixinha conclui a tarefa ali mesmo, sem abrir o projeto. */}
        <IcCheck width={13} height={13} className="opacity-0 group-hover:opacity-40 text-ink-2 transition-opacity" />
      </button>

      <button type="button" onClick={onAbrirProjeto} className="min-w-0 flex-1 text-left">
        <div className="truncate text-[13.5px] font-bold text-ink">{item.titulo || "(tarefa sem título)"}</div>
        <div className="truncate text-[12px] font-bold text-ink-3">
          {tarefa.projetoNome}
          {tarefa.clienteNome ? ` · ${tarefa.clienteNome}` : ""}
          {item.etapa ? ` · ${item.etapa}` : ""}
        </div>
      </button>

      <div className="flex items-center gap-2 shrink-0">
        {pendencias > 0 && <Badge tom="warning">{pendencias} obs.</Badge>}
        {item.responsavel ? (
          <span className="hidden sm:inline text-[12px] font-bold text-ink-2">{item.responsavel}</span>
        ) : (
          <span className="hidden sm:inline text-[12px] font-bold text-ink-3">sem responsável</span>
        )}
        <span
          className={cx(
            "text-[12.5px] font-extrabold tabular-nums w-[5.5rem] text-right",
            atrasada ? "text-danger" : "text-ink-2"
          )}
        >
          {item.dataLimite ? dataBR(item.dataLimite) : "—"}
        </span>
        <Button size="sm" variant="text" onClick={onAbrirProjeto}>
          Abrir
        </Button>
      </div>
    </div>
  );
}
