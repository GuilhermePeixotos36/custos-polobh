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

// LOGS (24/11/2026): o registrador recebe a chamada de RPC por INJEÇÃO, aqui, e não importa este
// módulo — o tratamento de erro do app (que usa este cliente) importa o registrador, e um import
// de volta faria um ciclo que, conforme a ordem do empacotador, dá tela em branco ("Cannot access
// 'supabase' before initialization"). O cliente vai sem tipos porque `registrar_log` pode ainda não
// existir no banco: sem ela o registrador se desliga sozinho pelo resto da sessão.
configurarRegistroDeLogs({
  rpc: (nome, argumentos) => (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => PromiseLike<{ error: { code?: string; message?: string } | null }>;
  }).rpc(nome, argumentos),
  ativo: true,
});
