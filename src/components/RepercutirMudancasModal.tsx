/**
 * "O evento mudou. E os documentos que já saíram?"
 *
 * Aparece depois de salvar os Dados Gerais quando a mudança alcança algo que a
 * EC ou a OS imprimem — e o projeto já tem documento emitido.
 *
 * A resposta padrão é NÃO MEXER EM NADA: EC e OS emitidas são o que o cliente e
 * o fornecedor receberam, e a alteração vale para o que nascer daqui em diante.
 * Esta janela é a exceção consentida, item a item:
 *
 *   · atualizar os dados do evento numa EC ainda em aberto — as OSs já emitidas
 *     a partir dela continuam iguais, porque cada uma guarda a própria foto;
 *   · gerar uma NOVA VERSÃO de uma OS, que nasce rascunho com os dados novos
 *     enquanto a anterior é cancelada e fica no histórico.
 *
 * Fechar sem escolher nada é uma resposta legítima: o projeto já está salvo.
 */
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Badge, Button, tomStatusOs } from "@/components/ui";
import { ROTULO_SITUACAO_EC, situacaoEc, TOM_SITUACAO_EC } from "@/domain/ec";
import { IcFechar } from "@/components/icons";
import { repo } from "@/data";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { cx } from "@/lib/format";
import { numeroOs, versaoOs } from "@/domain/calc";
import {
  aplicarMudancasEvento,
  ecsAtualizaveis,
  ossReemitiveis,
  type MudancaEvento,
  type SnapshotEvento,
} from "@/domain/mudancasEvento";
import type { Ec, Os } from "@/data/types";

