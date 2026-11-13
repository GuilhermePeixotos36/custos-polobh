/**
 * Configurações › Contratos (13/11/2026): o texto PADRÃO de cada cláusula dos
 * dois modelos de contrato, Corporativo e Cultural.
 *
 * Quem altera: o Administrador e a Direção de Produção (recurso
 * `contratos.clausulas`). O banco repete a regra — a gravação desta chave de
 * `config_app` só passa para quem tem o recurso na área.
 *
 * A TELA MOSTRA O DOCUMENTO PRONTO: cada cláusula aparece como sai no contrato
 * (bullets, cabeçalhos em negrito, texto justificado — ver `domain/clausulaTexto`),
 * tanto lendo quanto editando. A Cláusula Primeira mostra, abaixo do trecho
 * editável, o que o sistema monta com os dados da OS (em cinza, não editável).
 *
 * COMO SE EDITA:
 *  · "Editar" num bloco edita e salva SÓ aquele bloco;
 *  · "Editar tudo" libera todos os blocos de uma vez, e "Salvar tudo" grava tudo
 *    o que mudou.
 * Ao salvar, a pessoa é convidada a revisar o texto com IA: aceitando, vê o que
 * a revisão corrigiu (como escreveu × revisado) e decide antes de gravar. É texto
 * de contrato — nada o reescreve sem a pessoa ver.
 *
 *  · vale para os contratos gerados daqui em diante (campo da OS e PDF);
 *  · o que uma OS escreveu por cima do padrão continua valendo para ela;
 *  · contrato já emitido não muda;
 *  · só se grava o que DIFERE do texto de fábrica — "Voltar ao texto original"
 *    devolve a cláusula ao código, e uma correção futura do código ainda
 *    alcança as cláusulas que ninguém editou.
 *
 * "Visualizar contrato" monta um contrato de exemplo (dados fictícios) com o que
 * está na tela — salvo ou não.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SubGuias } from "@/components/layout/SubGuias";
import { RichTextField } from "@/components/RichTextField";
import { Badge, Button, CarregandoTela, Card } from "@/components/ui";
import { IcDownload, IcEye, IcFechar, IcPencil } from "@/components/icons";
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

/** A tipografia do documento: texto justificado e listas com bullet. */
const COMO_NO_DOCUMENTO =
  "text-justify [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_li]:text-justify";
/** O mesmo, aplicado à área editável do RichTextField. */
const COMO_NO_DOCUMENTO_EDITOR =
  "[&_[contenteditable]]:text-justify [&_[contenteditable]_li]:text-justify [&_[contenteditable]_li]:mb-1";

/** O texto na sua forma canônica: duas escritas que o contrato lê igual dão o mesmo resultado. */
const canonico = (chave: ChaveClausula, texto: string) => htmlParaTexto(textoParaHtml(texto, chave), chave).trim();

