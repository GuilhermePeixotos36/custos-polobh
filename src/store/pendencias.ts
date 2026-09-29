/**
 * Store da leitura geral do sistema: carrega projetos/ECs/OSs uma vez e deriva
 * dali as pendências (via domain/pendencias). Os componentes leem daqui e
 * filtram pelo papel do usuário para exibir os badges (bolinhas vermelhas).
 *
 * As listas cruas ficam guardadas de propósito. Elas são a carga mais pesada do
 * app, e a memória dos campos (`useSugestoes`) precisa exatamente dos mesmos
 * dados — buscá-los de novo, numa segunda store, seria pagar duas vezes pela
 * mesma consulta. Vale inclusive para os check-lists: já eram carregados para as
 * pendências, e agora ficam guardados para alimentar título e etapa de tarefa.
 */
import { useMemo } from "react";
import { create } from "zustand";
import { repo } from "@/data";
import { useAuth } from "@/store/auth";
import { calcularPendencias, agregarPendencias, type Pendencia } from "@/domain/pendencias";
import type { Checklist, Ec, Os, Projeto } from "@/data/types";

interface State {
  itens: Pendencia[];
  /** Listas cruas da última carga — base das pendências e das sugestões de campo. */
  projetos: Projeto[];
  /**
   * ECs com as linhas PARCIAIS (ver `repo.ecs.listarPainel`): só os campos que
   * as pendências e a memória de campos leem. Descritivo, valores e dados de
   * fornecedor vêm vazios — não use esta lista para copiar dados de uma EC.
   */
  ecsPainel: Ec[];
  oss: Os[];
  checklists: Checklist[];
  carregando: boolean;
  ultimoLoad: number;
  carregar: (force?: boolean) => Promise<void>;
}

export const usePendencias = create<State>((set, get) => ({
  itens: [],
  projetos: [],
  ecsPainel: [],
  oss: [],
  checklists: [],
  carregando: false,
  ultimoLoad: 0,
  carregar: async (force = false) => {
    const { carregando, ultimoLoad } = get();
    if (carregando) return;
    // Janela de silêncio da navegação. Era de 4s, e isso tinha dois problemas:
    // navegar entre telas recarregava a base inteira quase a cada clique, e a
    // recarga PÓS-AÇÃO (concluir tarefa, salvar OS) caía dentro da janela e não
    // acontecia — o badge só mudava depois. Agora quem muda dado chama com
    // `force`, e a navegação pode esperar bem mais.
    if (!force && Date.now() - ultimoLoad < 20000) return;
    set({ carregando: true });
    try {
      const [projetos, ecs, oss, usuarios, credenciados, checklists] = await Promise.all([
        repo.projetos.listar(),
        // Listagem leve: o painel recarrega a cada navegação e o descritivo
        // rico das linhas — o campo mais pesado da base — não é lido aqui.
        repo.ecs.listarPainel(),
        repo.oss.listar(),
        repo.auth.usuarios(),
        repo.oss.osComCredenciamento(),
        repo.checklists.listar(),
      ]);
      const nomes = usuarios.map((u) => u.nome).filter(Boolean);
      set({
        itens: calcularPendencias(projetos, ecs, oss, nomes, credenciados, checklists),
        projetos,
        ecsPainel: ecs,
        oss,
        checklists,
        ultimoLoad: Date.now(),
      });
    } catch (erro) {
      // Não quebra a tela — os badges são auxiliares. Mas o erro precisa ficar
      // visível no console: quando uma das cargas falha, TODAS as pendências
      // somem de uma vez, e sem rastro isso vira "o sistema parou de mostrar
      // as pendências", sem pista de onde olhar.
      console.error("[pendencias] falha ao carregar — badges ficarão zerados:", erro);
    } finally {
      set({ carregando: false });
    }
  },
}));

/**
 * Pendências do usuário atual, já agregadas por recurso/projeto/subguia/EC/OS.
 *
 * O recorte é pelo NOME — pendência é de quem foi cobrado nela, ou de quem
 * responde pelo projeto quando ela não tem outro dono. A única exceção são as
 * passagens de bastão da OS ("aguardando o financeiro"), que não nomeiam
 * ninguém e por isso são endereçadas à FUNÇÃO (ver `agregarPendencias`).
 */
export function useMinhasPendencias() {
  const itens = usePendencias((s) => s.itens);
  const pessoa = useAuth((s) => s.usuario?.nome);
  const pode = useAuth((s) => s.pode);
  return useMemo(() => agregarPendencias(itens, pessoa, pode), [itens, pessoa, pode]);
}