export function RepercutirMudancasModal({
  mudancas,
  atual,
  ecs,
  oss,
  onFechar,
  onConcluido,
}: {
  mudancas: MudancaEvento[];
  /** Os dados gerais como acabaram de ser salvos no projeto. */
  atual: SnapshotEvento;
  /** ECs do projeto (todas — o filtro do que pode receber é feito aqui). */
  ecs: Ec[];
  /** OSs do projeto. */
  oss: Os[];
  onFechar: () => void;
  /** Chamado depois de aplicar, para a tela recarregar o que mudou. */
  onConcluido: () => void;
}) {
  const podeEditarEc = useAuth((s) => s.pode("ecs.editar"));
  const podeEditarOs = useAuth((s) => s.pode("oss.editar"));

  const ecsAlvo = useMemo(() => (podeEditarEc ? ecsAtualizaveis(ecs) : []), [ecs, podeEditarEc]);
  const ossAlvo = useMemo(() => (podeEditarOs ? ossReemitiveis(oss) : []), [oss, podeEditarOs]);

  const [ecsMarcadas, setEcsMarcadas] = useState<Set<string>>(new Set());
  const [ossMarcadas, setOssMarcadas] = useState<Set<string>>(new Set());
  const [aplicando, setAplicando] = useState(false);

  const alterna = (set: Set<string>, id: string) => {
    const proximo = new Set(set);
    if (proximo.has(id)) proximo.delete(id);
    else proximo.add(id);
    return proximo;
  };

  const total = ecsMarcadas.size + ossMarcadas.size;
  /** Sem EC nem OS em aberto, o alerta é só informativo: não há o que substituir. */
  const haAlvos = ecsAlvo.length > 0 || ossAlvo.length > 0 || !podeEditarEc || !podeEditarOs;

  async function aplicar() {
    setAplicando(true);
    try {
      let ecsSalvas = 0;
      for (const ec of ecsAlvo) {
        if (!ecsMarcadas.has(ec.id)) continue;
        const novo = aplicarMudancasEvento({ info: ec.projeto, cliente: ec.cliente }, atual, mudancas);
        await repo.ecs.salvar({ ...ec, projeto: novo.info, cliente: novo.cliente });
        ecsSalvas += 1;
      }

      // A numeração da nova versão conta as OSs que já existem para o par
      // EC + fornecedor. Como as reemissões acontecem em sequência, cada uma
      // criada entra nesta lista — senão duas OSs do mesmo fornecedor sairiam
      // com o mesmo (NN).
      const conhecidas = [...oss];
      let ossReemitidas = 0;
      for (const os of ossAlvo) {
        if (!ossMarcadas.has(os.id)) continue;
        const novo = aplicarMudancasEvento({ info: os.projeto, cliente: os.cliente }, atual, mudancas);
        const ec = ecs.find((e) => e.id === os.ecId);
        const versao = versaoOs(conhecidas, os.ecId, os.fornecedor?.cnpj ?? "", os.fornecedor?.razaoSocial ?? "");
        const base: Ec = { ...(ec as Ec), projeto: novo.info, cliente: novo.cliente };
        const nova = await repo.oss.gerarNovaVersao(os, {
          numero: numeroOs(base, os.fornecedor, versao, new Date().toISOString()),
          projeto: novo.info,
          cliente: novo.cliente,
        });
        conhecidas.push(nova);
        ossReemitidas += 1;
      }

      const partes = [
        ecsSalvas ? `${ecsSalvas} EC atualizada${ecsSalvas > 1 ? "s" : ""}` : "",
        ossReemitidas ? `${ossReemitidas} OS reemitida${ossReemitidas > 1 ? "s" : ""} em nova versão` : "",
      ].filter(Boolean);
      toast(partes.length ? `${partes.join(" e ")}.` : "Nada a aplicar.", "success");
      onConcluido();
    } catch (e) {
      toast(`Não foi possível aplicar: ${(e as Error).message}`, "danger");
    } finally {
      setAplicando(false);
    }
  }

  return createPortal(
    <div className="no-print fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={aplicando ? undefined : onFechar} />
      <div className="relative w-full max-w-[760px] max-h-[92vh] flex flex-col bg-surface rounded-card-lg shadow-modal border border-border animate-[fadein_.14s_ease] overflow-hidden">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-border-soft">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-[18px] text-ink tracking-[-0.3px]">Alerta</h3>
            {/* Texto definido pela Pólobh (29/09/2026). */}
            <p className="text-[12.5px] text-ink-2 mt-1 leading-relaxed">
              Os dados gerais deste projeto foram atualizados. Os próximos documentos (ECs, OSs,
              cronogramas, etc...) serão emitidos com as novas informações.{" "}
              <b>Os documentos já emitidos não serão alterados.</b> Substitua os documentos que
              precisarem de atualização.
            </p>
          </div>
          <button
            onClick={onFechar}
            disabled={aplicando}
            title="Fechar sem alterar documentos"
            className="ml-auto shrink-0 h-9 w-9 grid place-items-center rounded-btn text-ink-2 hover:text-ink hover:bg-[#F1F2F5] transition-colors disabled:opacity-50"
          >
            <IcFechar width={18} height={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <Bloco titulo="Veja o que mudou:">
            <div className="rounded-card border border-border-soft overflow-hidden">
              {mudancas.map((m, i) => (
                <div
                  key={m.chave}
                  className={cx(
                    "grid sm:grid-cols-[190px_1fr] gap-x-3 gap-y-1 px-3.5 py-2.5 text-[12.5px]",
                    i % 2 === 1 && "bg-[#FBFBFC]"
                  )}
                >
                  <div className="font-bold text-ink">{m.label}</div>
                  <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-ink-3 line-through break-words whitespace-pre-line">{m.antes || "—"}</span>
                    <span className="text-ink-3">→</span>
                    <span className="text-ink font-semibold break-words whitespace-pre-line">{m.depois || "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          </Bloco>

          {haAlvos && (
            <>
          <Bloco
            titulo="Estimativas de Custo"
            hint="Atualiza os dados do evento na EC. As OSs já emitidas a partir dela não mudam."
          >
            {!podeEditarEc ? (
              <Aviso>Seu perfil consulta ECs, mas não edita — peça a alguém da Direção ou da Produção.</Aviso>
            ) : ecsAlvo.length === 0 ? (
              <Aviso>Nenhuma EC em aberto neste projeto.</Aviso>
            ) : (
              ecsAlvo.map((ec) => (
                <LinhaEscolha
                  key={ec.id}
                  marcada={ecsMarcadas.has(ec.id)}
                  onToggle={() => setEcsMarcadas((s) => alterna(s, ec.id))}
                  titulo={ec.numero}
                  detalhe={`V${String(ec.versao).padStart(2, "0")}`}
                  // Selo pela situação, não pela coluna `status` (ver `domain/ec`).
                  // Aqui só entra a EC que está no ar — ver `ecsAtualizaveis`.
                  badge={
                    <Badge tom={TOM_SITUACAO_EC[situacaoEc(ec)]}>{ROTULO_SITUACAO_EC[situacaoEc(ec)]}</Badge>
                  }
                />
              ))
            )}
          </Bloco>

          <Bloco
            titulo="Ordens de Serviço"
            hint="Gera uma nova versão com os dados novos (rascunho). A versão atual é arquivada automaticamente e fica no histórico."
          >
            {!podeEditarOs ? (
              <Aviso>Seu perfil consulta OSs, mas não edita.</Aviso>
            ) : ossAlvo.length === 0 ? (
              <Aviso>Nenhuma OS em aberto neste projeto.</Aviso>
            ) : (
              ossAlvo.map((os) => (
                <LinhaEscolha
                  key={os.id}
                  marcada={ossMarcadas.has(os.id)}
                  onToggle={() => setOssMarcadas((s) => alterna(s, os.id))}
                  titulo={os.numero}
                  detalhe={os.fornecedor?.nomeFantasia || os.fornecedor?.razaoSocial || "Fornecedor"}
                  badge={<Badge tom={tomStatusOs[os.status]}>{os.status}</Badge>}
                />
              ))
            )}
          </Bloco>
            </>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-border-soft bg-[#FCFCFD] flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[12px] text-ink-3">
            {!haAlvos ? "" : total === 0 ? "Nenhum documento marcado." : `${total} documento(s) marcado(s).`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant={haAlvos ? "secondary" : "primary"} size="sm" onClick={onFechar} disabled={aplicando}>
              {haAlvos ? "Agora não" : "Entendi"}
            </Button>
            {haAlvos && (
              <Button size="sm" onClick={aplicar} disabled={aplicando || total === 0}>
                {aplicando ? "Aplicando…" : `Aplicar${total ? ` (${total})` : ""}`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Bloco({ titulo, hint, children }: { titulo: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-2 flex-wrap">
        <h4 className="font-display font-bold text-[13.5px] text-ink">{titulo}</h4>
        {hint && <span className="text-[11.5px] text-ink-3">{hint}</span>}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] text-ink-3 italic px-1">{children}</p>;
}

function LinhaEscolha({
  marcada,
  onToggle,
  titulo,
  detalhe,
  badge,
}: {
  marcada: boolean;
  onToggle: () => void;
  titulo: string;
  detalhe: string;
  badge: React.ReactNode;
}) {
  return (
    <label
      className={cx(
        "flex items-center gap-3 rounded-btn border-[1.5px] px-3.5 py-2.5 cursor-pointer transition-colors",
        marcada ? "border-active-border bg-primary-soft" : "border-border hover:border-ink-3 bg-surface"
      )}
    >
      <input type="checkbox" checked={marcada} onChange={onToggle} className="h-4 w-4 accent-[#F2820D] shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-ink truncate">{titulo}</span>
        <span className="block text-[11.5px] text-ink-3 truncate">{detalhe}</span>
      </span>
      <span className="shrink-0">{badge}</span>
    </label>
  );
}
