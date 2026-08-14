/**
 * Editor do Cronograma Geral do projeto.
 *
 * Blocos: as cinco etapas padrão (Montagem, Alinhamentos, Ensaios, Evento,
 * Desmontagem) mais quantos blocos livres o usuário quiser criar. Etapas padrão
 * podem ser ocultadas (guardam os dados); blocos livres têm título editável e
 * podem ser excluídos.
 *
 * Movimentação — as duas formas convivem, como no restante do sistema:
 *  · arraste (alça) reordena blocos, reordena datas dentro de um bloco e move
 *    uma data de um bloco para outro, em saltos grandes;
 *  · setas (só nas datas) andam uma posição por vez e, ao chegar na borda do
 *    bloco, atravessam para o bloco vizinho — dá para percorrer o cronograma
 *    inteiro só com elas. A tela acompanha a data a cada passo.
 */
import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Field, Input } from "@/components/ui";
import { IcGrip, IcPlus, IcTrash, IcEye, IcEyeOff } from "@/components/icons";
import { MoverSetas, moverNaLista } from "@/components/MoverSetas";
import {
  ETAPAS_CRONOGRAMA,
  idBlocoEtapa,
  idBlocoExtra,
  novaFaixaCronograma,
  novoBlocoCronograma,
} from "@/domain/projeto";
import { destacarElemento, seguirElemento, idBlocoCronograma, idFaixaCronograma } from "@/lib/destaque";
import { cx, dataBR } from "@/lib/format";
import type {
  BlocoCronogramaExtra,
  CronogramaProjeto,
  EtapaCronogramaProjeto,
  FaixaCronogramaProjeto,
  ProjetoInfo,
} from "@/data/types";

/** Bloco já resolvido para a tela (etapa padrão ou bloco livre). */
interface Bloco {
  id: string; // "etapa:evento" | "extra:<uuid>"
  titulo: string;
  etapa?: EtapaCronogramaProjeto; // presente só nas etapas padrão
  faixas: FaixaCronogramaProjeto[];
}

const ehBlocoId = (id: string) => id.startsWith("B:") || id.startsWith("D:");
const chaveDoId = (id: string) => id.slice(2);
const BID = (id: string) => `B:${id}`; // alça de arraste do bloco
const DID = (id: string) => `D:${id}`; // área que recebe datas soltas no bloco

const blocoDaFaixa = (blocos: Bloco[], faixaId: string) => blocos.find((b) => b.faixas.some((f) => f.id === faixaId));

/** Monta a lista de blocos a partir do ProjetoInfo, respeitando a ordem salva. */
function montarBlocos(info: ProjetoInfo): Bloco[] {
  const porId = new Map<string, Bloco>();
  for (const { key, label } of ETAPAS_CRONOGRAMA) {
    porId.set(idBlocoEtapa(key), { id: idBlocoEtapa(key), titulo: label, etapa: key, faixas: info.cronograma[key] ?? [] });
  }
  for (const extra of info.cronogramaExtras ?? []) {
    porId.set(idBlocoExtra(extra.id), { id: idBlocoExtra(extra.id), titulo: extra.titulo, faixas: extra.faixas ?? [] });
  }
  const ordenados = (info.cronogramaOrdem ?? [])
    .map((id) => porId.get(id))
    .filter((b): b is Bloco => !!b);
  const vistos = new Set(ordenados.map((b) => b.id));
  // Bloco que ainda não consta da ordem gravada entra no fim, nunca desaparece.
  return [...ordenados, ...[...porId.values()].filter((b) => !vistos.has(b.id))];
}

/** Converte a lista de blocos de volta nos campos do ProjetoInfo. */
function aplicarBlocos(blocos: Bloco[]): Pick<ProjetoInfo, "cronograma" | "cronogramaExtras" | "cronogramaOrdem"> {
  const cronograma = {} as CronogramaProjeto;
  for (const { key } of ETAPAS_CRONOGRAMA) cronograma[key] = [];
  const extras: BlocoCronogramaExtra[] = [];
  for (const b of blocos) {
    if (b.etapa) cronograma[b.etapa] = b.faixas;
    else extras.push({ id: chaveDoIdBloco(b.id), titulo: b.titulo, faixas: b.faixas });
  }
  return { cronograma, cronogramaExtras: extras, cronogramaOrdem: blocos.map((b) => b.id) };
}

/** "extra:abc" → "abc" (o id gravado no ProjetoInfo é sem prefixo). */
const chaveDoIdBloco = (id: string) => id.replace(/^extra:/, "");

