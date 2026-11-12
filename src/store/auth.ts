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
  | "oss.emitir"
  | "oss.validarContrato"
  | "oss.etapaFinanceiro"
  | "oss.etapaBackoffice"
  | "oss.financeiro"
  | "oss.financeiro.editar"
  | "checklists"
  | "checklists.editar"
  | "checklists.excluir"
  | "checklists.padrao"
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
  "oss.emitir",
  "oss.validarContrato",
  "oss.etapaFinanceiro",
  "oss.etapaBackoffice",
  "oss.financeiro",
  "oss.financeiro.editar",
  "checklists",
  "checklists.editar",
  "checklists.excluir",
  "checklists.padrao",
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

/**
 * DADOS FINANCEIROS (12/11/2026): o que se VÊ e o que se EDITA dentro das telas,
 * cada um com a sua marcação. Antes tudo vinha num "Bloco financeiro" só — quem
 * via os blocos financeiros da OS via também os valores e o BV da EC, e ver e
 * editar eram a mesma chave. Agora a matriz da área diz, linha a linha:
 *
 *  · Valores e BV da EC — o que o banco mostra (`ve_financeiro`); ver e editar
 *    andam juntos, como sempre;
 *  · Blocos financeiros da OS — ver e editar separados: a Produção pode preencher
 *    todos os campos da OS (12/11/2026) sem enxergar o BV da EC;
 *  · Rentabilidade — só ver.
 *
 * `editar` sem `ver` não existe: a matriz liga o `ver` junto (ver `AreaModal`).
 */
export const DADOS_FINANCEIROS: { ver: Recurso; editar?: Recurso; label: string; hint: string }[] = [
  {
    ver: "financeiro",
    label: "Valores e BV na Estimativa de Custo",
    hint: "Valor Pólobh, valor do cliente, BV e o resumo da EC. Ver e editar andam juntos.",
  },
  {
    ver: "oss.financeiro",
    editar: "oss.financeiro.editar",
    label: "Blocos financeiros da OS",
    hint: "Resumo dos Custos, Dados Emissão Faturamento, Faturamento e Contrato e Acerto Financeiro",
  },
  {
    ver: "rentabilidade",
    label: "Rentabilidade por item",
    hint: "A margem da Pólobh item a item, na EC — separada dos valores",
  },
];

