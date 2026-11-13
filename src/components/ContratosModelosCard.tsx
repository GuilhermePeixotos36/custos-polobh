/**
 * Configurações › Contratos (13/11/2026): o texto PADRÃO de cada cláusula dos
 * dois modelos de contrato, Corporativo e Cultural.
 *
 * Quem altera: o Administrador e a Direção de Produção (recurso
 * `contratos.clausulas`). O banco repete a regra — a gravação desta chave de
 * `config_app` só passa para quem tem o recurso na área.
 *
 * Cada cláusula é uma caixa de texto com negrito, desfazer/refazer e revisão de
 * texto. O que se grava continua sendo texto simples com `**negrito**` — a
 * ponte com o editor está em `domain/clausulaTexto` —, de modo que a OS e o PDF
 * leem exatamente o que sempre leram.
 *
 *  · vale para os contratos gerados daqui em diante (campo da OS e PDF);
 *  · o que uma OS escreveu por cima do padrão continua valendo para ela;
 *  · contrato já emitido não muda;
 *  · só se grava o que DIFERE do texto de fábrica — "Voltar ao texto original"
 *    devolve a cláusula ao código, e uma correção futura do código ainda
 *    alcança as cláusulas que ninguém editou.
 *
 * A visualização monta um contrato de exemplo (dados fictícios) com o que está
 * na tela — salvo ou não — para ver o documento pronto antes de gravar.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SubGuias } from "@/components/layout/SubGuias";
import { RichTextField } from "@/components/RichTextField";
import { Badge, Button, CarregandoTela, Card } from "@/components/ui";
import { IcDownload, IcEye, IcFechar, IcSpark } from "@/components/icons";
import { htmlParaTexto, textoParaHtml } from "@/domain/clausulaTexto";
import { contratoDeExemplo } from "@/domain/contratoExemplo";
import {
  clausulasDoCodigo,
  MODELOS_CONTRATO,
  type ChaveClausula,
  type ClausulasDaCasa,
  type ModeloContrato,
} from "@/domain/contratoModelo";
import { blobDoPdf, clausulasDaCasa, gravarClausulasDaCasa, testemunhasDaCasa } from "@/lib/contratoPdf";
import { AVISO_REVISAO_PARCIAL, revisarCampos } from "@/lib/correcaoOrtografica";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";

const ROTULO_MODELO: Record<ModeloContrato, string> = { Corporativo: "CORPORATIVO", Cultural: "CULTURAL" };

/** Só o que difere do texto de fábrica — o que de fato vira "padrão da casa". */
function soDiferencas(r: ClausulasDaCasa): ClausulasDaCasa {
  const saida: ClausulasDaCasa = {};
  for (const modelo of MODELOS_CONTRATO) {
    const dele = r[modelo];
    if (!dele) continue;
    const limpo: Partial<Record<ChaveClausula, string>> = {};
    for (const c of clausulasDoCodigo(modelo)) {
      const t = dele[c.chave];
      if (t && t.trim() && t.trim() !== c.padrao.trim()) limpo[c.chave] = t;
    }
    if (Object.keys(limpo).length) saida[modelo] = limpo;
  }
  return saida;
}

interface Revisao {
  /** O texto revisado, já no formato da cláusula. */
  texto: string;
  /** A IA estava fora do ar: só a correção básica foi aplicada. */
  parcial: boolean;
}

