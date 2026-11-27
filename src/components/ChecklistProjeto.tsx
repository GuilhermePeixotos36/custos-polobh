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
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePreferencia, umDe, conjuntoOuNulo } from "@/hooks/usePreferencia";
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
import { IcPlus, IcEye, IcEyeOff, IcCalendar, IcChevron, IcPencil, IcTrash, IcGrip } from "@/components/icons";
import { ObservacoesThread } from "@/components/ObservacoesPopup";
import { MoverSetas } from "@/components/MoverSetas";
import { NotifDot } from "@/components/NotifDot";
import { useAnexosChecklist } from "@/hooks/useAnexosChecklist";
import { idAncoraPendencia } from "@/lib/destaque";
import type { Pendencia } from "@/domain/pendencias";
import { CabecalhoColuna, FiltroLista, type DirecaoOrdem } from "@/components/FiltroColuna";
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
import { colapsarEspacos, cx, dataBR, hojeLocalIso } from "@/lib/format";
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

const hojeIso = () => hojeLocalIso();

type Agrupamento = "etapa" | "data";

const SEM_PENDENCIAS: Pendencia[] = [];
const SEM_MOTIVOS: string[] = [];

/** O que a pendência pede de quem está olhando — a etiqueta que aparece na tarefa. */
const MOTIVO_PENDENCIA: Record<string, string> = {
  "checklist.atrasado": "Com você: atrasada",
  "checklist.vencendo": "Com você: vence hoje",
  "checklist.observacao": "Com você: responder",
};
const ORDEM_MOTIVOS = ["checklist.atrasado", "checklist.vencendo", "checklist.observacao"];

/** Colunas que ordenam (cabeçalho com ↑ ↓). */
type ColunaOrdem = "tarefa" | "responsavel" | "prevista" | "conclusao" | "status";
const SEM_RESPONSAVEL = "__sem__";
const STATUS_EXIBIDOS: StatusExibido[] = ["Pendente", "Atrasado", "Concluído", "Não se aplica"];
/** Faixas do filtro da Data Prevista — as mesmas das pílulas do resumo. */
const FAIXAS_PRAZO: { valor: SituacaoPrazo; rotulo: string }[] = [
  { valor: "atrasado", rotulo: "Atrasadas" },
  { valor: "hoje", rotulo: "Vencem hoje" },
  { valor: "proximo", rotulo: "Vencem nos próximos 3 dias" },
  { valor: "em-dia", rotulo: "No prazo (mais adiante)" },
  { valor: "sem-data", rotulo: "Sem data" },
  { valor: "encerrado", rotulo: "Encerradas (concluídas ou não se aplica)" },
];
const ORDEM_STATUS: Record<StatusExibido, number> = { Atrasado: 0, Pendente: 1, Concluído: 2, "Não se aplica": 3 };

interface Props {
  checklist: Checklist;
  /** Nomes dos usuários — alimentam @menções e a escolha de responsável. */
  usuarios: string[];
  podeEditar: boolean;
  /**
   * Apagar tarefa — só Coordenação e Direção (recurso `checklists.excluir`,
   * 01/10/2026). Incluir e editar é de todos; excluir não tem volta.
   */
  podeExcluir: boolean;
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
  /**
   * As pendências DO USUÁRIO neste check-list, uma a uma (26/11/2026) — a mesma
   * lista do sininho e da pílula do canto. Alimentam o filtro "Tarefas com
   * pendência" e a etiqueta que diz, em cada tarefa, o que está esperando por
   * ela.
   */
  minhasPendencias?: Pendencia[];
  /** O que abre o topo congelado, acima do resumo — a observação da aba, que vem da tela do projeto. */
  topo?: ReactNode;
}

