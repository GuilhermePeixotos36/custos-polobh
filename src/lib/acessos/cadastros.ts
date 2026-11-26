// Cadastro de Setores e Funções (cargos) — tabelas `acesso_setor` e `acesso_funcao`
// (migração 20261126120000). O cadastro do usuário escolhe daqui, sem digitação livre: assim
// "Produção" e "producao" não viram dois setores. Nunca se exclui: inativa.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

const bd = supabase as unknown as SupabaseClient;

export type TipoCadastro = "setor" | "funcao";
export type ItemCadastro = { id: string; nome: string; ativo: boolean };

const TABELA: Record<TipoCadastro, string> = { setor: "acesso_setor", funcao: "acesso_funcao" };

function mensagem(error: { code?: string; message?: string }, tipo: TipoCadastro): string {
  if (error.code === "23505") return `Já existe ${tipo === "setor" ? "um setor" : "uma função"} com este nome.`;
  if (error.code === "42501") return `Você não tem permissão para alterar ${tipo === "setor" ? "setores" : "funções"}.`;
  if (error.code === "23514") return "O nome precisa ter ao menos 2 caracteres.";
  return error.message || "Não foi possível salvar.";
}

export async function carregarCadastro(tipo: TipoCadastro): Promise<ItemCadastro[]> {
  const { data, error } = await bd.from(TABELA[tipo]).select("id, nome, ativo").order("nome");
  if (error) throw new Error(error.message);
  return ((data ?? []) as ItemCadastro[]).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function salvarItemCadastro(tipo: TipoCadastro, item: { id?: string; nome: string; ativo?: boolean }): Promise<void> {
  const nome = item.nome.trim().replace(/\s+/g, " ");
  if (nome.length < 2) throw new Error("O nome precisa ter ao menos 2 caracteres.");
  const linha: Record<string, unknown> = { nome };
  if (item.ativo !== undefined) linha.ativo = item.ativo;
  const { error } = item.id
    ? await bd.from(TABELA[tipo]).update(linha).eq("id", item.id)
    : await bd.from(TABELA[tipo]).insert(linha);
  if (error) throw new Error(mensagem(error, tipo));
}