export function CronogramaProjetoEditor({
  info,
  onChange,
  eventoComErro,
}: {
  info: ProjetoInfo;
  onChange: (patch: Partial<ProjetoInfo>) => void;
  /** Destaca em vermelho as datas do bloco Evento quando o obrigatório não foi preenchido. */
  eventoComErro: boolean;
}) {
  const [blocos, setBlocos] = useState<Bloco[]>(() => montarBlocos(info));
  const [ativo, setAtivo] = useState<{ tipo: "bloco" | "faixa"; chave: string } | null>(null);
  const arrastandoRef = useRef(false);
  // Espelho sempre atual (onDragOver e onDragEnd não podem ler estado defasado).
  const blocosRef = useRef(blocos);
  blocosRef.current = blocos;

  // Re-sincroniza quando o projeto muda por fora (carregamento, troca de registro).
  useEffect(() => {
    if (arrastandoRef.current) return;
    const externo = JSON.stringify(montarBlocos(info));
    if (externo !== JSON.stringify(blocosRef.current)) setBlocos(montarBlocos(info));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.cronograma, info.cronogramaExtras, info.cronogramaOrdem]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const commit = (next: Bloco[]) => {
    blocosRef.current = next;
    setBlocos(next);
    onChange(aplicarBlocos(next));
  };

  const updBloco = (id: string, patch: Partial<Bloco>) => commit(blocos.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const updFaixa = (blocoId: string, faixaId: string, patch: Partial<FaixaCronogramaProjeto>) =>
    commit(blocos.map((b) => (b.id === blocoId ? { ...b, faixas: b.faixas.map((f) => (f.id === faixaId ? { ...f, ...patch } : f)) } : b)));

  const addFaixa = (blocoId: string) => {
    const nova = novaFaixaCronograma();
    commit(blocos.map((b) => (b.id === blocoId ? { ...b, faixas: [...b.faixas, nova] } : b)));
    destacarElemento(idFaixaCronograma(nova.id));
  };
  const removerFaixa = (blocoId: string, faixaId: string) =>
    commit(blocos.map((b) => (b.id === blocoId ? { ...b, faixas: b.faixas.filter((f) => f.id !== faixaId) } : b)));
  /** Bloco oculto não mostra as datas — a seta o atravessa em vez de esconder o item lá dentro. */
  const blocoVisivel = (b: Bloco) => !b.etapa || !info.etapasOcultas.includes(b.etapa);
  const proximoBlocoVisivel = (de: number, direcao: -1 | 1) => {
    for (let i = de + direcao; i >= 0 && i < blocos.length; i += direcao) if (blocoVisivel(blocos[i])) return i;
    return -1;
  };

  /**
   * Move uma data uma posição. Na borda do bloco ela PASSA PARA O BLOCO VIZINHO:
   * descendo, entra no topo do bloco de baixo; subindo, no fim do de cima.
   */
  const moverFaixa = (blocoId: string, faixaId: string, direcao: -1 | 1) => {
    const iBloco = blocos.findIndex((b) => b.id === blocoId);
    if (iBloco < 0) return;
    const bloco = blocos[iBloco];
    const atual = bloco.faixas.findIndex((f) => f.id === faixaId);
    if (atual < 0) return;
    const destino = atual + direcao;

    if (destino >= 0 && destino < bloco.faixas.length) {
      commit(blocos.map((b, i) => (i === iBloco ? { ...b, faixas: moverNaLista(b.faixas, atual, direcao) } : b)));
    } else {
      const iDestino = proximoBlocoVisivel(iBloco, direcao);
      if (iDestino < 0) return;
      const faixa = bloco.faixas[atual];
      commit(
        blocos.map((b, i) => {
          if (i === iBloco) return { ...b, faixas: b.faixas.filter((f) => f.id !== faixaId) };
          if (i === iDestino) return { ...b, faixas: direcao === 1 ? [faixa, ...b.faixas] : [...b.faixas, faixa] };
          return b;
        })
      );
    }
    // A tela acompanha a data — senão ela sai de vista a cada toque na seta.
    seguirElemento(idFaixaCronograma(faixaId));
  };

  const addBloco = () => {
    const novo = novoBlocoCronograma();
    const id = idBlocoExtra(novo.id);
    commit([...blocos, { id, titulo: novo.titulo, faixas: novo.faixas }]);
    // O bloco novo entra no fim da lista, muitas vezes fora da tela: leva a
    // rolagem até ele e pisca duas vezes para não se perder de vista.
    destacarElemento(idBlocoCronograma(id));
  };
  const removerBloco = (id: string) => commit(blocos.filter((b) => b.id !== id));

  const toggleOculta = (etapa: EtapaCronogramaProjeto) =>
    onChange({
      etapasOcultas: info.etapasOcultas.includes(etapa)
        ? info.etapasOcultas.filter((e) => e !== etapa)
        : [...info.etapasOcultas, etapa],
    });

  /* ---------------------------- arrastar e soltar ---------------------------- */
  const onDragStart = (e: DragStartEvent) => {
    arrastandoRef.current = true;
    const id = String(e.active.id);
    setAtivo(ehBlocoId(id) ? { tipo: "bloco", chave: chaveDoId(id) } : { tipo: "faixa", chave: id });
  };

  // Move a data entre blocos ao vivo, para o espaço "abrir" enquanto arrasta.
  const onDragOver = (e: DragOverEvent) => {
    const activeId = String(e.active.id);
    if (ehBlocoId(activeId) || !e.over) return;
    const overId = String(e.over.id);
    const atual = blocosRef.current;
    const origem = blocoDaFaixa(atual, activeId);
    const destino = ehBlocoId(overId)
      ? atual.find((b) => b.id === chaveDoId(overId))
      : blocoDaFaixa(atual, overId);
    if (!origem || !destino || origem.id === destino.id) return;

    const copia = atual.map((b) => ({ ...b, faixas: [...b.faixas] }));
    const bo = copia.find((b) => b.id === origem.id)!;
    const bd = copia.find((b) => b.id === destino.id)!;
    const i = bo.faixas.findIndex((f) => f.id === activeId);
    if (i < 0) return;
    const [movida] = bo.faixas.splice(i, 1);
    const j = ehBlocoId(overId) ? bd.faixas.length : bd.faixas.findIndex((f) => f.id === overId);
    bd.faixas.splice(j < 0 ? bd.faixas.length : j, 0, movida);
    blocosRef.current = copia;
    setBlocos(copia);
  };

  const onDragEnd = (e: DragEndEvent) => {
    arrastandoRef.current = false;
    setAtivo(null);
    const atual = blocosRef.current;
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return commit(atual);

    if (ehBlocoId(activeId)) {
      const de = atual.findIndex((b) => b.id === chaveDoId(activeId));
      const alvo = ehBlocoId(overId) ? chaveDoId(overId) : blocoDaFaixa(atual, overId)?.id;
      const para = atual.findIndex((b) => b.id === alvo);
      if (de >= 0 && para >= 0 && de !== para) return commit(arrayMove(atual, de, para));
      return commit(atual);
    }

    // Data reordenada dentro do próprio bloco (a troca de bloco já ocorreu no onDragOver).
    const bloco = blocoDaFaixa(atual, activeId);
    const alvo = ehBlocoId(overId) ? atual.find((b) => b.id === chaveDoId(overId)) : blocoDaFaixa(atual, overId);
    if (bloco && alvo && bloco.id === alvo.id && !ehBlocoId(overId)) {
      const de = bloco.faixas.findIndex((f) => f.id === activeId);
      const para = bloco.faixas.findIndex((f) => f.id === overId);
      if (de !== para && para >= 0) {
        return commit(atual.map((b) => (b.id === bloco.id ? { ...b, faixas: arrayMove(b.faixas, de, para) } : b)));
      }
    }
    commit(atual);
  };

  const faixaAtiva = ativo?.tipo === "faixa" ? blocos.flatMap((b) => b.faixas).find((f) => f.id === ativo.chave) : undefined;
  const blocoAtivo = ativo?.tipo === "bloco" ? blocos.find((b) => b.id === ativo.chave) : undefined;

  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" size="sm" icon={<IcPlus width={16} height={16} />} onClick={addBloco}>
        Adicionar bloco
      </Button>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <SortableContext items={blocos.map((b) => BID(b.id))} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {blocos.map((bloco, iBloco) => (
              <BlocoCard
                key={bloco.id}
                bloco={bloco}
                oculto={!!bloco.etapa && info.etapasOcultas.includes(bloco.etapa)}
                temBlocoAcima={proximoBlocoVisivel(iBloco, -1) >= 0}
                temBlocoAbaixo={proximoBlocoVisivel(iBloco, 1) >= 0}
                comErro={bloco.etapa === "evento" && eventoComErro}
                onTitulo={(titulo) => updBloco(bloco.id, { titulo })}
                onToggleOculta={() => bloco.etapa && toggleOculta(bloco.etapa)}
                onRemoverBloco={() => removerBloco(bloco.id)}
                onAddFaixa={() => addFaixa(bloco.id)}
                onUpdFaixa={(faixaId, patch) => updFaixa(bloco.id, faixaId, patch)}
                onRemoverFaixa={(faixaId) => removerFaixa(bloco.id, faixaId)}
                onMoverFaixa={(faixaId, direcao) => moverFaixa(bloco.id, faixaId, direcao)}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {faixaAtiva ? (
            <div className="rounded-btn border-2 border-primary bg-white shadow-2xl px-3 py-2 opacity-90 rotate-1 flex items-center gap-2">
              <IcGrip width={18} height={18} className="text-primary" />
              <span className="text-[13px] font-bold text-ink">
                {dataBR(faixaAtiva.data) || "Nova data"}
                {faixaAtiva.inicio ? ` · ${faixaAtiva.inicio}` : ""}
              </span>
            </div>
          ) : blocoAtivo ? (
            <div className="rounded-card border-2 border-primary bg-white shadow-2xl px-3 py-3 opacity-90 rotate-1 flex items-center gap-2">
              <IcGrip width={20} height={20} className="text-primary" />
              <span className="text-[15px] font-bold text-ink">{blocoAtivo.titulo}</span>
              <span className="text-[12px] font-bold text-ink-3 bg-[#F0F1F4] rounded-pill px-2 py-0.5">
                {blocoAtivo.faixas.length} data(s)
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/* ------------------------------- Bloco ------------------------------- */

function BlocoCard({
  bloco,
  oculto,
  temBlocoAcima,
  temBlocoAbaixo,
  comErro,
  onTitulo,
  onToggleOculta,
  onRemoverBloco,
  onAddFaixa,
  onUpdFaixa,
  onRemoverFaixa,
  onMoverFaixa,
}: {
  bloco: Bloco;
  oculto: boolean;
  /** Há bloco visível antes/depois deste — a seta na borda leva a data para lá. */
  temBlocoAcima: boolean;
  temBlocoAbaixo: boolean;
  comErro: boolean;
  onTitulo: (v: string) => void;
  onToggleOculta: () => void;
  onRemoverBloco: () => void;
  onAddFaixa: () => void;
  onUpdFaixa: (faixaId: string, patch: Partial<FaixaCronogramaProjeto>) => void;
  onRemoverFaixa: (faixaId: string) => void;
  onMoverFaixa: (faixaId: string, direcao: -1 | 1) => void;
}) {
  const sortable = useSortable({ id: BID(bloco.id) });
  const droppable = useDroppable({ id: DID(bloco.id) });
  const setRefs = (node: HTMLElement | null) => {
    sortable.setNodeRef(node);
    droppable.setNodeRef(node);
  };
  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };
  const etapaPadrao = !!bloco.etapa;

  return (
    <section
      ref={setRefs}
      style={style}
      id={idBlocoCronograma(bloco.id)}
      aria-labelledby={`cronograma-${bloco.id}`}
      className={cx(
        "rounded-btn border p-3 sm:p-4 bg-white",
        sortable.isDragging ? "opacity-40 border-border" : "border-border-soft",
        droppable.isOver && !sortable.isDragging && "ring-2 ring-primary/40 border-primary"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <button
          ref={sortable.setActivatorNodeRef}
          {...sortable.listeners}
          {...sortable.attributes}
          type="button"
          className="cursor-grab active:cursor-grabbing text-ink-3 hover:text-ink shrink-0 touch-none"
          title="Arraste para reordenar o bloco"
          aria-label={`Arrastar bloco ${bloco.titulo}`}
        >
          <IcGrip width={18} height={18} />
        </button>
        {etapaPadrao ? (
          <h3 id={`cronograma-${bloco.id}`} className="text-sm font-bold text-ink">{bloco.titulo}</h3>
        ) : (
          <Input
            className="!h-9 !text-[13.5px] !font-bold max-w-xs"
            formato="titulo"
            value={bloco.titulo}
            onChange={(e) => onTitulo(e.target.value)}
            placeholder="Título do bloco"
            aria-label="Título do bloco"
          />
        )}
        <div className="ml-auto flex items-center gap-1">
          {etapaPadrao ? (
            <Button
              type="button"
              variant="text"
              size="sm"
              aria-label={oculto ? `Reexibir ${bloco.titulo}` : `Ocultar ${bloco.titulo}`}
              title={oculto ? "Reexibir etapa" : "Ocultar etapa"}
              icon={oculto ? <IcEye width={15} height={15} /> : <IcEyeOff width={15} height={15} />}
              onClick={onToggleOculta}
            >
              {oculto ? "Reexibir" : "Ocultar"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="text"
              size="sm"
              aria-label={`Excluir bloco ${bloco.titulo}`}
              title="Excluir bloco"
              icon={<IcTrash width={15} height={15} />}
              onClick={onRemoverBloco}
            />
          )}
          <Button type="button" variant="soft" size="sm" icon={<IcPlus width={15} height={15} />} onClick={onAddFaixa}>
            Adicionar data
          </Button>
        </div>
      </div>

      {!oculto && (
        <SortableContext items={bloco.faixas.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {bloco.faixas.map((faixa, indice) => (
              <FaixaLinha
                key={faixa.id}
                faixa={faixa}
                indice={indice}
                bloco={bloco.titulo}
                podeSubir={indice > 0 || temBlocoAcima}
                podeDescer={indice < bloco.faixas.length - 1 || temBlocoAbaixo}
                comErro={comErro && !faixa.data.trim()}
                onUpd={(patch) => onUpdFaixa(faixa.id, patch)}
                onRemover={() => onRemoverFaixa(faixa.id)}
                onMover={(direcao) => onMoverFaixa(faixa.id, direcao)}
              />
            ))}
            {bloco.faixas.length === 0 && (
              <p className="text-center text-[13px] text-ink-3 py-3">
                Nenhuma data neste bloco — use “Adicionar data” ou arraste uma de outro bloco.
              </p>
            )}
          </div>
        </SortableContext>
      )}
    </section>
  );
}

/* ------------------------------- Data ------------------------------- */

function FaixaLinha({
  faixa,
  indice,
  bloco,
  podeSubir,
  podeDescer,
  comErro,
  onUpd,
  onRemover,
  onMover,
}: {
  faixa: FaixaCronogramaProjeto;
  indice: number;
  bloco: string;
  podeSubir: boolean;
  podeDescer: boolean;
  comErro: boolean;
  onUpd: (patch: Partial<FaixaCronogramaProjeto>) => void;
  onRemover: () => void;
  onMover: (direcao: -1 | 1) => void;
}) {
  const sortable = useSortable({ id: faixa.id });
  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };
  const rotulo = `a data ${indice + 1} de ${bloco}`;

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      id={idFaixaCronograma(faixa.id)}
      className={cx(
        "grid grid-cols-1 sm:grid-cols-[auto_auto_minmax(150px,1fr)_minmax(120px,.7fr)_minmax(120px,.7fr)_auto] gap-2 items-end rounded-btn",
        sortable.isDragging && "opacity-40"
      )}
    >
      <button
        ref={sortable.setActivatorNodeRef}
        {...sortable.listeners}
        {...sortable.attributes}
        type="button"
        className="cursor-grab active:cursor-grabbing text-ink-3 hover:text-ink shrink-0 touch-none pb-2.5"
        title="Arraste para reordenar ou mover para outro bloco"
        aria-label={`Arrastar ${rotulo}`}
      >
        <IcGrip width={16} height={16} />
      </button>
      {/* Setas: uma posição por vez; na borda, passam a data para o bloco vizinho. */}
      <MoverSetas
        className="pb-1.5"
        rotulo={rotulo}
        podeSubir={podeSubir}
        podeDescer={podeDescer}
        onSubir={() => onMover(-1)}
        onDescer={() => onMover(1)}
      />
      <Field label="Data"><Input type="date" erro={comErro} value={faixa.data} onChange={(e) => onUpd({ data: e.target.value })} /></Field>
      <Field label="Início"><Input type="time" value={faixa.inicio} onChange={(e) => onUpd({ inicio: e.target.value })} /></Field>
      <Field label="Fim"><Input type="time" value={faixa.fim} onChange={(e) => onUpd({ fim: e.target.value })} /></Field>
      <div className="pb-0.5">
        <Button type="button" variant="text" size="sm" aria-label={`Excluir ${rotulo}`} title="Excluir data" icon={<IcTrash width={15} height={15} />} onClick={onRemover} />
      </div>
    </div>
  );
}
