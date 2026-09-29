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
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge, Button, Card, EmptyState, Input, ProgressBar, Select, type Tom } from "@/components/ui";
import { IcCheck, IcPlus, IcEye, IcEyeOff, IcCalendar, IcTrash, IcGrip } from "@/components/icons";
import { ObservacoesThread } from "@/components/ObservacoesPopup";
import { MoverSetas } from "@/components/MoverSetas";
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
  moverEtapaSobre,
  moverItemParaEtapa,
  moverItemPorSeta,
  moverItemSobre,
  ordenarPorPrazo,
  resumirChecklist,
  SEM_ETAPA,
  situacaoPrazo,
  statusExibido,
  type SituacaoPrazo,
  type StatusExibido,
} from "@/domain/checklist";
import { confirmar } from "@/store/confirm";
import { useAuth } from "@/store/auth";
import { useSugestoes } from "@/hooks/useSugestoes";
import { colapsarEspacos, cx, dataBR } from "@/lib/format";
import type { Checklist, ItemChecklist, Observacao, StatusChecklist } from "@/data/types";

/** Cor de cada status da COLUNA "Status" (Pendente, Atrasado, Concluído). */
const tomStatusExibido: Record<StatusExibido, Tom> = {
  Pendente: "warning",
  Atrasado: "danger",
  Concluído: "success",
  "Não se aplica": "neutral",
};

/**
 * As colunas da lista — o desenho do app "LZ": Tarefa, Responsável, Data
 * Prevista, Data de Conclusão e Status. A PREVISTA é o prazo que o sistema
 * distribui (e que se pode ajustar à mão); a de CONCLUSÃO é quando a tarefa foi
 * de fato concluída. As duas primeiras (seleção e movimento) e a última
 * (recolher/excluir) são ferramentas, não dados.
 */
const GRADE_COLUNAS =
  "grid gap-x-3 gap-y-1 items-start grid-cols-[auto_auto_minmax(0,1fr)] md:grid-cols-[22px_60px_minmax(0,1fr)_170px_130px_170px_130px_56px]";

