/**
 * Configurações › Contratos (13/11/2026): o texto PADRÃO de cada cláusula dos
 * dois modelos de contrato, Corporativo e Cultural.
 *
 * Quem altera: o Administrador e a Direção de Produção (recurso
 * `contratos.clausulas`). O banco repete a regra — a gravação desta chave de
 * `config_app` só passa para quem tem o recurso na área.
 *
 * Cada cláusula é uma caixa com as ferramentas de texto de sempre (negrito,
 * itálico, sublinhado, listas, recuo, alinhamento, desfazer). O que se grava é
 * texto simples com marcas (ver `domain/formatoClausula`), e o PDF desenha cada
 * ferramenta de verdade; a ponte com o editor está em `domain/clausulaTexto`.
 *
 * A REVISÃO DE TEXTO acontece ao SALVAR, e só nas cláusulas que mudaram: o que a
 * revisão corrigir aparece numa conferência (como escreveu × revisado) antes de
 * gravar — é texto de contrato, e nada o reescreve sem a pessoa ver.
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
import { IcDownload, IcEye, IcFechar } from "@/components/icons";
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
import { revisarCampos } from "@/lib/correcaoOrtografica";
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

/** O que a revisão de texto propõe para uma cláusula que mudou. */
interface ItemRevisado {
  modelo: ModeloContrato;
  chave: ChaveClausula;
  titulo: string;
  original: string;
  revisado: string;
}

interface RevisaoPendente {
  itens: ItemRevisado[];
  /** A IA estava fora do ar: só a correção básica foi aplicada. */
  parcial: boolean;
}

