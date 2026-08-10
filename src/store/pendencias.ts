/**
 * Store das pendências do processo. Carrega projetos/ECs/OSs e deriva a lista de
 * pendências (via domain/pendencias). Os componentes leem daqui e filtram pelo
 * papel do usuário para exibir os badges (bolinhas vermelhas).
 */
import { useMemo } from "react";
import { create } from "zustand";
import { repo } from "@/data";
import { useAuth } from "@/store/auth";
import { calcularPendencias, agregarPendencias, type Pendencia } from "@/domain/pendencias";

interface State {
  itens: Pendencia[];
  carregando: boolean;
  ultimoLoad: number;
  carregar: (force?: boolean) => Promise<void>;
}

export const usePendencias = create<State>((set, get) => ({
  itens: [],
  carregando: false,
  ultimoLoad: 0,
  carregar: async (force = false) => {
    const { carregando, ultimoLoad } = get();
    if (carregando) return;
    if (!force && Date.now() - ultimoLoad < 4000) return; // evita recargas em rajada
    set({ carregando: true });
    try {
      const [projetos, ecs, oss, usuarios, credenciados] = await Promise.all([
        repo.projetos.listar(),
        repo.ecs.listar(),
        repo.oss.listar(),
        repo.auth.usuarios(),
        repo.oss.osComCredenciamento(),
      ]);
      const nomes = usuarios.map((u) => u.nome).filter(Boolean);
      set({ itens: calcularPendencias(projetos, ecs, oss, nomes, credenciados), ultimoLoad: Date.now() });
    } catch {
      /* silencioso: os badges são auxiliares, não devem quebrar a tela */
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