export function ChecklistProjeto({
  checklist,
  usuarios,
  podeEditar,
  podeExcluir,
  onSalvarItem,
  onCriarItem,
  onRemoverItem,
  onSalvarVarios,
  onRemoverVarios,
  onSincronizar,
  itensNovosNoModelo = 0,
  pendenciasPorItem = {},
  minhasPendencias = SEM_PENDENCIAS,
  topo,
}: Props) {
  const hoje = hojeIso();
  const nomeAtual = useAuth((s) => s.usuario?.nome ?? "");
  // Memória dos campos: título e etapa de tarefa se repetem projeto a projeto.
  const sugestoes = useSugestoes();
  /*
   * A VISTA DO CHECK-LIST É DO USUÁRIO (27/11/2026): agrupamento, filtros de
   * coluna, ordenação e "só as minhas pendências" ficam guardados e valem em
   * todo projeto, até a pessoa trocar (ver `usePreferencia`). A busca não.
   */
  const booleano = { deGuardado: (b: unknown) => (typeof b === "boolean" ? b : undefined) };
  const [verRecolhidas, setVerRecolhidas] = usePreferencia<boolean>("checklist.verRecolhidas", false, booleano);
  const [agrupamento, setAgrupamento] = usePreferencia<Agrupamento>("checklist.agrupamento", "etapa", umDe(["etapa", "data"] as const));
  // Filtros por coluna, como no Excel: `null` = todos (sem filtro).
  const [filtroResp, setFiltroResp] = usePreferencia<Set<string> | null>("checklist.filtroResp", null, conjuntoOuNulo<string>());
  const [filtroStatus, setFiltroStatus] = usePreferencia<Set<StatusExibido> | null>("checklist.filtroStatus", null, conjuntoOuNulo<StatusExibido>());
  const [filtroPrazo, setFiltroPrazo] = usePreferencia<Set<SituacaoPrazo> | null>("checklist.filtroPrazo", null, conjuntoOuNulo<SituacaoPrazo>());
  const [buscaTarefa, setBuscaTarefa] = useState("");
  const [ordem, setOrdem] = usePreferencia<{ coluna: ColunaOrdem; dir: DirecaoOrdem } | null>("checklist.ordem", null, {
    deGuardado: (b) => {
      if (b === null) return null;
      const o = b as { coluna?: string; dir?: string };
      return ["tarefa", "responsavel", "prevista", "conclusao", "status"].includes(o?.coluna ?? "") && (o.dir === "asc" || o.dir === "desc")
        ? { coluna: o.coluna as ColunaOrdem, dir: o.dir }
        : undefined;
    },
  });
  /** Só as tarefas que têm pendência de quem está olhando. */
  const [soPendencias, setSoPendencias] = usePreferencia<boolean>("checklist.soPendencias", false, booleano);
  const temFiltro = filtroResp !== null || filtroStatus !== null || filtroPrazo !== null || !!buscaTarefa.trim() || soPendencias;
  const limparFiltros = () => {
    setSoPendencias(false);
    setFiltroResp(null);
    setFiltroStatus(null);
    setFiltroPrazo(null);
    setBuscaTarefa("");
  };
  /** Clique num quadro do resumo: filtra só por ele; no que já está ligado, tira o filtro. */
  const filtrarPeloResumo = (alvo: { prazo?: SituacaoPrazo[]; status?: StatusExibido[] }) => {
    const jaLigado = alvo.prazo ? mesmoConjunto(filtroPrazo, alvo.prazo) : mesmoConjunto(filtroStatus, alvo.status ?? []);
    limparFiltros();
    if (jaLigado) return;
    if (alvo.prazo) setFiltroPrazo(new Set(alvo.prazo));
    if (alvo.status) setFiltroStatus(new Set(alvo.status));
  };
  const ordenarPor = (coluna: ColunaOrdem) =>
    setOrdem((o) => (o?.coluna !== coluna ? { coluna, dir: "asc" } : o.dir === "asc" ? { coluna, dir: "desc" } : null));
  // Edição em lote: status e prazo das tarefas marcadas.
  const [prazoEmLote, setPrazoEmLote] = useState("");
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
   * AS PENDÊNCIAS DE QUEM ESTÁ OLHANDO, À VISTA (26/11/2026).
   *
   * O número vermelho já existia — no sininho, na aba e numa bolinha ao lado da
   * tarefa —, mas dentro do check-list ele se perdia entre 180 linhas: a pessoa
   * sabia que tinha "5" e não via quais nem por quê. Agora a barra tem um botão
   * que filtra só elas e cada tarefa traz uma etiqueta com o que ela espera
   * ("Com você: atrasada"). Quem leva de uma pendência à outra continua sendo a
   * pílula do canto, como em todas as telas — a faixa que repetia o papel dela
   * no topo desta lista saiu em 27/11/2026.
   */
  const pendenciasDasTarefas = useMemo(() => minhasPendencias.filter((p) => !!p.checklistItemId), [minhasPendencias]);
  const motivosPorItem = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const p of pendenciasDasTarefas) {
      const lista = mapa.get(p.checklistItemId!) ?? [];
      if (!lista.includes(p.tipo)) lista.push(p.tipo);
      mapa.set(p.checklistItemId!, lista);
    }
    return mapa;
  }, [pendenciasDasTarefas]);
  // A última pendência foi resolvida com o filtro ligado: ele se desliga, senão a lista ficaria vazia.
  useEffect(() => {
    if (soPendencias && pendenciasDasTarefas.length === 0) setSoPendencias(false);
  }, [soPendencias, pendenciasDasTarefas.length]);
  const alternarSoPendencias = () => {
    const ligar = !soPendencias;
    limparFiltros();
    setSoPendencias(ligar);
  };

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
    // Filtrar por Concluído/Não se aplica (ou pela faixa "Encerradas") é pedir para ver as
    // recolhidas: sem isto o filtro devolvia uma lista vazia.
    const querEncerradas =
      (filtroStatus !== null && (filtroStatus.has("Concluído") || filtroStatus.has("Não se aplica"))) ||
      (filtroPrazo !== null && filtroPrazo.has("encerrado"));
    const base = checklist.itens.filter(
      (i) => verRecolhidas || querEncerradas || !i.oculto || cobrada(i) || encerradasAgora.includes(i.id)
    );
    const termo = colapsarEspacos(buscaTarefa).toLowerCase();
    const filtrados = base.filter((i) => {
      if (soPendencias && !cobrada(i)) return false;
      if (filtroResp !== null && !filtroResp.has(i.responsavel || SEM_RESPONSAVEL) && !cobrada(i)) return false;
      if (filtroStatus !== null && !filtroStatus.has(statusExibido(i, hoje))) return false;
      if (filtroPrazo !== null && !filtroPrazo.has(situacaoPrazo(i, hoje))) return false;
      if (termo && !`${i.titulo} ${i.descricao}`.toLowerCase().includes(termo)) return false;
      return true;
    });
    return ordenarPorPrazo(filtrados);
  }, [checklist.itens, verRecolhidas, filtroResp, filtroStatus, filtroPrazo, buscaTarefa, soPendencias, pendenciasPorItem, encerradasAgora, hoje]);

  /** A ordenação escolhida no cabeçalho (vale dentro de cada grupo). */
  const comparar = useMemo(() => {
    if (!ordem) return null;
    const fator = ordem.dir === "asc" ? 1 : -1;
    const texto = (a: string, b: string) => {
      if (!a && !b) return 0;
      if (!a) return 1; // vazio sempre no fim
      if (!b) return -1;
      return a.localeCompare(b, "pt-BR") * fator;
    };
    return (a: ItemChecklist, b: ItemChecklist) => {
      switch (ordem.coluna) {
        case "tarefa": return texto(a.titulo, b.titulo);
        case "responsavel": return texto(a.responsavel, b.responsavel);
        case "prevista": return texto(a.dataLimite, b.dataLimite);
        case "conclusao": return texto(a.concluidoEm, b.concluidoEm);
        case "status": return (ORDEM_STATUS[statusExibido(a, hoje)] - ORDEM_STATUS[statusExibido(b, hoje)]) * fator || texto(a.dataLimite, b.dataLimite);
      }
    };
  }, [ordem, hoje]);

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
        itens: comparar ? [...g.itens].sort(comparar) : g.itens,
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
      itens: comparar ? [...itens].sort(comparar) : itens,
    }));
  }, [visiveis, agrupamento, comparar]);

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


  /** Opções dos funis, com a contagem de cada valor na lista inteira. */
  const opcoesResp = useMemo(() => {
    const conta = new Map<string, number>();
    for (const i of checklist.itens) conta.set(i.responsavel || SEM_RESPONSAVEL, (conta.get(i.responsavel || SEM_RESPONSAVEL) ?? 0) + 1);
    return [...conta.entries()]
      .sort(([a], [b]) => (a === SEM_RESPONSAVEL ? 1 : b === SEM_RESPONSAVEL ? -1 : a.localeCompare(b, "pt-BR")))
      .map(([valor, contagem]) => ({ valor, contagem, rotulo: valor === SEM_RESPONSAVEL ? "(sem responsável)" : valor }));
  }, [checklist.itens]);
  const opcoesStatus = useMemo(
    () => STATUS_EXIBIDOS.map((v) => ({ valor: v, rotulo: v, contagem: checklist.itens.filter((i) => statusExibido(i, hoje) === v).length })),
    [checklist.itens, hoje]
  );
  const opcoesPrazo = useMemo(
    () => FAIXAS_PRAZO.map((f) => ({ ...f, contagem: checklist.itens.filter((i) => situacaoPrazo(i, hoje) === f.valor).length })),
    [checklist.itens, hoje]
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

  /**
   * STATUS EM LOTE — o único caminho para concluir, reabrir ou marcar "Não se
   * aplica" várias tarefas (26/11/2026). Os botões "Concluir selecionadas" e
   * "Reabrir selecionadas" saíram: faziam o mesmo que escolher o status aqui.
   *
   * Vale a mesma regra da tarefa individual (data e autor da conclusão). Reabrir
   * o que estava concluído apaga a data de conclusão registrada, por isso
   * pergunta antes.
   */
  const statusEmLote = async (status: StatusChecklist) => {
    const alvo = marcadas.filter((i) => i.status !== status);
    if (!alvo.length) return;
    const reabre = status !== "Concluído" && status !== "Não se aplica";
    const concluidas = alvo.filter((i) => i.status === "Concluído").length;
    if (reabre && concluidas > 0) {
      const ok = await confirmar({
        titulo: concluidas === 1 ? "Reabrir a tarefa concluída?" : `Reabrir ${concluidas} tarefas concluídas?`,
        mensagem: `Elas voltam para ${status} e reaparecem na lista. A data de conclusão registrada é apagada.`,
        confirmarTexto: "Reabrir",
      });
      if (!ok) return;
    }
    const agora = new Date().toISOString();
    const depois = alvo.map((i) => definirStatus(i, status, nomeAtual, agora));
    setEncerradasAgora((ids) => {
      const fechadas = depois.filter((i) => encerrado(i)).map((i) => i.id);
      const abertas = new Set(depois.filter((i) => !encerrado(i)).map((i) => i.id));
      return [...new Set([...ids.filter((id) => !abertas.has(id)), ...fechadas])];
    });
    onSalvarVarios(depois);
    setSelecionadas(new Set());
  };

  /** Prazo em lote: a data vira manual (o recálculo automático não passa por cima dela). */
  const prazoEmLoteAplicar = () => {
    if (!prazoEmLote || !marcadas.length) return;
    onSalvarVarios(marcadas.map((i) => ({ ...i, dataLimite: prazoEmLote, dataManual: true })));
    setPrazoEmLote("");
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
    limparFiltros();
    const id = await onCriarItem(base);
    if (typeof id === "string") setIdRecemCriado(id);
  };

  return (
    <div className="space-y-4">
      {/* O TOPO DO CHECK-LIST FICA CONGELADO (27/11/2026): a observação da aba, o
          resumo, os botões, a seleção em lote e os nomes das colunas grudam juntos
          logo abaixo do cabeçalho da página. Rolando a lista, o que está em cima é
          sempre o mesmo — e os filtros ficam à mão. Só da tela média para cima:
          no celular esse bloco ocuparia a tela inteira. O fundo é o da página,
          para as tarefas não aparecerem por trás dos espaços entre os cartões. */}
      <div className="space-y-4 md:sticky md:top-[calc(var(--altura-topnav)+var(--altura-cabecalho))] md:z-10 md:bg-bg md:pb-2 md:-mt-4 md:pt-4">
        {topo}
      {/* ----------------------------- resumo ----------------------------- */}
      <Card>
        {/* O RESUMO EM TRÊS BLOCOS (26/11/2026): o progresso, o que está EM ABERTO (repartido pelo
            prazo) e o que está ENCERRADO. Cada quadro é um número grande com o nome embaixo, todos
            do mesmo tamanho, e os dois grupos fecham a conta: em aberto + encerradas = total.
            Clicar num quadro filtra a lista por ele; clicar de novo tira o filtro. */}
        <div className="flex flex-wrap items-stretch gap-x-6 gap-y-4">
          <div className="min-w-[230px] flex-1 basis-[230px] max-w-md">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-ink-3">Progresso</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-[26px] font-extrabold leading-none text-ink tabular-nums">
                {resumo.concluidos}
                <span className="text-ink-3">/{resumo.contam}</span>
              </span>
              <span className="text-[13px] font-bold text-ink-2">tarefas concluídas</span>
              <span className="ml-auto text-[14px] font-extrabold text-primary-dark tabular-nums">
                {Math.round(resumo.progresso * 100)}%
              </span>
            </div>
            <div className="mt-2">
              <ProgressBar value={resumo.progresso * 100} />
            </div>
            <div className="mt-1.5 text-[11.5px] font-semibold text-ink-3">
              {resumo.total} no total
              {resumo.naoSeAplica > 0 &&
                ` · ${resumo.naoSeAplica} ${resumo.naoSeAplica === 1 ? "não se aplica e fica" : "não se aplicam e ficam"} fora da conta`}
            </div>
          </div>

          <GrupoResumo titulo="Em aberto" total={resumo.abertos} className="flex-[4_1_420px]">
            <QuadroResumo tom="danger" n={resumo.atrasados} rotulo={resumo.atrasados === 1 ? "Atrasada" : "Atrasadas"}
              titulo="Prazo vencido e ainda não concluídas"
              ativo={mesmoConjunto(filtroPrazo, ["atrasado"])} onClick={() => filtrarPeloResumo({ prazo: ["atrasado"] })} />
            <QuadroResumo tom="warning" n={resumo.proximos} rotulo={resumo.proximos === 1 ? "Vence em 3 dias" : "Vencem em 3 dias"}
              titulo="Vencem hoje ou nos próximos 3 dias"
              ativo={mesmoConjunto(filtroPrazo, ["hoje", "proximo"])} onClick={() => filtrarPeloResumo({ prazo: ["hoje", "proximo"] })} />
            <QuadroResumo tom="info" n={resumo.noPrazo} rotulo="No prazo"
              titulo="Abertas, com prazo mais adiante"
              ativo={mesmoConjunto(filtroPrazo, ["em-dia"])} onClick={() => filtrarPeloResumo({ prazo: ["em-dia"] })} />
            <QuadroResumo tom="neutral" n={resumo.semData} rotulo="Sem data"
              titulo="Abertas, sem data prevista"
              ativo={mesmoConjunto(filtroPrazo, ["sem-data"])} onClick={() => filtrarPeloResumo({ prazo: ["sem-data"] })} />
          </GrupoResumo>

          <GrupoResumo titulo="Encerradas" total={resumo.concluidos + resumo.naoSeAplica} className="flex-[2_1_210px]">
            <QuadroResumo tom="success" n={resumo.concluidos} rotulo={resumo.concluidos === 1 ? "Concluída" : "Concluídas"}
              titulo="Concluídas"
              ativo={mesmoConjunto(filtroStatus, ["Concluído"])} onClick={() => filtrarPeloResumo({ status: ["Concluído"] })} />
            <QuadroResumo tom="neutral" n={resumo.naoSeAplica} rotulo={resumo.naoSeAplica === 1 ? "Não se aplica" : "Não se aplicam"}
              titulo="Marcadas como Não se aplica (fora do progresso)"
              ativo={mesmoConjunto(filtroStatus, ["Não se aplica"])} onClick={() => filtrarPeloResumo({ status: ["Não se aplica"] })} />
          </GrupoResumo>
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
          {nomeAtual && (
            <Button
              size="sm"
              variant={filtroResp?.size === 1 && filtroResp.has(nomeAtual) ? "soft" : "secondary"}
              onClick={() => setFiltroResp((f) => (f?.size === 1 && f.has(nomeAtual) ? null : new Set([nomeAtual])))}
              title="Só as tarefas em que você é o responsável"
            >
              Minhas tarefas
            </Button>
          )}
          {/* Só as tarefas que esperam por quem está olhando. Com zero ele fica apagado,
              e a pessoa sabe que não deve nada aqui. */}
          <Button
            size="sm"
            variant={soPendencias ? "soft" : "secondary"}
            disabled={pendenciasDasTarefas.length === 0}
            onClick={alternarSoPendencias}
            className="disabled:opacity-50"
            title={
              pendenciasDasTarefas.length
                ? "Só as tarefas que estão esperando por você: atrasadas, para hoje ou com observação para responder"
                : "Nenhuma tarefa deste check-list está esperando por você"
            }
          >
            Tarefas com pendência
            <span
              className={cx(
                "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-extrabold leading-none tabular-nums",
                pendenciasDasTarefas.length ? "bg-danger text-white" : "bg-[#E4E6EC] text-ink-3"
              )}
            >
              {pendenciasDasTarefas.length}
            </span>
          </Button>
          {(temFiltro || ordem) && (
            <Button size="sm" variant="text" onClick={() => { limparFiltros(); setOrdem(null); }}>
              Limpar filtros e ordenação
            </Button>
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

      {/* --------------------------- alterações em lote --------------------------
          UMA barra, três gestos (26/11/2026): mudar o status, mudar o prazo e
          excluir. Tudo na mesma altura e com a mesma moldura; o que cada controle
          muda está escrito nele. Concluir e reabrir em lote são o próprio "Status". */}
      {podeEditar && visiveis.length > 0 && (
        <div
          className={cx(
            "flex min-h-[52px] items-center gap-x-4 gap-y-2 flex-wrap rounded-card border px-4 py-2 transition-colors",
            marcadas.length ? "border-primary bg-primary-soft" : "border-border bg-surface"
          )}
        >
          <label className="inline-flex items-center gap-2 text-[13px] font-bold text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={todasMarcadas}
              onChange={(e) => alternarMarca(idsVisiveis, e.target.checked)}
              className="h-4 w-4 accent-[#F2820D]"
            />
            Selecionar todas
          </label>
          {marcadas.length === 0 ? (
            <span className="text-[12.5px] font-semibold text-ink-3">
              {podeExcluir
                ? "Marque as tarefas para mudar o status, o prazo ou excluir várias de uma vez"
                : "Marque as tarefas para mudar o status ou o prazo de várias de uma vez"}
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-2 text-[13px] font-extrabold text-primary-dark">
                <span className="tabular-nums">
                  {marcadas.length} {marcadas.length === 1 ? "selecionada" : "selecionadas"}
                </span>
                <button
                  type="button"
                  onClick={() => setSelecionadas(new Set())}
                  className="rounded px-1 text-[12.5px] font-bold text-ink-2 underline decoration-dotted underline-offset-2 hover:text-ink input-focus"
                >
                  limpar
                </button>
              </span>

              <div className="ml-auto flex items-center gap-2 flex-wrap">
                <ControleEmLote rotulo="Status">
                  <select
                    value=""
                    onChange={(e) => e.target.value && void statusEmLote(e.target.value as StatusChecklist)}
                    aria-label="Mudar o status das tarefas selecionadas"
                    className="h-full cursor-pointer appearance-none bg-transparent bg-no-repeat pl-2.5 pr-8 text-[13px] font-bold text-ink outline-none"
                    style={{ backgroundImage: SETA_LISTA, backgroundPosition: "right 10px center" }}
                  >
                    <option value="">Mudar para…</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Não se aplica">Não se aplica</option>
                  </select>
                </ControleEmLote>

                <ControleEmLote rotulo="Prazo">
                  <input
                    type="date"
                    min="1900-01-01"
                    max="2100-12-31"
                    value={prazoEmLote}
                    onChange={(e) => setPrazoEmLote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && prazoEmLoteAplicar()}
                    className="h-full bg-transparent px-2.5 text-[13px] font-bold text-ink outline-none"
                    aria-label="Nova data prevista das tarefas selecionadas"
                    title="Nova data prevista para as selecionadas"
                  />
                  <button
                    type="button"
                    disabled={!prazoEmLote}
                    onClick={prazoEmLoteAplicar}
                    className="h-full border-l-[1.5px] border-[#D6D9E0] px-3 text-[13px] font-bold text-primary-dark hover:bg-primary-soft disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent"
                  >
                    Aplicar
                  </button>
                </ControleEmLote>

                {podeExcluir && (
                  <Button size="sm" variant="danger" icon={<IcTrash width={15} height={15} />} onClick={() => void excluirMarcadas()}>
                    Excluir
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Cada grupo é UMA lista, e não uma pilha de cartões soltos.
          O que faz uma lista parecer uma lista é a continuidade: um fundo só,
          linhas separadas por um fio, e o título preso no topo. Com um cartão
          por tarefa — borda, sombra e respiro em cada uma — doze tarefas viravam
          doze objetos, e a leitura de cima a baixo se perdia. */}
      {/* Cabeçalho ÚNICO da tabela (26/11/2026): cada coluna com ordenar (↑ ↓) e funil de filtro,
          como no Excel. Ordenar vale dentro de cada grupo; enquanto há ordenação, mover à mão
          fica desligado (a ordem da tela não seria a ordem gravada).
          GRUDA LOGO ABAIXO DO CABEÇALHO DA PÁGINA (27/11/2026). Estava em `top-0`
          com a mesma camada do cabeçalho da página: ao rolar, os nomes das colunas
          subiam por cima do título e das abas do projeto. Agora a posição é a
          barra do topo + o cabeçalho da página (medidos, como no `Th`), numa
          camada abaixo da dele. */}
      {checklist.itens.length > 0 && (
        <div className={cx(GRADE_COLUNAS, "max-md:flex max-md:flex-wrap rounded-card border border-border bg-[#FAFAFB] px-4 py-2 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-ink-3")}>
          <span className="max-md:hidden" />
          <span className="max-md:hidden" />
          <CabecalhoColuna rotulo="Tarefa" ordem={ordem?.coluna === "tarefa" ? ordem.dir : null} onOrdenar={() => ordenarPor("tarefa")}
            filtro={<FiltroLista rotulo="Tarefa" opcoes={[]} selecionados={null} onChange={() => {}} busca={buscaTarefa} onBusca={setBuscaTarefa} />} />
          <CabecalhoColuna rotulo="Responsável" ordem={ordem?.coluna === "responsavel" ? ordem.dir : null} onOrdenar={() => ordenarPor("responsavel")}
            filtro={<FiltroLista rotulo="Responsável" opcoes={opcoesResp} selecionados={filtroResp} onChange={setFiltroResp} />} />
          <CabecalhoColuna rotulo="Data Prevista" ordem={ordem?.coluna === "prevista" ? ordem.dir : null} onOrdenar={() => ordenarPor("prevista")}
            filtro={<FiltroLista rotulo="Data Prevista" opcoes={opcoesPrazo} selecionados={filtroPrazo} onChange={setFiltroPrazo} />} />
          <CabecalhoColuna rotulo="Data de Conclusão" ordem={ordem?.coluna === "conclusao" ? ordem.dir : null} onOrdenar={() => ordenarPor("conclusao")} />
          <CabecalhoColuna rotulo="Status" ordem={ordem?.coluna === "status" ? ordem.dir : null} onOrdenar={() => ordenarPor("status")}
            filtro={<FiltroLista rotulo="Status" opcoes={opcoesStatus} selecionados={filtroStatus} onChange={setFiltroStatus} alinharDireita />} />
          <span className="max-md:hidden" />
        </div>
      )}
      </div>

      {/* ------------------------------ lista ----------------------------- */}
      {!visiveis.length && (
        <EmptyState
          title={temFiltro ? "Nenhuma tarefa com estes filtros" : "Nenhuma tarefa em aberto"}
          hint={
            temFiltro
              ? "Troque ou limpe os filtros do cabeçalho para ver as demais."
              : recolhidas > 0
              ? `As ${recolhidas} tarefas do check-list estão concluídas ou recolhidas. Use “Ver recolhidas” para trazê-las de volta.`
              : "Este check-list ainda não tem tarefas."
          }
        />
      )}


      <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
        <SortableContext items={blocos.map((b) => `etapa:${b.chave}`)} strategy={verticalListSortingStrategy}>
          {blocos.map((bloco, indiceBloco) => {
            const progresso = progressoDoGrupo.get(bloco.chave) ?? { feitas: 0, contam: 0 };
            const idsDoBloco = bloco.itens.map((i) => i.id);
            const blocoMarcado = idsDoBloco.length > 0 && idsDoBloco.every((id) => selecionadas.has(id));
            return (
              <SecaoEtapa key={bloco.chave} id={`etapa:${bloco.chave}`} ordenavel={podeEditar && agrupamento === "etapa" && !ordem}>
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
                      {agrupamento === "etapa" && podeEditar && !ordem && (
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
                            podeExcluir={podeExcluir}
                            ordenavel={podeEditar && agrupamento === "etapa" && !ordem}
                            selecionada={selecionadas.has(item.id)}
                            onSelecionar={(marcar) => alternarMarca([item.id], marcar)}
                            podeSubir={indiceItem > 0 || indiceBloco > 0}
                            podeDescer={indiceItem < bloco.itens.length - 1 || indiceBloco < blocos.length - 1}
                            onSeta={(direcao) => moverTarefa(item, direcao)}
                            pendencias={pendenciasPorItem[item.id] ?? 0}
                            motivos={motivosPorItem.get(item.id) ?? SEM_MOTIVOS}
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
  podeExcluir,
  ordenavel,
  selecionada,
  onSelecionar,
  podeSubir,
  podeDescer,
  onSeta,
  sugestoesTitulo,
  etapas,
  pendencias,
  motivos,
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
  podeExcluir: boolean;
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
  /** Por que a tarefa está com o usuário (tipos de pendência) — vira etiqueta. */
  motivos: string[];
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
                "group/titulo flex w-full items-start gap-1.5 text-left text-[14px] font-bold leading-snug rounded-btn border border-transparent px-1.5 -mx-1.5 py-[3px] input-focus",
                podeEditar && "hover:border-primary hover:bg-surface cursor-text",
                fechado ? "line-through text-ink-3" : "text-ink",
                !item.titulo && "text-ink-3 font-semibold italic"
              )}
              title={podeEditar ? "Clique para renomear" : undefined}
            >
              <span className="min-w-0 flex-1">{item.titulo || "Descreva a tarefa"}</span>
              {/* O lápis aparece ao passar o mouse na linha: é o aviso de que o título se edita. */}
              {podeEditar && (
                <IcPencil
                  width={13}
                  height={13}
                  className="mt-[3px] shrink-0 text-ink-3 opacity-0 group-hover:opacity-70 group-hover/titulo:text-primary-dark group-hover/titulo:opacity-100 max-md:opacity-70 transition-opacity"
                  aria-hidden
                />
              )}
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
                "block w-full text-left text-[12.5px] leading-snug rounded-btn border border-transparent px-1.5 -mx-1.5 py-px mt-0.5 input-focus",
                fechado ? "text-ink-3" : "text-ink-2",
                podeEditar && "hover:border-primary hover:bg-surface cursor-text"
              )}
              title={podeEditar ? "Clique para editar a descrição" : undefined}
            >
              {item.descricao}
            </button>
          ) : null}

          {/* Linha de apoio da tarefa: etapa (mover por seletor), avisos e convites. */}
          <div className="mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap text-[12.5px]">
            {etapas.length > 0 && (
              <CampoLista
                titulo="Etapa"
                vazio={!item.etapa}
                rotulo={item.etapa || "Sem etapa"}
                podeEditar={podeEditar}
                valor={item.etapa}
                onChange={(etapa) => onAlterar({ etapa })}
                className="max-w-[16rem] !h-[24px] !border-transparent !bg-[#F1F2F5] !text-[11.5px] !text-ink-2 hover:!border-primary"
              >
                <option value="">Sem etapa</option>
                {etapas.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </CampoLista>
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
            {/* O que esta tarefa espera de quem está olhando. Sem motivo conhecido, fica a bolinha com o número. */}
            {motivos.length > 0 ? (
              ORDEM_MOTIVOS.filter((m) => motivos.includes(m)).map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-danger px-2 py-[3px] text-[11px] font-extrabold leading-none text-white"
                  title="Pendência sua nesta tarefa"
                >
                  {MOTIVO_PENDENCIA[m]}
                </span>
              ))
            ) : (
              <NotifDot inline n={pendencias} title={`${pendencias} pendência(s) sua(s) nesta tarefa`} />
            )}
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
          <div className="min-w-0 max-md:w-[13rem]">
            <CampoLista
              titulo="Responsável"
              vazio={!item.responsavel}
              rotulo={item.responsavel || "Sem responsável"}
              podeEditar={podeEditar}
              valor={item.responsavel}
              onChange={(responsavel) => onAlterar({ responsavel })}
            >
              <option value="">Sem responsável</option>
              {/* Quem saiu da lista de usuários continua aparecendo na tarefa que já era dele. */}
              {item.responsavel && !usuarios.includes(item.responsavel) && <option value={item.responsavel}>{item.responsavel}</option>}
              {usuarios.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </CampoLista>
            {/* A função da lista padrão ("Back-Office", "Direção de Produção"…):
                quem é a pessoa pode variar, a função da tarefa não. */}
            {!!item.funcoes?.length && (
              <div className="text-[11px] font-bold text-ink-3 leading-tight mt-0.5" title="Função responsável, pela lista padrão">
                {item.funcoes.join(" + ")}
              </div>
            )}
          </div>

          <div className="min-w-0 max-md:w-[8.5rem]">
            <CampoDataLinha
              titulo="Data Prevista — o prazo calculado pelo sistema; dá para ajustar à mão"
              vazio={!item.dataLimite}
              rotulo={item.dataLimite ? dataBR(item.dataLimite) : "Sem data"}
              tom={situacao === "atrasado" ? "danger" : undefined}
              podeEditar={podeEditar}
              larguraAberto="w-[9.5rem]"
            >
              <Input
                type="date"
                className="!h-[30px] !px-2 !text-[12.5px] !font-semibold w-full"
                value={item.dataLimite}
                // Editar a data trava o item contra o recálculo automático: o
                // ajuste da pessoa vale mais que a régua do modelo.
                onChange={(e) => onAlterar({ dataLimite: e.target.value, dataManual: true })}
                aria-label="Data prevista da tarefa"
              />
            </CampoDataLinha>
          </div>

          {/* DATA DE CONCLUSÃO: quando a tarefa foi de fato concluída. Vazia
              enquanto a tarefa está aberta (e aí não há o que editar, por isso
              é só um traço, sem moldura); depois de concluída, editável (quem
              terminou na sexta e marcou na segunda corrige aqui). */}
          <div className="min-w-0 max-md:w-[10.5rem]">
            {item.status === "Concluído" ? (
              <ConclusaoDoItem item={item} podeEditar={podeEditar} onAlterar={onAlterar} />
            ) : (
              <span
                className="inline-flex h-[30px] items-center px-2 font-semibold text-ink-3"
                title="Preenchida quando a tarefa for concluída"
              >
                —
              </span>
            )}
          </div>

          <div className="min-w-0 max-md:w-[8.5rem]">
            {/* Pendente, Atrasado ou Concluído — o valor mostrado sai do prazo;
                o que se escolhe é Pendente, Concluído ou Não se aplica. */}
            <CampoLista
              titulo="Status"
              rotulo={status}
              tom={tomStatusExibido[status]}
              podeEditar={podeEditar}
              valor={item.status === "Concluído" || item.status === "Não se aplica" ? item.status : "Pendente"}
              onChange={(s) => onStatus(s as StatusChecklist)}
            >
              <option value="Pendente">Pendente</option>
              <option value="Concluído">Concluído</option>
              <option value="Não se aplica">Não se aplica</option>
            </CampoLista>
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
            {podeExcluir && !item.origemModeloItemId && (
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
/*
 * OS CAMPOS DA LINHA COM CARA DE CAMPO (26/11/2026).
 *
 * O texto puro que só virava campo no clique ficou limpo demais: nada dizia que
 * dava para editar, e quem sabia ainda precisava de dois cliques (um para o
 * texto virar caixa, outro para a lista abrir). Agora o que é editável tem
 * moldura fina, o ícone do tipo (setinha de lista, calendário) e realce laranja
 * ao passar o mouse; um clique só já abre a lista ou o calendário. O que NÃO é
 * editável (sem permissão) continua texto puro, sem moldura — a diferença entre
 * os dois é o próprio aviso.
 */
const CAMPO_LINHA =
  "relative flex h-[30px] min-w-0 items-center gap-1.5 rounded-btn border px-2 text-[12.5px] font-semibold transition-colors " +
  "hover:border-primary focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(242,130,13,0.12)]";

/** Moldura e cor do campo: neutra por padrão; colorida quando o valor tem tom (status, atraso). */
const CAMPO_LINHA_TOM: Record<Tom, string> = {
  danger: "border-danger/30 bg-danger-soft text-danger",
  warning: "border-warning/30 bg-warning-soft text-warning",
  success: "border-success/30 bg-success-soft text-success",
  info: "border-info/30 bg-info-soft text-info",
  neutral: "border-border bg-[#F0F1F4] text-ink-2",
  arquivado: "border-border bg-[#F0F1F4] text-ink-2",
};
const corCampoLinha = (tom: Tom | undefined, vazio: boolean | undefined) =>
  tom ? CAMPO_LINHA_TOM[tom] : cx("border-border bg-surface", vazio ? "text-ink-3" : "text-ink");
const corTextoPuro = (tom: Tom | undefined, vazio: boolean | undefined) =>
  tom === "danger" ? "text-danger" : tom === "warning" ? "text-warning" : tom === "success" ? "text-success" : vazio ? "text-ink-3" : "text-ink-2";

interface PropsCampoLinha {
  icone?: ReactNode;
  /** Nome do dado, para quem passa o mouse e para leitor de tela. */
  titulo: string;
  /** O que se lê no campo. */
  rotulo: string;
  tom?: Tom;
  /** Sem valor: fica apagado, para "Sem responsável" não pesar como um dado. */
  vazio?: boolean;
  podeEditar: boolean;
  /** Largura: por padrão ocupa a coluna inteira. */
  className?: string;
}

/** O dado quando a pessoa não pode editar: só texto, sem moldura. */
function TextoDoCampo({ icone, titulo, rotulo, tom, vazio }: Omit<PropsCampoLinha, "podeEditar" | "className">) {
  return (
    <span title={titulo} className={cx("inline-flex h-[30px] min-w-0 items-center gap-1.5 text-[12.5px] font-semibold", corTextoPuro(tom, vazio))}>
      {icone}
      <span className="truncate">{rotulo}</span>
    </span>
  );
}

/**
 * Campo de LISTA (responsável, status, etapa).
 *
 * O que se vê é a moldura com o texto e a setinha; por cima dela fica o
 * `<select>` de verdade, invisível. Assim um clique só abre a lista do
 * navegador, o teclado funciona como em qualquer lista, e o texto mostrado pode
 * ser diferente das opções (o status mostra "Atrasado", que não se escolhe).
 */
function CampoLista({
  valor,
  onChange,
  children,
  className,
  ...campo
}: PropsCampoLinha & { valor: string; onChange: (valor: string) => void; children: ReactNode }) {
  if (!campo.podeEditar) return <TextoDoCampo {...campo} />;
  return (
    <span className={cx(CAMPO_LINHA, corCampoLinha(campo.tom, campo.vazio), className ?? "w-full")} title={`${campo.titulo} — clique para alterar`}>
      {campo.icone}
      <span className="min-w-0 flex-1 truncate">{campo.rotulo}</span>
      <IcChevron width={13} height={13} className="shrink-0 rotate-90 opacity-60" aria-hidden />
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        aria-label={campo.titulo}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
      >
        {children}
      </select>
    </span>
  );
}

/**
 * Campo de DATA (prevista e de conclusão).
 *
 * Fechado, é a moldura com a data e o calendário; no clique vira o campo de
 * data do navegador, já em foco e com o calendário aberto — dá para escolher no
 * calendário ou digitar. Fecha sozinho ao sair.
 */
function CampoDataLinha({
  children,
  className,
  larguraAberto,
  ...campo
}: PropsCampoLinha & {
  /** O `<Input type="date">` (ou `datetime-local`) que aparece ao abrir. */
  children: ReactNode;
  /** Largura do campo aberto, quando precisa de mais espaço que a coluna (data e hora). */
  larguraAberto?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const input = caixa.current?.querySelector("input");
    if (!input) return;
    input.focus();
    // Abre o calendário junto. Navegador que não tem `showPicker` (ou que o
    // recusa) fica só com o campo em foco, que já resolve.
    try {
      input.showPicker?.();
    } catch {
      /* sem calendário automático */
    }
  }, [aberto]);

  if (!campo.podeEditar) return <TextoDoCampo {...campo} />;
  if (aberto) {
    return (
      // Fecha ao sair do campo — inclusive quando o foco vai para outro lugar da tela.
      <span
        ref={caixa}
        className={cx("relative block h-[30px]", className ?? "w-full")}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setAberto(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") setAberto(false);
        }}
      >
        <span className={cx("absolute left-0 top-0 z-10", larguraAberto ?? "w-full")}>{children}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setAberto(true)}
      title={`${campo.titulo} — clique para alterar`}
      aria-label={`${campo.titulo}: ${campo.rotulo}`}
      className={cx(CAMPO_LINHA, "cursor-pointer text-left outline-none focus-visible:border-primary", corCampoLinha(campo.tom, campo.vazio), className ?? "w-full")}
    >
      <span className="min-w-0 flex-1 truncate">{campo.rotulo}</span>
      <span className="shrink-0 opacity-60" aria-hidden>
        {campo.icone ?? <IcCalendar width={13} height={13} />}
      </span>
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
    <div className="min-w-0">
      {/* O mesmo campo da Data Prevista: a data na moldura, o calendário no
          clique. Quem concluiu e se saiu no prazo ficam na linha de baixo, em
          letra de apoio, como a função embaixo do responsável. */}
      <CampoDataLinha
        titulo="Data e hora reais da conclusão — corrija se você marcou depois de ter feito"
        rotulo={quando ? dataBR(item.concluidoEm.slice(0, 10)) : "Sem data"}
        vazio={!quando}
        podeEditar={podeEditar}
        larguraAberto="w-[12.5rem]"
      >
        <Input
          type="datetime-local"
          className="!h-[30px] !px-2 !text-[12.5px] !font-semibold w-full"
          value={quando}
          onChange={(e) => onAlterar(definirDataConclusao(item, e.target.value))}
          aria-label="Data e hora em que a tarefa foi concluída"
        />
      </CampoDataLinha>
      {(item.concluidoPor || atraso !== null) && (
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] font-bold leading-tight text-ink-3">
          {item.concluidoPor && <span className="truncate">por {item.concluidoPor}</span>}
          {atraso !== null &&
            (atraso > 0 ? (
              <span className="text-danger">
                {atraso} {atraso === 1 ? "dia de atraso" : "dias de atraso"}
              </span>
            ) : (
              <span className="text-success">no prazo</span>
            ))}
        </div>
      )}
    </div>
  );
}

/** A setinha das listas, a mesma do `Select` do design system. */
const SETA_LISTA =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236A6E78' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")";

/**
 * Um controle da barra de alterações em lote: o nome do que ele muda, numa aba
 * cinza à esquerda, e o campo ao lado — tudo numa moldura só, na altura dos
 * botões da tela.
 */
function ControleEmLote({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <span className="inline-flex h-9 items-stretch overflow-hidden rounded-btn border-[1.5px] border-[#D6D9E0] bg-surface focus-within:border-primary">
      <span className="flex items-center border-r-[1.5px] border-[#D6D9E0] bg-[#FAFAFB] px-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-3">
        {rotulo}
      </span>
      {children}
    </span>
  );
}

/** O filtro está exatamente nestes valores (nem mais, nem menos)? */
function mesmoConjunto<T>(filtro: Set<T> | null, valores: T[]): boolean {
  return filtro !== null && filtro.size === valores.length && valores.every((v) => filtro.has(v));
}

/** Um grupo de quadros do resumo, com o nome e a soma dele em cima. */
function GrupoResumo({ titulo, total, className, children }: { titulo: string; total: number; className?: string; children: ReactNode }) {
  return (
    <div className={cx("min-w-0 md:border-l md:border-border-soft md:pl-6", className)}>
      <div className="flex items-baseline gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-ink-3">
        {titulo}
        <span className="text-[12.5px] tracking-normal text-ink tabular-nums">{total}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const QUADRO_TOM: Record<Tom, { numero: string; ponto: string; ativo: string }> = {
  danger: { numero: "text-danger", ponto: "bg-danger", ativo: "border-danger bg-danger-soft" },
  warning: { numero: "text-warning", ponto: "bg-warning", ativo: "border-warning bg-warning-soft" },
  info: { numero: "text-info", ponto: "bg-info", ativo: "border-info bg-info-soft" },
  success: { numero: "text-success", ponto: "bg-success", ativo: "border-success bg-success-soft" },
  neutral: { numero: "text-ink-2", ponto: "bg-ink-3", ativo: "border-ink-3 bg-[#F0F1F4]" },
  arquivado: { numero: "text-ink-2", ponto: "bg-ink-3", ativo: "border-ink-3 bg-[#F0F1F4]" },
};

/**
 * Quadro do resumo: o número grande, na cor do assunto, e o nome embaixo.
 * Clicar filtra a lista por ele (e, ligado, desliga). Zero fica apagado.
 */
function QuadroResumo({
  tom,
  n,
  rotulo,
  titulo,
  ativo,
  onClick,
}: {
  tom: Tom;
  n: number;
  rotulo: string;
  titulo: string;
  ativo: boolean;
  onClick: () => void;
}) {
  const cores = QUADRO_TOM[tom];
  const zerado = n === 0 && !ativo;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={zerado}
      aria-pressed={ativo}
      title={ativo ? `${titulo} — filtro ligado; clique para ver todas` : `${titulo} — clique para filtrar a lista`}
      className={cx(
        "min-w-[124px] flex-1 rounded-btn border px-3 py-2 text-left transition-colors input-focus",
        ativo ? cores.ativo : "border-border-soft bg-surface",
        zerado ? "cursor-default opacity-50" : !ativo && "hover:border-border hover:bg-[#FAFAFB]"
      )}
    >
      <span className={cx("block text-[21px] font-extrabold leading-none tabular-nums", zerado ? "text-ink-3" : cores.numero)}>{n}</span>
      <span className="mt-1.5 flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-bold leading-tight text-ink-2">
        <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", cores.ponto)} aria-hidden />
        {rotulo}
      </span>
    </button>
  );
}