/** Como o prazo aparece na tela: só o que precisa de atenção ganha destaque. */
const AVISO_PRAZO: Record<SituacaoPrazo, { tom: Tom; rotulo: string } | null> = {
  atrasado: { tom: "danger", rotulo: "Atrasada" },
  hoje: { tom: "danger", rotulo: "Vence hoje" },
  proximo: { tom: "warning", rotulo: "Vence em breve" },
  // Sem data não é aviso: já se lê no próprio campo do prazo, que mostra
  // "Sem data" em cinza. Um selo a mais só repetiria a mesma informação.
  "sem-data": null,
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
  /**
   * Cria uma tarefa e devolve o id, para a tela levar o cursor até ela.
   *
   * `base` é onde ela nasce: a etapa (ou o dia) do grupo em que a pessoa
   * clicou. Sem isso, o "+" no fim de um grupo criava a tarefa em OUTRO lugar
   * da lista — a pessoa clicava em PRÉ-PRODUÇÃO e o cursor sumia no fim da
   * tela.
   */
  onCriarItem: (base?: { etapa?: string; dataLimite?: string }) => Promise<string | void>;
  onRemoverItem: (item: ItemChecklist) => void;
  /** Grava várias tarefas de uma vez — reordenar, mover de etapa, concluir em lote. */
  onSalvarVarios: (itens: ItemChecklist[]) => void;
  /** Apaga várias tarefas de uma vez. */
  onRemoverVarios: (itens: ItemChecklist[]) => void;
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
  onSalvarVarios,
  onRemoverVarios,
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
  /**
   * Tarefas que a pessoa encerrou AGORA, nesta sessão.
   *
   * Concluir recolhe o item da lista (é o pedido do briefing), e o efeito
   * colateral era ruim: o clique fazia a linha evaporar, sem o risco em xis nem
   * o contador subindo à vista, e quem errou o alvo tinha de ir em "Ver
   * recolhidas" para descobrir o que sumiu. Aqui ela FICA — riscada, com o
   * tique verde — até a próxima visita à aba. O banco já guardou `oculto`;
   * isto é só a tela não escondendo o que acabou de acontecer.
   */
  const [encerradasAgora, setEncerradasAgora] = useState<string[]>([]);
  /** Tarefas marcadas para concluir ou excluir em lote. */
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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
    const base = checklist.itens.filter(
      (i) => verRecolhidas || !i.oculto || cobrada(i) || encerradasAgora.includes(i.id)
    );
    const porPessoa = filtroResponsavel
      ? base.filter((i) => i.responsavel === filtroResponsavel || cobrada(i))
      : base;
    return ordenarPorPrazo(porPessoa);
  }, [checklist.itens, verRecolhidas, filtroResponsavel, pendenciasPorItem, encerradasAgora]);

  /** Tudo o que está fora da visão principal — concluído OU recolhido à mão. */
  const recolhidas = useMemo(() => checklist.itens.filter((i) => i.oculto).length, [checklist.itens]);

  /** A chave do grupo a que um item pertence, no agrupamento escolhido. */
  const chaveDoGrupo = (i: ItemChecklist) => (agrupamento === "data" ? i.dataLimite || "" : i.etapa || "OUTROS");

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
    // Dentro da etapa vale a ORDEM ARRUMADA (setas e arraste), e não a data:
    // ordenar por prazo desfazia qualquer arrumação a cada gravação.
    return [...mapa.entries()].map(([chave, itens]) => ({
      chave,
      titulo: chave,
      itens,
    }));
  }, [visiveis, agrupamento]);

  /**
   * Progresso de cada grupo, contado sobre o grupo INTEIRO — e não sobre o que
   * está à vista.
   *
   * O cabeçalho dizia "0 de 5" numa etapa com três tarefas concluídas: ele
   * contava a lista visível, de onde a tarefa concluída acabara de sair. O
   * número que interessa é o do processo ("3 de 8 desta etapa"), não o do
   * filtro. "Não se aplica" fica de fora do denominador, como no resumo do
   * topo — tarefa que não vale não é meta.
   */
  const progressoDoGrupo = useMemo(() => {
    const mapa = new Map<string, { feitas: number; contam: number }>();
    for (const item of checklist.itens) {
      if (item.status === "Não se aplica") continue;
      const chave = chaveDoGrupo(item);
      const atual = mapa.get(chave) ?? { feitas: 0, contam: 0 };
      atual.contam += 1;
      if (item.status === "Concluído") atual.feitas += 1;
      mapa.set(chave, atual);
    }
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklist.itens, agrupamento]);

  const responsaveis = useMemo(
    () => [...new Set(checklist.itens.map((i) => i.responsavel).filter(Boolean))].sort(),
    [checklist.itens]
  );

  /** As etapas da lista, na ordem do processo — alimentam o seletor do item. */
  const etapasExistentes = useMemo(() => {
    const vistas: string[] = [];
    for (const item of [...checklist.itens].sort((a, b) => a.ordem - b.ordem)) {
      const nome = (item.etapa || "").trim();
      if (nome && !vistas.includes(nome)) vistas.push(nome);
    }
    return vistas;
  }, [checklist.itens]);

  const alterar = (item: ItemChecklist, patch: Partial<ItemChecklist>) => {
    // Recolher à mão é dizer "some daqui": aí a tarefa some mesmo, mesmo que
    // tenha sido encerrada nesta sessão.
    if (patch.oculto) setEncerradasAgora((ids) => ids.filter((id) => id !== item.id));
    onSalvarItem({ ...item, ...patch });
  };

  const mudarStatus = (item: ItemChecklist, status: StatusChecklist) => {
    const depois = definirStatus(item, status, nomeAtual, new Date().toISOString());
    setEncerradasAgora((ids) =>
      encerrado(depois) ? [...new Set([...ids, item.id])] : ids.filter((id) => id !== item.id)
    );
    onSalvarItem(depois);
  };

  /**
   * RENOMEAR A ETAPA acerta todas as tarefas dela de uma vez (15/09/2026).
   *
   * A etapa não é um registro: ela é o nome que as tarefas carregam. Renomear
   * item a item produziria, na metade do caminho, duas etapas com nomes
   * parecidos — e a lista quebraria em duas.
   */
  const renomearEtapa = async (antiga: string, nova: string) => {
    const nome = nova.trim();
    if (!nome || nome === antiga) return;
    for (const item of checklist.itens.filter((i) => (i.etapa || "OUTROS") === antiga)) {
      onSalvarItem({ ...item, etapa: nome });
    }
  };

  /**
   * MOVER A ETAPA leva as tarefas dela junto — as que estão à vista e as
   * recolhidas. A ordem das etapas sai da ordem das tarefas (`item.ordem`), então
   * mover é reescrever a ordem (ver `moverEtapaSobre`).
   */
  const moverEtapa = (indice: number, direcao: -1 | 1) => {
    const vizinha = blocos[indice + direcao];
    if (!vizinha) return;
    onSalvarVarios(moverEtapaSobre(checklist.itens, blocos[indice].chave, vizinha.chave));
  };

  /** As setas de uma tarefa: uma posição por vez, atravessando para a etapa vizinha na borda. */
  const moverTarefa = (item: ItemChecklist, direcao: -1 | 1) =>
    onSalvarVarios(moverItemPorSeta(checklist.itens, item.id, direcao, visiveis.map((i) => i.id)));

  /** Soltar depois de arrastar: uma tarefa (entre tarefas ou etapas) ou uma etapa inteira. */
  const aoSoltar = (e: DragEndEvent) => {
    if (!e.over) return;
    const ativo = String(e.active.id);
    const sobre = String(e.over.id);
    if (ativo === sobre) return;
    const ehEtapa = (id: string) => id.startsWith("etapa:");
    // Soltar uma etapa sobre uma TAREFA vale como soltar sobre a etapa dela.
    const etapaDe = (id: string) =>
      ehEtapa(id) ? id.slice(6) : (checklist.itens.find((i) => i.id === id)?.etapa || SEM_ETAPA);
    if (ehEtapa(ativo)) {
      const alvo = etapaDe(sobre);
      if (alvo) onSalvarVarios(moverEtapaSobre(checklist.itens, ativo.slice(6), alvo));
      return;
    }
    onSalvarVarios(
      ehEtapa(sobre)
        ? moverItemParaEtapa(checklist.itens, ativo, sobre.slice(6), "fim")
        : moverItemSobre(checklist.itens, ativo, sobre)
    );
  };

  /* ------------------------------ em lote ------------------------------ */

  const marcadas = useMemo(
    () => checklist.itens.filter((i) => selecionadas.has(i.id)),
    [checklist.itens, selecionadas]
  );
  const idsVisiveis = useMemo(() => visiveis.map((i) => i.id), [visiveis]);
  const todasMarcadas = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionadas.has(id));

  const alternarMarca = (ids: string[], marcar: boolean) =>
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      for (const id of ids) marcar ? novo.add(id) : novo.delete(id);
      return novo;
    });

  const concluirMarcadas = () => {
    const alvo = marcadas.filter((i) => !encerrado(i));
    if (alvo.length) {
      const agora = new Date().toISOString();
      setEncerradasAgora((ids) => [...new Set([...ids, ...alvo.map((i) => i.id)])]);
      onSalvarVarios(alvo.map((i) => definirStatus(i, "Concluído", nomeAtual, agora)));
    }
    setSelecionadas(new Set());
  };

  /**
   * Excluir em lote. A tarefa que veio da lista padrão não some do banco — a
   * lista padrão continua sendo o padrão, e a tarefa reaparecia como "nova" no
   * aviso de sincronização —, então ela vira "Não se aplica" e sai da vista, que
   * é o mesmo que a exclusão individual sempre fez por ela. As criadas à mão
   * são apagadas de vez.
   */
  const excluirMarcadas = async () => {
    if (!marcadas.length) return;
    const doModelo = marcadas.filter((i) => i.origemModeloItemId);
    const avulsas = marcadas.filter((i) => !i.origemModeloItemId);
    const ok = await confirmar({
      titulo: `Excluir ${marcadas.length} ${marcadas.length === 1 ? "tarefa" : "tarefas"}?`,
      mensagem: doModelo.length
        ? `${avulsas.length} ${avulsas.length === 1 ? "será apagada" : "serão apagadas"} de vez. ` +
          `As ${doModelo.length} que vieram da lista padrão ficam como “Não se aplica” e saem da lista (a lista padrão não muda).`
        : "As tarefas são apagadas de vez e isso não pode ser desfeito.",
      confirmarTexto: "Excluir",
      tom: "danger",
    });
    if (!ok) return;
    const agora = new Date().toISOString();
    onSalvarVarios(
      doModelo.filter((i) => i.status !== "Não se aplica").map((i) => definirStatus(i, "Não se aplica", nomeAtual, agora))
    );
    onRemoverVarios(avulsas);
    setSelecionadas(new Set());
  };

  /**
   * Cria a tarefa e garante que ela apareça.
   *
   * O filtro por responsável é limpo de propósito: a tarefa nova nasce sem
   * responsável e, com um filtro ativo, o clique em "Nova tarefa" não mostrava
   * nada — parecia que o botão não tinha funcionado.
   */
  const criar = async (base?: { etapa?: string; dataLimite?: string }) => {
    setFiltroResponsavel("");
    const id = await onCriarItem(base);
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
                {resumo.proximos} vencendo
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
          {/* CRIAR ETAPA (15/09/2026). A etapa é o nome que as tarefas carregam,
              então criar uma é criar a primeira tarefa dela — e é assim que ela
              nasce com conteúdo em vez de virar um cabeçalho vazio que alguém
              esquece na lista. */}
          {podeEditar && agrupamento === "etapa" && (
            <Button
              size="sm"
              variant="secondary"
              icon={<IcPlus width={16} height={16} />}
              onClick={() => void criar({ etapa: nomeDeEtapaNova(checklist.itens) })}
              title="Cria a etapa com a primeira tarefa dela"
            >
              Nova etapa
            </Button>
          )}
          <Select
            className="!h-9 !w-auto !text-[13px]"
            value={agrupamento}
            onChange={(e) => setAgrupamento(e.target.value as Agrupamento)}
            aria-label="Agrupar tarefas"
          >
            <option value="etapa">Agrupar por etapa</option>
            <option value="data">Agrupar por data</option>
          </Select>
          {responsaveis.length > 0 && (
            <Select
              className="!h-9 !w-auto !text-[13px]"
              value={filtroResponsavel}
              onChange={(e) => setFiltroResponsavel(e.target.value)}
              aria-label="Filtrar por responsável"
            >
              <option value="">Todos os responsáveis</option>
              {/* "As minhas" é o filtro que mais se usa, e estava escondido no
                  meio de uma lista alfabética de nomes. Fica em cima, com o
                  nome próprio junto para não haver dúvida de quem é "minhas". */}
              {nomeAtual && <option value={nomeAtual}>Minhas tarefas ({nomeAtual})</option>}
              {responsaveis
                .filter((r) => r !== nomeAtual)
                .map((r) => (
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

      {/* ---------------------- concluir / excluir em lote ---------------------- */}
      {podeEditar && visiveis.length > 0 && (
        <div
          className={cx(
            "flex items-center gap-3 flex-wrap rounded-btn border px-3 py-2",
            marcadas.length ? "border-primary bg-primary-soft" : "border-border-soft bg-surface"
          )}
        >
          <label className="inline-flex items-center gap-2 text-[12.5px] font-bold text-ink-2 cursor-pointer">
            <input
              type="checkbox"
              checked={todasMarcadas}
              onChange={(e) => alternarMarca(idsVisiveis, e.target.checked)}
              className="h-4 w-4 accent-[#F2820D]"
            />
            Selecionar todas
          </label>
          <span className="text-[12.5px] font-bold text-ink-3">
            {marcadas.length
              ? `${marcadas.length} ${marcadas.length === 1 ? "selecionada" : "selecionadas"}`
              : "Marque tarefas para concluir ou excluir em lote"}
          </span>
          {marcadas.length > 0 && (
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="secondary" icon={<IcCheck width={15} height={15} />} onClick={concluirMarcadas}>
                Concluir selecionadas
              </Button>
              <Button size="sm" variant="danger" icon={<IcTrash width={15} height={15} />} onClick={() => void excluirMarcadas()}>
                Excluir selecionadas
              </Button>
              <Button size="sm" variant="text" onClick={() => setSelecionadas(new Set())}>
                Limpar seleção
              </Button>
            </div>
          )}
        </div>
      )}

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

      {/* Cada grupo é UMA lista, e não uma pilha de cartões soltos.
          O que faz uma lista parecer uma lista é a continuidade: um fundo só,
          linhas separadas por um fio, e o título preso no topo. Com um cartão
          por tarefa — borda, sombra e respiro em cada uma — doze tarefas viravam
          doze objetos, e a leitura de cima a baixo se perdia. */}
      <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
        <SortableContext items={blocos.map((b) => `etapa:${b.chave}`)} strategy={verticalListSortingStrategy}>
          {blocos.map((bloco, indiceBloco) => {
            const progresso = progressoDoGrupo.get(bloco.chave) ?? { feitas: 0, contam: 0 };
            const idsDoBloco = bloco.itens.map((i) => i.id);
            const blocoMarcado = idsDoBloco.length > 0 && idsDoBloco.every((id) => selecionadas.has(id));
            return (
              <SecaoEtapa key={bloco.chave} id={`etapa:${bloco.chave}`} ordenavel={podeEditar && agrupamento === "etapa"}>
                {(alcaEtapa) => (
                  <>
                    <header className="flex items-center gap-2 px-4 py-2.5 bg-[#FAFAFB] border-b border-border-soft">
                      {podeEditar && (
                        <input
                          type="checkbox"
                          checked={blocoMarcado}
                          onChange={(e) => alternarMarca(idsDoBloco, e.target.checked)}
                          title="Selecionar as tarefas desta etapa"
                          aria-label={`Selecionar as tarefas de ${bloco.titulo}`}
                          className="h-4 w-4 accent-[#F2820D] shrink-0"
                        />
                      )}
                      {agrupamento === "data" && <IcCalendar width={15} height={15} className="text-ink-3 shrink-0" />}
                      {/* MOVER A ETAPA: arraste pela alça (saltos grandes) ou
                          pelas setas (uma posição por vez). Nos dois casos as
                          tarefas dela vão junto. */}
                      {agrupamento === "etapa" && podeEditar && (
                        <>
                          {alcaEtapa}
                          <MoverSetas
                            rotulo={`a etapa ${bloco.titulo}`}
                            podeSubir={indiceBloco > 0}
                            podeDescer={indiceBloco < blocos.length - 1}
                            onSubir={() => moverEtapa(indiceBloco, -1)}
                            onDescer={() => moverEtapa(indiceBloco, 1)}
                          />
                        </>
                      )}
                      {/* RENOMEAR A ETAPA: texto que vira campo no clique. */}
                      {agrupamento === "etapa" && podeEditar && bloco.chave !== SEM_ETAPA ? (
                        <NomeDaEtapa nome={bloco.titulo} onRenomear={(nome) => void renomearEtapa(bloco.chave, nome)} />
                      ) : (
                        <h3 className="text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-ink-2 truncate">
                          {bloco.titulo}
                        </h3>
                      )}
                      <span className="ml-auto shrink-0 text-[11.5px] font-bold text-ink-3 tabular-nums">
                        {progresso.feitas} de {progresso.contam}
                      </span>
                    </header>
                    {/* Cabeçalho das colunas (só em tela larga). */}
                    <div className={cx(GRADE_COLUNAS, "max-md:hidden px-4 py-1.5 border-b border-border-soft text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-ink-3")}>
                      <span />
                      <span />
                      <span>Tarefa</span>
                      <span>Responsável</span>
                      <span>Data Prevista</span>
                      <span>Data de Conclusão</span>
                      <span>Status</span>
                      <span />
                    </div>
                    <SortableContext items={idsDoBloco} strategy={verticalListSortingStrategy}>
                      <ul className="divide-y divide-border-soft">
                        {bloco.itens.map((item, indiceItem) => (
                          <ItemCard
                            key={item.id}
                            sugestoesTitulo={sugestoes.valores.tituloTarefa}
                            etapas={etapasExistentes}
                            item={item}
                            hoje={hoje}
                            usuarios={usuarios}
                            podeEditar={podeEditar}
                            ordenavel={podeEditar && agrupamento === "etapa"}
                            selecionada={selecionadas.has(item.id)}
                            onSelecionar={(marcar) => alternarMarca([item.id], marcar)}
                            podeSubir={indiceItem > 0 || indiceBloco > 0}
                            podeDescer={indiceItem < bloco.itens.length - 1 || indiceBloco < blocos.length - 1}
                            onSeta={(direcao) => moverTarefa(item, direcao)}
                            pendencias={pendenciasPorItem[item.id] ?? 0}
                            autoFoco={item.id === idRecemCriado}
                            onAlterar={(patch) => alterar(item, patch)}
                            onStatus={(s) => mudarStatus(item, s)}
                            onObservacoes={(observacoes) => alterar(item, { observacoes })}
                            onRemover={() => onRemoverItem(item)}
                          />
                        ))}
                        {/* Acrescentar onde se está olhando. */}
                        {podeEditar && (
                          <li>
                            <button
                              type="button"
                              onClick={() =>
                                void criar(
                                  agrupamento === "data" ? { dataLimite: bloco.chave } : { etapa: bloco.chave === SEM_ETAPA ? "" : bloco.chave }
                                )
                              }
                              className="w-full text-left px-4 py-2 text-[12.5px] font-bold text-ink-3 hover:bg-[#FCFCFD] hover:text-primary-dark inline-flex items-center gap-1.5"
                            >
                              <IcPlus width={14} height={14} />
                              {agrupamento === "data"
                                ? bloco.chave
                                  ? `Nova tarefa em ${dataBR(bloco.chave)}`
                                  : "Nova tarefa sem data"
                                : `Nova tarefa em ${bloco.titulo}`}
                            </button>
                          </li>
                        )}
                      </ul>
                    </SortableContext>
                  </>
                )}
              </SecaoEtapa>
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}

/**
 * A etapa como bloco arrastável: o cartão inteiro se move, e a alça (entregue ao
 * cabeçalho) é o que a pessoa segura.
 */
function SecaoEtapa({
  id,
  ordenavel,
  children,
}: {
  id: string;
  ordenavel: boolean;
  children: (alca: ReactNode) => ReactNode;
}) {
  const sortable = useSortable({ id, disabled: !ordenavel });
  const alca = ordenavel ? (
    <button
      ref={sortable.setActivatorNodeRef}
      {...sortable.listeners}
      {...sortable.attributes}
      type="button"
      className="cursor-grab active:cursor-grabbing text-ink-3 hover:text-ink shrink-0 touch-none"
      title="Arraste para mover a etapa (as tarefas vão junto)"
      aria-label="Arrastar a etapa"
    >
      <IcGrip width={18} height={18} />
    </button>
  ) : null;
  return (
    <section
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      className={cx(
        "rounded-card border border-border bg-surface shadow-card overflow-hidden",
        sortable.isDragging && "opacity-50 relative z-10"
      )}
    >
      {children(alca)}
    </section>
  );
}

/* --------------------------------- item ---------------------------------- */

function ItemCard({
  item,
  hoje,
  usuarios,
  podeEditar,
  ordenavel,
  selecionada,
  onSelecionar,
  podeSubir,
  podeDescer,
  onSeta,
  sugestoesTitulo,
  etapas,
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
  /** Arraste e setas ligados (só no agrupamento por etapa). */
  ordenavel: boolean;
  /** Marcada para concluir/excluir em lote. */
  selecionada: boolean;
  onSelecionar: (marcar: boolean) => void;
  podeSubir: boolean;
  podeDescer: boolean;
  onSeta: (direcao: -1 | 1) => void;
  /** Títulos de tarefa já usados na casa — o mesmo trabalho se repete a cada projeto. */
  sugestoesTitulo: string[];
  /** As etapas que a lista já tem — para mover a tarefa sem redigitar o nome. */
  etapas: string[];
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
  /**
   * O título é TEXTO até alguém querer mudá-lo. Nasce em edição só quando a
   * tarefa acabou de ser criada — ela vem sem nome, e o cursor tem de estar lá.
   */
  const [editandoTitulo, setEditandoTitulo] = useState(autoFoco);
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
  /**
   * A DESCRIÇÃO da tarefa — o que precisa ser feito.
   *
   * Ela existia no tipo, era preenchida na lista padrão (Configurações →
   * Check-list, com o rótulo "aparece na tarefa do projeto") e era copiada para
   * cada projeto por `itemDoModelo`... e não aparecia em lugar nenhum. Quem
   * escrevia a instrução no modelo estava escrevendo para ninguém, e a tarefa
   * do projeto continuava sendo só um título solto.
   *
   * Mesmo tratamento do título: texto para ler, campo ao clicar.
   */
  const [descricao, setDescricao] = useState(item.descricao);
  const [editandoDescricao, setEditandoDescricao] = useState(false);
  useEffect(() => {
    if (!editandoDescricao) setDescricao(item.descricao);
  }, [item.descricao, editandoDescricao]);
  const commitDescricao = () => {
    setEditandoDescricao(false);
    const limpo = colapsarEspacos(descricao);
    if (limpo !== item.descricao) onAlterar({ descricao: limpo });
  };

  const fechado = encerrado(item);
  const anexos = useAnexosChecklist(item.id);
  /**
   * A conversa fica à vista, ou é só um convite no hover?
   *
   * À vista quando há o que mostrar — e também quando a tarefa COBRA a pessoa:
   * a regra da casa é que todo número contado pode ser achado, e esconder a
   * thread deixaria o badge vermelho apontando para o nada.
   */
  const temConversa = (item.observacoes ?? []).length > 0 || pendencias > 0;

  const sortable = useSortable({ id: item.id, disabled: !ordenavel });
  const status = statusExibido(item, hoje);

  return (
    <li
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      id={idAncoraPendencia(item.id)}
      className={cx(
        "group relative px-4 py-2.5 transition-colors hover:bg-[#FCFCFD]",
        // Atrasada ganha um fio vermelho na lateral, não uma borda inteira.
        situacao === "atrasado" && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-danger",
        item.oculto && "opacity-60",
        selecionada && "bg-primary-soft/50",
        sortable.isDragging && "opacity-50 relative z-10 bg-surface shadow-card",
        recolhidaAberta && "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,#F7F8FA_6px,#F7F8FA_12px)]"
      )}
    >
      <div className={GRADE_COLUNAS}>
        {/* ---- seleção (em lote) ---- */}
        <span className="pt-[3px]">
          {podeEditar && (
            <input
              type="checkbox"
              checked={selecionada}
              onChange={(e) => onSelecionar(e.target.checked)}
              aria-label={`Selecionar a tarefa ${item.titulo || "sem título"}`}
              className="h-4 w-4 accent-[#F2820D]"
            />
          )}
        </span>

        {/* ---- mover: alça de arraste + setas ---- */}
        <div className="flex items-center gap-1 pt-0.5">
          {ordenavel && (
            <>
              <button
                ref={sortable.setActivatorNodeRef}
                {...sortable.listeners}
                {...sortable.attributes}
                type="button"
                className="cursor-grab active:cursor-grabbing text-ink-3 hover:text-ink shrink-0 touch-none"
                title="Arraste para mover a tarefa (inclusive para outra etapa)"
                aria-label="Arrastar a tarefa"
              >
                <IcGrip width={16} height={16} />
              </button>
              <MoverSetas
                rotulo={`a tarefa ${item.titulo || "sem título"}`}
                podeSubir={podeSubir}
                podeDescer={podeDescer}
                onSubir={() => onSeta(-1)}
                onDescer={() => onSeta(1)}
              />
            </>
          )}
        </div>

        {/* ---- Tarefa ---- */}
        <div className="min-w-0">
          {/* Texto, e não uma caixa de digitação sempre aberta: a tarefa é para
              LER; editar é a exceção, e acontece ao clicar. */}
          {editandoTitulo ? (
            <Input
              autoFocus
              className={cx("!h-8 !px-2 !text-[14px] !font-bold w-full", fechado && "line-through")}
              sugestoes={sugestoesTitulo}
              value={titulo}
              placeholder="Descreva a tarefa"
              disabled={!podeEditar}
              onChange={(e) => setTitulo(e.target.value)}
              // Grava ao sair do campo (ou no Enter), NÃO a cada tecla.
              onBlur={commitTitulo}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setTitulo(item.titulo);
                  setEditandoTitulo(false);
                }
              }}
              aria-label="Título da tarefa"
            />
          ) : (
            <button
              type="button"
              disabled={!podeEditar}
              onClick={() => setEditandoTitulo(true)}
              className={cx(
                "block w-full text-left text-[14px] font-bold leading-snug rounded px-1 -mx-1 py-0.5 input-focus",
                podeEditar && "hover:bg-[#F1F2F5] cursor-text",
                fechado ? "line-through text-ink-3" : "text-ink",
                !item.titulo && "text-ink-3 font-semibold italic"
              )}
              title={podeEditar ? "Clique para renomear" : undefined}
            >
              {item.titulo || "Descreva a tarefa"}
            </button>
          )}

          {/* A descrição: o "como fazer", embaixo do título. */}
          {editandoDescricao ? (
            <Input
              autoFocus
              className="!h-7 !px-2 !text-[12.5px] w-full mt-0.5"
              value={descricao}
              placeholder="O que precisa ser feito"
              onChange={(e) => setDescricao(e.target.value)}
              onBlur={commitDescricao}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setDescricao(item.descricao);
                  setEditandoDescricao(false);
                }
              }}
              aria-label="Descrição da tarefa"
            />
          ) : item.descricao ? (
            <button
              type="button"
              disabled={!podeEditar}
              onClick={() => setEditandoDescricao(true)}
              className={cx(
                "block w-full text-left text-[12.5px] leading-snug rounded px-1 -mx-1 mt-0.5 input-focus",
                fechado ? "text-ink-3" : "text-ink-2",
                podeEditar && "hover:bg-[#F1F2F5] cursor-text"
              )}
              title={podeEditar ? "Clique para editar a descrição" : undefined}
            >
              {item.descricao}
            </button>
          ) : null}

          {/* Linha de apoio da tarefa: etapa (mover por seletor), avisos e convites. */}
          <div className="mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap text-[12.5px]">
            {etapas.length > 0 && (
              <CampoDiscreto
                titulo="Etapa"
                vazio={!item.etapa}
                rotulo={item.etapa || "Sem etapa"}
                podeEditar={podeEditar}
              >
                <Select
                  className="!h-7 !px-1.5 !text-[12.5px] !w-[14rem]"
                  value={item.etapa}
                  onChange={(e) => onAlterar({ etapa: e.target.value })}
                  aria-label="Etapa da tarefa"
                >
                  <option value="">Sem etapa</option>
                  {etapas.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </Select>
              </CampoDiscreto>
            )}
            {/* O atraso já se lê na coluna Status; aqui ficam só os avisos que a
                coluna não diz (vence hoje, vence em breve). */}
            {aviso && situacao !== "atrasado" && <Badge tom={aviso.tom}>{aviso.rotulo}</Badge>}
            {recolhidaAberta && <Badge tom="neutral">Recolhida</Badge>}
            {item.dataManual && (
              <span className="text-[11px] font-bold text-ink-3" title="O recálculo de prazos não altera esta data">
                data à mão
              </span>
            )}
            <NotifDot inline n={pendencias} title={`${pendencias} pendência(s) sua(s) nesta tarefa`} />
            {!item.descricao && podeEditar && (
              <button
                type="button"
                onClick={() => setEditandoDescricao(true)}
                className="font-bold text-ink-3 hover:text-primary-dark rounded px-1 -mx-1 input-focus opacity-0 group-hover:opacity-100 focus:opacity-100 max-md:opacity-100 transition-opacity"
              >
                + descrição
              </button>
            )}
            {!temConversa && (
              <div className="ml-auto max-md:ml-0 max-md:w-full opacity-0 group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100 transition-opacity">
                <ObservacoesThread
                  className="!border-t-0 !px-0 !py-0"
                  ancora={item.id}
                  observacoes={item.observacoes ?? []}
                  usuarios={usuarios}
                  onChange={onObservacoes}
                  anexos={anexos}
                />
              </div>
            )}
          </div>

          {/* A conversa, quando existe, fica na linha de baixo (padrão da EC). */}
          {temConversa && (
            <div className="mt-1.5 pt-1.5 border-t border-border-soft">
              <ObservacoesThread
                className="!border-t-0 !px-0 !py-0"
                ancora={item.id}
                observacoes={item.observacoes ?? []}
                usuarios={usuarios}
                onChange={onObservacoes}
                anexos={anexos}
              />
            </div>
          )}
        </div>

        {/* ---- Responsável · Data de Conclusão · Status ----
            Em tela larga são colunas da grade; no celular descem juntas, em
            linha, embaixo da tarefa. */}
        <div className="col-span-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] md:contents">
          <div className="min-w-0 md:pt-1">
            <CampoDiscreto
              titulo="Responsável"
              vazio={!item.responsavel}
              rotulo={item.responsavel || "Sem responsável"}
              podeEditar={podeEditar}
            >
              <Select
                className="!h-7 !px-1.5 !text-[12.5px] !w-[13rem]"
                value={item.responsavel}
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
            </CampoDiscreto>
          </div>

          <div className="md:pt-1">
            <CampoDiscreto
              icone={<IcCalendar width={13} height={13} />}
              titulo="Data Prevista — o prazo calculado pelo sistema; clique para ajustar à mão"
              vazio={!item.dataLimite}
              rotulo={item.dataLimite ? dataBR(item.dataLimite) : "Sem data"}
              tom={situacao === "atrasado" ? "danger" : undefined}
              podeEditar={podeEditar}
            >
              <Input
                type="date"
                className="!h-7 !px-1.5 !text-[12.5px] !w-[9.5rem]"
                value={item.dataLimite}
                // Editar a data trava o item contra o recálculo automático: o
                // ajuste da pessoa vale mais que a régua do modelo.
                onChange={(e) => onAlterar({ dataLimite: e.target.value, dataManual: true })}
                aria-label="Data prevista da tarefa"
              />
            </CampoDiscreto>
          </div>

          {/* DATA DE CONCLUSÃO: quando a tarefa foi de fato concluída. Vazia
              enquanto a tarefa está aberta; depois de concluída, editável
              (quem terminou na sexta e marcou na segunda corrige aqui). */}
          <div className="min-w-0 md:pt-1">
            {item.status === "Concluído" ? (
              <ConclusaoDoItem item={item} podeEditar={podeEditar} onAlterar={onAlterar} />
            ) : (
              <span className="font-semibold text-ink-3">—</span>
            )}
          </div>

          <div className="min-w-0 md:pt-1">
            {/* Pendente, Atrasado ou Concluído — o valor mostrado sai do prazo;
                o que se escolhe é Pendente, Concluído ou Não se aplica. */}
            <CampoDiscreto titulo="Status" rotulo={status} tom={tomStatusExibido[status]} podeEditar={podeEditar}>
              <Select
                className="!h-7 !px-1.5 !text-[12.5px] !w-[9.5rem]"
                value={item.status === "Concluído" || item.status === "Não se aplica" ? item.status : "Pendente"}
                onChange={(e) => onStatus(e.target.value as StatusChecklist)}
                aria-label="Status da tarefa"
              >
                <option value="Pendente">Pendente</option>
                <option value="Concluído">Concluído</option>
                <option value="Não se aplica">Não se aplica</option>
              </Select>
            </CampoDiscreto>
          </div>
        </div>

        {/* ---- recolher / excluir: só no hover (e sempre no toque) ---- */}
        {podeEditar ? (
          <div className="col-span-3 md:col-span-1 flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onAlterar({ oculto: !item.oculto })}
              className="rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5] hover:text-ink"
              title={item.oculto ? "Trazer de volta para a lista" : "Recolher da lista"}
            >
              {item.oculto ? <IcEye width={16} height={16} /> : <IcEyeOff width={16} height={16} />}
            </button>
            {/* Só o item criado à mão pode ser apagado um a um; o que veio do
                modelo se recolhe ou vira "Não se aplica". (A exclusão em lote
                trata os dois casos — ver `excluirMarcadas`.) */}
            {!item.origemModeloItemId && (
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
        ) : (
          <span className="max-md:hidden" />
        )}
      </div>
    </li>
  );
}

/**
 * O nome de uma etapa que ainda não existe: "Nova etapa", "Nova etapa 2"…
 *
 * Numerar é o que evita duas etapas com o mesmo nome — e duas etapas com o
 * mesmo nome seriam UMA na tela, porque o agrupamento é pelo nome.
 */
function nomeDeEtapaNova(itens: ItemChecklist[]): string {
  const existentes = new Set(itens.map((i) => (i.etapa || "").trim().toLocaleLowerCase("pt-BR")));
  const base = "Nova etapa";
  if (!existentes.has(base.toLocaleLowerCase("pt-BR"))) return base;
  for (let n = 2; n < 100; n++) {
    const tentativa = `${base} ${n}`;
    if (!existentes.has(tentativa.toLocaleLowerCase("pt-BR"))) return tentativa;
  }
  return `${base} ${Date.now()}`;
}

/**
 * O nome da ETAPA — texto que vira campo no clique, como o resto da lista.
 *
 * Renomear daqui acerta todas as tarefas da etapa de uma vez (ver
 * `renomearEtapa`): a etapa não é um registro, é o nome que as tarefas
 * carregam, e mudá-lo item a item partiria a lista em duas no meio do caminho.
 *
 * Nome vazio volta ao anterior: uma etapa sem nome cairia em "OUTROS" levando
 * as tarefas junto, e a pessoa não veria de onde elas sumiram.
 */
function NomeDaEtapa({ nome, onRenomear }: { nome: string; onRenomear: (nome: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nome);
  useEffect(() => {
    if (!editando) setTexto(nome);
  }, [nome, editando]);

  const commit = () => {
    setEditando(false);
    const limpo = colapsarEspacos(texto);
    if (!limpo || limpo === nome) {
      setTexto(nome);
      return;
    }
    onRenomear(limpo);
  };

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        title="Renomear a etapa (vale para todas as tarefas dela)"
        className="text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-ink-2 truncate text-left rounded px-1 -mx-1 hover:bg-[#F1F2F5] input-focus"
      >
        {nome}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") { setTexto(nome); setEditando(false); }
      }}
      aria-label={`Nome da etapa ${nome}`}
      className="h-7 min-w-0 flex-1 rounded-btn border-[1.5px] border-[#BFC4CE] px-2 text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-ink input-focus"
    />
  );
}

/**
 * Um dado da tarefa que se LÊ como texto e vira controle ao ser clicado.
 *
 * A lista de tarefas mostrava prazo, responsável e status como três campos de
 * formulário sempre abertos — trinta e seis caixas com borda numa lista de doze
 * tarefas, e nenhuma delas mexida na maior parte do tempo. Aqui o normal é o
 * texto; o campo aparece no clique e some ao sair.
 *
 * Não é só estética: com tudo como caixa, a tarefa em si (o título, o prazo)
 * competia por atenção com molduras vazias, e a pessoa lia a tela procurando
 * onde estava a informação em vez de simplesmente lê-la.
 */
function CampoDiscreto({
  icone,
  titulo,
  rotulo,
  tom,
  vazio,
  podeEditar,
  children,
}: {
  icone?: ReactNode;
  /** Nome do dado, para quem passa o mouse e para leitor de tela. */
  titulo: string;
  /** O que se lê quando o campo está fechado. */
  rotulo: string;
  tom?: Tom;
  /** Sem valor: fica apagado, para "Sem responsável" não pesar como um dado. */
  vazio?: boolean;
  podeEditar: boolean;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);

  if (aberto && podeEditar) {
    return (
      // Fecha ao sair do campo — inclusive quando o foco vai para outro lugar
      // da tela. `blur` no container não basta: ele não dispara para o filho.
      <span
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setAberto(false);
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={!podeEditar}
      onClick={() => setAberto(true)}
      title={podeEditar ? `${titulo} — clique para alterar` : titulo}
      aria-label={`${titulo}: ${rotulo}`}
      className={cx(
        "inline-flex items-center gap-1 rounded px-1 -mx-1 py-0.5 font-semibold input-focus",
        podeEditar && "hover:bg-[#F1F2F5]",
        tom === "danger" ? "text-danger" : tom === "warning" ? "text-warning" : vazio ? "text-ink-3" : "text-ink-2",
        !podeEditar && "cursor-default"
      )}
    >
      {icone}
      {rotulo}
    </button>
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
  const quando = paraCampoDataHora(item.concluidoEm);
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {/* Texto até alguém precisar corrigir — o mesmo tratamento do prazo e do
          responsável. Um campo de data e hora aberto em toda tarefa concluída
          enchia a lista de caixas que quase ninguém mexe. */}
      <CampoDiscreto
        titulo="Data e hora reais da conclusão — corrija se você marcou depois de ter feito"
        rotulo={quando ? `Concluída em ${dataBR(item.concluidoEm.slice(0, 10))}` : "Sem data de conclusão"}
        vazio={!quando}
        podeEditar={podeEditar}
      >
        <Input
          type="datetime-local"
          className="!h-7 !px-1.5 !text-[12px] !w-[12.5rem]"
          value={quando}
          onChange={(e) => onAlterar(definirDataConclusao(item, e.target.value))}
          aria-label="Data e hora em que a tarefa foi concluída"
        />
      </CampoDiscreto>
      {item.concluidoPor && (
        <span className="text-[11.5px] font-semibold text-ink-3">por {item.concluidoPor}</span>
      )}
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
