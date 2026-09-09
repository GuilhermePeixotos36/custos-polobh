/**
 * Edge Function agendada: lembretes-cronograma
 * Envia, automaticamente, o lembrete de cronograma aos fornecedores
 * **2 dias úteis antes do evento** (exigência da Pólobh — texto padrão).
 *
 * Deploy:   supabase functions deploy lembretes-cronograma
 * Agendar:  via pg_cron (ver supabase/schema.sql) ou um cron externo que faça
 *           POST nesta função 1x ao dia.
 *
 * O CORPO DA MENSAGEM não mora mais aqui (revisão de 10/09/2026). Ele era uma
 * cópia à mão do texto do aplicativo, e as duas envelheceram em ritmos
 * diferentes: a do app aprendeu a dizer TODAS as datas do evento, e esta
 * continuou mandando o fornecedor para um evento de um dia só, porque lia
 * `projeto.evento` — que guarda apenas a primeira faixa do cronograma. Agora as
 * duas saem da mesma régua (`../_shared/cronogramaEmail.ts`).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enviarPeloBrevo } from "../_shared/brevo.ts";
import {
  corpoCronogramaFornecedor,
  type EtapaOsJson,
  type FornecedorJson,
  type ProjetoJson,
} from "../_shared/cronogramaEmail.ts";

/** Soma N dias úteis (pula sábado/domingo). */
function maisDiasUteis(base: Date, n: number): Date {
  const d = new Date(base);
  let restantes = n;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) restantes--;
  }
  return d;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Só OS que o fornecedor de fato recebeu entra no lembrete.
 *
 * Rascunho é papel de trabalho — ninguém do lado de fora sabe que ele existe —,
 * e Cancelada é justamente o que NÃO vale mais: mandar o cronograma de uma OS
 * arquivada dois dias antes do evento é pior do que não mandar nada. Antes o
 * filtro não existia, e a reemissão por troca de fornecedor (que cancela a
 * anterior) faria os dois receberem.
 */
const STATUS_QUE_RECEBEM = ["Emitida", "Disparada"];

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ erro: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  const segredo = Deno.env.get("CRON_SECRET") ?? "";
  if (!segredo || req.headers.get("x-cron-secret") !== segredo) {
    return new Response(JSON.stringify({ erro: "Não autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);

  // Data-alvo: eventos que COMEÇAM daqui a 2 dias úteis. `projeto.evento` é a
  // primeira faixa da etapa Evento, mantida em dia a cada gravação do projeto
  // (ver `sincronizarCamposLegados`) — serve bem como gatilho. O que ele não
  // serve é para DIZER quando o evento acontece: disso cuida o texto, que lê o
  // cronograma inteiro.
  const alvo = iso(maisDiasUteis(new Date(), 2));

  // ECs com evento na data-alvo (projeto.evento guardado em jsonb).
  const { data: ecs, error } = await sb
    .from("ecs")
    .select("id, numero, cliente_id, projeto")
    .filter("projeto->>evento", "eq", alvo);
  if (error) return new Response(JSON.stringify({ erro: error.message }), { status: 500 });

  let enviados = 0;
  for (const ec of ecs ?? []) {
    const { data: oss } = await sb
      .from("oss")
      .select("*")
      .eq("ec_id", ec.id)
      .in("status", STATUS_QUE_RECEBEM);
    for (const os of oss ?? []) {
      const f = (os.fornecedor ?? {}) as FornecedorJson;
      if (!f.email) continue;

      // O projeto vem da OS quando ela tem a sua foto do evento (toda OS
      // emitida tem), e da EC só como plano B: é a foto da OS que o fornecedor
      // recebeu, e é sobre ela que o lembrete fala.
      const proj = (os.projeto ?? ec.projeto ?? {}) as ProjetoJson;
      const msg = corpoCronogramaFornecedor({
        projeto: proj,
        fornecedor: f,
        etapas: (os.cronograma ?? []) as EtapaOsJson[],
        numeroOs: os.numero,
        lembrete: true,
      });

      // A restrição única no banco transforma cada lembrete diário em uma operação idempotente.
      const { data: reserva, error: reservaErro } = await sb.from("emails").insert({
        assunto: msg.assunto,
        destinatarios: [f.email],
        status: "processando",
        tipo: "lembrete_cronograma",
        referencia_id: os.id,
        data_referencia: alvo,
      }).select("id").maybeSingle();
      if (reservaErro?.code === "23505" || !reserva) continue;
      if (reservaErro) throw reservaErro;

      try {
        const envio = await enviarPeloBrevo({
          para: [{ email: f.email, nome: f.razaoSocial }],
          assunto: msg.assunto,
          html: msg.html,
        });
        await sb.from("emails").update({ status: "enviado", provider_id: envio.messageId ?? null }).eq("id", reserva.id);
        enviados++;
      } catch (erro) {
        await sb.from("emails").update({ status: "erro", erro: String((erro as Error).message) }).eq("id", reserva.id);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, dataAlvo: alvo, enviados }), {
    headers: { "Content-Type": "application/json" },
  });
});
