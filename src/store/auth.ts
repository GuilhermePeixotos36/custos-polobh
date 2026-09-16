/** Estado global de autenticação (Supabase Auth) + permissões por papel. */
import { create } from "zustand";
import type { Papel, Usuario } from "@/data/types";
import { supabase } from "@/lib/supabaseClient";
import { auditar, definirAtor } from "@/store/logs";
import { traduzirErroDeSenha } from "@/domain/senha";
import type { User } from "@supabase/supabase-js";

export type Recurso =
  | "projetos"
  | "projetos.editar"
  | "ecs"
  | "ecs.editar"
  | "oss"
  | "oss.editar"
  | "checklists"
  | "checklists.editar"
  | "cronogramas"
  | "fornecedores"
  | "fornecedores.editar"
  | "financeiro"
  | "rentabilidade"
  | "configuracoes"
  | "logs"
  | "guia";

/** Todos os recursos — usado pelo perfil Administrador (acesso total). */
export const TODOS_RECURSOS: Recurso[] = [
  "projetos",
  "projetos.editar",
  "ecs",
  "ecs.editar",
  "oss",
  "oss.editar",
  "checklists",
  "checklists.editar",
  "cronogramas",
  "fornecedores",
  "fornecedores.editar",
  "financeiro",
  "rentabilidade",
  "configuracoes",
  "logs",
  "guia",
];

/**
 * Telas do sistema, na ordem em que aparecem na matriz de Configurações.
 * `editar` é a chave do recurso de edição, quando a tela tem uma.
 */
export const TELAS: { ver: Recurso; editar?: Recurso; label: string }[] = [
  { ver: "projetos", editar: "projetos.editar", label: "Projetos" },
  { ver: "ecs", editar: "ecs.editar", label: "Estimativas de Custo" },
  { ver: "oss", editar: "oss.editar", label: "Ordens de Serviço" },
  { ver: "checklists", editar: "checklists.editar", label: "Check-list de projetos" },
  { ver: "cronogramas", label: "Cronogramas" },
  { ver: "fornecedores", editar: "fornecedores.editar", label: "Fornecedores" },
  { ver: "guia", label: "Guia de uso" },
];

/** Permissões que não são "telas", e sim o que se enxerga dentro delas. */
export const PERMISSOES_ESPECIAIS: { key: Recurso; label: string; hint: string }[] = [
  {
    key: "financeiro",
    label: "Bloco financeiro",
    hint: "Valores Pólobh, valores do cliente e o financeiro da OS",
  },
  /**
   * A RENTABILIDADE ganhou permissão própria (15/09/2026).
   *
   * Ela vinha junto do bloco financeiro — quem via valor via margem —, e a
   * Pólobh separou as duas coisas: a aba mostra quanto a casa ganha em cada
   * item, e o pedido é que ela fique com Diretoria e Coordenação (Produção e
   * Administrativo-Financeiro). Quem lança custo e emite OS continua vendo
   * valor sem ver margem.
   */
  {
    key: "rentabilidade",
    label: "Rentabilidade por item",
    hint: "A margem da Pólobh item a item, na EC — separada do bloco financeiro",
  },
  { key: "configuracoes", label: "Configurações", hint: "Empresas do grupo, áreas e usuários" },
  { key: "logs", label: "Logs do sistema", hint: "Trilha de auditoria — normalmente só o Administrador" },
];

/**
 * Matriz padrão de fábrica (perfis × recursos). Serve de semente para as áreas
 * de fábrica e de rede de segurança quando o usuário ainda não tem área.
 * A matriz que vale no dia a dia vem da área do usuário (tabela `areas`).
 */
export const PERMISSOES: Record<Papel, Recurso[]> = {
  // Administrador: superusuário (desenvolvedor/gestor do app). Único com "logs".
  Admin: TODOS_RECURSOS,
  Direcao: [
    "projetos",
    "projetos.editar",
    "ecs",
    "ecs.editar",
    "oss",
    "oss.editar",
    "checklists",
    "checklists.editar",
    "cronogramas",
    "fornecedores",
    "fornecedores.editar",
    "financeiro",
    "rentabilidade",
    "configuracoes",
    "guia",
  ],
  Producao: [
    "projetos",
    "projetos.editar",
    "ecs",
    "ecs.editar",
    "oss",
    "oss.editar",
    "checklists",
    "checklists.editar",
    "cronogramas",
    "fornecedores",
    "fornecedores.editar",
    "guia",
  ],
  Administrativo: [
    "projetos",
    "ecs",
    "oss",
    "oss.editar",
    "checklists",
    "checklists.editar",
    "cronogramas",
    "fornecedores",
    "fornecedores.editar",
    "financeiro",
    "configuracoes",
    "guia",
  ],
};

export const ROTULO_PAPEL: Record<Papel, string> = {
  Admin: "Administrador",
  Direcao: "Direção",
  Producao: "Produção",
  // O papel 'Administrativo' é o do financeiro da Pólobh (o que vê só a
  // descrição financeira da EC) — o rótulo acompanha o nome usado na casa.
  Administrativo: "Financeiro",
};