/** Só o que difere do texto de fábrica — o que de fato vira "padrão da casa". */
function soDiferencas(r: ClausulasDaCasa): ClausulasDaCasa {
  const saida: ClausulasDaCasa = {};
  for (const modelo of MODELOS_CONTRATO) {
    const dele = r[modelo];
    if (!dele) continue;
    const limpo: Partial<Record<ChaveClausula, string>> = {};
    for (const c of clausulasDoCodigo(modelo)) {
      const t = dele[c.chave];
      if (t && t.trim() && canonico(c.chave, t) !== canonico(c.chave, c.padrao)) limpo[c.chave] = t;
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

type Fluxo =
  /** Convite: revisar com IA antes de salvar? */
  | { etapa: "oferta" }
  | { etapa: "revisando" }
  /** A revisão corrigiu algo: a pessoa confere antes de gravar. */
  | { etapa: "conferencia"; itens: ItemRevisado[]; parcial: boolean };

export function ContratosModelosCard() {
  const pode = useAuth((s) => s.pode);
  const [salvo, setSalvo] = useState<ClausulasDaCasa | null>(null);
  const [rascunho, setRascunho] = useState<ClausulasDaCasa>({});
  const [modelo, setModelo] = useState<ModeloContrato>("Corporativo");
  const [salvando, setSalvando] = useState(false);
  /** "Editar tudo" ligado, ou o bloco (`modelo:chave`) em edição — um dos dois. */
  const [editandoTudo, setEditandoTudo] = useState(false);
  const [blocoEmEdicao, setBlocoEmEdicao] = useState<string | null>(null);
  const [fluxo, setFluxo] = useState<Fluxo | null>(null);
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
  /** O que o sistema monta da OS na Cláusula Primeira, com dados de exemplo — só para a leitura fiel. */
  const geradoDoObjeto = useMemo(() => {
    const objeto = contratoDeExemplo(modelo, {}).clausulas.find((c) => c.chave === "objeto");
    return (objeto?.paragrafos ?? []).slice(1).join("\n").replace(/^\n+/, "");
  }, [modelo]);

  const sujo = salvo !== null && JSON.stringify(soDiferencas(rascunho)) !== JSON.stringify(soDiferencas(salvo));
  const editando = editandoTudo || blocoEmEdicao !== null;

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

  const idDoBloco = (chave: ChaveClausula) => `${modelo}:${chave}`;
  const valor = (chave: ChaveClausula, padrao: string) => rascunho[modelo]?.[chave] ?? padrao;
  const editar = (chave: ChaveClausula, padrao: string, texto: string) =>
    setRascunho((r) => {
      const dele = { ...(r[modelo] ?? {}) };
      // Igual ao de fábrica (mesmo escrito de outro jeito) não é alteração.
      if (canonico(chave, texto) === canonico(chave, padrao)) delete dele[chave];
      else dele[chave] = texto;
      return { ...r, [modelo]: dele };
    });
  const voltarAoOriginal = (chave: ChaveClausula) =>
    setRascunho((r) => {
      const { [chave]: _fora, ...resto } = r[modelo] ?? {};
      return { ...r, [modelo]: resto };
    });

  /** Sai da edição e leva o rascunho de volta ao que está salvo (só o escopo que estava em edição). */
  function cancelarEdicao() {
    if (blocoEmEdicao) {
      const [m, chave] = blocoEmEdicao.split(":") as [ModeloContrato, ChaveClausula];
      setRascunho((r) => {
        const dele = { ...(r[m] ?? {}) };
        const gravado = salvo?.[m]?.[chave];
        if (gravado === undefined) delete dele[chave];
        else dele[chave] = gravado;
        return { ...r, [m]: dele };
      });
    } else setRascunho(salvo ?? {});
    setEditandoTudo(false);
    setBlocoEmEdicao(null);
  }

  async function pedirCancelar() {
    if (sujo && !(await confirmar({ titulo: "Descartar as alterações?", mensagem: "O que foi digitado e não salvo será perdido.", confirmarTexto: "Descartar" }))) return;
    cancelarEdicao();
  }

  /** As cláusulas que mudaram desde o que está salvo. */
  function alteradas() {
    const hoje = soDiferencas(rascunho);
    const antes = soDiferencas(salvo ?? {});
    const lista: ItemRevisado[] = [];
    for (const m of MODELOS_CONTRATO) {
      for (const c of clausulasDoCodigo(m)) {
        const t = hoje[m]?.[c.chave] ?? c.padrao;
        const era = antes[m]?.[c.chave] ?? c.padrao;
        if (canonico(c.chave, t) !== canonico(c.chave, era)) lista.push({ modelo: m, chave: c.chave, titulo: c.titulo, original: t, revisado: t });
      }
    }
    return lista;
  }

  async function gravarTextos(textos: ClausulasDaCasa) {
    setSalvando(true);
    try {
      const final = soDiferencas(textos);
      await gravarClausulasDaCasa(final);
      setSalvo(final);
      setRascunho(final);
      setFluxo(null);
      setEditandoTudo(false);
      setBlocoEmEdicao(null);
      toast("Cláusulas padrão dos contratos salvas.", "success");
    } catch (e) {
      toast(`Não foi possível salvar: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  }

  /** "Salvar" (do bloco ou de tudo): se algo mudou, convida a revisar com IA; senão, só sai da edição. */
  function pedirSalvar() {
    if (!alteradas().length) {
      toast("Nada foi alterado.", "info");
      cancelarEdicao();
      return;
    }
    setFluxo({ etapa: "oferta" });
  }

  /** Aceitou a revisão: manda à IA só o que mudou e, se ela corrigir algo, abre a conferência. */
  async function revisarComIa() {
    const mudadas = alteradas();
    setFluxo({ etapa: "revisando" });
    try {
      const { textos, revisaoCompleta } = await revisarCampos(
        mudadas.map((a) => ({ id: `${a.modelo}:${a.chave}`, texto: textoParaHtml(a.original, a.chave), html: true })),
      );
      const itens = mudadas
        .map((a): ItemRevisado => ({
          ...a,
          revisado: htmlParaTexto(textos.get(`${a.modelo}:${a.chave}`) ?? textoParaHtml(a.original, a.chave), a.chave),
        }))
        .filter((i) => i.revisado.trim() && canonico(i.chave, i.revisado) !== canonico(i.chave, i.original));
      if (!itens.length) {
        toast(revisaoCompleta ? "A revisão não encontrou nada a corrigir." : "A revisão por IA está indisponível; o texto foi salvo como escrito.", "info");
        await gravarTextos(rascunho);
        return;
      }
      setFluxo({ etapa: "conferencia", itens, parcial: !revisaoCompleta });
    } catch (e) {
      // Sem revisão não se perde o trabalho: grava como foi escrito e avisa.
      toast(`A revisão de texto não pôde ser feita (${(e as Error).message}). Salvando como foi escrito.`, "info");
      await gravarTextos(rascunho);
    }
  }

  /** Da conferência: grava com as correções (ou como foi escrito). */
  async function gravarDaConferencia(comCorrecoes: boolean) {
    if (fluxo?.etapa !== "conferencia") return;
    if (!comCorrecoes) return gravarTextos(rascunho);
    const textos: ClausulasDaCasa = structuredClone(rascunho);
    for (const i of fluxo.itens) textos[i.modelo] = { ...(textos[i.modelo] ?? {}), [i.chave]: i.revisado };
    await gravarTextos(textos);
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
        const mudou = canonico(c.chave, atual) !== canonico(c.chave, c.padrao);
        const id = idDoBloco(c.chave);
        const esteEmEdicao = editandoTudo || blocoEmEdicao === id;
        return (
          <Card key={c.chave}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <h3 className="font-display font-bold text-[13.5px] text-ink tracking-[-0.2px]">{c.titulo}</h3>
              {mudou && <Badge tom="warning">Alterada</Badge>}
              <div className="ml-auto flex items-center gap-2">
                {blocoEmEdicao === id ? (
                  <>
                    <Button size="sm" onClick={pedirSalvar} disabled={salvando}>Salvar</Button>
                    <Button size="sm" variant="secondary" onClick={() => void pedirCancelar()} disabled={salvando}>Cancelar</Button>
                  </>
                ) : (
                  !editando && (
                    <Button size="sm" variant="secondary" icon={<IcPencil width={14} height={14} />} onClick={() => setBlocoEmEdicao(id)}>
                      Editar
                    </Button>
                  )
                )}
              </div>
            </div>

            <RichTextField
              somenteLeitura={!esteEmEdicao}
              className={`${COMO_NO_DOCUMENTO_EDITOR} [&_[contenteditable]]:text-[13.5px] ${esteEmEdicao ? "[&_[contenteditable]]:min-h-[140px]" : "[&_[contenteditable]]:min-h-[48px] !border-border-soft"}`}
              value={textoParaHtml(atual, c.chave)}
              onChange={(html) => editar(c.chave, c.padrao, htmlParaTexto(html, c.chave))}
              toolbarExtra={
                mudou && esteEmEdicao ? (
                  <button
                    type="button"
                    onClick={() => voltarAoOriginal(c.chave)}
                    className="h-7 px-2 rounded-md text-[11.5px] font-bold text-ink-3 hover:bg-primary-soft hover:text-primary-dark"
                  >
                    Voltar ao texto original
                  </button>
                ) : undefined
              }
            />

            {c.chave === "objeto" && (
              <div
                aria-hidden
                className={`mt-2 px-2.5 text-[13.5px] leading-relaxed text-ink-3 select-none pointer-events-none ${COMO_NO_DOCUMENTO}`}
                dangerouslySetInnerHTML={{ __html: textoParaHtml(geradoDoObjeto, "objeto") }}
              />
            )}
          </Card>
        );
      })}

      <div className="sticky bottom-0 z-10 -mx-1 px-1 py-3 bg-bg/90 backdrop-blur-sm border-t border-border-soft flex items-center gap-2 flex-wrap">
        {editandoTudo ? (
          <>
            <Button size="sm" onClick={pedirSalvar} disabled={salvando}>Salvar tudo</Button>
            <Button size="sm" variant="secondary" onClick={() => void pedirCancelar()} disabled={salvando}>Cancelar</Button>
          </>
        ) : (
          !blocoEmEdicao && (
            <Button size="sm" icon={<IcPencil width={14} height={14} />} onClick={() => setEditandoTudo(true)}>
              Editar tudo
            </Button>
          )
        )}
        <Button size="sm" variant="secondary" icon={<IcEye width={15} height={15} />} onClick={() => void visualizar()} disabled={gerando}>
          {gerando ? "Gerando…" : "Visualizar contrato"}
        </Button>
      </div>

      {fluxo &&
        createPortal(
          <div className="no-print fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
            {fluxo.etapa === "conferencia" ? (
              <div className="relative w-full max-w-[860px] max-h-[90vh] bg-surface rounded-card-lg shadow-modal border border-border flex flex-col">
                <div className="px-5 py-4 border-b border-border shrink-0">
                  <h3 className="font-display font-bold text-[16px] text-ink">Revisão de texto</h3>
                  <p className="text-[12.5px] text-ink-2 mt-0.5">
                    {fluxo.parcial ? "A IA está indisponível; foi aplicada só a correção básica. " : ""}
                    Confira o que a revisão propõe antes de salvar.
                  </p>
                </div>
                <div className="overflow-y-auto px-5 py-4 space-y-5">
                  {fluxo.itens.map((i) => (
                    <div key={`${i.modelo}:${i.chave}`}>
                      <div className="text-[12.5px] font-bold text-ink mb-2">
                        {ROTULO_MODELO[i.modelo]} — {i.titulo}
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="rounded-btn border border-border p-3">
                          <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3 mb-1.5">Como você escreveu</div>
                          <div className={`text-[13px] text-ink leading-relaxed ${COMO_NO_DOCUMENTO}`} dangerouslySetInnerHTML={{ __html: textoParaHtml(i.original, i.chave) }} />
                        </div>
                        <div className="rounded-btn border border-primary/30 bg-primary-soft/40 p-3">
                          <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-primary-dark mb-1.5">Revisado</div>
                          <div className={`text-[13px] text-ink leading-relaxed ${COMO_NO_DOCUMENTO}`} dangerouslySetInnerHTML={{ __html: textoParaHtml(i.revisado, i.chave) }} />
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
                  <Button size="sm" variant="text" onClick={() => setFluxo(null)} disabled={salvando}>
                    Voltar a editar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative w-full max-w-[460px] bg-surface rounded-card-lg shadow-modal border border-border p-6">
                <h3 className="font-display font-bold text-[16px] text-ink">Revisar o texto com IA?</h3>
                <p className="text-[13px] text-ink-2 mt-1.5">
                  {fluxo.etapa === "revisando"
                    ? "Revisando o que você alterou…"
                    : "A IA revisa só o que você alterou, e você confere as correções antes de salvar."}
                </p>
                <div className="flex items-center gap-2 mt-5 flex-wrap">
                  <Button size="sm" onClick={() => void revisarComIa()} disabled={fluxo.etapa === "revisando" || salvando}>
                    {fluxo.etapa === "revisando" ? "Revisando…" : "Revisar com IA"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void gravarTextos(rascunho)} disabled={fluxo.etapa === "revisando" || salvando}>
                    {salvando ? "Salvando…" : "Salvar sem revisar"}
                  </Button>
                  <Button size="sm" variant="text" onClick={() => setFluxo(null)} disabled={fluxo.etapa === "revisando" || salvando}>
                    Voltar
                  </Button>
                </div>
              </div>
            )}
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
