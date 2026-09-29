/**
 * Edge Function agendada: backup-diario
 * Todo dia às 22h00 (Brasília) copia os dados do sistema para um arquivo JSON e
 * o envia para a pasta de Back-Up da Pólobh no Dropbox. O Dropbox de cada
 * computador da rede sincroniza a pasta sozinho:
 *   C:\Users\<usuário>\Dropbox\Pólobh (HGM)\Internos (Novo)\05 - TI\App Pólobh\Back-Up
 *
 * Deploy:   supabase functions deploy backup-diario --no-verify-jwt
 * Agendar:  select agendar_backup_diario('<URL da função>', '<CRON_SECRET>');
 *           (função criada pela migração 20260929100000)
 *
 * Segredos (supabase secrets set ...):
 *   CRON_SECRET             o mesmo usado no agendamento
 *   DROPBOX_APP_KEY         chave do app criado em dropbox.com/developers
 *   DROPBOX_APP_SECRET      segredo desse app
 *   DROPBOX_REFRESH_TOKEN   token de longa duração (fluxo offline, ver docs/BACKUP_E_ARQUIVO_DROPBOX.md)
 *   DROPBOX_BACKUP_PATH     opcional — padrão abaixo (caminho DENTRO do Dropbox, com "/" na frente)
 *
 * O arquivo leva a data no nome (backup-AAAA-MM-DD.json). Rodar duas vezes no
 * mesmo dia sobrescreve o do dia — o backup é idempotente.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PASTA_PADRAO = "/Pólobh (HGM)/Internos (Novo)/05 - TI/App Pólobh/Back-Up";

/** Tabelas copiadas. Fora: `emails` e `audit_log` (volumosos, e a trilha é do Admin). */
const TABELAS = [
  "perfis", "areas", "config_app", "clientes", "fornecedores", "empresas_grupo",
  "projetos", "ecs", "ec_linhas", "oss", "os_linhas", "os_financeiro",
  "credenciamentos", "checklists", "checklist_itens", "checklist_modelos", "chamados",
];

const PAGINA = 1000;

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

/** Data de hoje em Brasília (AAAA-MM-DD) — o job roda 01:00 UTC, já "amanhã" em UTC. */
function hojeBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

async function tokenDropbox(): Promise<string> {
  const corpo = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: Deno.env.get("DROPBOX_REFRESH_TOKEN") ?? "",
    client_id: Deno.env.get("DROPBOX_APP_KEY") ?? "",
    client_secret: Deno.env.get("DROPBOX_APP_SECRET") ?? "",
  });
  const r = await fetch("https://api.dropboxapi.com/oauth2/token", { method: "POST", body: corpo });
  if (!r.ok) throw new Error(`Dropbox recusou o token (${r.status})`);
  return (await r.json()).access_token as string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "Method not allowed" }, 405);
  const segredo = Deno.env.get("CRON_SECRET") ?? "";
  if (!segredo || req.headers.get("x-cron-secret") !== segredo) return json({ erro: "Não autorizado" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dados: Record<string, unknown[]> = {};
  const contagem: Record<string, number> = {};
  for (const tabela of TABELAS) {
    const linhas: unknown[] = [];
    for (let de = 0; ; de += PAGINA) {
      const { data, error } = await sb.from(tabela).select("*").range(de, de + PAGINA - 1);
      if (error) return json({ erro: `Falha lendo ${tabela}: ${error.message}` }, 500);
      linhas.push(...(data ?? []));
      if ((data?.length ?? 0) < PAGINA) break;
    }
    dados[tabela] = linhas;
    contagem[tabela] = linhas.length;
  }

  const dia = hojeBrasilia();
  const arquivo = JSON.stringify({ geradoEm: new Date().toISOString(), dia, contagem, dados });
  const pasta = (Deno.env.get("DROPBOX_BACKUP_PATH") ?? PASTA_PADRAO).replace(/\/+$/, "");
  const caminho = `${pasta}/backup-${dia}.json`;

  try {
    const token = await tokenDropbox();
    const r = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        // Cabeçalho HTTP só aceita ASCII: acentos do caminho vão escapados (\uXXXX).
        "Dropbox-API-Arg": JSON.stringify({ path: caminho, mode: "overwrite", mute: true }).replace(
          /[\u0080-\uffff]/g,
          (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
        ),
      },
      body: arquivo,
    });
    if (!r.ok) return json({ erro: `Dropbox recusou o arquivo (${r.status}): ${await r.text()}` }, 502);
  } catch (e) {
    return json({ erro: (e as Error).message }, 502);
  }

  await sb.from("audit_log").insert({
    nivel: "info", categoria: "Backup", acao: "backup.diario",
    mensagem: `Backup de ${dia} enviado ao Dropbox (${Object.values(contagem).reduce((a, b) => a + b, 0)} registros)`,
  });
  return json({ ok: true, caminho, contagem });
});
