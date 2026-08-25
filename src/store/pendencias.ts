/**
 * Store da leitura geral do sistema: carrega projetos/ECs/OSs uma vez e deriva
 * dali as pendências (via domain/pendencias). Os componentes leem daqui e
 * filtram pelo papel do usuário para exibir os badges (bolinhas vermelhas).
 *
 * As listas cruas ficam guardadas de propósito. Elas são a carga mais pesada do
 * app, e as sugestões de preenchimento (`useSugestoes`) precisam exatamente dos
 * mesmos dados — buscá-los de novo, numa segunda store, seria pagar duas vezes
 * pela mesma consulta.
 */
import { useMemo } from "react";
import { create } from "zustand";
import { repo } from "@/data";
import { useAuth } from "@/store/auth";
import { calcularPendencias, agregarPendencias, type Pendencia } from "@/domain/pendencias";
import type { Ec, Os, Projeto } from "@/data/types";

interface State {
  itens: Pendencia[];
  /** Listas cruas da última carga — base das pendências e das sugestões de campo. */
  projetos: Projeto[];
  ecs: Ec[];
  oss: Os[];
  carregando: boolean;
  ultimoLoad: number;
  carregar: (force?: boolean) => Promise<void>;
}

export const usePendencias = create<State>((set, get) => ({
  itens: [],
  projetos: [],
  ecs: [],
  oss: [],
  carregando: false,
  ultimoLoad: 0,
  carregar: async (force = false) => {
    const { carregando, ultimoLoad } = get();
    if (carregando) return;
    if (!force && Date.now() - ultimoLoad < 4000) return; // evita recargas em rajada
    set({ carregando: true });
    try {
      const [projetos, ecs, oss, usuarios, credenciados, checklists] = await Promise.all([
        repo.projetos.listar(),
        repo.ecs.listar(),
        repo.oss.listar(),
        repo.auth.usuarios(),
        repo.oss.osComCredenciamento(),
        repo.checklists.listar(),
      ]);
      const nomes = usuarios.map((u) => u.nome).filter(Boolean);
      set({
        itens: calcularPendencias(projetos, ecs, oss, nomes, credenciados, checklists),
        projetos,
        ecs,
        oss,
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

/** Pendências do usuário atual, já agregadas por recurso/projeto/subguia/EC/OS. */
export function useMinhasPendencias() {
  const itens = usePendencias((s) => s.itens);
  const papel = useAuth((s) => s.usuario?.papel);
  const pessoa = useAuth((s) => s.usuario?.nome);
  return useMemo(() => agregarPendencias(itens, papel, pessoa), [itens, papel, pessoa]);
}
