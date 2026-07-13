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
import { IcGrip, IcChevron, IcPlus, IcTrash, IcEye, IcEyeOff, IcSpark } from "@/components/icons";
import { FornecedorField } from "@/components/FornecedorField";
import { RichTextField } from "@/components/RichTextField";
import { ObservacoesInline } from "@/components/ObservacoesPopup";
import { ResumoPropostaModal } from "@/components/ResumoPropostaModal";
import { flags } from "@/lib/flags";
import { brl, cx, onlyDigits, maskCpfCnpjInput } from "@/lib/format";
import { confirmar } from "@/store/confirm";
import type { EcLinha, Fornecedor, Observacao, StatusAprovacao, StatusOs } from "@/data/types";

interface Grupo {
  id: string;
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
  return ordem.map((nome, indice) => {
    const itens = map.get(nome)!;
    return {
      // O nome do grupo é editável e não pode ser usado como identidade do
      // componente: isso desmontava o card (e seus inputs) a cada caractere.
      id: `grupo-${itens[0]?.id || indice}`,
      nome,
      itens,
    };
  });
}

/** Achata os grupos de volta num array de linhas, reatribuindo grupo e ordem. */
function achatar(grupos: Grupo[]): EcLinha[] {
  const out: EcLinha[] = [];
  grupos.forEach((g) => g.itens.forEach((it) => out.push({ ...it, grupo: g.nome, ordem: out.length })));
  return out;
}

const GID = (id: string) => `G:${id}`; // id sortable estável do grupo
const CID = (id: string) => `C:${id}`; // id droppable estável do grupo
const ehGrupoId = (id: string) => id.startsWith("G:") || id.startsWith("C:");
const chaveDoId = (id: string) => id.slice(2);

const grupoDoId = (grupos: Grupo[], id: string) =>
  grupos.find((grupo) => grupo.id === chaveDoId(id));

