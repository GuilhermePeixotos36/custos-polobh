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
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Input, AutoTextarea, Select, NumberInput, Button } from "@/components/ui";
import { IcGrip, IcChevron, IcPlus, IcTrash } from "@/components/icons";
import { FornecedorField } from "@/components/FornecedorField";
import { brl, cx, onlyDigits, maskCpfCnpjInput } from "@/lib/format";
import { confirmar } from "@/store/confirm";
import type { EcLinha, Fornecedor, StatusAprovacao, StatusOs } from "@/data/types";

interface Grupo {
  nome: string;
  itens: EcLinha[];
}

/** Agrupa as linhas por grupo, preservando a ordem de aparição. */
function agrupar(linhas: EcLinha[]): Grupo[] {
  const ordem: string[] = [];
  const map = new Map<string, EcLinha[]>();
  for (const l of linhas) {
    if (!map.has(l.grupo)) {
      map.set(l.grupo, []);
      ordem.push(l.grupo);
    }
    map.get(l.grupo)!.push(l);
  }
  return ordem.map((nome) => ({ nome, itens: map.get(nome)! }));
}

/** Achata os grupos de volta num array de linhas, reatribuindo grupo e ordem. */
function achatar(grupos: Grupo[]): EcLinha[] {
  const out: EcLinha[] = [];
  grupos.forEach((g) => g.itens.forEach((it) => out.push({ ...it, grupo: g.nome, ordem: out.length })));
  return out;
}

const GID = (nome: string) => `G:${nome}`; // id sortable do grupo
const CID = (nome: string) => `C:${nome}`; // id droppable (container) do grupo
const ehGrupoId = (id: string) => id.startsWith("G:") || id.startsWith("C:");
const nomeDoId = (id: string) => id.slice(2);

let seq = 0;
function novaLinhaBase(): EcLinha {
  seq += 1;
  return {
    id: `nl-${Date.now()}-${seq}`,
    grupo: "GERAL",
    item: "",
    descricao: "",
    valorPolobh: 0,
    valorCliente: 0,
    valorGasto: 0,
    statusAprovacao: "Pendente",
    fornecedorRazao: "",
    fornecedorCnpj: "",
    fornecedorContato: "",
    faturaNf: "",
    codigoServico: "",
    pedidoCompra: "",
    statusOs: "Pendente",
    contrato: "",
    observacao: "",
    ordem: 0,
  };
}