export function ContratosModelosCard() {
  const pode = useAuth((s) => s.pode);
  const [salvo, setSalvo] = useState<ClausulasDaCasa | null>(null);
  const [rascunho, setRascunho] = useState<ClausulasDaCasa>({});
  const [modelo, setModelo] = useState<ModeloContrato>("Corporativo");
  const [salvando, setSalvando] = useState(false);
  /** Revisão de texto: qual cláusula está sendo revisada, e o que a revisão devolveu. */
  const [revisando, setRevisando] = useState<string | null>(null);
  const [revisoes, setRevisoes] = useState<Record<string, Revisao>>({});
  const [gerando, setGerando] = useState(false);
  const [previa, setPrevia] = useState<{ url: string; nome: string } | null>(null);

  useEffect(() => {
    void clausulasDaCasa().then((c) => {
      setSalvo(c);
      setRascunho(c);
    });
  }, []);

  // Fecha a visualização liberando o arquivo temporário.
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa.url); }, [previa]);

  const clausulas = useMemo(() => clausulasDoCodigo(modelo), [modelo]);
  const sujo = salvo !== null && JSON.stringify(soDiferencas(rascunho)) !== JSON.stringify(soDiferencas(salvo));

  // Sair da aba (ou fechar a janela) com texto digitado e não salvo pede confirmação.
  useUnsavedGuard(sujo);

  if (!pode("contratos.clausulas")) {
    return (
      <Card>
        <p className="text-sm text-ink-2">Só o Administrador e a Direção de Produção editam as cláusulas padrão dos contratos.</p>
      </Card>
    );
  }
  if (salvo === null) return <CarregandoTela />;

  const valor = (chave: ChaveClausula, padrao: string) => rascunho[modelo]?.[chave] ?? padrao;
  const editar = (chave: ChaveClausula, texto: string) =>
    setRascunho((r) => ({ ...r, [modelo]: { ...(r[modelo] ?? {}), [chave]: texto } }));
  const voltar = (chave: ChaveClausula) =>
    setRascunho((r) => {
      const { [chave]: _fora, ...resto } = r[modelo] ?? {};
      return { ...r, [modelo]: resto };
    });
  const idRevisao = (chave: ChaveClausula) => `${modelo}:${chave}`;

  async function gravar() {
    setSalvando(true);
    try {
      const final = soDiferencas(rascunho);
      await gravarClausulasDaCasa(final);
      setSalvo(final);
      setRascunho(final);
      toast("Cláusulas padrão dos contratos salvas.", "success");
    } catch (e) {
      toast(`Não foi possível salvar: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  }

  async function descartar() {
    if (!(await confirmar({ titulo: "Descartar as alterações?", mensagem: "O que foi digitado e não salvo será perdido.", confirmarTexto: "Descartar" }))) return;
    setRascunho(salvo ?? {});
    setRevisoes({});
  }

  /** A revisão de texto: devolve a proposta, que só vale se a pessoa aplicar. */
  async function revisar(chave: ChaveClausula, atual: string) {
    const id = idRevisao(chave);
    setRevisando(id);
    try {
      const { textos, revisaoCompleta } = await revisarCampos([{ id, texto: textoParaHtml(atual), html: true }]);
      const revisado = htmlParaTexto(textos.get(id) ?? "");
      if (!revisado.trim() || revisado.trim() === atual.trim()) {
        toast(revisaoCompleta ? "Nenhuma correção necessária neste texto." : AVISO_REVISAO_PARCIAL, revisaoCompleta ? "success" : "info");
        setRevisoes((r) => {
          const { [id]: _fora, ...resto } = r;
          return resto;
        });
        return;
      }
      setRevisoes((r) => ({ ...r, [id]: { texto: revisado, parcial: !revisaoCompleta } }));
    } catch (e) {
      toast(`Não foi possível revisar: ${(e as Error).message}`, "danger");
    } finally {
      setRevisando(null);
    }
  }

  const descartarRevisao = (id: string) =>
    setRevisoes((r) => {
      const { [id]: _fora, ...resto } = r;
      return resto;
    });

  /** O contrato pronto, com o que está na tela, para conferir antes de valer. */
  async function visualizar() {
    setGerando(true);
    try {
      const contrato = contratoDeExemplo(modelo, soDiferencas(rascunho), await testemunhasDaCasa());
      const { gerarContratoPdf } = await import("@/lib/pdf/contrato");
      const bytes = await gerarContratoPdf(contrato);
      setPrevia({ url: URL.createObjectURL(blobDoPdf(bytes)), nome: `Contrato de exemplo - ${ROTULO_MODELO[modelo]}.pdf` });
    } catch (e) {
      toast(`Não foi possível gerar a visualização: ${(e as Error).message}`, "danger");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-4">
      <SubGuias
        variante="secundaria"
        rotulo="Modelo de contrato"
        atual={modelo}
        onChange={setModelo}
        abas={MODELOS_CONTRATO.map((m) => ({ key: m, label: ROTULO_MODELO[m] }))}
      />

      {clausulas.map((c) => {
        const atual = valor(c.chave, c.padrao);
        const mudou = atual.trim() !== c.padrao.trim();
        const id = idRevisao(c.chave);
        const proposta = revisoes[id];
        return (
          <Card key={c.chave}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-display font-bold text-[13.5px] text-ink tracking-[-0.2px]">{c.titulo}</h3>
              {mudou && <Badge tom="warning">Alterada</Badge>}
            </div>

            <RichTextField
              ferramentas="negrito"
              className="[&_[contenteditable]]:min-h-[140px] [&_[contenteditable]]:text-[14px]"
              value={textoParaHtml(atual)}
              onChange={(html) => editar(c.chave, htmlParaTexto(html))}
              toolbarExtra={
                <div className="flex items-center gap-1">
                  {mudou && (
                    <button
                      type="button"
                      onClick={() => voltar(c.chave)}
                      className="h-7 px-2 rounded-md text-[11.5px] font-bold text-ink-3 hover:bg-primary-soft hover:text-primary-dark"
                    >
                      Voltar ao texto original
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void revisar(c.chave, atual)}
                    disabled={revisando !== null}
                    className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11.5px] font-extrabold text-primary-dark bg-primary-soft hover:bg-active-border disabled:opacity-60"
                  >
                    <IcSpark width={13} height={13} /> {revisando === id ? "Revisando…" : "Revisar texto"}
                  </button>
                </div>
              }
            />

            {proposta && (
              <div className="mt-3 rounded-btn border border-primary/30 bg-primary-soft/40 p-3">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-primary-dark mb-2">
                  Texto revisado{proposta.parcial ? " — só a correção básica (a IA está indisponível)" : ""}
                </div>
                <div
                  className="text-[13.5px] text-ink leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0"
                  dangerouslySetInnerHTML={{ __html: textoParaHtml(proposta.texto) }}
                />
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={() => {
                      editar(c.chave, proposta.texto);
                      descartarRevisao(id);
                    }}
                  >
                    Aplicar revisão
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => descartarRevisao(id)}>Descartar</Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}

      <div className="sticky bottom-0 z-10 -mx-1 px-1 py-3 bg-bg/90 backdrop-blur-sm border-t border-border-soft flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={() => void gravar()} disabled={salvando || !sujo}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
        <Button size="sm" variant="secondary" icon={<IcEye width={15} height={15} />} onClick={() => void visualizar()} disabled={gerando}>
          {gerando ? "Gerando…" : "Visualizar contrato"}
        </Button>
        {sujo && (
          <Button size="sm" variant="text" onClick={() => void descartar()} disabled={salvando}>
            Descartar alterações
          </Button>
        )}
      </div>

      {previa &&
        createPortal(
          <div className="no-print fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => setPrevia(null)} />
            <div className="relative w-full max-w-[980px] h-[92vh] bg-surface rounded-card-lg shadow-modal border border-border flex flex-col">
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border shrink-0">
                <h3 className="font-display font-bold text-[16px] text-ink truncate">
                  Contrato {ROTULO_MODELO[modelo]} — exemplo
                </h3>
                <div className="flex items-center gap-2">
                  <a
                    href={previa.url}
                    download={previa.nome}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-[12.5px] font-bold text-ink-2 hover:bg-primary-soft hover:text-primary-dark"
                  >
                    <IcDownload width={14} height={14} /> Baixar PDF
                  </a>
                  <button
                    type="button"
                    onClick={() => setPrevia(null)}
                    aria-label="Fechar"
                    className="h-8 w-8 grid place-items-center rounded-btn text-ink-2 hover:bg-primary-soft"
                  >
                    <IcFechar width={16} height={16} />
                  </button>
                </div>
              </div>
              <iframe title="Visualização do contrato" src={previa.url} className="flex-1 w-full rounded-b-card-lg" />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
