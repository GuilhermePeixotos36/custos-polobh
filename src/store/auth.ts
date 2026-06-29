/** Estado global de autenticação (Supabase Auth) + permissões por papel. */
import { create } from "zustand";
import type { Papel, Usuario } from "@/data/types";
import { supabase } from "@/lib/supabaseClient";
import { auditar, definirAtor } from "@/store/logs";
import type { User } from "@supabase/supabase-js";

export type Recurso =
  | "dashboard"
  | "ecs"
  | "ecs.editar"
  | "oss"
  | "cronogramas"
  | "fornecedores"
  | "financeiro"
  | "configuracoes"
  | "logs";

/** Todos os recursos — usado pelo perfil Administrador (acesso total). */
export const TODOS_RECURSOS: Recurso[] = [
  "dashboard",
  "ecs",
  "ecs.editar",
  "oss",
  "cronogramas",
  "fornecedores",
  "financeiro",
  "configuracoes",
  "logs",
];

/** Matriz de perfis × recursos (seção 4 / 9 do brief). Espelha a RLS no banco. */
export const PERMISSOES: Record<Papel, Recurso[]> = {
  // Administrador: superusuário (desenvolvedor/gestor do app). Único com "logs".
  Admin: TODOS_RECURSOS,
  Direcao: [
    "dashboard",
    "ecs",
    "ecs.editar",
    "oss",
    "cronogramas",
    "fornecedores",
    "financeiro",
    "configuracoes",
  ],
  Producao: ["dashboard", "ecs", "ecs.editar", "oss", "cronogramas", "fornecedores"],
  Administrativo: [
    "dashboard",
    "ecs",
    "oss",
    "cronogramas",
    "fornecedores",
    "financeiro",
    "configuracoes",
  ],
};

export const ROTULO_PAPEL: Record<Papel, string> = {
  Admin: "Administrador",
  Direcao: "Direção",
  Producao: "Produção",
  Administrativo: "Administrativo",
};

interface AuthState {
  usuario: Usuario | null;
  /** true até a sessão inicial ser resolvida (evita redirect prematuro). */
  carregando: boolean;
  pode: (r: Recurso) => boolean;
  entrarComEmail: (email: string, senha: string) => Promise<{ ok: boolean; erro?: string }>;
  sair: () => Promise<void>;
  /** Inicializa a sessão a partir do Supabase (chamado uma vez no boot). */
  bootstrap: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => {
  /** Carrega o perfil (papel) do usuário autenticado e popula o estado. */
  async function carregarPerfil(user: User) {
    const { data, error } = await supabase
      .from("perfis")
      .select("nome, papel")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data) {
      // Usuário sem perfil cadastrado: não tem acesso a nada.
      definirAtor(null);
      set({ usuario: null, carregando: false });
      return null;
    }
    const usuario: Usuario = {
      id: user.id,
      nome: data.nome ?? user.email ?? "Usuário",
      email: user.email ?? "",
      papel: data.papel as Papel,
    };
    definirAtor({ id: user.id, nome: usuario.nome, papel: usuario.papel });
    set({ usuario, carregando: false });
    return usuario;
  }

  return {
    usuario: null,
    carregando: true,

    pode: (r) => {
      const u = get().usuario;
      if (!u) return false;
      return PERMISSOES[u.papel].includes(r);
    },

    entrarComEmail: async (email, senha) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });
      if (error || !data.user) {
        return { ok: false, erro: "E-mail ou senha inválidos." };
      }
      const u = await carregarPerfil(data.user);
      if (!u) {
        await supabase.auth.signOut();
        return { ok: false, erro: "Seu usuário não tem um perfil de acesso configurado." };
      }
      auditar({
        categoria: "Autenticação",
        acao: "auth.login",
        mensagem: `Login realizado (${ROTULO_PAPEL[u.papel]})`,
        usuario: u.nome,
        papel: u.papel,
      });
      return { ok: true };
    },

    sair: async () => {
      const u = get().usuario;
      if (u) {
        auditar({
          categoria: "Autenticação",
          acao: "auth.logout",
          mensagem: "Logout realizado",
          usuario: u.nome,
          papel: u.papel,
        });
      }
      definirAtor(null);
      await supabase.auth.signOut();
      set({ usuario: null });
    },

    bootstrap: async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        await carregarPerfil(data.session.user);
      } else {
        set({ carregando: false });
      }
      // Mantém o estado sincronizado com login/logout em outras abas.
      supabase.auth.onAuthStateChange((_evento, session) => {
        if (session?.user) {
          carregarPerfil(session.user);
        } else {
          definirAtor(null);
          set({ usuario: null, carregando: false });
        }
      });
    },
  };
});