function nomeGrupoUnico(base: string, grupos: Grupo[]): string {
  const nomes = new Set(grupos.map((g) => g.nome));
  if (!nomes.has(base)) return base;
  let i = 2;
  while (nomes.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

const containerDoItem = (grupos: Grupo[], itemId: string) =>
  grupos.find((g) => g.itens.some((i) => i.id === itemId))?.nome;

interface Props {
  linhas: EcLinha[];
  onChange: (linhas: EcLinha[]) => void;
  verFinanceiro: boolean;
  fornecedores: Fornecedor[];
  onValidarFornecedor: (cnpj: string) => Promise<string | null>;
}

const DATALIST_ID = "ec-fornecedores-cnpj";

export function EcGrupos({ linhas, onChange, verFinanceiro, fornecedores, onValidarFornecedor }: Props) {
  const [grupos, setGrupos] = useState<Grupo[]>(() => agrupar(linhas));
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const [ativo, setAtivo] = useState<{ tipo: "grupo" | "item"; chave: string } | null>(null);
  const arrastandoRef = useRef(false);
  // Espelho sempre atual do estado (evita leitura defasada entre onDragOver e onDragEnd).
  const gruposRef = useRef(grupos);
  gruposRef.current = grupos;

  // Re-sincroniza com as linhas externas (ex.: template, nova versão) quando não há arraste.
  useEffect(() => {
    if (arrastandoRef.current) return;
    const propSig = JSON.stringify(linhas.map((l) => [l.id, l.grupo]));
    const curSig = JSON.stringify(achatar(grupos).map((l) => [l.id, l.grupo]));
    if (propSig !== curSig) setGrupos(agrupar(linhas));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const isExp = (nome: string) => expandido[nome] ?? false;
  const toggle = (nome: string) => setExpandido((e) => ({ ...e, [nome]: !isExp(nome) }));
  const expandirTodos = (v: boolean) => setExpandido(Object.fromEntries(grupos.map((g) => [g.nome, v])));

  /* ------- edição (atualiza estado local e propaga) ------- */
  const commit = (next: Grupo[]) => {
    gruposRef.current = next;
    setGrupos(next);
    onChange(achatar(next));
  };

  const updLinha = (id: string, patch: Partial<EcLinha>) =>
    commit(grupos.map((g) => ({ ...g, itens: g.itens.map((it) => (it.id === id ? { ...it, ...patch } : it)) })));

  const renomearGrupo = (nomeAntigo: string, novo: string) => {
    commit(grupos.map((g) => (g.nome === nomeAntigo ? { ...g, nome: novo } : g)));
    setExpandido((e) => {
      const { [nomeAntigo]: v, ...resto } = e;
      return { ...resto, [novo]: v ?? false };
    });
  };

  const addItem = (grupoNome: string) => {
    commit(grupos.map((g) => (g.nome === grupoNome ? { ...g, itens: [...g.itens, { ...novaLinhaBase(), grupo: grupoNome }] } : g)));
    setExpandido((e) => ({ ...e, [grupoNome]: true }));
  };

  const addGrupo = () => {
    const nome = nomeGrupoUnico("NOVO GRUPO", grupos);
    commit([...grupos, { nome, itens: [{ ...novaLinhaBase(), grupo: nome }] }]);
    setExpandido((e) => ({ ...e, [nome]: true }));
  };

  const delGrupo = async (g: Grupo) => {
    const temConteudo = g.itens.some((l) => l.item || l.descricao || l.valorPolobh || l.valorCliente || l.fornecedorRazao);
    if (
      temConteudo &&
      !(await confirmar({
        titulo: `Remover o grupo "${g.nome}"?`,
        mensagem: `As ${g.itens.length} linha(s) deste grupo serão excluídas da estimativa.`,
        confirmarTexto: "Remover grupo",
        tom: "danger",
      }))
    )
      return;
    commit(grupos.filter((x) => x.nome !== g.nome));
  };

  const delItem = async (l: EcLinha) => {
    const temConteudo = l.item || l.descricao || l.valorPolobh || l.valorCliente || l.fornecedorRazao;
    if (
      temConteudo &&
      !(await confirmar({
        titulo: "Remover esta linha de custo?",
        mensagem: l.item || l.descricao || "Esta linha será excluída da estimativa.",
        confirmarTexto: "Remover",
        tom: "danger",
      }))
    )
      return;
    commit(grupos.map((g) => ({ ...g, itens: g.itens.filter((x) => x.id !== l.id) })));
  };

  /* ------------------------- drag & drop ------------------------- */
  const onDragStart = (e: DragStartEvent) => {
    arrastandoRef.current = true;
    const id = String(e.active.id);
    if (ehGrupoId(id)) setAtivo({ tipo: "grupo", chave: nomeDoId(id) });
    else setAtivo({ tipo: "item", chave: id });
  };

  // Move o item entre grupos ao vivo (permite a animação de "abrir espaço").
  const onDragOver = (e: DragOverEvent) => {
    const activeId = String(e.active.id);
    if (ehGrupoId(activeId) || !e.over) return; // reordenar grupo é tratado no fim
    const overId = String(e.over.id);
    const atual = gruposRef.current;
    const from = containerDoItem(atual, activeId);
    const to = ehGrupoId(overId) ? nomeDoId(overId) : containerDoItem(atual, overId);
    if (!from || !to || from === to) return;
    const gs = atual.map((g) => ({ nome: g.nome, itens: [...g.itens] }));
    const gf = gs.find((g) => g.nome === from);
    const gt = gs.find((g) => g.nome === to);
    if (!gf || !gt) return;
    const idx = gf.itens.findIndex((x) => x.id === activeId);
    if (idx < 0) return;
    const [it] = gf.itens.splice(idx, 1);
    const movido = { ...it, grupo: to };
    const j = ehGrupoId(overId) ? gt.itens.length : gt.itens.findIndex((x) => x.id === overId);
    gt.itens.splice(j < 0 ? gt.itens.length : j, 0, movido);
    gruposRef.current = gs;
    setGrupos(gs);
  };

  const onDragEnd = (e: DragEndEvent) => {
    arrastandoRef.current = false;
    setAtivo(null);
    const atual = gruposRef.current;
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) {
      commit(atual);
      return;
    }
    // Reordenar grupos
    if (ehGrupoId(activeId)) {
      const fromNome = nomeDoId(activeId);
      const toNome = ehGrupoId(overId) ? nomeDoId(overId) : containerDoItem(atual, overId);
      if (toNome && fromNome !== toNome) {
        const oldIndex = atual.findIndex((g) => g.nome === fromNome);
        const newIndex = atual.findIndex((g) => g.nome === toNome);
        commit(arrayMove(atual, oldIndex, newIndex));
        return;
      }
      commit(atual);
      return;
    }
    // Reordenar item dentro do mesmo grupo (cross-group já ocorreu no onDragOver)
    const cont = containerDoItem(atual, activeId);
    const alvoCont = ehGrupoId(overId) ? nomeDoId(overId) : containerDoItem(atual, overId);
    if (cont && alvoCont && cont === alvoCont && !ehGrupoId(overId)) {
      const g = atual.find((x) => x.nome === cont)!;
      const oldIndex = g.itens.findIndex((x) => x.id === activeId);
      const newIndex = g.itens.findIndex((x) => x.id === overId);
      if (oldIndex !== newIndex && newIndex >= 0) {
        commit(atual.map((x) => (x.nome === cont ? { ...x, itens: arrayMove(x.itens, oldIndex, newIndex) } : x)));
        return;
      }
    }
    commit(atual);
  };

  const itemAtivo = ativo?.tipo === "item" ? grupos.flatMap((g) => g.itens).find((i) => i.id === ativo.chave) : undefined;
  const grupoAtivo = ativo?.tipo === "grupo" ? grupos.find((g) => g.nome === ativo.chave) : undefined;

  return (
    <div className="space-y-3">
      <datalist id={DATALIST_ID}>
        {fornecedores.map((f) => (
          <option key={f.id} value={maskCpfCnpjInput(onlyDigits(f.cnpj))}>
            {f.nomeFantasia || f.razaoSocial}
          </option>
        ))}
      </datalist>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="secondary" size="sm" icon={<IcPlus width={16} height={16} />} onClick={addGrupo}>
          Adicionar grupo
        </Button>
        <div className="flex gap-3 text-[13px] font-bold text-ink-2">
          <button onClick={() => expandirTodos(true)} className="hover:text-ink">Expandir todos</button>
          <span className="text-border">|</span>
          <button onClick={() => expandirTodos(false)} className="hover:text-ink">Retrair todos</button>
        </div>
      </div>

      {grupos.length === 0 && (
        <div className="text-center text-ink-3 text-sm py-8 border border-dashed border-border rounded-card">
          Nenhum grupo. Use “Adicionar grupo” para começar.
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <SortableContext items={grupos.map((g) => GID(g.nome))} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {grupos.map((g) => (
              <GrupoCard
                key={g.nome}
                g={g}
                aberto={isExp(g.nome)}
                verFinanceiro={verFinanceiro}
                fornecedores={fornecedores}
                onToggle={() => toggle(g.nome)}
                onRenomear={(v) => renomearGrupo(g.nome, v)}
                onAddItem={() => addItem(g.nome)}
                onDelGrupo={() => delGrupo(g)}
                onUpdLinha={updLinha}
                onDelItem={delItem}
                onValidarFornecedor={onValidarFornecedor}
              />
            ))}
          </div>
        </SortableContext>

        {/* Card flutuante que acompanha o cursor */}
        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {itemAtivo ? (
            <div className="rounded-btn border-2 border-primary bg-white shadow-2xl px-3 py-2 opacity-90 rotate-1 flex items-center gap-2 min-w-[260px]">
              <IcGrip width={18} height={18} className="text-primary" />
              <div className="min-w-0">
                <div className="text-[13.5px] font-bold text-ink truncate">{itemAtivo.item || "Item"}</div>
                {itemAtivo.descricao && <div className="text-[12px] text-ink-2 truncate">{itemAtivo.descricao}</div>}
              </div>
            </div>
          ) : grupoAtivo ? (
            <div className="rounded-card border-2 border-primary bg-white shadow-2xl px-3 py-3 opacity-90 rotate-1 flex items-center gap-2">
              <IcGrip width={20} height={20} className="text-primary" />
              <span className="text-[15px] font-bold uppercase text-ink">{grupoAtivo.nome}</span>
              <span className="text-[12px] font-bold text-ink-3 bg-[#F0F1F4] rounded-pill px-2 py-0.5">{grupoAtivo.itens.length} itens</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/* ------------------------------ Grupo ------------------------------ */

interface GrupoProps {
  g: Grupo;
  aberto: boolean;
  verFinanceiro: boolean;
  fornecedores: Fornecedor[];
  onToggle: () => void;
  onRenomear: (v: string) => void;
  onAddItem: () => void;
  onDelGrupo: () => void;
  onUpdLinha: (id: string, patch: Partial<EcLinha>) => void;
  onDelItem: (l: EcLinha) => void;
  onValidarFornecedor: (cnpj: string) => Promise<string | null>;
}

function GrupoCard({ g, aberto, verFinanceiro, fornecedores, onToggle, onRenomear, onAddItem, onDelGrupo, onUpdLinha, onDelItem, onValidarFornecedor }: GrupoProps) {
  const sortable = useSortable({ id: GID(g.nome) });
  const droppable = useDroppable({ id: CID(g.nome) });
  const setRefs = (node: HTMLElement | null) => {
    sortable.setNodeRef(node);
    droppable.setNodeRef(node);
  };
  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };
  const subtotal = g.itens.reduce((s, l) => s + (l.valorPolobh || 0) + (l.valorCliente || 0), 0);

  return (
    <div
      ref={setRefs}
      style={style}
      className={cx(
        "rounded-card border bg-white",
        sortable.isDragging ? "opacity-40" : "border-border",
        droppable.isOver && !sortable.isDragging && "ring-2 ring-primary/40 border-primary"
      )}
    >
      <div className={cx("flex items-center gap-2 px-3 py-3", aberto && "border-b border-border-soft")}>
        <button
          ref={sortable.setActivatorNodeRef}
          {...sortable.listeners}
          {...sortable.attributes}
          className="cursor-grab active:cursor-grabbing text-ink-3 hover:text-ink shrink-0 touch-none"
          title="Arraste para reordenar o grupo"
        >
          <IcGrip width={20} height={20} />
        </button>
        <button onClick={onToggle} className="shrink-0 text-ink-2 hover:text-ink" title={aberto ? "Retrair" : "Expandir"}>
          <IcChevron width={20} height={20} className={cx("transition-transform duration-200", aberto && "rotate-90")} />
        </button>
        <Input className="!h-10 !px-2.5 !text-[15px] !font-bold !uppercase max-w-sm" value={g.nome} onChange={(e) => onRenomear(e.target.value)} />
        <span className="shrink-0 text-[12px] font-bold text-ink-3 bg-[#F0F1F4] rounded-pill px-2.5 py-1">
          {g.itens.length} {g.itens.length === 1 ? "item" : "itens"}
        </span>
        {verFinanceiro && subtotal > 0 && (
          <span className="shrink-0 text-[14px] font-display font-bold text-ink-2">{brl(subtotal)}</span>
        )}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <Button variant="soft" size="sm" icon={<IcPlus width={15} height={15} />} onClick={onAddItem}>
            Item
          </Button>
          <button onClick={onDelGrupo} className="text-ink-3 hover:text-danger p-1.5" title="Remover grupo">
            <IcTrash width={18} height={18} />
          </button>
        </div>
      </div>

      {aberto && (
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-ink-3 bg-[#FAFAFB]">
              <span className="w-5 shrink-0" />
              <span className="w-44 shrink-0">Item</span>
              <span className="flex-1 min-w-[240px]">Descrição</span>
              <span className="w-60 shrink-0">Fornecedor</span>
              {verFinanceiro && <span className="w-28 shrink-0 text-right">Pólobh</span>}
              {verFinanceiro && <span className="w-28 shrink-0 text-right">Cliente</span>}
              <span className="w-24 shrink-0">Aprov.</span>
              <span className="w-24 shrink-0">OS</span>
              <span className="w-28 shrink-0">Contrato</span>
              <span className="w-7 shrink-0" />
            </div>

            <SortableContext items={g.itens.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {g.itens.map((l) => (
                <ItemRow
                  key={l.id}
                  l={l}
                  verFinanceiro={verFinanceiro}
                  fornecedores={fornecedores}
                  onUpd={(patch) => onUpdLinha(l.id, patch)}
                  onDel={() => onDelItem(l)}
                  onValidarFornecedor={onValidarFornecedor}
                />
              ))}
            </SortableContext>

            <div className="px-3 py-2.5">
              <Button variant="secondary" size="sm" icon={<IcPlus width={15} height={15} />} onClick={onAddItem}>
                Adicionar item ao grupo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Item ------------------------------ */

interface ItemProps {
  l: EcLinha;
  verFinanceiro: boolean;
  fornecedores: Fornecedor[];
  onUpd: (patch: Partial<EcLinha>) => void;
  onDel: () => void;
  onValidarFornecedor: (cnpj: string) => Promise<string | null>;
}

function ItemRow({ l, verFinanceiro, fornecedores, onUpd, onDel, onValidarFornecedor }: ItemProps) {
  const sortable = useSortable({ id: l.id });
  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cx(
        "flex items-start gap-2 px-3 py-2.5 border-b border-border-soft bg-white",
        sortable.isDragging && "opacity-40"
      )}
    >
      <button
        ref={sortable.setActivatorNodeRef}
        {...sortable.listeners}
        {...sortable.attributes}
        className="cursor-grab active:cursor-grabbing text-ink-3 hover:text-ink shrink-0 mt-2 touch-none"
        title="Arraste para reordenar / mover de grupo"
      >
        <IcGrip width={18} height={18} />
      </button>
      <div className="w-44 shrink-0">
        <Input className="!h-10 !px-2.5 !text-[13.5px]" placeholder="Item" value={l.item} onChange={(e) => onUpd({ item: e.target.value })} />
      </div>
      <div className="flex-1 min-w-[240px]">
        <AutoTextarea className="!text-[13.5px]" placeholder="Descrição" value={l.descricao} onChange={(e) => onUpd({ descricao: e.target.value })} />
      </div>
      <div className="w-60 shrink-0">
        <FornecedorField
          razao={l.fornecedorRazao}
          cnpj={l.fornecedorCnpj}
          contato={l.fornecedorContato}
          fornecedores={fornecedores}
          datalistId={DATALIST_ID}
          onChange={onUpd}
          onValidar={onValidarFornecedor}
        />
      </div>
      {verFinanceiro && (
        <div className="w-28 shrink-0">
          <NumberInput className="!h-10 !px-2.5 !text-[13.5px]" value={l.valorPolobh} onValue={(v) => onUpd({ valorPolobh: v })} />
        </div>
      )}
      {verFinanceiro && (
        <div className="w-28 shrink-0">
          <NumberInput className="!h-10 !px-2.5 !text-[13.5px]" value={l.valorCliente} onValue={(v) => onUpd({ valorCliente: v })} />
        </div>
      )}
      <div className="w-24 shrink-0">
        <Select className="!h-10 !px-2 !text-[13px]" value={l.statusAprovacao} onChange={(e) => onUpd({ statusAprovacao: e.target.value as StatusAprovacao })}>
          <option>Pendente</option>
          <option>OK</option>
        </Select>
      </div>
      <div className="w-24 shrink-0">
        <Select className="!h-10 !px-2 !text-[13px]" value={l.statusOs} onChange={(e) => onUpd({ statusOs: e.target.value as StatusOs })}>
          <option>Pendente</option>
          <option>Emitir</option>
          <option>OK</option>
        </Select>
      </div>
      <div className="w-28 shrink-0">
        <Input className="!h-10 !px-2.5 !text-[13.5px]" placeholder="Nº/ref." value={l.contrato} onChange={(e) => onUpd({ contrato: e.target.value })} />
      </div>
      <button onClick={onDel} className="text-ink-3 hover:text-danger p-1.5 shrink-0 mt-1.5" title="Remover linha">
        <IcTrash width={18} height={18} />
      </button>
    </div>
  );
}
