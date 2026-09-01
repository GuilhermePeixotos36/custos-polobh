/**
 * Estado do tour guiado — mora fora da árvore de telas de propósito.
 *
 * O tour começa no Guia e termina em Configurações, atravessando meia dúzia de
 * rotas. Se o estado morasse dentro de uma página, ele morreria na primeira
 * troca de tela. Aqui ele sobrevive à navegação, e a sobreposição é montada uma
 * única vez, na casca do app.
 */
import { create } from "zustand";
import { usePendencias } from "@/store/pendencias";

/**
 * Os registros de verdade que o tour usa para abrir telas reais.
 *
 * O tour NÃO cria nada para se mostrar: ele abre um projeto, uma EC e uma OS
 * que já existem. Quando a casa ainda não tem nenhum, o passo continua
 * acontecendo — só que sem a tela por trás, com a explicação no centro. É o que
 * impede o tour de quebrar num sistema recém-instalado.
 */
export interface ContextoTour {
  projetoId?: string;
  ecId?: string;
  osId?: string;
}

interface EstadoTour {
  aberto: boolean;
  indice: number;
  contexto: ContextoTour;
  abrir: () => void;
  fechar: () => void;
  ir: (i: number) => void;
}

/**
 * Escolhe o projeto/EC/OS mais representativos entre os que já estão em
 * memória (o store de pendências carrega tudo isso na entrada do app, então
 * abrir o tour não custa nenhuma consulta nova).
 */
function lerContexto(): ContextoTour {
  const { projetos, ecsPainel, oss } = usePendencias.getState();
  // Um projeto ativo mostra mais coisa que um arquivado: check-list em
  // andamento, EC ativa, OSs emitidas.
  const projeto = projetos.find((p) => p.status === "Ativo") ?? projetos[0];
  const ec =
    ecsPainel.find((e) => e.projetoId === projeto?.id && e.ativa) ??
    ecsPainel.find((e) => e.projetoId === projeto?.id) ??
    ecsPainel[0];
  const os = oss.find((o) => o.ecId === ec?.id) ?? oss[0];
  return { projetoId: projeto?.id, ecId: ec?.id, osId: os?.id };
}

export const useTour = create<EstadoTour>((set) => ({
  aberto: false,
  indice: 0,
  contexto: {},
  abrir: () => set({ aberto: true, indice: 0, contexto: lerContexto() }),
  fechar: () => set({ aberto: false }),
  ir: (i) => set({ indice: Math.max(0, i) }),
}));

/**
 * O tour está conduzindo a navegação agora?
 *
 * Serve ao guarda de alterações não salvas (`useUnsavedGuard`): o tour passa
 * por formulários que se marcam como "mexidos" só de abrir — uma EC nova já
 * nasce com os itens do modelo —, e sem isto cada passo do tour esbarraria num
 * "Sair sem salvar?" por cima da sobreposição.
 *
 * Não há risco de perder trabalho de verdade: o tour começa numa tela limpa (o
 * Guia), a sobreposição bloqueia qualquer clique no app enquanto ele roda, e o
 * tour nunca digita nada. O único "mexido" que existe durante o tour é o que o
 * próprio tour abriu.
 */
export const tourNavegando = (): boolean => useTour.getState().aberto;
