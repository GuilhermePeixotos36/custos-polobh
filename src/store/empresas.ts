/**
 * Empresas do grupo Pólobh (Pólobh Promoções Eireli / MF Promoções Eireli).
 * Dados fiscais usados na OS quando o tomador/contratante é a própria Pólobh.
 *
 * Fonte de verdade: Supabase (tabela `empresas_grupo`, via repo). Este store é
 * um cache em memória carregado no boot — assim `empresaPadrao()` continua
 * síncrono para o gerador de Excel. Escritas persistem no banco.
 */
import { create } from "zustand";
import { repo } from "@/data";
import type { EmpresaGrupo } from "@/data/types";

interface EmpresasState {
  empresas: EmpresaGrupo[];
  carregado: boolean;
  carregar: () => Promise<void>;
  /** Edição local (a cada tecla) — não grava no banco. */
  editar: (id: string, patch: Partial<EmpresaGrupo>) => void;
  /** Persiste no Supabase o estado atual da empresa (chamar no blur). */
  persistir: (id: string) => Promise<void>;
  definirPadrao: (id: string) => Promise<void>;
}

export const useEmpresas = create<EmpresasState>((set, get) => ({
  empresas: [],
  carregado: false,
  carregar: async () => {
    try {
      const empresas = await repo.empresas.listar();
      set({ empresas, carregado: true });
    } catch {
      // silencioso: se o usuário não tem acesso, o gerador só não pré-preenche
      set({ carregado: true });
    }
  },
  editar: (id, patch) =>
    set((s) => ({ empresas: s.empresas.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
  persistir: async (id) => {
    const atual = get().empresas.find((e) => e.id === id);
    if (!atual) return;
    const salvo = await repo.empresas.salvar(atual);
    set((s) => ({ empresas: s.empresas.map((e) => (e.id === id ? salvo : e)) }));
  },
  definirPadrao: async (id) => {
    set((s) => ({ empresas: s.empresas.map((e) => ({ ...e, padrao: e.id === id })) }));
    await repo.empresas.definirPadrao(id);
  },
}));

/** Empresa emissora padrão (uso síncrono fora de componentes, ex.: gerador). */
export const empresaPadrao = (): EmpresaGrupo | undefined => {
  const { empresas } = useEmpresas.getState();
  return empresas.find((e) => e.padrao) ?? empresas[0];
};
