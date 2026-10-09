import { useState } from "react";
import { useAvisoDeSaida } from "@/hooks/useAvisoDeSaida";
import { useParams } from "react-router-dom";
import { Button, Input } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { cx, dataBR, maskCpfCnpjInput, maskPlaca } from "@/lib/format";
import type { CredenciamentoMembro, CredenciamentoVeiculo } from "@/data/types";
import { camposDoCredenciamento, pedeVeiculo, type CampoCredenciamento } from "@/domain/credenciamentoCampos";

interface Contexto {
  evento: { titulo: string; local: string; data: string };
  fornecedor: string;
  prazoLimite: string;
  /** O servidor é quem decide: o prazo é do calendário da Pólobh (fuso de Brasília). */
  prazoEncerrado?: boolean;
  /**
   * Os campos que ESTE credenciamento pede (15/09/2026). Vêm do servidor junto
   * do resto do contexto: o formulário é público, e deixar a escolha chegar
   * pela URL seria deixar qualquer um pedir o RG da equipe alheia.
   */
  campos?: CampoCredenciamento[];
}

const base = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const headers = { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" };

const membroVazio = (): CredenciamentoMembro => ({ nome: "", cpf: "", funcao: "" });

/** Rótulo e máscara de cada campo escolhido — o formulário se monta com isto. */
const CAMPO_INPUT: Record<
  Exclude<CampoCredenciamento, "veiculo" | "placa">,
  { placeholder: string; tipo?: string; inputMode?: "numeric" | "tel"; mascara?: (v: string) => string }
> = {
  funcao: { placeholder: "Função" },
  rg: { placeholder: "RG" },
  cpf: { placeholder: "CPF", inputMode: "numeric", mascara: maskCpfCnpjInput },
  endereco: { placeholder: "Endereço completo" },
  telefone: { placeholder: "Telefone com DDD", inputMode: "tel" },
  aniversario: { placeholder: "Aniversário", tipo: "date" },
};
const veiculoVazio = (): CredenciamentoVeiculo => ({ modelo: "", placa: "" });

/** Formulário público (sem login) de credenciamento, preenchido pelo fornecedor. */
export function CredenciamentoPublico() {
  const { token = "" } = useParams();

  const { data: ctx, loading } = useAsync(async () => {
    const resp = await fetch(`${base}/functions/v1/credenciamento?token=${encodeURIComponent(token)}`, { headers });
    if (!resp.ok) return null;
    return (await resp.json()) as Contexto;
  }, [token]);

  /** O que este credenciamento pede — com o padrão de sempre quando não veio nada. */
  const campos = camposDoCredenciamento(ctx?.campos);
  const camposDaPessoa = campos.filter((c) => c !== "veiculo" && c !== "placa") as Exclude<CampoCredenciamento, "veiculo" | "placa">[];

  const [equipe, setEquipe] = useState<CredenciamentoMembro[]>([membroVazio()]);
  const [veiculos, setVeiculos] = useState<CredenciamentoVeiculo[]>([veiculoVazio()]);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  // Formulário público preenchido pelo fornecedor: recarregar perderia o que ele digitou.
  useAvisoDeSaida({ equipe, veiculos }, !enviado);

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
        {ctx.prazoLimite && (
          <p className={cx("text-[12.5px] font-semibold mt-1", ctx.prazoEncerrado ? "text-danger" : "text-primary-dark")}>
            Prazo para credenciamento: {dataBR(ctx.prazoLimite)}
            {ctx.prazoEncerrado && " — encerrado"}
          </p>
        )}

        {/* Prazo vencido: avisa AGORA, e não depois de a pessoa preencher a
            equipe inteira e apanhar um erro no envio. */}
        {ctx.prazoEncerrado && !enviado ? (
          <div className="mt-8 bg-surface border border-danger/30 rounded-card shadow-card p-6 text-center">
            <h2 className="font-display font-bold text-ink text-lg">Prazo encerrado</h2>
            <p className="text-ink-2 text-sm mt-1">
              O prazo para este credenciamento terminou em {dataBR(ctx.prazoLimite)}. Fale com a produção da Pólobh
              para reabrir o formulário.
            </p>
          </div>
        ) : enviado ? (
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
              {/* Empilha no celular: este formulário é preenchido PELO
                  FORNECEDOR, quase sempre pelo telefone, e em colunas fixas o
                  campo de nome ficava com uns 90px. */}
              {/* O formulário se MONTA com o que a Pólobh escolheu para este
                  credenciamento (15/09/2026): o de estádio pede RG e placa, o do
                  almoço de trinta pessoas pede nome e função — e pedir o resto é
                  atrito para o fornecedor e dado sensível guardado à toa.
                  O NOME é sempre pedido: sem ele a linha não identifica ninguém. */}
              <div className="space-y-3">
                {equipe.map((m, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <Input
                      className="flex-1 min-w-[12rem]"
                      placeholder="Nome completo"
                      value={m.nome}
                      onChange={(e) => setEquipe((l) => l.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                    />
                    {camposDaPessoa.map((campo) => {
                      const def = CAMPO_INPUT[campo];
                      return (
                        <Input
                          key={campo}
                          className="flex-1 min-w-[9rem]"
                          type={def.tipo}
                          inputMode={def.inputMode}
                          placeholder={def.placeholder}
                          value={(m[campo] as string) ?? ""}
                          onChange={(e) => {
                            const valor = def.mascara ? def.mascara(e.target.value) : e.target.value;
                            setEquipe((l) => l.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));
                          }}
                        />
                      );
                    })}
                    <button type="button" className="text-ink-3 hover:text-danger px-2" onClick={() => setEquipe((l) => l.filter((_, j) => j !== i))} aria-label="Remover">✕</button>
                  </div>
                ))}
              </div>
            </section>

            {/* Veículos — só quando este credenciamento os pede. */}
            {pedeVeiculo(campos) && (
            <section className="bg-surface border border-border rounded-card shadow-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-ink">Veículos</h3>
                <Button type="button" variant="secondary" size="sm" onClick={() => setVeiculos((l) => [...l, veiculoVazio()])}>+ Veículo</Button>
              </div>
              <div className="space-y-2">
                {veiculos.map((v, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2 sm:items-center">
                    <Input placeholder="Modelo / descrição" value={v.modelo} onChange={(e) => setVeiculos((l) => l.map((x, j) => (j === i ? { ...x, modelo: e.target.value } : x)))} />
                    <Input placeholder="Placa" value={v.placa} onChange={(e) => setVeiculos((l) => l.map((x, j) => (j === i ? { ...x, placa: maskPlaca(e.target.value) } : x)))} />
                    <button type="button" className="text-ink-3 hover:text-danger px-2" onClick={() => setVeiculos((l) => l.filter((_, j) => j !== i))} aria-label="Remover">✕</button>
                  </div>
                ))}
              </div>
            </section>
            )}

            {erro && <p className="text-[13px] font-semibold text-danger bg-danger-soft rounded-btn px-3 py-2">{erro}</p>}

            <Button type="submit" block disabled={enviando}>
              {enviando ? "Enviando…" : "Enviar credenciamento"}
            </Button>
          </form>
        )}

        <p className="text-center text-ink-3 text-[12px] mt-10">© Pólobh Promoções</p>
      </main>
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen grid place-items-center text-ink-2 px-6 text-center">{children}</div>;
}
