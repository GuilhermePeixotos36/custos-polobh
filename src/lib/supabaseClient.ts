/**
 * Cliente Supabase único do app. As credenciais vêm do .env (VITE_*) — a chave
 * `anon` é pública por design; a segurança real está nas policies de RLS
 * (ver supabase/schema.sql), não em esconder a anon key.
 */
import { createClient } from "@supabase/supabase-js";

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