export function ContratosModelosCard() {
  const pode = useAuth((s) => s.pode);
  const [salvo, setSalvo] = useState<ClausulasDaCasa | null>(null);
  const [rascunho, setRascunho] = useState<ClausulasDaCasa>({});
  const [modelo, setModelo] = useState<ModeloContrato>("Corporativo");
  const [salvando, setSalvando] = useState(false);
  /** A revisão ao salvar: rodando, e o que ela propôs (a conferência antes de gravar). */
  const [revisando, setRevisando] = useState(false);
  const [pendente, setPendente] = useState<RevisaoPendente | null>(null);
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

  /** Grava de fato (com os textos que a pessoa decidiu). */
  async function gravarTextos(textos: ClausulasDaCasa) {
    setSalvando(true);
    try {
      const final = soDiferencas(textos);
      await gravarClausulasDaCasa(final);
      setSalvo(final);
      setRascunho(final);
      setPendente(null);
      toast("Cláusulas padrão dos contratos salvas.", "success");
    } catch (e) {
      toast(`Não foi possível salvar: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  }

  /**
   * "Salvar": passa a revisão de texto nas cláusulas que MUDARAM e, se ela
   * corrigir algo, mostra a conferência antes de gravar. Sem correção, grava.
   */
  async function salvar() {
    const hoje = soDiferencas(rascunho);
    const antes = soDiferencas(salvo ?? {});
    const alterados: { modelo: ModeloContrato; chave: ChaveClausula; titulo: string; texto: string }[] = [];
    for (const m of MODELOS_CONTRATO) {
      for (const c of clausulasDoCodigo(m)) {
        const t = hoje[m]?.[c.chave];
        if (t && t !== antes[m]?.[c.chave]) alterados.push({ modelo: m, chave: c.chave, titulo: c.titulo, texto: t });
      }
    }
    if (!alterados.length) {
      await gravarTextos(rascunho);
      return;
    }
    setRevisando(true);
    try {
      const { textos, revisaoCompleta } = await revisarCampos(
        alterados.map((a) => ({ id: `${a.modelo}:${a.chave}`, texto: textoParaHtml(a.texto), html: true })),
      );
      const itens = alterados
        .map((a): ItemRevisado => ({
          modelo: a.modelo,
          chave: a.chave,
          titulo: a.titulo,
          original: a.texto,
          revisado: htmlParaTexto(textos.get(`${a.modelo}:${a.chave}`) ?? a.texto),
        }))
        .filter((i) => i.revisado.trim() && i.revisado.trim() !== i.original.trim());
      if (!itens.length) {
        await gravarTextos(rascunho);
        return;
      }
      setPendente({ itens, parcial: !revisaoCompleta });
    } catch (e) {
      // Sem revisão não se perde o trabalho: grava como foi escrito e avisa.
      toast(`A revisão de texto não pôde ser feita (${(e as Error).message}). Salvando como foi escrito.`, "info");
      await gravarTextos(rascunho);
    } finally {
      setRevisando(false);
    }
  }

  /** Da conferência: grava com as correções (ou como foi escrito). */
  async function gravarDaConferencia(comCorrecoes: boolean) {
    if (!pendente) return;
    if (!comCorrecoes) return gravarTextos(rascunho);
    const textos: ClausulasDaCasa = structuredClone(rascunho);
    for (const i of pendente.itens) textos[i.modelo] = { ...(textos[i.modelo] ?? {}), [i.chave]: i.revisado };
    await gravarTextos(textos);
  }

  async function descartar() {
    if (!(await confirmar({ titulo: "Descartar as alterações?", mensagem: "O que foi digitado e não salvo será perdido.", confirmarTexto: "Descartar" }))) return;
    setRascunho(salvo ?? {});
  }

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
        return (
          <Card key={c.chave}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-display font-bold text-[13.5px] text-ink tracking-[-0.2px]">{c.titulo}</h3>
              {mudou && <Badge tom="warning">Alterada</Badge>}
            </div>

            <RichTextField
              className="[&_[contenteditable]]:min-h-[140px] [&_[contenteditable]]:text-[14px]"
              value={textoParaHtml(atual)}
              onChange={(html) => editar(c.chave, htmlParaTexto(html))}
              toolbarExtra={
                mudou ? (
                  <button
                    type="button"
                    onClick={() => voltar(c.chave)}
                    className="h-7 px-2 rounded-md text-[11.5px] font-bold text-ink-3 hover:bg-primary-soft hover:text-primary-dark"
                  >
                    Voltar ao texto original
                  </button>
                ) : undefined
              }
            />
          </Card>
        );
      })}

      <div className="sticky bottom-0 z-10 -mx-1 px-1 py-3 bg-bg/90 backdrop-blur-sm border-t border-border-soft flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={() => void salvar()} disabled={salvando || revisando || !sujo}>
          {revisando ? "Revisando o texto…" : salvando ? "Salvando…" : "Salvar"}
        </Button>
        <Button size="sm" variant="secondary" icon={<IcEye width={15} height={15} />} onClick={() => void visualizar()} disabled={gerando}>
          {gerando ? "Gerando…" : "Visualizar contrato"}
        </Button>
        {sujo && (
          <Button size="sm" variant="text" onClick={() => void descartar()} disabled={salvando || revisando}>
            Descartar alterações
          </Button>
        )}
      </div>

      {pendente &&
        createPortal(
          <div className="no-print fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
            <div className="relative w-full max-w-[860px] max-h-[90vh] bg-surface rounded-card-lg shadow-modal border border-border flex flex-col">
              <div className="px-5 py-4 border-b border-border shrink-0">
                <h3 className="font-display font-bold text-[16px] text-ink">Revisão de texto</h3>
                <p className="text-[12.5px] text-ink-2 mt-0.5">
                  {pendente.parcial
                    ? "A IA está indisponível; foi aplicada só a correção básica. "
                    : ""}
                  Confira o que a revisão propõe antes de salvar.
                </p>
              </div>
              <div className="overflow-y-auto px-5 py-4 space-y-5">
                {pendente.itens.map((i) => (
                  <div key={`${i.modelo}:${i.chave}`}>
                    <div className="text-[12.5px] font-bold text-ink mb-2">
                      {ROTULO_MODELO[i.modelo]} — {i.titulo}
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="rounded-btn border border-border p-3">
                        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3 mb-1.5">Como você escreveu</div>
                        <div className="text-[13px] text-ink leading-relaxed [&_p]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: textoParaHtml(i.original) }} />
                      </div>
                      <div className="rounded-btn border border-primary/30 bg-primary-soft/40 p-3">
                        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-primary-dark mb-1.5">Revisado</div>
                        <div className="text-[13px] text-ink leading-relaxed [&_p]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: textoParaHtml(i.revisado) }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 px-5 py-3 border-t border-border shrink-0 flex-wrap">
                <Button size="sm" onClick={() => void gravarDaConferencia(true)} disabled={salvando}>
                  {salvando ? "Salvando…" : "Salvar com as correções"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void gravarDaConferencia(false)} disabled={salvando}>
                  Salvar como escrevi
                </Button>
                <Button size="sm" variant="text" onClick={() => setPendente(null)} disabled={salvando}>
                  Voltar a editar
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

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
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-[12.5px] font-bold text-ink-2 hover:bg-primary-soft hover:text-primary-dark"
                  >
                    Abrir em nova aba
                  </a>
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
