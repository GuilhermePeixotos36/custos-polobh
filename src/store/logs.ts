/**
 * Trilha de auditoria (logs do sistema) — gravada na tabela `audit_log` do
 * Supabase (append-only, protegida por RLS: só Admin lê). `auditar()` é o
 * único ponto de escrita; pode ser chamado de qualquer lugar (componentes,
 * stores, repositórios). A leitura acontece na tela Logs (src/pages/Logs.tsx).
 */
import { supabase } from "@/lib/supabaseClient";
import type { LogCategoria, LogNivel, Papel } from "@/data/types";

export interface NovoLog {
  nivel?: LogNivel; // default: "info"
  categoria: LogCategoria;
  acao: string;
  mensagem: string;
  usuario?: string;
  papel?: Papel;
  alvoId?: string;
}

/**
 * Ator atual da sessão, mantido fora do store de auth para evitar import
 * circular. O auth chama `definirAtor` no login/logout; `auditar` usa esse
 * valor como autor padrão dos eventos disparados em código sem contexto.
 */
let atorAtual: { id: string; nome: string; papel: Papel } | null = null;
export function definirAtor(u: { id: string; nome: string; papel: Papel } | null) {
  atorAtual = u;
}

/** Registra um evento na trilha de auditoria (fire-and-forget). */
export function auditar(l: NovoLog) {
  void supabase
    .from("audit_log")
    .insert({
      nivel: l.nivel ?? "info",
      categoria: l.categoria,
      acao: l.acao,
      mensagem: l.mensagem,
      usuario: l.usuario ?? atorAtual?.nome ?? null,
      papel: l.papel ?? atorAtual?.papel ?? null,
      user_id: atorAtual?.id ?? null,
      alvo_id: l.alvoId ?? null,
    })
    .then(({ error }) => {
      // Sem perfil/sessão a RLS bloqueia (ex.: falha de login por anon) — ok.
      if (error) console.warn("[audit] não registrado:", error.message);
    });
}
