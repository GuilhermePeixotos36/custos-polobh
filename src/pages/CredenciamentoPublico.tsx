import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button, Input } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { dataBR, maskCpfCnpjInput, maskPlaca } from "@/lib/format";
import type { CredenciamentoMembro, CredenciamentoVeiculo } from "@/data/types";

interface Contexto {
  evento: { titulo: string; local: string; data: string };
  fornecedor: string;
  prazoLimite: string;
}

const base = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const headers = { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" };

const membroVazio = (): CredenciamentoMembro => ({ nome: "", cpf: "", funcao: "" });
const veiculoVazio = (): CredenciamentoVeiculo => ({ modelo: "", placa: "" });

/** Formulário público (sem login) de credenciamento, preenchido pelo fornecedor. */
export function CredenciamentoPublico() {
  const { token = "" } = useParams();

  const { data: ctx, loading } = useAsync(async () => {
    const resp = await fetch(`${base}/functions/v1/credenciamento?token=${encodeURIComponent(token)}`, { headers });
    if (!resp.ok) return null;
    return (await resp.json()) as Contexto;
  }, [token]);

  const [equipe, setEquipe] = useState<CredenciamentoMembro[]>([membroVazio()]);
  const [veiculos, setVeiculos] = useState<CredenciamentoVeiculo[]>([veiculoVazio()]);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const resp = await fetch(`${base}/functions/v1/credenciamento`, {
        method: "POST",
        headers,
        body: JSON.stringify({ token, equipe, veiculos }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(data?.error ?? "Não foi possível enviar. Tente novamente.");
        return;
      }
      setEnviado(true);
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (loading) return <Centro>Carregando…</Centro>;
  if (!ctx) return <Centro>Link de credenciamento inválido ou expirado.</Centro>;

  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-surface border-b-2 border-primary">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center gap-3">
          <img src="/polobh-logo.png" className="h-8 w-auto object-contain" alt="Pólobh" />
          <div className="text-ink-3 text-[12px] font-semibold">Credenciamento de fornecedor</div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="font-display font-bold text-[24px] tracking-[-0.6px] text-ink">{ctx.evento.titulo}</h1>
        <p className="text-ink-2 mt-1">
          {ctx.fornecedor && <>{ctx.fornecedor} · </>}Evento em {dataBR(ctx.evento.data)}{ctx.evento.local ? ` · ${ctx.evento.local}` : ""}
        </p>
        {ctx.prazoLimite && <p className="text-[12.5px] text-primary-dark font-semibold mt-1">Prazo para credenciamento: {dataBR(ctx.prazoLimite)}</p>}

        {enviado ? (
          <div className="mt-8 bg-surface border border-border rounded-card shadow-card p-6 text-center">
            <h2 className="font-display font-bold text-ink text-lg">Credenciamento enviado!</h2>
            <p className="text-ink-2 text-sm mt-1">Recebemos os dados da sua equipe e veículos. Obrigado.</p>
          </div>
        ) : (
          <form onSubmit={enviar} className="mt-6 space-y-4">
            {/* Equipe */}
            <section className="bg-surface border border-border rounded-card shadow-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-ink">Equipe</h3>
                <Button type="button" variant="secondary" size="sm" onClick={() => setEquipe((l) => [...l, membroVazio()])}>+ Pessoa</Button>
              </div>
              <div className="space-y-2">
                {equipe.map((m, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_1fr_auto] gap-2 items-center">
                    <Input placeholder="Nome completo" value={m.nome} onChange={(e) => setEquipe((l) => l.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
                    <Input placeholder="CPF" inputMode="numeric" value={m.cpf} onChange={(e) => setEquipe((l) => l.map((x, j) => (j === i ? { ...x, cpf: maskCpfCnpjInput(e.target.value) } : x)))} />
                    <Input placeholder="Função" value={m.funcao} onChange={(e) => setEquipe((l) => l.map((x, j) => (j === i ? { ...x, funcao: e.target.value } : x)))} />
                    <button type="button" className="text-ink-3 hover:text-danger px-2" onClick={() => setEquipe((l) => l.filter((_, j) => j !== i))} aria-label="Remover">✕</button>
                  </div>
                ))}
              </div>
            </section>

            {/* Veículos */}
            <section className="bg-surface border border-border rounded-card shadow-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-ink">Veículos</h3>
                <Button type="button" variant="secondary" size="sm" onClick={() => setVeiculos((l) => [...l, veiculoVazio()])}>+ Veículo</Button>
              </div>
              <div className="space-y-2">
                {veiculos.map((v, i) => (
                  <div key={i} className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                    <Input placeholder="Modelo / descrição" value={v.modelo} onChange={(e) => setVeiculos((l) => l.map((x, j) => (j === i ? { ...x, modelo: e.target.value } : x)))} />
                    <Input placeholder="Placa" value={v.placa} onChange={(e) => setVeiculos((l) => l.map((x, j) => (j === i ? { ...x, placa: maskPlaca(e.target.value) } : x)))} />
                    <button type="button" className="text-ink-3 hover:text-danger px-2" onClick={() => setVeiculos((l) => l.filter((_, j) => j !== i))} aria-label="Remover">✕</button>
                  </div>
                ))}
              </div>
            </section>

            {erro && <p className="text-[13px] font-semibold text-danger bg-danger-soft rounded-btn px-3 py-2">{erro}</p>}

            <Button type="submit" block disabled={enviando}>
              {enviando ? "Enviando…" : "Enviar credenciamento"}
            </Button>
          </form>
        )}

        <p className="text-center text-ink-3 text-[12px] mt-10">© Pólobh Eventos</p>
      </main>
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen grid place-items-center text-ink-2 px-6 text-center">{children}</div>;
}
