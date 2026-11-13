/**
 * PADRONIZAR OS ENDEREÇOS DOS FORNECEDORES PELO CNPJ (13/11/2026, pedido da Marisa).
 *
 * Os fornecedores já cadastrados trazem endereços de antes dos campos: sem o
 * tipo ("Avenida"), com vírgulas, sem "CEP:". Aqui o sistema percorre os que
 * estão fora do padrão e propõe a correção, e SÓ aplica o que a pessoa
 * confirmar:
 *
 *  · endereço completo, só escrito fora do padrão → reescrito pelos campos (sem rede);
 *  · endereço incompleto, com CNPJ → completado pelo endereço da Receita;
 *  · sem CNPJ válido ou sem resposta da consulta → fica na lista "ajustar à mão".
 *
 * A consulta é uma por vez, com uma pausa entre elas: a BrasilAPI é pública e
 * recusa rajada.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { IcFechar } from "@/components/icons";
import { repo } from "@/data";
import type { Fornecedor } from "@/data/types";
import { planejarPadronizacao, type ResultadoPadronizacao } from "@/domain/endereco";
import { consultarCnpj } from "@/lib/cnpj";
import { onlyDigits } from "@/lib/format";
import { toast } from "@/store/toast";

interface Linha {
  f: Fornecedor;
  plano: ResultadoPadronizacao;
  /** Pode ser aplicado sem revisão manual (endereço final completo). */
  aplicavel: boolean;
  marcado: boolean;
  /** Por que ficou para ajuste manual. */
  motivo?: string;
}

