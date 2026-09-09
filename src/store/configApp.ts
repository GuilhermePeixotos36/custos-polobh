/**
 * Ajustes do aplicativo — o que se configura sem publicar versão nova.
 *
 * Fonte de verdade: a tabela `config_app` do Supabase (uma chave, um valor
 * jsonb). Este store é um cache em memória, carregado sob demanda: são poucos
 * ajustes, lidos por poucas telas, e nenhuma delas pode esperar um `await` para
 * pintar.
 *
 * Só quem administra grava (a RLS decide); todo mundo lê, porque o endereço do
 * suporte precisa chegar justamente a quem tem menos acesso.
 */
import { create } from "zustand";
import { repo } from "@/data";

/** Para onde vai o chamado aberto pelo Help Desk. */
export interface ConfigHelpDesk {
  email: string;
  assinatura: string;
}

/**
 * O padrão vale enquanto o banco não responde e quando a chave ainda não
 * existe: é o suporte técnico que hoje mantém o sistema. Editável em
 * Configurações › Geral.
 */
export const HELPDESK_PADRAO: ConfigHelpDesk = {
  email: "gpxautomacao@outlook.com",
  assinatura: "Suporte técnico do sistema Pólobh",
};

interface ConfigState {
  helpdesk: ConfigHelpDesk;
  carregado: boolean;
  carregar: () => Promise<void>;
  gravarHelpDesk: (patch: Partial<ConfigHelpDesk>) => Promise<void>;
}

export const useConfigApp = create<ConfigState>((set, get) => ({
  helpdesk: HELPDESK_PADRAO,
  carregado: false,
  carregar: async () => {
    if (get().carregado) return;
    try {
      const v = await repo.config.ler<ConfigHelpDesk>("helpdesk");
      set({ helpdesk: { ...HELPDESK_PADRAO, ...(v ?? {}) }, carregado: true });
    } catch {
      // Silencioso de propósito: sem o ajuste, o Help Desk usa o padrão e
      // continua funcionando. Um chamado que não abre é pior do que um chamado
      // que vai para o endereço de sempre.
      set({ carregado: true });
    }
  },
  gravarHelpDesk: async (patch) => {
    const novo = { ...get().helpdesk, ...patch };
    set({ helpdesk: novo });
    await repo.config.gravar("helpdesk", novo);
  },
}));