/**
 * Níveis de segurança que uma área pode herdar. 'Admin' fica de fora de
 * propósito: é o papel do desenvolvedor, que não pertence a área nenhuma e
 * enxerga tudo pelo fallback de `pode()`.
 */
export const PAPEIS_AREA: Papel[] = ["Direcao", "Producao", "Administrativo"];

interface AuthState {
  usuario: Usuario | null;
  /** Recursos liberados pela área do usuário. null = sem área (cai no padrão do papel). */
  recursos: Recurso[] | null;
  /** true até a sessão inicial ser resolvida (evita redirect prematuro). */
  carregando: boolean;
  pode: (r: Recurso) => boolean;
  entrarComEmail: (email: string, senha: string) => Promise<{ ok: boolean; erro?: string }>;
  /** Troca a própria senha, já logado. Pede a atual para confirmar quem é. */
  trocarSenha: (atual: string, nova: string) => Promise<{ ok: boolean; erro?: string }>;
  sair: () => Promise<void>;
  /** Inicializa a sessão a partir do Supabase (chamado uma vez no boot). */
  bootstrap: () => Promise<void>;
}

/** Formato da área trazida no join de `perfis`. */
interface AreaJoin {
  nome: string | null;
  recursos: string[] | null;
}

export const useAuth = create<AuthState>((set, get) => {
  /** Carrega o perfil (papel) do usuário autenticado e popula o estado. */
  async function carregarPerfil(user: User) {
    const { data, error } = await supabase
      .from("perfis")
      .select("nome, papel, telefone, area_id, areas(nome, recursos)")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data) {
      // Usuário sem perfil cadastrado: não tem acesso a nada.
      definirAtor(null);
      set({ usuario: null, recursos: null, carregando: false });
      return null;
    }
    // O join volta como objeto (relação 1:1) — o tipo gerado do supabase-js
    // descreve como array, daí o normalize abaixo.
    const bruto = (data as { areas?: AreaJoin | AreaJoin[] | null }).areas;
    const area = (Array.isArray(bruto) ? bruto[0] : bruto) ?? null;

    const usuario: Usuario = {
      id: user.id,
      nome: data.nome ?? user.email ?? "Usuário",
      email: user.email ?? "",
      telefone: data.telefone ?? "",
      papel: data.papel as Papel,
      areaId: data.area_id ?? undefined,
      areaNome: area?.nome ?? undefined,
    };
    definirAtor({ id: user.id, nome: usuario.nome, papel: usuario.papel });
    set({ usuario, recursos: (area?.recursos as Recurso[] | undefined) ?? null, carregando: false });
    return usuario;
  }

  return {
    usuario: null,
    recursos: null,
    carregando: true,

    pode: (r) => {
      const u = get().usuario;
      if (!u) return false;
      // A área do usuário é a fonte de verdade; sem área (ou área sem nenhum
      // recurso marcado), vale a matriz padrão do papel.
      const daArea = get().recursos;
      if (daArea && daArea.length) return daArea.includes(r);
      // Papel que não está na matriz (cadastro novo, dado torto) devolvia
      // `undefined` e derrubava a tela inteira num `.includes` de nada.
      // Sem permissão é uma resposta; tela branca não é.
      return (PERMISSOES[u.papel] ?? []).includes(r);
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

    /**
     * Troca a senha de quem está logado.
     *
     * A SENHA ATUAL É EXIGIDA, e não é capricho: o Supabase troca a senha de
     * quem tem uma sessão válida sem perguntar mais nada — ou seja, qualquer
     * pessoa que sente na cadeira com o app aberto poderia trocar a senha e
     * deixar a dona da conta de fora. Conferimos a senha atual entrando de novo
     * com ela: dá certo, é a pessoa; dá errado, para aqui.
     *
     * O `signInWithPassword` renova a sessão do MESMO usuário — não desloga
     * ninguém, não muda o perfil carregado. Só o `updateUser` depois é que
     * altera de fato a senha.
     */
    trocarSenha: async (atual, nova) => {
      const u = get().usuario;
      if (!u?.email) return { ok: false, erro: "Sua sessão expirou. Entre de novo." };

      const conferencia = await supabase.auth.signInWithPassword({ email: u.email, password: atual });
      if (conferencia.error) {
        auditar({
          nivel: "aviso",
          categoria: "Autenticação",
          acao: "auth.senha.recusada",
          mensagem: "Troca de senha recusada: senha atual incorreta",
          usuario: u.nome,
          papel: u.papel,
        });
        return { ok: false, erro: "Senha atual incorreta." };
      }

      const { error } = await supabase.auth.updateUser({ password: nova });
      if (error) return { ok: false, erro: traduzirErroDeSenha(error.message) };

      auditar({
        categoria: "Autenticação",
        acao: "auth.senha",
        mensagem: "Senha alterada pelo próprio usuário",
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
      set({ usuario: null, recursos: null });
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
          set({ usuario: null, recursos: null, carregando: false });
        }
      });
    },
  };
});