const PAUSA_MS = 450;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function PadronizarEnderecosModal({
  fornecedores,
  onFechar,
  onAplicado,
}: {
  fornecedores: Fornecedor[];
  onFechar: () => void;
  onAplicado: () => void;
}) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [feitos, setFeitos] = useState(0);
  const [aplicando, setAplicando] = useState(false);
  const cancelado = useRef(false);

  useEffect(() => {
    cancelado.current = false;
    (async () => {
      const saida: Linha[] = [];
      for (const f of fornecedores) {
        if (cancelado.current) return;
        const local = planejarPadronizacao(f.endereco, "");
        if (local.tipo === "ok") {
          setFeitos((n) => n + 1);
          continue;
        }
        if (local.tipo === "reescrever") {
          saida.push({ f, plano: local, aplicavel: true, marcado: true });
        } else {
          const digitos = onlyDigits(f.cnpj);
          if (digitos.length !== 14) {
            saida.push({ f, plano: local, aplicavel: false, marcado: false, motivo: "Sem CNPJ para consultar — complete o endereço à mão." });
          } else {
            try {
              const d = await consultarCnpj(f.cnpj);
              const plano = planejarPadronizacao(f.endereco, d.endereco);
              const completo = plano.tipo === "completar" && plano.completo;
              saida.push({
                f,
                plano,
                aplicavel: completo,
                marcado: completo,
                motivo: completo ? undefined : "A consulta não trouxe o endereço completo — complete à mão.",
              });
            } catch (e) {
              saida.push({ f, plano: local, aplicavel: false, marcado: false, motivo: (e as Error).message });
            }
            await espera(PAUSA_MS);
          }
        }
        setFeitos((n) => n + 1);
      }
      if (!cancelado.current) setLinhas(saida);
    })();
    return () => {
      cancelado.current = true;
    };
    // roda uma vez, com a lista que abriu o modal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const novoDe = (l: Linha) => (l.plano.tipo === "ok" ? l.f.endereco : l.plano.novo);
  const aplicaveis = (linhas ?? []).filter((l) => l.aplicavel);
  const manuais = (linhas ?? []).filter((l) => !l.aplicavel);
  const marcados = aplicaveis.filter((l) => l.marcado);

  async function aplicar() {
    setAplicando(true);
    let ok = 0;
    const falhas: string[] = [];
    for (const l of marcados) {
      try {
        await repo.fornecedores.salvar({ ...l.f, endereco: novoDe(l) });
        ok++;
      } catch (e) {
        falhas.push(`${l.f.nomeFantasia || l.f.razaoSocial}: ${(e as Error).message}`);
      }
    }
    setAplicando(false);
    toast(
      falhas.length ? `${ok} endereço(s) atualizado(s); ${falhas.length} falharam (${falhas[0]}).` : `${ok} endereço(s) atualizado(s).`,
      falhas.length ? "warning" : "success",
    );
    onAplicado();
    onFechar();
  }

  const alternar = (id: string) =>
    setLinhas((ls) => (ls ?? []).map((l) => (l.f.id === id && l.aplicavel ? { ...l, marcado: !l.marcado } : l)));

  return createPortal(
    <div className="no-print fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={aplicando ? undefined : onFechar} />
      <div className="relative w-full max-w-[920px] bg-surface rounded-card-lg shadow-modal border border-border flex flex-col max-h-[88vh]">
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-display font-bold text-[17px] text-ink tracking-[-0.3px]">Padronizar endereços pelo CNPJ</h3>
            <p className="text-[12.5px] text-ink-2 mt-0.5">
              Padrão: Tipo Nome, Número - Complemento - Bairro - Cidade - UF - CEP: 00000-000. Nada é alterado sem a sua confirmação.
            </p>
          </div>
          <button
            onClick={onFechar}
            disabled={aplicando}
            title="Fechar"
            className="h-8 w-8 grid place-items-center rounded-btn text-ink-2 hover:text-ink hover:bg-[#F5F6F8] disabled:opacity-40"
          >
            <IcFechar width={17} height={17} />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {!linhas ? (
            <div className="text-[13px] text-ink-2">
              Consultando os CNPJs… {feitos} de {fornecedores.length}
              <div className="mt-2 h-1.5 rounded-full bg-[#E8EAEE] overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${(feitos / Math.max(fornecedores.length, 1)) * 100}%` }} />
              </div>
            </div>
          ) : (
            <>
              {aplicaveis.length === 0 && manuais.length === 0 && (
                <p className="text-[13px] text-ink-2">Todos os endereços já estão completos e no padrão.</p>
              )}
              {aplicaveis.length > 0 && (
                <div>
                  <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3 mb-1.5">
                    Prontos para atualizar ({marcados.length} de {aplicaveis.length} marcados)
                  </div>
                  <div className="rounded-card border border-border overflow-hidden">
                    {aplicaveis.map((l) => (
                      <label key={l.f.id} className="flex items-start gap-3 px-3 py-2.5 border-b border-border-soft last:border-0 cursor-pointer">
                        <input type="checkbox" checked={l.marcado} onChange={() => alternar(l.f.id)} className="mt-1 w-[16px] h-[16px] accent-[#F2820D]" />
                        <span className="min-w-0 text-[12.5px]">
                          <span className="block font-bold text-ink">{l.f.nomeFantasia || l.f.razaoSocial}</span>
                          <span className="block text-ink-3 line-through decoration-ink-3/40">{l.f.endereco || "(sem endereço)"}</span>
                          <span className="block text-ink font-semibold">{novoDe(l)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {manuais.length > 0 && (
                <div>
                  <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3 mb-1.5">
                    Precisam de ajuste à mão ({manuais.length})
                  </div>
                  <div className="rounded-card border border-border overflow-hidden">
                    {manuais.map((l) => (
                      <div key={l.f.id} className="px-3 py-2.5 border-b border-border-soft last:border-0 text-[12.5px]">
                        <span className="block font-bold text-ink">{l.f.nomeFantasia || l.f.razaoSocial}</span>
                        <span className="block text-ink-3">{l.f.endereco || "(sem endereço)"}</span>
                        <span className="block text-warning font-semibold">{l.motivo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <Button variant="secondary" onClick={onFechar} disabled={aplicando}>{linhas ? "Fechar" : "Cancelar"}</Button>
          {linhas && aplicaveis.length > 0 && (
            <Button onClick={() => void aplicar()} disabled={aplicando || marcados.length === 0}>
              {aplicando ? "Atualizando…" : `Atualizar ${marcados.length} endereço(s)`}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
