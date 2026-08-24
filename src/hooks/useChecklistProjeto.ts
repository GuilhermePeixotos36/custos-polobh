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
import {
  gerarChecklist,
  modeloDaModalidade,
  recalcularPrazos,
  sincronizarComModelo,
} from "@/domain/checklist";
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
  criarItem: () => Promise<string | void>;
  removerItem: (item: ItemChecklist) => Promise<void>;
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
  // Evita a segunda geração enquanto a primeira ainda está no ar (StrictMode
  // monta o efeito duas vezes em desenvolvimento).
  const gerando = useRef(false);
  // Sem `force`: o store estrangula recargas a uma cada 4s. Marcar dez tarefas
  // em sequência recarregava o quadro dez vezes — seis consultas cada.
  const recarregarPendencias = usePendencias((s) => s.carregar);

  const projetoId = projeto?.id ?? "";
  const modalidade = projeto?.info.modalidade ?? "";
  const modelo = useMemo(() => modeloDaModalidade(modelos, modalidade), [modelos, modalidade]);

  const carregar = useCallback(async () => {
    if (!projetoId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    try {
      const [lista, atual] = await Promise.all([
        repo.checklists.listarModelos(),
        repo.checklists.doProjeto(projetoId),
      ]);
      setModelos(lista);
      setChecklist(atual);
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
        const novo = gerarChecklist(projeto, modelo);
        setChecklist(await repo.checklists.criar(novo));
        toast(`Check-list ${modalidade} criado com ${novo.itens.length} tarefas.`, "success");
        void recarregarPendencias();
      } catch {
        // Corrida entre duas abas: o índice único de projeto_id barra a segunda.
        // Recarregar resolve — quem perdeu a corrida passa a ver a lista da outra.
        await carregar();
      } finally {
        gerando.current = false;
      }
    })();
  }, [carregando, checklist, projeto, modelo, podeEditar, projetoId, modalidade, projetoSalvo, carregar, recarregarPendencias]);

  /* ----------------------------- diagnósticos ----------------------------- */

  const prazosDesatualizados = useMemo(() => {
    if (!checklist || !projeto || !modelo || !projetoSalvo) return 0;
    const recalculado = recalcularPrazos(checklist, projeto, modelo);
    return recalculado.itens.filter((novo, i) => novo.dataLimite !== checklist.itens[i]?.dataLimite).length;
  }, [checklist, projeto, modelo, projetoSalvo]);

  const itensNovosNoModelo = useMemo(() => {
    if (!checklist || !modelo) return 0;
    const jaTem = new Set(checklist.itens.map((i) => i.origemModeloItemId).filter(Boolean));
    return modelo.itens.filter((m) => !jaTem.has(m.id)).length;
  }, [checklist, modelo]);

  const modalidadeDivergente = !!checklist && !!modalidade && checklist.modalidade !== modalidade;

  /* -------------------------------- ações --------------------------------- */

  /** Atualiza um item na tela e grava só ele. */
  const salvarItem = useCallback(
    async (item: ItemChecklist) => {
      setChecklist((c) => (c ? { ...c, itens: c.itens.map((i) => (i.id === item.id ? item : i)) } : c));
      try {
        await repo.checklists.salvarItem(item);
        void recarregarPendencias();
      } catch (erro) {
        toast(`Não foi possível salvar a tarefa: ${(erro as Error).message}`, "danger");
        await carregar(); // volta ao que está no banco em vez de mentir na tela
      }
    },
    [carregar, recarregarPendencias]
  );

  const criarItem = useCallback(async (): Promise<string | void> => {
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
      // Cai no mesmo bloco do último item, para nascer perto do contexto de quem criou.
      etapa: checklist.itens[checklist.itens.length - 1]?.etapa ?? "",
      status: "Pendente",
      dataLimite: "",
      dataManual: false,
      concluidoEm: "",
      concluidoPor: "",
      responsavel: "",
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
        void recarregarPendencias();
      } catch (erro) {
        toast(`Não foi possível excluir a tarefa: ${(erro as Error).message}`, "danger");
        await carregar();
      }
    },
    [carregar, recarregarPendencias]
  );

  const aplicarRecalculo = useCallback(async () => {
    if (!checklist || !projeto || !modelo) return;
    const recalculado = recalcularPrazos(checklist, projeto, modelo);
    const mudaram = recalculado.itens.filter((novo, i) => novo.dataLimite !== checklist.itens[i]?.dataLimite);
    if (!mudaram.length) return;
    setChecklist(recalculado);
    try {
      await repo.checklists.salvarItens(mudaram);
      toast(`${mudaram.length} prazo(s) recalculado(s) a partir das datas do projeto.`, "success");
      void recarregarPendencias();
    } catch (erro) {
      toast(`Não foi possível recalcular: ${(erro as Error).message}`, "danger");
      await carregar();
    }
  }, [checklist, projeto, modelo, carregar, recarregarPendencias]);

  const sincronizar = useCallback(async () => {
    if (!checklist || !projeto || !modelo) return;
    const { checklist: atualizado, adicionados } = sincronizarComModelo(checklist, projeto, modelo);
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
  }, [checklist, projeto, modelo, carregar]);

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
      const novo = gerarChecklist(projeto, modelo);
      setChecklist(await repo.checklists.criar(novo));
      toast(`Check-list refeito no modelo ${modelo.modalidade}.`, "success");
      void recarregarPendencias();
    } catch (erro) {
      toast(`Não foi possível refazer o check-list: ${(erro as Error).message}`, "danger");
      await carregar();
    }
  }, [checklist, projeto, modelo, carregar, recarregarPendencias]);

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
    aplicarRecalculo,
    sincronizar,
    regenerar,
  };
}
