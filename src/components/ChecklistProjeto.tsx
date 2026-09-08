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
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, ProgressBar, Select, type Tom } from "@/components/ui";
import { IcCheck, IcPlus, IcEye, IcEyeOff, IcCalendar, IcTrash } from "@/components/icons";
import { ObservacoesThread } from "@/components/ObservacoesPopup";
import { NotifDot } from "@/components/NotifDot";
import { useAnexosChecklist } from "@/hooks/useAnexosChecklist";
import { idAncoraPendencia } from "@/lib/destaque";
import {
  agruparPorData,
  atrasoNaConclusao,
  definirDataConclusao,
  paraCampoDataHora,
  definirStatus,
  encerrado,
  ordenarPorPrazo,
  resumirChecklist,
  situacaoPrazo,
  type SituacaoPrazo,
} from "@/domain/checklist";
import { useAuth } from "@/store/auth";
import { useSugestoes } from "@/hooks/useSugestoes";
import { colapsarEspacos, cx, dataBR } from "@/lib/format";
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
  /** Devolve o id da tarefa criada, para a tela levar o cursor até ela. */
  onCriarItem: () => Promise<string | void>;
  onRemoverItem: (item: ItemChecklist) => void;
  /** Traz para este check-list os itens acrescentados à lista padrão depois. */
  onSincronizar?: () => void;
  itensNovosNoModelo?: number;
  /**
   * Pendências DO USUÁRIO por tarefa (id -> quantidade). Vem de cima porque o
   * badge do item tem de dizer a mesma coisa que o da aba e o do navegador: o
   * número vermelho é sempre "o que é seu", nunca "o que existe".
   */
  pendenciasPorItem?: Record<string, number>;
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
  pendenciasPorItem = {},
}: Props) {
  const hoje = hojeIso();
  const nomeAtual = useAuth((s) => s.usuario?.nome ?? "");
  // Memória dos campos: título e etapa de tarefa se repetem projeto a projeto.
  const sugestoes = useSugestoes();
  const [verRecolhidas, setVerRecolhidas] = useState(false);
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("etapa");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  /** Id da última tarefa criada aqui — recebe o foco assim que aparece. */
  const [idRecemCriado, setIdRecemCriado] = useState("");

  const resumo = useMemo(() => resumirChecklist(checklist, hoje), [checklist, hoje]);

  /**
   * Itens à vista.
   *
   * Uma tarefa sai da visão principal por dois caminhos: automaticamente, ao ser
   * concluída (pedido do briefing), ou à mão, pelo botão de recolher. Os dois
   * casos voltam pelo MESMO botão — por isso ele fala em "recolhidas", e não em
   * "concluídas": recolher um item pendente e não ter como trazê-lo de volta
   * seria perdê-lo de vista. Nada aqui é apagado.
   *
   * Uma exceção, e ela é a razão de o número vermelho valer alguma coisa: a
   * tarefa que TEM pendência sua aparece mesmo recolhida. Recolhida e cobrada,
   * ela era contada no badge da subguia e não existia na tela — a pílula de
   * localização não tinha o que achar, e o número virava mistério. Também não
   * some pelo filtro por responsável, pelo mesmo motivo.
   */
  const visiveis = useMemo(() => {
    const cobrada = (i: ItemChecklist) => (pendenciasPorItem[i.id] ?? 0) > 0;
    const base = checklist.itens.filter((i) => verRecolhidas || !i.oculto || cobrada(i));
    const porPessoa = filtroResponsavel
      ? base.filter((i) => i.responsavel === filtroResponsavel || cobrada(i))
      : base;
    return ordenarPorPrazo(porPessoa);
  }, [checklist.itens, verRecolhidas, filtroResponsavel, pendenciasPorItem]);

  /** Tudo o que está fora da visão principal — concluído OU recolhido à mão. */
  const recolhidas = useMemo(() => checklist.itens.filter((i) => i.oculto).length, [checklist.itens]);

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

  /**
   * Cria a tarefa e garante que ela apareça.
   *
   * O filtro por responsável é limpo de propósito: a tarefa nova nasce sem
   * responsável e, com um filtro ativo, o clique em "Nova tarefa" não mostrava
   * nada — parecia que o botão não tinha funcionado.
   */
  const criar = async () => {
    setFiltroResponsavel("");
    const id = await onCriarItem();
    if (typeof id === "string") setIdRecemCriado(id);
  };

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
            <Button size="sm" variant="secondary" icon={<IcPlus width={16} height={16} />} onClick={() => void criar()}>
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
          onClick={() => setVerRecolhidas((v) => !v)}
          disabled={!verRecolhidas && recolhidas === 0}
          title="Mostra as tarefas concluídas e as que foram recolhidas da lista"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-2 hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {verRecolhidas ? <IcEyeOff width={16} height={16} /> : <IcEye width={16} height={16} />}
          {verRecolhidas ? "Esconder recolhidas" : `Ver recolhidas (${recolhidas})`}
        </button>
      </div>

      {/* ------------------------------ lista ----------------------------- */}
      {!visiveis.length && (
        <EmptyState
          title={filtroResponsavel ? "Nenhuma tarefa para este responsável" : "Nenhuma tarefa em aberto"}
          hint={
            filtroResponsavel
              ? "Troque o filtro para ver as demais."
              : recolhidas > 0
              ? `As ${recolhidas} tarefas do check-list estão concluídas ou recolhidas. Use “Ver recolhidas” para trazê-las de volta.`
              : "Este check-list ainda não tem tarefas."
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
              sugestoesTitulo={sugestoes.valores.tituloTarefa}
              item={item}
              hoje={hoje}
              usuarios={usuarios}
              podeEditar={podeEditar}
              pendencias={pendenciasPorItem[item.id] ?? 0}
              autoFoco={item.id === idRecemCriado}
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
  sugestoesTitulo,
  pendencias,
  autoFoco,
  onAlterar,
  onStatus,
  onObservacoes,
  onRemover,
}: {
  item: ItemChecklist;
  hoje: string;
  usuarios: string[];
  podeEditar: boolean;
  /** Títulos de tarefa já usados na casa — o mesmo trabalho se repete a cada projeto. */
  sugestoesTitulo: string[];
  /** Pendências do usuário nesta tarefa — o mesmo número do badge da aba. */
  pendencias: number;
  /** Tarefa recém-criada: o cursor vai direto para o título. */
  autoFoco: boolean;
  onAlterar: (patch: Partial<ItemChecklist>) => void;
  onStatus: (status: StatusChecklist) => void;
  onObservacoes: (observacoes: Observacao[]) => void;
  onRemover: () => void;
}) {
  const situacao = situacaoPrazo(item, hoje);
  const aviso = AVISO_PRAZO[situacao];
  /** Recolhida à mão e ainda em aberto — o caso que some da lista sem estar resolvido. */
  const recolhidaAberta = item.oculto && !encerrado(item);

  // Rascunho local do título. Sem ele, cada tecla virava uma gravação no banco.
  const [titulo, setTitulo] = useState(item.titulo);
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  // Reflete alteração vinda de fora (recarga, outra aba) sem atropelar quem digita.
  useEffect(() => {
    if (!editandoTitulo) setTitulo(item.titulo);
  }, [item.titulo, editandoTitulo]);
  const commitTitulo = () => {
    setEditandoTitulo(false);
    const limpo = colapsarEspacos(titulo);
    // Título vazio deixaria a tarefa sem identidade na lista e no quadro de
    // pendências: apagar tudo e sair do campo devolve o texto anterior.
    if (!limpo && item.titulo) {
      setTitulo(item.titulo);
      return;
    }
    if (limpo === item.titulo) return;
    onAlterar({ titulo: limpo });
  };
  const fechado = encerrado(item);
  const anexos = useAnexosChecklist(item.id);

  return (
    <div
      id={idAncoraPendencia(item.id)}
      className={cx(
        "rounded-card border bg-white p-3",
        situacao === "atrasado" ? "border-danger/50" : "border-border",
        // Recolhida (por conclusão ou à mão) aparece esmaecida quando revelada.
        item.oculto && "opacity-70",
        recolhidaAberta && "border-dashed"
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
              autoFocus={autoFoco}
              className={cx("!h-8 !px-2 !text-[14px] !font-bold flex-1 min-w-[200px]", fechado && "line-through")}
              sugestoes={sugestoesTitulo}
              value={titulo}
              placeholder="Descreva a tarefa"
              disabled={!podeEditar}
              onFocus={() => setEditandoTitulo(true)}
              onChange={(e) => setTitulo(e.target.value)}
              // Grava ao sair do campo (ou no Enter), NÃO a cada tecla: digitar
              // um título disparava uma gravação por caractere.
              onBlur={commitTitulo}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setTitulo(item.titulo);
              }}
              aria-label="Título da tarefa"
            />
            {aviso && <Badge tom={aviso.tom}>{aviso.rotulo}</Badge>}
            <NotifDot inline n={pendencias} title={`${pendencias} pendência(s) sua(s) nesta tarefa`} />
          </div>

          {/* Larguras fixas, do tamanho do conteúdo. Antes os três campos se
              esticavam pela largura do cartão e uma data de 10 caracteres
              ocupava meia tela. */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5">
              <span className="sr-only">Data-limite</span>
              <Input
                type="date"
                className="!h-8 !px-2 !text-[12.5px] !w-[9.5rem]"
                value={item.dataLimite}
                disabled={!podeEditar}
                // Editar a data trava o item contra o recálculo automático: o
                // ajuste da pessoa vale mais que a régua do modelo.
                onChange={(e) => onAlterar({ dataLimite: e.target.value, dataManual: true })}
                aria-label="Data-limite da tarefa"
              />
            </label>
            <Select
              className="!h-8 !px-2 !text-[12.5px] !w-[13rem]"
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
              className="!h-8 !px-2 !text-[12.5px] !w-[11rem]"
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
            {recolhidaAberta && (
              <Badge tom="neutral">Recolhida</Badge>
            )}
            {item.dataManual && (
              <span className="text-[11.5px] font-bold text-ink-3" title="O recálculo de prazos não altera esta data">
                data ajustada à mão
              </span>
            )}
            {item.status === "Concluído" && (
              <ConclusaoDoItem item={item} podeEditar={podeEditar} onAlterar={onAlterar} />
            )}
            <div className="ml-auto flex items-center gap-1">
              <ObservacoesThread
                ancora={item.id}
                observacoes={item.observacoes ?? []}
                usuarios={usuarios}
                onChange={onObservacoes}
                // Só aqui: a tarefa do check-list é o único lugar do sistema com
                // anexo na conversa (ver `domain/anexos`).
                anexos={anexos}
              />
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

/**
 * Bloco de conclusão do item: quando foi concluída, por quem, e se saiu no prazo.
 *
 * As duas datas convivem de propósito. `dataLimite` é o compromisso — quando a
 * tarefa DEVE ficar pronta, calculada pela régua do modelo. `concluidoEm` é o
 * fato — quando ela ficou. É a comparação entre as duas que responde a pergunta
 * que interessa depois do evento: a produção saiu no tempo combinado?
 *
 * A data de conclusão é editável porque a realidade atrasa o registro: quem
 * termina na sexta e marca na segunda precisa poder corrigir, senão o histórico
 * inventa três dias de atraso que não existiram.
 */
function ConclusaoDoItem({
  item,
  podeEditar,
  onAlterar,
}: {
  item: ItemChecklist;
  podeEditar: boolean;
  onAlterar: (patch: Partial<ItemChecklist>) => void;
}) {
  const atraso = atrasoNaConclusao(item);
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap text-[11.5px] font-bold text-ink-3">
      <span>Concluída em</span>
      <Input
        type="datetime-local"
        className="!h-7 !px-1.5 !text-[11.5px] !w-[12.5rem]"
        value={paraCampoDataHora(item.concluidoEm)}
        disabled={!podeEditar}
        onChange={(e) => onAlterar(definirDataConclusao(item, e.target.value))}
        aria-label="Data e hora em que a tarefa foi concluída"
        title="Data e hora reais da conclusão — corrija se você marcou depois de ter feito"
      />
      {item.concluidoPor && <span>por {item.concluidoPor}</span>}
      {atraso !== null &&
        (atraso > 0 ? (
          <Badge tom="danger">
            {atraso} {atraso === 1 ? "dia de atraso" : "dias de atraso"}
          </Badge>
        ) : (
          <Badge tom="success">no prazo</Badge>
        ))}
    </span>
  );
}
