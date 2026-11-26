/**
 * Cliente Supabase único do app. As credenciais vêm do .env (VITE_*) — a chave
 * `anon` é pública por design; a segurança real está nas policies de RLS
 * (ver supabase/schema.sql), não em esconder a anon key.
 */
import { createClient } from "@supabase/supabase-js";
import { configurarRegistroDeLogs } from "@/lib/logs/registrarLog";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  // Falha cedo e clara: o app é 100% banco, não há fallback mock.
  throw new Error(
    "Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env."
  );
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// O registro de logs recebe o cliente por INJEÇÃO (padrão de Logs, ponto 0): o registrador não
// importa este módulo — um ciclo de import aqui é tela em branco em produção com testes verdes.
configurarRegistroDeLogs({
  rpc: (nome, argumentos) => (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => PromiseLike<{ error: { code?: string; message?: string } | null }>;
  }).rpc(nome, argumentos),
  ativo: true,
});
