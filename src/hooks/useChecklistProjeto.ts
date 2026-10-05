/**
 * Carrega e opera o check-list de um projeto.
 *
 * Concentra aqui tudo o que é efeito colateral (buscar, gerar, gravar) para a
 * tela ficar só com a apresentação. Duas decisões de comportamento moram neste
 * arquivo e valem ser lidas antes de mexer:
 *
 *  1. A GERAÇÃO é automática — abrir um projeto que tem modalidade e ainda não
 *     tem check-list já cria a lista, como pede o briefing.
 *  2. O RECÁLCULO de prazos NÃO é. Quando as datas do projeto mudam, a tela
 *     avisa e oferece o botão; ninguém tem prazo remexido sem saber.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { repo } from "@/data";
import { AVISO_REVISAO_PARCIAL, revisarDocumento } from "@/lib/correcaoOrtografica";
import { aplicarNoChecklist, camposDoChecklist } from "@/domain/revisaoTexto";
import {
  gerarChecklist,
  modeloDaModalidade,
  recalcularPrazos,
  sincronizarComModelo,
} from "@/domain/checklist";
import { datasDosFeriados } from "@/domain/feriados";
import { lerFeriados } from "@/lib/feriados";
import { usePendencias } from "@/store/pendencias";
import { toast } from "@/store/toast";
import type { Checklist, ItemChecklist, ModeloChecklist, Projeto } from "@/data/types";

export interface EstadoChecklist {
  checklist: Checklist | undefined;
  modelo: ModeloChecklist | undefined;
  carregando: boolean;
  /** Quantas tarefas mudariam de data se o recálculo fosse aplicado agora. */
  prazosDesatualizados: number;
  /** Tarefas que existem na lista padrão e ainda não estão neste check-list. */
  itensNovosNoModelo: number;
  /** A modalidade do projeto mudou depois que a lista foi gerada. */
  modalidadeDivergente: boolean;
  salvarItem: (item: ItemChecklist) => Promise<void>;
  /** Devolve o id da tarefa criada — a tela usa para dar foco nela. */
  criarItem: (base?: { etapa?: string; dataLimite?: string }) => Promise<string | void>;
  removerItem: (item: ItemChecklist) => Promise<void>;
  /** Grava várias tarefas de uma vez (reordenar, concluir em lote): uma ida ao banco só. */
  salvarVarios: (itens: ItemChecklist[]) => Promise<void>;
  /** Apaga várias tarefas de uma vez (exclusão em lote). */
  removerVarios: (itens: ItemChecklist[]) => Promise<void>;
  aplicarRecalculo: () => Promise<void>;
  sincronizar: () => Promise<void>;
  regenerar: () => Promise<void>;
}

/**
 * @param projeto      Projeto da tela.
 * @param podeEditar   Recurso `checklists.editar`.
 * @param projetoSalvo O formulário está sem alterações pendentes. Só então a
 *   lista é gerada e o recálculo é oferecido: sem esta trava, trocar a
 *   modalidade no formulário e desistir antes de salvar já teria criado o
 *   check-list da modalidade errada, e as datas em digitação ficariam
 *   disparando o aviso de prazo desatualizado a cada tecla.
 */