let seq = 0;
function novaLinhaBase(): EcLinha {
  seq += 1;
  return {
    id: `nl-${Date.now()}-${seq}`,
    grupo: "GERAL",
    item: "",
    descricao: "",
    descricaoCompleta: "",
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
    contratoStatus: "Pendente",
    observacao: "",
    observacoes: [],
    oculto: false,
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
  /** Nomes dos usuários do sistema (para atribuir observações). */
  usuarios: string[];
  onValidarFornecedor: (cnpj: string) => Promise<string | null>;
  onRevisarESalvar: (linhaId: string) => Promise<boolean>;
}

const DATALIST_ID = "ec-fornecedores-cnpj";

export function EcGrupos({ linhas, onChange, verFinanceiro, fornecedores, usuarios, onValidarFornecedor, onRevisarESalvar }: Props) {
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
    const propSig = JSON.stringify(linhas);
    const curSig = JSON.stringify(achatar(grupos));
    if (propSig !== curSig) setGrupos(agrupar(linhas));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const isExp = (id: string) => expandido[id] ?? false;
  const toggle = (id: string) => setExpandido((e) => ({ ...e, [id]: !(e[id] ?? false) }));
  const expandirTodos = (v: boolean) => setExpandido(Object.fromEntries(grupos.map((g) => [g.id, v])));

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
  };

  const addItem = (grupoNome: string) => {
    commit(grupos.map((g) => (g.nome === grupoNome ? { ...g, itens: [...g.itens, { ...novaLinhaBase(), grupo: grupoNome }] } : g)));
    const grupoId = grupos.find((g) => g.nome === grupoNome)?.id;
    if (grupoId) setExpandido((e) => ({ ...e, [grupoId]: true }));
  };

  const addGrupo = () => {
    const nome = nomeGrupoUnico("NOVO GRUPO", grupos);
    const linha = { ...novaLinhaBase(), grupo: nome };
    const id = `grupo-${linha.id}`;
    commit([...grupos, { id, nome, itens: [linha] }]);
    setExpandido((e) => ({ ...e, [id]: true }));
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

  /** Oculta/reexibe um item. */
  const setOcultoItem = (id: string, oculto: boolean) => updLinha(id, { oculto });
  /** Oculta/reexibe o grupo inteiro (todos os itens). */
  const setOcultoGrupo = (grupoNome: string, oculto: boolean) =>
    commit(grupos.map((g) => (g.nome === grupoNome ? { ...g, itens: g.itens.map((it) => ({ ...it, oculto })) } : g)));

  /* ------------------------- drag & drop ------------------------- */
  const onDragStart = (e: DragStartEvent) => {
    arrastandoRef.current = true;
    const id = String(e.active.id);
    if (ehGrupoId(id)) setAtivo({ tipo: "grupo", chave: chaveDoId(id) });
    else setAtivo({ tipo: "item", chave: id });
  };

  // Move o item entre grupos ao vivo (permite a animação de "abrir espaço").
  const onDragOver = (e: DragOverEvent) => {
    const activeId = String(e.active.id);
    if (ehGrupoId(activeId) || !e.over) return; // reordenar grupo é tratado no fim
    const overId = String(e.over.id);
    const atual = gruposRef.current;
    const from = containerDoItem(atual, activeId);
    const to = ehGrupoId(overId) ? grupoDoId(atual, overId)?.nome : containerDoItem(atual, overId);
    if (!from || !to || from === to) return;
    const gs = atual.map((g) => ({ id: g.id, nome: g.nome, itens: [...g.itens] }));
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
      const fromGrupo = grupoDoId(atual, activeId);
      const toNome = ehGrupoId(overId) ? grupoDoId(atual, overId)?.nome : containerDoItem(atual, overId);
      if (toNome && fromGrupo && fromGrupo.nome !== toNome) {
        const oldIndex = atual.findIndex((g) => g.id === fromGrupo.id);
        const newIndex = atual.findIndex((g) => g.nome === toNome);
        commit(arrayMove(atual, oldIndex, newIndex));
        return;
      }
      commit(atual);
      return;
    }
    // Reordenar item dentro do mesmo grupo (cross-group já ocorreu no onDragOver)
    const cont = containerDoItem(atual, activeId);
    const alvoCont = ehGrupoId(overId) ? grupoDoId(atual, overId)?.nome : containerDoItem(atual, overId);
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
  const grupoAtivo = ativo?.tipo === "grupo" ? grupos.find((g) => g.id === ativo.chave) : undefined;

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
        <SortableContext items={grupos.map((g) => GID(g.id))} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {grupos.map((g) => (
              <GrupoCard
                key={g.id}
                g={g}
                aberto={isExp(g.id)}
                verFinanceiro={verFinanceiro}
                fornecedores={fornecedores}
                usuarios={usuarios}
                onToggle={() => toggle(g.id)}
                onRenomear={(v) => renomearGrupo(g.nome, v)}
                onAddItem={() => addItem(g.nome)}
                onDelGrupo={() => delGrupo(g)}
                onUpdLinha={updLinha}
                onDelItem={delItem}
                onOcultoItem={setOcultoItem}
                onOcultoGrupo={(v) => setOcultoGrupo(g.nome, v)}
                onValidarFornecedor={onValidarFornecedor}
                onRevisarESalvar={onRevisarESalvar}
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
  usuarios: string[];
  onToggle: () => void;
  onRenomear: (v: string) => void;
  onAddItem: () => void;
  onDelGrupo: () => void;
  onUpdLinha: (id: string, patch: Partial<EcLinha>) => void;
  onDelItem: (l: EcLinha) => void;
  onOcultoItem: (id: string, oculto: boolean) => void;
  onOcultoGrupo: (oculto: boolean) => void;
  onValidarFornecedor: (cnpj: string) => Promise<string | null>;
  onRevisarESalvar: (linhaId: string) => Promise<boolean>;
}

function GrupoCard({
  g, aberto, verFinanceiro, fornecedores, usuarios,
  onToggle, onRenomear, onAddItem, onDelGrupo, onUpdLinha, onDelItem, onOcultoItem, onOcultoGrupo, onValidarFornecedor, onRevisarESalvar,
}: GrupoProps) {
  const sortable = useSortable({ id: GID(g.id) });
  const droppable = useDroppable({ id: CID(g.id) });
  const [verOcultos, setVerOcultos] = useState(false);
  const setRefs = (node: HTMLElement | null) => {
    sortable.setNodeRef(node);
    droppable.setNodeRef(node);
  };
  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };

  const visiveis = g.itens.filter((l) => !l.oculto);
  const ocultos = g.itens.filter((l) => l.oculto);
  const grupoOculto = g.itens.length > 0 && visiveis.length === 0;
  const subtotal = visiveis.reduce((s, l) => s + (l.valorPolobh || 0) + (l.valorCliente || 0), 0);

  return (
    <div
      ref={setRefs}
      style={style}
      className={cx(
        "rounded-card border bg-white",
        sortable.isDragging ? "opacity-40" : "border-border",
        grupoOculto && "opacity-70",
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
          {visiveis.length} {visiveis.length === 1 ? "item" : "itens"}
        </span>
        {grupoOculto && <span className="shrink-0 text-[11px] font-extrabold text-ink-3 bg-[#F0F1F4] rounded-pill px-2 py-0.5 uppercase">Oculto</span>}
        {verFinanceiro && subtotal > 0 && (
          <span className="shrink-0 text-[14px] font-display font-bold text-ink-2">{brl(subtotal)}</span>
        )}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onOcultoGrupo(!grupoOculto)}
            className="inline-flex items-center gap-1.5 rounded-btn px-2 py-1.5 text-[12px] font-bold text-ink-3 hover:bg-primary-soft hover:text-primary-dark"
            title={grupoOculto ? "Reexibir grupo" : "Ocultar grupo (mantém guardado)"}
          >
            {grupoOculto ? <IcEye width={17} height={17} /> : <IcEyeOff width={17} height={17} />}
            {grupoOculto ? "Reexibir grupo" : "Ocultar grupo"}
          </button>
          <Button variant="soft" size="sm" icon={<IcPlus width={15} height={15} />} onClick={onAddItem}>
            Item
          </Button>
          <button onClick={onDelGrupo} className="text-ink-3 hover:text-danger p-1.5" title="Remover grupo">
            <IcTrash width={18} height={18} />
          </button>
        </div>
      </div>

      {aberto && (
        <div className="p-3 space-y-2.5">
          <SortableContext items={visiveis.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {visiveis.map((l) => (
              <ItemRow
                key={l.id}
                l={l}
                verFinanceiro={verFinanceiro}
                fornecedores={fornecedores}
                usuarios={usuarios}
                onUpd={(patch) => onUpdLinha(l.id, patch)}
                onDel={() => onDelItem(l)}
                onOcultar={() => onOcultoItem(l.id, true)}
                onValidarFornecedor={onValidarFornecedor}
                onRevisarESalvar={onRevisarESalvar}
              />
            ))}
          </SortableContext>

          {visiveis.length === 0 && !grupoOculto && (
            <div className="text-center text-ink-3 text-[13px] py-4">Nenhum item visível neste grupo.</div>
          )}

          {/* Itens ocultos guardados */}
          {ocultos.length > 0 && (
            <div className="rounded-btn border border-dashed border-border bg-[#FAFAFB]">
              <button onClick={() => setVerOcultos((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] font-bold text-ink-2 hover:text-ink">
                <IcChevron width={16} height={16} className={cx("transition-transform", verOcultos && "rotate-90")} />
                Itens ocultos ({ocultos.length})
                <span className="text-ink-3 font-medium">— guardados, fora dos totais e do Excel</span>
              </button>
              {verOcultos && (
                <div className="px-3 pb-2.5 space-y-1.5">
                  {ocultos.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 rounded-btn bg-white border border-border-soft px-2.5 py-1.5">
                      <span className="flex-1 min-w-0 truncate text-[13px] text-ink-2">{l.item || l.descricao || "(item sem título)"}</span>
                      <button type="button" onClick={() => onOcultoItem(l.id, false)} className="inline-flex items-center gap-1 rounded-btn px-2 py-1 text-[12px] font-bold text-ink-3 hover:bg-primary-soft hover:text-primary-dark" title="Reexibir item">
                        <IcEye width={16} height={16} /> Reexibir
                      </button>
                      <button onClick={() => onDelItem(l)} className="text-ink-3 hover:text-danger p-1" title="Remover item">
                        <IcTrash width={16} height={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-0.5">
            <Button variant="secondary" size="sm" icon={<IcPlus width={15} height={15} />} onClick={onAddItem}>
              Adicionar item ao grupo
            </Button>
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
  usuarios: string[];
  onUpd: (patch: Partial<EcLinha>) => void;
  onDel: () => void;
  onOcultar: () => void;
  onValidarFornecedor: (cnpj: string) => Promise<string | null>;
  onRevisarESalvar: (linhaId: string) => Promise<boolean>;
}

function ItemRow({ l, verFinanceiro, fornecedores, usuarios, onUpd, onDel, onOcultar, onValidarFornecedor, onRevisarESalvar }: ItemProps) {
  const sortable = useSortable({ id: l.id });
  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };
  const [resumoAberto, setResumoAberto] = useState(false);
  const [revisando, setRevisando] = useState(false);

  const inserirResumo = (html: string) => {
    if (!html) return;
    onUpd({ descricaoCompleta: l.descricaoCompleta ? `${l.descricaoCompleta}${html}` : html });
  };

  const revisarESalvar = async () => {
    setRevisando(true);
    try {
      const botoesAntes = [...document.querySelectorAll<HTMLButtonElement>("[data-revisar-item]")];
      const posicaoAtual = botoesAntes.findIndex((botao) => botao.dataset.linhaId === l.id);
      const ok = await onRevisarESalvar(l.id);
      if (!ok) return;
      const botoes = [...document.querySelectorAll<HTMLButtonElement>("[data-revisar-item]")];
      const proximo = botoes[posicaoAtual + 1];
      proximo?.scrollIntoView({ behavior: "smooth", block: "center" });
      proximo?.focus();
    } finally {
      setRevisando(false);
    }
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cx(
        "rounded-card border border-border bg-white",
        sortable.isDragging && "opacity-40"
      )}
    >
      {/* Linha 1: item + descrições + valores */}
      <div className="flex items-start gap-2 p-2.5">
        <button
          ref={sortable.setActivatorNodeRef}
          {...sortable.listeners}
          {...sortable.attributes}
          className="cursor-grab active:cursor-grabbing text-ink-3 hover:text-ink shrink-0 mt-2 touch-none"
          title="Arraste para reordenar / mover de grupo"
        >
          <IcGrip width={18} height={18} />
        </button>

        <div className="w-52 shrink-0">
          <Campo label="Item">
            <Input className="!h-10 !px-2.5 !text-[13.5px] !font-semibold" placeholder="Nome do item" value={l.item} onChange={(e) => onUpd({ item: e.target.value })} />
          </Campo>
        </div>

        <div className="flex-1 min-w-[280px] grid gap-2">
          <Campo label="Descrição Financeiro">
            <AutoTextarea
              className="!text-[13px] whitespace-pre-wrap"
              placeholder="Descrição do item — use Enter para criar parágrafos"
              value={l.descricao}
              rows={3}
              lang="pt-BR"
              spellCheck
              autoCapitalize="sentences"
              autoCorrect="on"
              onChange={(e) => onUpd({ descricao: e.target.value })}
            />
          </Campo>
          <Campo label="Descrição Completa">
            <RichTextField
              value={l.descricaoCompleta}
              onChange={(html) => onUpd({ descricaoCompleta: html })}
              placeholder="Detalhamento completo (bullets, negrito)…"
              toolbarExtra={
                flags.resumoIA ? (
                  <button
                    type="button"
                    onClick={() => setResumoAberto(true)}
                    title="Resumo da Proposta com IA"
                    className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11.5px] font-extrabold text-primary-dark bg-primary-soft hover:bg-active-border"
                  >
                    <IcSpark width={13} height={13} /> Resumo da Proposta
                  </button>
                ) : undefined
              }
            />
          </Campo>
        </div>

        {verFinanceiro && (
          <div className="shrink-0 flex gap-2">
            <Campo label="Pólobh" className="w-28">
              <NumberInput className="!h-10 !px-2.5 !text-[13.5px]" value={l.valorPolobh} onValue={(v) => onUpd({ valorPolobh: v })} />
            </Campo>
            <Campo label="Cliente" className="w-28">
              <NumberInput className="!h-10 !px-2.5 !text-[13.5px]" value={l.valorCliente} onValue={(v) => onUpd({ valorCliente: v })} />
            </Campo>
          </div>
        )}

        <div className="shrink-0 flex flex-col items-center gap-1 pt-5">
          <button type="button" onClick={onOcultar} className="text-ink-3 hover:text-primary p-1.5" title="Ocultar item (mantém guardado)" aria-label="Ocultar item">
            <IcEyeOff width={18} height={18} />
          </button>
          <button onClick={onDel} className="text-ink-3 hover:text-danger p-1.5" title="Remover linha">
            <IcTrash width={18} height={18} />
          </button>
        </div>
      </div>

      {/* Linha 2: metadados */}
      <div className="flex flex-wrap items-end gap-2 px-2.5 pb-2.5 pt-1 border-t border-border-soft bg-[#FCFCFD] rounded-b-card">
        <Campo label="Aprovação" className="w-28">
          <Select className="!h-9 !px-2 !text-[12.5px]" value={l.statusAprovacao} onChange={(e) => onUpd({ statusAprovacao: e.target.value as StatusAprovacao })}>
            <option>Pendente</option>
            <option>OK</option>
          </Select>
        </Campo>
        <Campo label="Fornecedor (CNPJ / Razão social)" className="w-[420px] max-w-full">
          <FornecedorField
            razao={l.fornecedorRazao}
            cnpj={l.fornecedorCnpj}
            fornecedores={fornecedores}
            datalistId={DATALIST_ID}
            onChange={onUpd}
            onValidar={onValidarFornecedor}
          />
        </Campo>
        <Campo label="Fatura ou Nota Fiscal" className="w-36">
          <Input className="!h-9 !px-2 !text-[12.5px]" value={l.faturaNf} onChange={(e) => onUpd({ faturaNf: e.target.value })} />
        </Campo>
        <Campo label="Código de Serviço" className="w-32">
          <Input className="!h-9 !px-2 !text-[12.5px]" value={l.codigoServico} onChange={(e) => onUpd({ codigoServico: e.target.value })} />
        </Campo>
        <Campo label="Pedido de Compra" className="w-32">
          <Input className="!h-9 !px-2 !text-[12.5px]" value={l.pedidoCompra} onChange={(e) => onUpd({ pedidoCompra: e.target.value })} />
        </Campo>
        <Campo label="OS" className="w-24">
          <Select className="!h-9 !px-2 !text-[12.5px]" value={l.statusOs} onChange={(e) => onUpd({ statusOs: e.target.value as StatusOs })}>
            <option>Pendente</option>
            <option>Emitir</option>
            <option>OK</option>
          </Select>
        </Campo>
        <Campo label="Contrato" className="w-24">
          <Select className="!h-9 !px-2 !text-[12.5px]" value={l.contratoStatus} onChange={(e) => onUpd({ contratoStatus: e.target.value as StatusAprovacao })}>
            <option>Pendente</option>
            <option>OK</option>
          </Select>
        </Campo>
        <Campo label="Contrato (nº)" className="w-28">
          <Input className="!h-9 !px-2 !text-[12.5px]" placeholder="ref." value={l.contrato} onChange={(e) => onUpd({ contrato: e.target.value })} />
        </Campo>
        <Button
          type="button"
          variant="soft"
          size="sm"
          data-revisar-item
          data-linha-id={l.id}
          icon={<IcSpark width={15} height={15} />}
          disabled={revisando}
          onClick={() => void revisarESalvar()}
        >
          {revisando ? "Revisando…" : "Revisar e salvar"}
        </Button>
      </div>

      <ObservacoesInline
        observacoes={l.observacoes}
        usuarios={usuarios}
        onChange={(obs: Observacao[]) => onUpd({ observacoes: obs })}
      />

      {resumoAberto && <ResumoPropostaModal onInserir={inserirResumo} onClose={() => setResumoAberto(false)} />}
    </div>
  );
}

/** Rótulo pequeno acima de um campo. */
function Campo({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cx("block", className)}>
      <span className="block text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-ink-3 mb-1 truncate">{label}</span>
      {children}
    </label>
  );
}
