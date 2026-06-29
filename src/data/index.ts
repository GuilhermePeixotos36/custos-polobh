/**
 * Fonte de dados do app: 100% Supabase (sem mock).
 * A implementação concreta vive em ./supabase e fala com o banco via RLS.
 */
import type { Repositorios } from "./repository";
import { supabaseRepositorios } from "./supabase";

export const repo: Repositorios = supabaseRepositorios;

export * from "./repository";
export * from "./types";
