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

      {/* Cada grupo é UMA lista, e não uma pilha de cartões soltos.
          O que faz uma lista parecer uma lista é a continuidade: um fundo só,
          linhas separadas por um fio, e o título preso no topo. Com um cartão
          por tarefa — borda, sombra e respiro em cada uma — doze tarefas viravam
          doze objetos, e a leitura de cima a baixo se perdia. */}
      {blocos.map((bloco) => {
        const feitas = bloco.itens.filter((i) => i.status === "Concluído").length;
        return (
          <section key={bloco.chave} className="rounded-card border border-border bg-surface shadow-card overflow-hidden">
            <header className="flex items-center gap-2 px-4 py-2.5 bg-[#FAFAFB] border-b border-border-soft">
              {agrupamento === "data" && <IcCalendar width={15} height={15} className="text-ink-3 shrink-0" />}
              <h3 className="text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-ink-2 truncate">
                {bloco.titulo}
              </h3>
              {/* "3 de 8" diz mais que "8": é o progresso do grupo, à vista. */}
              <span className="ml-auto shrink-0 text-[11.5px] font-bold text-ink-3 tabular-nums">
                {feitas} de {bloco.itens.length}
              </span>
            </header>
            <ul className="divide-y divide-border-soft">
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
            </ul>
          </section>
        );
      })}
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

  return (
    <li
      id={idAncoraPendencia(item.id)}
      className={cx(
        "group relative px-4 py-2.5 transition-colors hover:bg-[#FCFCFD]",
        // Atrasada ganha um fio vermelho na lateral, não uma borda inteira: a
        // linha continua sendo linha, e a lista não vira um mural de molduras.
        situacao === "atrasado" && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-danger",
        item.oculto && "opacity-60",
        recolhidaAberta && "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,#F7F8FA_6px,#F7F8FA_12px)]"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Concluir com um clique — o gesto mais frequente da tela, e por isso
            o maior alvo da linha. */}
        <button
          type="button"
          disabled={!podeEditar}
          onClick={() => onStatus(item.status === "Concluído" ? "Pendente" : "Concluído")}
          title={item.status === "Concluído" ? "Reabrir tarefa" : "Marcar como concluída"}
          aria-pressed={item.status === "Concluído"}
          className={cx(
            "mt-[3px] h-[22px] w-[22px] shrink-0 rounded-md border-[1.5px] grid place-items-center transition-all",
            item.status === "Concluído"
              ? "bg-success border-success text-white"
              : "border-[#C9CDD6] hover:border-success hover:bg-success-soft",
            !podeEditar && "cursor-not-allowed opacity-60"
          )}
        >
          {item.status === "Concluído" ? (
            <IcCheck width={14} height={14} />
          ) : (
            // O tique aparece esmaecido ao passar o mouse: mostra o que o clique
            // vai fazer antes de a pessoa clicar.
            <IcCheck width={14} height={14} className="text-success opacity-0 group-hover:opacity-40 transition-opacity" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          {/* ------------------------- o título ------------------------- */}
          {/* Texto, e não uma caixa de digitação sempre aberta. A tarefa é para
              LER; editar é a exceção, e acontece ao clicar. Com um input por
              linha, doze tarefas viravam doze formulários. */}
          {editandoTitulo ? (
            <Input
              autoFocus
              className={cx("!h-8 !px-2 !text-[14px] !font-bold w-full", fechado && "line-through")}
              sugestoes={sugestoesTitulo}
              value={titulo}
              placeholder="Descreva a tarefa"
              disabled={!podeEditar}
              onChange={(e) => setTitulo(e.target.value)}
              // Grava ao sair do campo (ou no Enter), NÃO a cada tecla: digitar
              // um título disparava uma gravação por caractere.
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

          {/* ------------------------- a linha de dados ------------------ */}
          {/* Prazo, responsável e status como TEXTO, lado a lado. Eram três
              caixas com borda, sempre visíveis — trinta e seis molduras numa
              lista de doze tarefas. Cada uma vira o controle de verdade quando
              recebe o clique (ver `CampoDiscreto`). */}
          <div className="mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap text-[12.5px]">
            <CampoDiscreto
              icone={<IcCalendar width={13} height={13} />}
              titulo="Data-limite"
              vazio={!item.dataLimite}
              rotulo={item.dataLimite ? dataBR(item.dataLimite) : "Sem data"}
              tom={aviso?.tom}
              podeEditar={podeEditar}
            >
              <Input
                type="date"
                className="!h-7 !px-1.5 !text-[12.5px] !w-[9.5rem]"
                value={item.dataLimite}
                // Editar a data trava o item contra o recálculo automático: o
                // ajuste da pessoa vale mais que a régua do modelo.
                onChange={(e) => onAlterar({ dataLimite: e.target.value, dataManual: true })}
                aria-label="Data-limite da tarefa"
              />
            </CampoDiscreto>

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

            {/* O status aparecia DUAS vezes: no seletor e num selo logo abaixo.
                Agora é um só, e ele é o próprio controle. */}
            <CampoDiscreto titulo="Status" rotulo={item.status} tom={tomStatus[item.status]} podeEditar={podeEditar}>
              <Select
                className="!h-7 !px-1.5 !text-[12.5px] !w-[11rem]"
                value={item.status}
                onChange={(e) => onStatus(e.target.value as StatusChecklist)}
                aria-label="Status da tarefa"
              >
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </CampoDiscreto>

            {/* Quando foi concluída, por quem e se saiu no prazo — ao lado do
                resto, e não numa linha própria. */}
            {item.status === "Concluído" && (
              <ConclusaoDoItem item={item} podeEditar={podeEditar} onAlterar={onAlterar} />
            )}

            {aviso && aviso.rotulo !== "Sem data" && <Badge tom={aviso.tom}>{aviso.rotulo}</Badge>}
            {recolhidaAberta && <Badge tom="neutral">Recolhida</Badge>}
            {item.dataManual && (
              <span className="text-[11px] font-bold text-ink-3" title="O recálculo de prazos não altera esta data">
                data à mão
              </span>
            )}
            <NotifDot inline n={pendencias} title={`${pendencias} pendência(s) sua(s) nesta tarefa`} />

            {/* A conversa entra na PRÓPRIA linha de dados, encostada à direita.
                Ela ocupava uma faixa inteira por tarefa — um terço da altura da
                lista gasto para dizer "Adicionar Observação" em tarefas que não
                têm observação nenhuma. Quando há conversa, a contagem fica à
                vista (é informação); quando não há, o convite só aparece ao
                passar o mouse — e sempre no toque, onde não existe hover. */}
            <div
              className={cx(
                "ml-auto",
                !temConversa && "opacity-0 group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100 transition-opacity"
              )}
            >
              <ObservacoesThread
                className="!border-t-0 !px-0 !py-0"
                ancora={item.id}
                observacoes={item.observacoes ?? []}
                usuarios={usuarios}
                onChange={onObservacoes}
                // Só aqui: a tarefa do check-list é o único lugar do sistema com
                // anexo na conversa (ver `domain/anexos`).
                anexos={anexos}
              />
            </div>
          </div>
        </div>

        {/* Recolher e excluir só aparecem no hover (e sempre no toque, onde não
            existe hover): são ações raras, e ocupavam lugar fixo em toda linha. */}
        {podeEditar && (
          <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onAlterar({ oculto: !item.oculto })}
              className="rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5] hover:text-ink"
              title={item.oculto ? "Trazer de volta para a lista" : "Recolher da lista"}
            >
              {item.oculto ? <IcEye width={16} height={16} /> : <IcEyeOff width={16} height={16} />}
            </button>
            {/* Só o item criado à mão pode ser apagado: o que veio do modelo
                se recolhe ou vira "Não se aplica", preservando o padrão. */}
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
        )}
      </div>
    </li>
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
