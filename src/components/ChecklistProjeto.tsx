/**
 * Check-list (work flow) do projeto.
 *
 * A tela acompanha as tarefas do projeto: prazo, status, responsável e a thread
 * de observações — a mesma `ObservacoesThread` dos itens da EC, de propósito,
 * para a equipe não ter de aprender dois jeitos de conversar dentro do sistema.
 *
 * Gravação item a item: cada mudança persiste só a tarefa mexida. Duas pessoas
 * trabalhando em tarefas diferentes do mesmo projeto nunca se sobrescrevem.
 */
import { useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, ProgressBar, Select, type Tom } from "@/components/ui";
import { IcCheck, IcPlus, IcEye, IcEyeOff, IcCalendar, IcTrash } from "@/components/icons";
import { ObservacoesThread } from "@/components/ObservacoesPopup";
import { NotifDot } from "@/components/NotifDot";
import { idAncoraPendencia } from "@/components/NavegadorPendencias";
import {
  agruparPorData,
  definirStatus,
  encerrado,
  ordenarPorPrazo,
  resumirChecklist,
  situacaoPrazo,
  type SituacaoPrazo,
} from "@/domain/checklist";
import { useAuth } from "@/store/auth";
import { cx, dataBR } from "@/lib/format";
import type { Checklist, ItemChecklist, Observacao, StatusChecklist } from "@/data/types";

const STATUS: StatusChecklist[] = ["Pendente", "Em andamento", "Concluído", "Não se aplica"];

/** Cor do status, no mesmo vocabulário visual dos status da EC. */
const tomStatus: Record<StatusChecklist, Tom> = {
  Pendente: "warning",
  "Em andamento": "info",
  Concluído: "success",
  "Não se aplica": "neutral",
};

/** Como o prazo aparece na tela: só o que precisa de atenção ganha destaque. */
const AVISO_PRAZO: Record<SituacaoPrazo, { tom: Tom; rotulo: string } | null> = {
  atrasado: { tom: "danger", rotulo: "Atrasada" },
  hoje: { tom: "danger", rotulo: "Vence hoje" },
  proximo: { tom: "warning", rotulo: "Vence em breve" },
  "sem-data": { tom: "neutral", rotulo: "Sem data" },
  "em-dia": null,
  encerrado: null,
};

const hojeIso = () => new Date().toISOString().slice(0, 10);

type Agrupamento = "etapa" | "data";

interface Props {
  checklist: Checklist;
  /** Nomes dos usuários — alimentam @menções e a escolha de responsável. */
  usuarios: string[];
  podeEditar: boolean;
  /** Persiste UM item. A tela chama a cada alteração. */
  onSalvarItem: (item: ItemChecklist) => void;
  onCriarItem: () => void;
  onRemoverItem: (item: ItemChecklist) => void;
  /** Traz para este check-list os itens acrescentados à lista padrão depois. */
  onSincronizar?: () => void;
  itensNovosNoModelo?: number;
}

