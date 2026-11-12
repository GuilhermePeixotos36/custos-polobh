/**
 * PUSH-PENDENCIAS — o aviso de pendência que chega com o navegador FECHADO.
 *
 * Quem sabe o que é pendência é o app (`domain/pendencias`); esta função só
 * ENTREGA e NÃO REPETE. Qualquer app aberto da equipe calcula as pendências de
 * quem tem aparelho inscrito e manda para cá; `registrar_push` separa o que é
 * novo para cada pessoa (dez apps abertos mandando a mesma pendência viram UM
 * aviso), e só o novo vira push.
 *
 * Ações (POST, com a sessão do usuário):
 *  · chave   → a chave pública VAPID (gerada e guardada aqui na primeira vez —
 *              a privada nunca sai do servidor);
 *  · inscrever    → { inscricao: { endpoint, p256dh, auth }, userAgent, ids }.
 *                   Liga ESTE aparelho a quem chama. Quando o aparelho é novo
 *                   para a pessoa, as pendências atuais dela (`ids`) entram como
 *                   já avisadas ANTES da inscrição valer — o que já existia não
 *                   vira uma enxurrada de avisos. Se o aparelho era de outra
 *                   pessoa (computador compartilhado), passa a ser de quem entrou;
 *  · desinscrever → { endpoint }: ao sair do app, o aparelho para de receber;
 *  · avisar  → { avisos: [{ userId, pendencias: [{ id, titulo, url }] }] }. O `id`
 *              é a CHAVE do aviso (`chavePendencia`): a pendência mais, quando é uma
 *              conversa ou uma etapa da OS, "#" e a marca da vez — assim a thread
 *              que volta para a pessoa, ou a OS devolvida e reenviada, avisa de novo;
 *  · teste   → um aviso de teste para os aparelhos de quem chama.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { autorizar, respostaAutorizacao } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MAX_PESSOAS = 60;
const MAX_PENDENCIAS = 400;
const corta = (s: unknown, n: number) => String(s ?? "").slice(0, n);
/** Só caminhos do próprio app — o aviso nunca leva para fora do Pólobh. */
const caminho = (u: unknown) => {
  const s = String(u ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s.slice(0, 300) : "/projetos";
};

interface Chaves {
  publica: string;
  privada: string;
}

let chavesEmMemoria: Chaves | null = null;

/** O par VAPID: lido do banco, ou gerado e guardado na primeira vez. */
async function chaves(): Promise<Chaves> {
  if (chavesEmMemoria) return chavesEmMemoria;
  const ler = async () => {
    const { data, error } = await admin.from("push_config").select("vapid_publica, vapid_privada").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data ? { publica: data.vapid_publica as string, privada: data.vapid_privada as string } : null;
  };
  let c = await ler();
  if (!c) {
    const novo = webpush.generateVAPIDKeys();
    // Duas chamadas ao mesmo tempo: a primeira grava, a segunda relê a dela.
    await admin
      .from("push_config")
      .upsert({ id: 1, vapid_publica: novo.publicKey, vapid_privada: novo.privateKey }, { onConflict: "id", ignoreDuplicates: true });
    c = await ler();
    if (!c) throw new Error("Não foi possível gerar a chave de notificação.");
  }
  chavesEmMemoria = c;
  return c;
}

interface Inscricao {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface Aviso {
  titulo: string;
  corpo: string;
  url: string;
  tag: string;
}

/** Manda o aviso a cada aparelho; inscrição que o navegador já descartou sai da base. */
async function entregar(inscricoes: Inscricao[], aviso: Aviso) {
  const c = await chaves();
  let enviados = 0;
  const mortas: string[] = [];
  const falhas: string[] = [];
  await Promise.all(
    inscricoes.map(async (i) => {
      try {
        await webpush.sendNotification(
          { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
          JSON.stringify(aviso),
          {
            vapidDetails: { subject: "https://app.polobh.com.br", publicKey: c.publica, privateKey: c.privada },
            TTL: 60 * 60 * 24,
            urgency: "normal",
            topic: aviso.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined,
          },
        );
        enviados++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410: o navegador desinstalou, limpou os dados ou revogou a permissão.
        if (status === 404 || status === 410) mortas.push(i.id);
        else falhas.push(`${status ?? "?"} ${(e as Error).message ?? e}`.slice(0, 200));
      }
    }),
  );
  if (mortas.length) await admin.from("push_inscricoes").delete().in("id", mortas);
  const vivas = inscricoes.filter((i) => !mortas.includes(i.id)).map((i) => i.id);
  if (enviados && vivas.length) await admin.from("push_inscricoes").update({ usado_em: new Date().toISOString() }).in("id", vivas);
  return { enviados, removidas: mortas.length, falhas };
}

async function inscricoesDe(userIds: string[]): Promise<Inscricao[]> {
  if (!userIds.length) return [];
  const { data, error } = await admin.from("push_inscricoes").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds);
  if (error) throw error;
  return (data ?? []) as Inscricao[];
}

async function registrar(userId: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data, error } = await admin.rpc("registrar_push", { p_user: userId, p_ids: ids });
  if (error) throw error;
  return new Set(((data ?? []) as unknown[]).map((x) => (typeof x === "string" ? x : String(Object.values(x as object)[0]))));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let quem;
  try {
    quem = await autorizar(req, ["Admin", "Direcao", "Producao", "Administrativo"]);
  } catch (e) {
    const r = respostaAutorizacao(e, cors);
    if (r) return r;
    return json({ ok: false, erro: (e as Error).message }, 500);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const acao = body.acao;

    if (acao === "chave") return json({ ok: true, chave: (await chaves()).publica });

    if (acao === "inscrever") {
      const i = (body.inscricao ?? {}) as Record<string, unknown>;
      const endpoint = corta(i.endpoint, 1000);
      const p256dh = corta(i.p256dh, 200);
      const auth = corta(i.auth, 100);
      if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return json({ ok: false, erro: "Inscrição inválida." }, 400);
      const { data: atual, error: eAtual } = await admin
        .from("push_inscricoes")
        .select("user_id")
        .eq("endpoint", endpoint)
        .maybeSingle();
      if (eAtual) throw eAtual;
      const novoParaPessoa = !atual || atual.user_id !== quem.id;
      if (novoParaPessoa) {
        const ids = Array.isArray(body.ids) ? body.ids.slice(0, MAX_PENDENCIAS).map((x) => corta(x, 200)) : [];
        await registrar(quem.id, [...new Set(ids)]);
      }
      const { error } = await admin.from("push_inscricoes").upsert(
        { user_id: quem.id, endpoint, p256dh, auth, user_agent: corta(body.userAgent, 300) || null },
        { onConflict: "endpoint" },
      );
      if (error) throw error;
      return json({ ok: true, novo: novoParaPessoa });
    }

    if (acao === "desinscrever") {
      const endpoint = corta(body.endpoint, 1000);
      if (endpoint) await admin.from("push_inscricoes").delete().eq("endpoint", endpoint).eq("user_id", quem.id);
      return json({ ok: true });
    }

    if (acao === "teste") {
      const r = await entregar(await inscricoesDe([quem.id]), {
        titulo: "Teste do Pólobh",
        corpo: "Se você está vendo isto, os avisos chegam neste aparelho mesmo com o navegador fechado.",
        url: "/projetos",
        tag: "polobh-teste",
      });
      return json({ ok: true, ...r });
    }

    if (acao === "avisar") {
      const avisos = (Array.isArray(body.avisos) ? body.avisos : []).slice(0, MAX_PESSOAS) as {
        userId?: unknown;
        pendencias?: unknown;
      }[];
      const porPessoa = new Map<string, { id: string; titulo: string; url: string }[]>();
      for (const a of avisos) {
        const userId = corta(a.userId, 64);
        if (!/^[0-9a-f-]{36}$/i.test(userId) || !Array.isArray(a.pendencias)) continue;
        porPessoa.set(
          userId,
          (a.pendencias as Record<string, unknown>[]).slice(0, MAX_PENDENCIAS).map((p) => ({
            id: corta(p.id, 200),
            titulo: corta(p.titulo, 200),
            url: caminho(p.url),
          })),
        );
      }
      const todas = await inscricoesDe([...porPessoa.keys()]);
      let enviados = 0;
      let removidas = 0;
      const falhas: string[] = [];
      for (const [userId, pendencias] of porPessoa) {
        const aparelhos = todas.filter((i) => i.user_id === userId);
        // Sem aparelho inscrito não há a quem avisar — e não se marca nada como
        // avisado, para o aparelho que se inscrever depois semear do zero.
        if (!aparelhos.length || !pendencias.length) continue;
        const novasIds = await registrar(userId, [...new Set(pendencias.map((p) => p.id))]);
        const novas = pendencias.filter((p, i, arr) => novasIds.has(p.id) && arr.findIndex((q) => q.id === p.id) === i);
        if (!novas.length) continue;
        const primeira = novas[0];
        const r = await entregar(aparelhos, {
          titulo: novas.length === 1 ? "Nova pendência" : `${novas.length} novas pendências`,
          corpo: novas.length === 1 ? primeira.titulo : `${primeira.titulo} — e mais ${novas.length - 1}.`,
          url: novas.length === 1 ? primeira.url : "/projetos",
          tag: "polobh-pendencias",
        });
        // Nenhum aparelho recebeu por FALHA da entrega (e não por inscrição
        // morta): a pendência foi marcada como avisada e o aviso não saiu. Desfaz
        // a marca para a próxima carga de qualquer app tentar de novo — senão o
        // aviso se perde para sempre (12/11/2026).
        if (!r.enviados && r.falhas.length) {
          await admin
            .from("push_enviadas")
            .delete()
            .eq("user_id", userId)
            .in("pendencia_id", novas.map((p) => p.id));
        }
        enviados += r.enviados;
        removidas += r.removidas;
        falhas.push(...r.falhas);
      }
      if (falhas.length) console.error("[push-pendencias] falhas de entrega:", falhas.slice(0, 5));
      return json({ ok: true, enviados, removidas, falhas: falhas.length });
    }

    return json({ ok: false, erro: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error("[push-pendencias]", e);
    return json({ ok: false, erro: (e as Error).message ?? String(e) }, 500);
  }
});