export function useChecklistProjeto(
  projeto: Projeto | undefined,
  podeEditar: boolean,
  projetoSalvo: boolean
): EstadoChecklist {
  const [checklist, setChecklist] = useState<Checklist | undefined>();
  const [modelos, setModelos] = useState<ModeloChecklist[]>([]);
  const [carregando, setCarregando] = useState(true);
  // Feriados que a contagem de dias úteis pula (os do ano do evento e vizinhos).
  const [feriados, setFeriados] = useState<ReadonlySet<string>>(new Set());
  // Evita a segunda geração enquanto a primeira ainda está no ar (StrictMode
  // monta o efeito duas vezes em desenvolvimento).
  const gerando = useRef(false);
  // Sem `force`: o store estrangula recargas a uma cada 4s. Marcar dez tarefas
  // em sequência recarregava o quadro dez vezes — seis consultas cada.
  const recarregarPendencias = usePendencias((s) => s.carregar);

  const projetoId = projeto?.id ?? "";
  // Ano em que o evento acontece, para a carga de feriados (sem refazer a carga a cada tecla).
  const anoDoEvento = useRef("");
  anoDoEvento.current = projeto?.info.evento ?? "";
  const modalidade = projeto?.info.modalidade ?? "";
  const modelo = useMemo(() => modeloDaModalidade(modelos, modalidade), [modelos, modalidade]);

  const carregar = useCallback(async () => {
    if (!projetoId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    try {
      const [lista, atual, guardados] = await Promise.all([
        repo.checklists.listarModelos(),
        repo.checklists.doProjeto(projetoId),
        // Sem feriado cadastrado a lista ainda funciona: só pula fim de semana.
        lerFeriados().catch(() => undefined),
      ]);
      setModelos(lista);
      setChecklist(atual);
      const ano = Number((anoDoEvento.current || "").slice(0, 4)) || new Date().getFullYear();
      setFeriados(datasDosFeriados(guardados, [ano - 1, ano, ano + 1]));
    } catch (erro) {
      toast(`Não foi possível carregar o check-list: ${(erro as Error).message}`, "danger");
    } finally {
      setCarregando(false);
    }
  }, [projetoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Cria a lista assim que o projeto tem modalidade — o "automaticamente" do briefing. */
  useEffect(() => {
    if (carregando || checklist || !projeto || !modelo || !podeEditar || gerando.current) return;
    if (!projetoId || !modalidade || !projetoSalvo) return;
    gerando.current = true;
    void (async () => {
      try {
        const novo = gerarChecklist(projeto, modelo, undefined, feriados);
        setChecklist(await repo.checklists.criar(novo));
        toast(`Check-list ${modalidade} criado com ${novo.itens.length} tarefas.`, "success");
        void recarregarPendencias(true);
      } catch {
        // Corrida entre duas abas: o índice único de projeto_id barra a segunda.
        // Recarregar resolve — quem perdeu a corrida passa a ver a lista da outra.
        await carregar();
      } finally {
        gerando.current = false;
      }
    })();
  }, [carregando, checklist, projeto, modelo, podeEditar, projetoId, modalidade, projetoSalvo, carregar, recarregarPendencias, feriados]);

  /* ----------------------------- diagnósticos ----------------------------- */

  const prazosDesatualizados = useMemo(() => {
    if (!checklist || !projeto || !modelo || !projetoSalvo) return 0;
    const recalculado = recalcularPrazos(checklist, projeto, modelo, feriados);
    return recalculado.itens.filter((novo, i) => novo.dataLimite !== checklist.itens[i]?.dataLimite).length;
  }, [checklist, projeto, modelo, projetoSalvo, feriados]);

  const itensNovosNoModelo = useMemo(() => {
    if (!checklist || !modelo) return 0;
    const jaTem = new Set(checklist.itens.map((i) => i.origemModeloItemId).filter(Boolean));
    return modelo.itens.filter((m) => !jaTem.has(m.id)).length;
  }, [checklist, modelo]);

  const modalidadeDivergente = !!checklist && !!modalidade && checklist.modalidade !== modalidade;

  /* -------------------------------- ações --------------------------------- */

  /**
   * Atualiza um item na tela e grava só ele.
   *
   * REVISÃO DE TEXTO (25/09/2026). A tarefa do check-list é lida por toda a
   * equipe e vira cobrança na tela de pendências, então entrou na revisão junto
   * com a EC e a OS.
   *
   * Aqui o cuidado com o custo é maior do que nos outros dois, porque esta
   * função é chamada a cada gesto — concluir a tarefa, mudar a data, trocar o
   * responsável. Mandar o título para a IA em todas essas seria pagar a cada
   * clique. Por isso a comparação é contra o item que está em memória: só um
   * título ou uma descrição REESCRITOS saem daqui.
   */
  const salvarItem = useCallback(
    async (item: ItemChecklist) => {
      const anterior = checklist?.itens.find((i) => i.id === item.id);
      setChecklist((c) => (c ? { ...c, itens: c.itens.map((i) => (i.id === item.id ? item : i)) } : c));
      try {
        const { documento, revisaoCompleta } = await revisarDocumento(
          camposDoChecklist([item]),
          camposDoChecklist(anterior ? [anterior] : []),
          (revisados) => aplicarNoChecklist([item], revisados)[0],
        );
        if (!revisaoCompleta) toast(AVISO_REVISAO_PARCIAL, "warning");
        // A tela mostra o texto revisado sem esperar uma recarga.
        if (documento !== item) {
          setChecklist((c) => (c ? { ...c, itens: c.itens.map((i) => (i.id === item.id ? documento : i)) } : c));
        }
        await repo.checklists.salvarItem(documento);
        void recarregarPendencias(true);
      } catch (erro) {
        toast(`Não foi possível salvar a tarefa: ${(erro as Error).message}`, "danger");
        await carregar(); // volta ao que está no banco em vez de mentir na tela
      }
    },
    [carregar, checklist, recarregarPendencias]
  );

  const criarItem = useCallback(async (
    base?: { etapa?: string; dataLimite?: string }
  ): Promise<string | void> => {
    if (!checklist) return;
    const ordem = checklist.itens.reduce((max, i) => Math.max(max, i.ordem), -1) + 1;
    const novo: ItemChecklist = {
      id: globalThis.crypto.randomUUID(),
      checklistId: checklist.id,
      origemModeloItemId: "", // criado à mão: fora da régua do modelo
      // Nasce sem título: o campo recebe o foco e a pessoa escreve direto,
      // em vez de precisar apagar um texto de exemplo.
      titulo: "",
      descricao: "",
      // Nasce ONDE a pessoa pediu — na etapa (ou no dia) do grupo em que ela
      // clicou. Sem isso, sobra o bloco do último item da lista, que é o
      // contexto de quem criou quando o pedido vem do botão do topo.
      etapa: base?.etapa ?? checklist.itens[checklist.itens.length - 1]?.etapa ?? "",
      status: "Pendente",
      dataLimite: base?.dataLimite ?? "",
      // Data escolhida pela pessoa (o grupo do dia) é ajuste à mão: o recálculo
      // do modelo não tem régua para item criado aqui, mas a marca deixa a
      // intenção explícita.
      dataManual: !!base?.dataLimite,
      concluidoEm: "",
      concluidoPor: "",
      responsavel: "",
      funcoes: [],
      observacoes: [],
      oculto: false,
      ordem,
    };
    setChecklist((c) => (c ? { ...c, itens: [...c.itens, novo] } : c));
    try {
      await repo.checklists.salvarItem(novo);
      return novo.id;
    } catch (erro) {
      toast(`Não foi possível criar a tarefa: ${(erro as Error).message}`, "danger");
      await carregar();
    }
  }, [checklist, carregar]);

  const removerItem = useCallback(
    async (item: ItemChecklist) => {
      setChecklist((c) => (c ? { ...c, itens: c.itens.filter((i) => i.id !== item.id) } : c));
      try {
        await repo.checklists.removerItem(item.id);
        void recarregarPendencias(true);
      } catch (erro) {
        toast(`Não foi possível excluir a tarefa: ${(erro as Error).message}`, "danger");
        await carregar();
      }
    },
    [carregar, recarregarPendencias]
  );

  /**
   * Grava várias tarefas de uma vez. Sem revisão de texto por IA: quem chega
   * aqui mexeu em ordem, etapa ou status — nunca reescreveu um título. A tela é
   * atualizada antes do banco, e as pendências recarregam UMA vez no fim.
   */
  const salvarVarios = useCallback(
    async (itens: ItemChecklist[]) => {
      if (!itens.length) return;
      const porId = new Map(itens.map((i) => [i.id, i]));
      setChecklist((c) => (c ? { ...c, itens: c.itens.map((i) => porId.get(i.id) ?? i) } : c));
      try {
        await repo.checklists.salvarItens(itens);
        void recarregarPendencias(true);
      } catch (erro) {
        toast(`Não foi possível salvar as tarefas: ${(erro as Error).message}`, "danger");
        await carregar();
      }
    },
    [carregar, recarregarPendencias]
  );

  const removerVarios = useCallback(
    async (itens: ItemChecklist[]) => {
      if (!itens.length) return;
      const ids = new Set(itens.map((i) => i.id));
      setChecklist((c) => (c ? { ...c, itens: c.itens.filter((i) => !ids.has(i.id)) } : c));
      try {
        await repo.checklists.removerItens([...ids]);
        void recarregarPendencias(true);
      } catch (erro) {
        toast(`Não foi possível excluir as tarefas: ${(erro as Error).message}`, "danger");
        await carregar();
      }
    },
    [carregar, recarregarPendencias]
  );

  const aplicarRecalculo = useCallback(async () => {
    if (!checklist || !projeto || !modelo) return;
    const recalculado = recalcularPrazos(checklist, projeto, modelo, feriados);
    const mudaram = recalculado.itens.filter((novo, i) => novo.dataLimite !== checklist.itens[i]?.dataLimite);
    if (!mudaram.length) return;
    setChecklist(recalculado);
    try {
      await repo.checklists.salvarItens(mudaram);
      toast(`${mudaram.length} prazo(s) recalculado(s) a partir das datas do projeto.`, "success");
      void recarregarPendencias(true);
    } catch (erro) {
      toast(`Não foi possível recalcular: ${(erro as Error).message}`, "danger");
      await carregar();
    }
  }, [checklist, projeto, modelo, carregar, recarregarPendencias, feriados]);

  const sincronizar = useCallback(async () => {
    if (!checklist || !projeto || !modelo) return;
    const { checklist: atualizado, adicionados } = sincronizarComModelo(checklist, projeto, modelo, undefined, feriados);
    if (!adicionados) return;
    const novos = atualizado.itens.slice(checklist.itens.length);
    setChecklist(atualizado);
    try {
      await repo.checklists.salvarItens(novos);
      toast(`${adicionados} tarefa(s) da lista padrão adicionada(s).`, "success");
    } catch (erro) {
      toast(`Não foi possível trazer as tarefas: ${(erro as Error).message}`, "danger");
      await carregar();
    }
  }, [checklist, projeto, modelo, carregar, feriados]);

  /**
   * Refaz a lista do zero quando a modalidade do projeto muda.
   *
   * É destrutivo — apaga status, prazos ajustados e observações — então só roda
   * por ação explícita, com confirmação na tela.
   */
  const regenerar = useCallback(async () => {
    if (!checklist || !projeto || !modelo) return;
    try {
      await repo.checklists.remover(checklist.id);
      const novo = gerarChecklist(projeto, modelo, undefined, feriados);
      setChecklist(await repo.checklists.criar(novo));
      toast(`Check-list refeito no modelo ${modelo.modalidade}.`, "success");
      void recarregarPendencias(true);
    } catch (erro) {
      toast(`Não foi possível refazer o check-list: ${(erro as Error).message}`, "danger");
      await carregar();
    }
  }, [checklist, projeto, modelo, carregar, recarregarPendencias, feriados]);

  return {
    checklist,
    modelo,
    carregando,
    prazosDesatualizados,
    itensNovosNoModelo,
    modalidadeDivergente,
    salvarItem,
    criarItem,
    removerItem,
    salvarVarios,
    removerVarios,
    aplicarRecalculo,
    sincronizar,
    regenerar,
  };
}
