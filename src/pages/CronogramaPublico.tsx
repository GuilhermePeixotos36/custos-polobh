import { useParams } from "react-router-dom";
import { useAsync } from "@/hooks/useAsync";
import { dataBR } from "@/lib/format";
import { Timeline, TimelineConsolidada, type ItemConsolidado } from "@/components/Timeline";
import { Badge, tomStatusOs } from "@/components/ui";
import type { CronogramaItem } from "@/data/types";

interface CronogramaPublicoResp {
  projeto: { titulo: string; local: string; evento: string };
  cliente: { nome: string };
  blocos: { fornecedor: string; status: string; cronograma: CronogramaItem[] }[];
}

/**
 * Página pública (sem login) com o cronograma consolidado do projeto.
 * Lê de uma Edge Function (service role) que devolve SÓ os campos do
 * cronograma — nunca expõe a EC/OS completa (financeiro, dados bancários).
 */
export function CronogramaPublico() {
  const { slug = "" } = useParams();

  const { data, loading } = useAsync(async () => {
    const base = import.meta.env.VITE_SUPABASE_URL as string;
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const resp = await fetch(
      `${base}/functions/v1/cronograma-publico?slug=${encodeURIComponent(slug)}`,
      { headers: { apikey: anon, Authorization: `Bearer ${anon}` } }
    );
    if (!resp.ok) return null;
    return (await resp.json()) as CronogramaPublicoResp;
  }, [slug]);

  if (loading) return <Centro>Carregando…</Centro>;
  if (!data || !data.projeto) return <Centro>Cronograma não encontrado.</Centro>;

  const blocosConsolidados: ItemConsolidado[] = data.blocos.flatMap((b) =>
    b.cronograma.map((c) => ({ ...c, fornecedor: b.fornecedor || "Fornecedor" }))
  );

  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-surface border-b-2 border-primary">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-3">
          <img src="/polobh-logo.png" className="h-8 w-auto object-contain" alt="Pólobh" />
          <div className="text-ink-3 text-[12px] font-semibold">Cronograma do projeto</div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="font-display font-bold text-[26px] tracking-[-0.6px] text-ink">{data.projeto.titulo}</h1>
        <p className="text-ink-2 mt-1">{data.cliente.nome} · Evento em {dataBR(data.projeto.evento)} · {data.projeto.local}</p>

        <div className="mt-6 space-y-4">
          {data.blocos.length === 0 ? (
            <p className="text-ink-3">Nenhuma etapa publicada ainda.</p>
          ) : (
            <>
              {/* Linha do tempo consolidada do evento */}
              <div className="bg-surface border border-border rounded-card shadow-card p-5">
                <h2 className="font-display font-bold text-ink text-[15px] mb-3">Linha do tempo do evento</h2>
                <TimelineConsolidada itens={blocosConsolidados} />
              </div>

              {/* Detalhe por fornecedor */}
              <div className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-ink-3 px-1 pt-1">Por fornecedor</div>
              {data.blocos.map((b, i) => (
                <div key={i} className="bg-surface border border-border rounded-card shadow-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display font-bold text-ink">{b.fornecedor || "Fornecedor"}</h3>
                    <Badge tom={tomStatusOs[b.status]}>{b.status}</Badge>
                  </div>
                  <Timeline itens={b.cronograma} />
                </div>
              ))}
            </>
          )}
        </div>
        <p className="text-center text-ink-3 text-[12px] mt-10">© Pólobh Promoções</p>
      </main>
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen grid place-items-center text-ink-2">{children}</div>;
}