export function ChecklistProjeto({
  checklist,
  usuarios,
  podeEditar,
  onSalvarItem,
  onCriarItem,
  onRemoverItem,
  onSincronizar,
  itensNovosNoModelo = 0,
}: Props) {
  const hoje = hojeIso();
  const nomeAtual = useAuth((s) => s.usuario?.nome ?? "");
  const [verConcluidos, setVerConcluidos] = useState(false);
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("etapa");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");

  const resumo = useMemo(() => resumirChecklist(checklist, hoje), [checklist, hoje]);

  /**
   * Itens à vista. "Concluído" e "Não se aplica" saem da visão principal
   * automaticamente (pedido do briefing) e voltam pelo botão de concluídos —
   * nunca são apagados.
   */
  const visiveis = useMemo(() => {
    const base = checklist.itens.filter((i) => (verConcluidos ? true : !i.oculto));
    const porPessoa = filtroResponsavel
      ? base.filter((i) => i.responsavel === filtroResponsavel)
      : base;
    return ordenarPorPrazo(porPessoa);
  }, [checklist.itens, verConcluidos, filtroResponsavel]);

  /** Blocos da tela: por etapa (ordem do processo) ou por data (visão cronológica). */
  const blocos = useMemo(() => {
    if (agrupamento === "data") {
      return agruparPorData(visiveis).map((g) => ({
        chave: g.data,
        titulo: g.data ? dataBR(g.data) : "Sem data definida",
        itens: g.itens,
      }));
    }
    const mapa = new Map<string, ItemChecklist[]>();
    // A ordem das etapas segue a ordem original do modelo, não o alfabeto.
    for (const item of [...visiveis].sort((a, b) => a.ordem - b.ordem)) {
      const chave = item.etapa || "OUTROS";
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(item);
    }
    return [...mapa.entries()].map(([chave, itens]) => ({
      chave,
      titulo: chave,
      itens: ordenarPorPrazo(itens),
    }));
  }, [visiveis, agrupamento]);

  const responsaveis = useMemo(
    () => [...new Set(checklist.itens.map((i) => i.responsavel).filter(Boolean))].sort(),
    [checklist.itens]
  );

  const alterar = (item: ItemChecklist, patch: Partial<ItemChecklist>) =>
    onSalvarItem({ ...item, ...patch });

  const mudarStatus = (item: ItemChecklist, status: StatusChecklist) =>
    onSalvarItem(definirStatus(item, status, nomeAtual, new Date().toISOString()));

  return (
    <div className="space-y-4">
      {/* ----------------------------- resumo ----------------------------- */}
      <Card>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-[220px] flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[22px] font-extrabold text-ink">
                {resumo.concluidos}/{resumo.contam}
              </span>
              <span className="text-[13px] font-bold text-ink-2">tarefas concluídas</span>
            </div>
            <div className="mt-2 max-w-sm">
              <ProgressBar value={resumo.progresso * 100} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {resumo.atrasados > 0 && (
              <Badge tom="danger">
                {resumo.atrasados} {resumo.atrasados === 1 ? "atrasada" : "atrasadas"}
              </Badge>
            )}
            {resumo.proximos > 0 && (
              <Badge tom="warning">
                {resumo.proximos} {resumo.proximos === 1 ? "vencendo" : "vencendo"}
              </Badge>
            )}
            <Badge tom="neutral">{resumo.abertos} em aberto</Badge>
          </div>
        </div>

        {/* Só aparece quando a lista padrão ganhou itens depois deste projeto. */}
        {podeEditar && itensNovosNoModelo > 0 && onSincronizar && (
          <div className="mt-3 flex items-center gap-3 flex-wrap rounded-btn border border-primary bg-primary-soft px-3 py-2">
            <span className="text-[12.5px] font-bold text-primary-dark">
              A lista padrão ganhou {itensNovosNoModelo}{" "}
              {itensNovosNoModelo === 1 ? "tarefa nova" : "tarefas novas"} desde que este check-list foi criado.
            </span>
            <Button size="sm" variant="soft" onClick={onSincronizar} className="ml-auto">
              Trazer para este projeto
            </Button>
          </div>
        )}
      </Card>

      {/* ---------------------------- controles --------------------------- */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {podeEditar && (
            <Button size="sm" variant="secondary" icon={<IcPlus width={16} height={16} />} onClick={onCriarItem}>
              Nova tarefa
            </Button>
          )}
          <Select
            className="!h-9 !text-[13px]"
            value={agrupamento}
            onChange={(e) => setAgrupamento(e.target.value as Agrupamento)}
            aria-label="Agrupar tarefas"
          >
            <option value="etapa">Agrupar por etapa</option>
            <option value="data">Agrupar por data</option>
          </Select>
          {responsaveis.length > 0 && (
            <Select
              className="!h-9 !text-[13px]"
              value={filtroResponsavel}
              onChange={(e) => setFiltroResponsavel(e.target.value)}
              aria-label="Filtrar por responsável"
            >
              <option value="">Todos os responsáveis</option>
              {responsaveis.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          )}
        </div>
        <button
          type="button"
          onClick={() => setVerConcluidos((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-2 hover:text-ink"
        >
          {verConcluidos ? <IcEyeOff width={16} height={16} /> : <IcEye width={16} height={16} />}
          {verConcluidos ? "Esconder concluídas" : `Ver concluídas (${resumo.total - resumo.abertos})`}
        </button>
      </div>

      {/* ------------------------------ lista ----------------------------- */}
      {!visiveis.length && (
        <EmptyState
          title={filtroResponsavel ? "Nenhuma tarefa para este responsável" : "Nenhuma tarefa em aberto"}
          hint={
            filtroResponsavel
              ? "Troque o filtro para ver as demais."
              : "Todas as tarefas do check-list já foram concluídas. Use “Ver concluídas” para consultá-las."
          }
        />
      )}

      {blocos.map((bloco) => (
        <div key={bloco.chave} className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            {agrupamento === "data" && <IcCalendar width={15} height={15} className="text-ink-3" />}
            <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-ink-2">{bloco.titulo}</h3>
            <span className="text-[12px] font-bold text-ink-3 bg-[#F0F1F4] rounded-pill px-2 py-0.5">
              {bloco.itens.length}
            </span>
          </div>
          {bloco.itens.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              hoje={hoje}
              usuarios={usuarios}
              podeEditar={podeEditar}
              onAlterar={(patch) => alterar(item, patch)}
              onStatus={(s) => mudarStatus(item, s)}
              onObservacoes={(observacoes) => alterar(item, { observacoes })}
              onRemover={() => onRemoverItem(item)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- item ---------------------------------- */

function ItemCard({
  item,
  hoje,
  usuarios,
  podeEditar,
  onAlterar,
  onStatus,
  onObservacoes,
  onRemover,
}: {
  item: ItemChecklist;
  hoje: string;
  usuarios: string[];
  podeEditar: boolean;
  onAlterar: (patch: Partial<ItemChecklist>) => void;
  onStatus: (status: StatusChecklist) => void;
  onObservacoes: (observacoes: Observacao[]) => void;
  onRemover: () => void;
}) {
  const situacao = situacaoPrazo(item, hoje);
  const aviso = AVISO_PRAZO[situacao];
  const pendencias = (item.observacoes ?? []).filter((o) => !o.resolvida && o.texto.trim()).length;
  const fechado = encerrado(item);

  return (
    <div
      id={idAncoraPendencia(item.id)}
      className={cx(
        "rounded-card border bg-white p-3",
        situacao === "atrasado" ? "border-danger/50" : "border-border",
        fechado && "opacity-70"
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
        {/* Concluir com um clique — o gesto mais frequente da tela. */}
        <button
          type="button"
          disabled={!podeEditar}
          onClick={() => onStatus(item.status === "Concluído" ? "Pendente" : "Concluído")}
          title={item.status === "Concluído" ? "Reabrir tarefa" : "Marcar como concluída"}
          className={cx(
            "mt-0.5 h-5 w-5 shrink-0 rounded-md border-[1.5px] grid place-items-center transition-colors",
            item.status === "Concluído"
              ? "bg-success border-success text-white"
              : "border-[#C9CDD6] hover:border-primary",
            !podeEditar && "cursor-not-allowed opacity-60"
          )}
        >
          {item.status === "Concluído" && <IcCheck width={13} height={13} />}
        </button>

        <div className="min-w-0 space-y-2">
          <div className="flex items-start gap-2 flex-wrap">
            <Input
              className={cx("!h-8 !px-2 !text-[14px] !font-bold flex-1 min-w-[200px]", fechado && "line-through")}
              value={item.titulo}
              disabled={!podeEditar}
              onChange={(e) => onAlterar({ titulo: e.target.value })}
              aria-label="Título da tarefa"
            />
            {aviso && <Badge tom={aviso.tom}>{aviso.rotulo}</Badge>}
            <NotifDot inline n={pendencias} title={`${pendencias} observação(ões) em aberto`} />
          </div>

          <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)] items-center">
            <label className="flex items-center gap-1.5">
              <span className="sr-only">Data-limite</span>
              <Input
                type="date"
                className="!h-8 !px-2 !text-[12.5px]"
                value={item.dataLimite}
                disabled={!podeEditar}
                // Editar a data trava o item contra o recálculo automático: o
                // ajuste da pessoa vale mais que a régua do modelo.
                onChange={(e) => onAlterar({ dataLimite: e.target.value, dataManual: true })}
                aria-label="Data-limite da tarefa"
              />
            </label>
            <Select
              className="!h-8 !px-2 !text-[12.5px]"
              value={item.responsavel}
              disabled={!podeEditar}
              onChange={(e) => onAlterar({ responsavel: e.target.value })}
              aria-label="Responsável pela tarefa"
            >
              <option value="">Sem responsável</option>
              {usuarios.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
            <Select
              className="!h-8 !px-2 !text-[12.5px]"
              value={item.status}
              disabled={!podeEditar}
              onChange={(e) => onStatus(e.target.value as StatusChecklist)}
              aria-label="Status da tarefa"
            >
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Badge tom={tomStatus[item.status]}>{item.status}</Badge>
            {item.dataManual && (
              <span className="text-[11.5px] font-bold text-ink-3" title="O recálculo de prazos não altera esta data">
                data ajustada à mão
              </span>
            )}
            {item.status === "Concluído" && item.concluidoPor && (
              <span className="text-[11.5px] font-bold text-ink-3">
                por {item.concluidoPor}
                {item.concluidoEm ? ` em ${dataBR(item.concluidoEm)}` : ""}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <ObservacoesThread observacoes={item.observacoes ?? []} usuarios={usuarios} onChange={onObservacoes} />
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => onAlterar({ oculto: !item.oculto })}
                  className="rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5] hover:text-ink"
                  title={item.oculto ? "Trazer de volta para a lista" : "Recolher da lista"}
                >
                  {item.oculto ? <IcEye width={16} height={16} /> : <IcEyeOff width={16} height={16} />}
                </button>
              )}
              {/* Só o item criado à mão pode ser apagado: o que veio do modelo
                  se recolhe ou vira "Não se aplica", preservando o padrão. */}
              {podeEditar && !item.origemModeloItemId && (
                <button
                  type="button"
                  onClick={onRemover}
                  className="rounded-btn p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger"
                  title="Excluir tarefa"
                >
                  <IcTrash width={16} height={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