/** Permissões que não são "telas", e sim o que se enxerga dentro delas. */
export const PERMISSOES_ESPECIAIS: { key: Recurso; label: string; hint: string }[] = [
  /**
   * EMITIR A OS é a última fase, e ganhou recurso próprio (16/09/2026).
   *
   * O check-list separa a OS em dois momentos e diz, com todas as letras, quem
   * edita cada um: até "Enviar para Conclusão Financeiro" entra a Produção; a
   * partir dali, não. Montar a OS é `Ordens de Serviço › editar`, e concluir o
   * faturamento é `Bloco financeiro` — os dois já existiam. Faltava o terceiro
   * momento: a emissão pelo Back-office. Sem chave própria, ela cairia em
   * `oss.editar`, e a Produção, que precisa dele para montar, voltaria a poder
   * emitir o documento que a fase acabou de tirar das mãos dela.
   */
  {
    key: "oss.emitir",
    label: "Emitir a OS (Back-office)",
    hint: "A última fase: emitir a OS já concluída pelo financeiro",
  },
  /**
   * EXCLUIR TAREFA e MEXER NA LISTA PADRÃO do check-list ficaram só com a
   * Coordenação e a Direção (01/10/2026). Incluir e editar tarefa é de todos —
   * é a equipe inteira que alimenta o check-list —, mas apagar é irreversível e
   * a lista padrão vale para todos os projetos novos.
   */
  {
    key: "checklists.excluir",
    label: "Excluir tarefas do check-list",
    hint: "Apagar tarefas (e refazer o check-list) dentro dos projetos — normalmente Coordenação e Direção",
  },
  {
    key: "checklists.padrao",
    label: "Editar a lista padrão do check-list",
    hint: "Configurações › Check-list: as tarefas que nascem em todo projeto novo — normalmente Coordenação e Direção",
  },
  /**
   * VALIDAR O CONTRATO da OS cultural (11/11/2026): a Produção preenche os
   * Dados para Contrato e envia; quem tem esta chave recebe a pendência, confere
   * e manda a OS ao Financeiro. Hoje é a Diretoria Produção (Marisa).
   */
  {
    key: "oss.validarContrato",
    label: "Revisar a OS cultural (Direção de Produção)",
    hint: "Recebe a pendência de revisar a OS cultural com contrato (preenchida pela Produção) e a envia ao Financeiro",
  },
  /**
   * QUEM É COBRADO por cada etapa da OS (11/11/2026). Separado de quem PODE
   * agir: "Bloco financeiro" e "Emitir a OS" também estão com a Coordenação e a
   * Diretoria Produção, que recebiam "Aguardando o Financeiro" de todas as OSs
   * da casa. Estas chaves só decidem para quem vai a pendência da etapa.
   */
  {
    key: "oss.etapaFinanceiro",
    label: "Responde pela etapa do Financeiro na OS",
    hint: "Recebe a pendência \"Aguardando o Financeiro\" de cada OS — hoje a Coordenação Administrativo-Financeira",
  },
  {
    key: "oss.etapaBackoffice",
    label: "Responde pela etapa do Back-office na OS",
    hint: "Recebe a pendência \"Aguardando o Back-office emitir\" de cada OS — hoje o Back-office",
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
    "oss",
    "oss.emitir",
    "oss.validarContrato",
    "oss.financeiro",
    "oss.financeiro.editar",
    "checklists",
    "checklists.editar",
    "checklists.excluir",
    "checklists.padrao",
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
    "oss.etapaFinanceiro",
    "projetos",
    "ecs",
    "oss",
    "oss.editar",
    "oss.emitir",
    "oss.financeiro",
    "oss.financeiro.editar",
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
  /** Manda o e-mail de redefinição de senha (a tela de login, sem sessão). */
  pedirRedefinicaoSenha: (email: string) => Promise<{ ok: boolean; erro?: string }>;
  /** Grava a senha nova de quem chegou pelo link do e-mail. */
  definirSenhaPeloLink: (nova: string) => Promise<{ ok: boolean; erro?: string }>;
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
      .select("nome, papel, telefone, area_id, ativo, areas(nome, recursos)")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data) {
      // Usuário sem perfil cadastrado: não tem acesso a nada.
      definirAtor(null);
      set({ usuario: null, recursos: null, carregando: false });
      return null;
    }
    // CONTA INATIVA (24/09/2026). A RLS já recusa tudo — o que falta é dizer o
    // motivo. A política de `perfis` deixa cada um ler a PRÓPRIA linha
    // justamente para esta distinção existir: sem ela, a tela não saberia
    // separar "sua conta foi desativada" de "seu usuário não tem perfil", e a
    // pessoa abriria chamado de um defeito que não existe.
    if ((data as { ativo?: boolean }).ativo === false) {
      definirAtor(null);
      set({ usuario: null, recursos: null, carregando: false });
      return "inativo" as const;
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
      if (u === "inativo") {
        await supabase.auth.signOut();
        return {
          ok: false,
          erro: "A sua conta está inativa. Procure a Direção da Pólobh para reativar o acesso.",
        };
      }
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

    /**
     * "Esqueceu a senha?" — o caminho que faltava (15/09/2026).
     *
     * Até aqui, quem esquecia a senha pedia ao suporte um convite novo, e o
     * resultado prático era a senha do primeiro dia valendo para sempre: ninguém
     * abre um chamado para trocar de senha.
     *
     * A resposta é SEMPRE a mesma, tenha o e-mail cadastro ou não. Dizer "este
     * e-mail não existe" entrega quem trabalha na casa a quem perguntar — e o
     * sistema tem os nomes de toda a equipe.
     */
    pedirRedefinicaoSenha: async (email) => {
      const limpo = email.trim().toLowerCase();
      if (!limpo) return { ok: false, erro: "Informe o seu e-mail." };
      const { error } = await supabase.auth.resetPasswordForEmail(limpo, {
        redirectTo: `${window.location.origin}/nova-senha`,
      });
      // O erro do Supabase aqui costuma ser limite de envio, não "não existe".
      if (error) return { ok: false, erro: traduzirErroDeSenha(error.message) };
      auditar({
        categoria: "Autenticação",
        acao: "auth.senha.redefinicao",
        mensagem: `Redefinição de senha solicitada para ${limpo}`,
      });
      return { ok: true };
    },

    /**
     * A senha nova de quem chegou pelo link do e-mail.
     *
     * Aqui NÃO se pede a senha atual — quem chegou por este caminho não a tem,
     * e é justamente isso que o link resolve. Quem garante que é a pessoa é o
     * e-mail: o Supabase abre uma sessão de recuperação ao abrir o link, e sem
     * ela `updateUser` falha.
     */
    definirSenhaPeloLink: async (nova) => {
      const { error } = await supabase.auth.updateUser({ password: nova });
      if (error) return { ok: false, erro: traduzirErroDeSenha(error.message) };
      auditar({
        categoria: "Autenticação",
        acao: "auth.senha.redefinida",
        mensagem: "Senha redefinida pelo link enviado por e-mail",
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
      // O aparelho para de receber os avisos de quem saiu (computador
      // compartilhado). Antes do signOut: a função precisa da sessão.
      await import("@/lib/push").then((m) => m.desligarNesteAparelho()).catch(() => {});
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
