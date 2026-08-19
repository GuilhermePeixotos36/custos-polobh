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
import { Input, AutoTextarea, Select, CurrencyInput, Button } from "@/components/ui";
import { IcGrip, IcChevron, IcPlus, IcEye, IcEyeOff, IcSpark, IcCheck } from "@/components/icons";
import { FornecedorField } from "@/components/FornecedorField";
import { RichTextField } from "@/components/RichTextField";
import { ObservacoesThread } from "@/components/ObservacoesPopup";
import { ResumoPropostaModal } from "@/components/ResumoPropostaModal";
import { NotifDot } from "@/components/NotifDot";
import { MoverSetas } from "@/components/MoverSetas";
import { idAncoraPendencia } from "@/components/NavegadorPendencias";
import { destacarElemento, seguirElemento, idGrupoEc } from "@/lib/destaque";
import { flags } from "@/lib/flags";
import { brl, cx } from "@/lib/format";
import type { DocumentoPg, EcLinha, Fornecedor, Observacao, StatusAprovacao, StatusOs } from "@/data/types";

/** Opções de status de OS e de Contrato — a mesma lista nos dois campos. */
const OPCOES_STATUS_OS: StatusOs[] = ["Pendente", "Emitir", "Emitir Nova Versão", "OK", "Não se Aplica"];

const OPCOES_STATUS_TEXTO = ["Pendente", "Não se Aplica"];
const OPCOES_SELECT_TEXTO = [
  { valor: "Pendente", rotulo: "Pendente" },
  { valor: "Não se Aplica", rotulo: "Não se Aplica" },
  { valor: "outro", rotulo: "Outro (preencher)" },
];
// Mesma seta usada no <Select> padrão (ver ui/Field.tsx), reaproveitada aqui como imagem de fundo.
const SETA_SELECT_ESTILO = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236A6E78' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundPosition: "right 8px center",
};

/**
 * Select (Pendente/Não se Aplica) com opção "Outro" que transforma o próprio campo
 * em texto livre (fundo cinza), em vez de abrir um segundo campo abaixo. A seta
 * continua clicável para reabrir a lista e trocar de opção.
 */
function SelectComTexto({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [modoOutro, setModoOutro] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const personalizado = value !== "" && !OPCOES_STATUS_TEXTO.includes(value);
  const emOutro = modoOutro || personalizado;

  useEffect(() => {
    if (value && OPCOES_STATUS_TEXTO.includes(value)) setModoOutro(false);
  }, [value]);

  function escolher(opcao: string) {
    setMenuAberto(false);
    if (opcao === "outro") {
      setModoOutro(true);
      if (!personalizado) onChange("");
    } else {
      setModoOutro(false);
      onChange(opcao);
    }
  }

  return (
    <div className="relative">
      {emOutro ? (
        <Input
          autoFocus={modoOutro && !personalizado}
          className={cx("!h-9 !pl-2 !pr-7 !text-[12.5px] !bg-[#EDEEF1]", className)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Outro (preencher)"
        />
      ) : (
        <button
          type="button"
          onClick={() => setMenuAberto((v) => !v)}
          style={SETA_SELECT_ESTILO}
          className={cx(
            "!h-9 w-full appearance-none bg-no-repeat bg-surface border-[1.5px] border-[#BFC4CE] rounded-btn pl-2 pr-7 text-[12.5px] text-left truncate",
            value ? "text-ink" : "text-ink-3",
            className,
          )}
        >
          {value || "Selecione…"}
        </button>
      )}
      {emOutro && (
        <button
          type="button"
          onClick={() => setMenuAberto((v) => !v)}
          style={SETA_SELECT_ESTILO}
          aria-label="Alterar opção"
          title="Clique para escolher outra opção"
          className="absolute right-0 top-0 h-9 w-7 bg-no-repeat"
        />
      )}
      {menuAberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuAberto(false)} />
          <div className="absolute left-0 right-0 mt-1 z-50 min-w-[140px] rounded-btn border border-border bg-white shadow-2xl py-1">
            {OPCOES_SELECT_TEXTO.map((o) => (
              <button
                key={o.valor}
                type="button"
                onClick={() => escolher(o.valor)}
                className="block w-full text-left px-3 py-1.5 text-[12.5px] text-ink hover:bg-primary-soft"
              >
                {o.rotulo}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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
}

export function EcGrupos({ linhas, onChange, verFinanceiro, fornecedores, usuarios, onValidarFornecedor }: Props) {
  const [grupos, setGrupos] = useState<Grupo[]>(() => agrupar(linhas));
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
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
    const nova = { ...novaLinhaBase(), grupo: grupoNome };
    commit(grupos.map((g) => (g.nome === grupoNome ? { ...g, itens: [...g.itens, nova] } : g)));
    const grupoId = grupos.find((g) => g.nome === grupoNome)?.id;
    if (grupoId) setExpandido((e) => ({ ...e, [grupoId]: true }));
    // O item entra no fim do grupo, quase sempre fora da tela numa EC longa.
    destacarElemento(idAncoraPendencia(nova.id));
  };

  const addGrupo = () => {
    const nome = nomeGrupoUnico("NOVO GRUPO", grupos);
    const linha = { ...novaLinhaBase(), grupo: nome };
    const id = `grupo-${linha.id}`;
    commit([...grupos, { id, nome, itens: [linha] }]);
    setExpandido((e) => ({ ...e, [id]: true }));
    destacarElemento(idGrupoEc(id));
  };

  /**
   * Move um item uma posição para cima ou para baixo.
   *
   * Dentro do grupo, a troca é com o VIZINHO VISÍVEL — itens ocultos ficam no
   * meio do array e, se entrassem na conta, a seta pareceria não fazer nada.
   * Chegando à borda, o item PASSA PARA O GRUPO SEGUINTE: descendo, entra no
   * topo do grupo de baixo; subindo, no fim do grupo de cima. Assim dá para
   * atravessar a EC inteira só com as setas, sem precisar arrastar.
   *
   * Exceção: o ÚLTIMO item de um grupo não sai. Os grupos existem apenas como
   * agrupamento das linhas (ver `agrupar`/`achatar`), então um grupo sem nenhuma
   * linha não tem como ser reconstruído e o nome dele se perderia ao recarregar.
   */
  const moverItem = (grupoId: string, itemId: string, direcao: -1 | 1) => {
    const iGrupo = grupos.findIndex((g) => g.id === grupoId);
    if (iGrupo < 0) return;
    const grupo = grupos[iGrupo];
    const atual = grupo.itens.findIndex((i) => i.id === itemId);
    if (atual < 0) return;

    let vizinho = atual + direcao;
    while (vizinho >= 0 && vizinho < grupo.itens.length && grupo.itens[vizinho].oculto) vizinho += direcao;

    if (vizinho >= 0 && vizinho < grupo.itens.length) {
      const itens = [...grupo.itens];
      [itens[atual], itens[vizinho]] = [itens[vizinho], itens[atual]];
      commit(grupos.map((g, i) => (i === iGrupo ? { ...g, itens } : g)));
    } else {
      // Tirar o único item apagaria o grupo — a seta já vem desligada nesse caso,
      // e aqui a regra fica garantida também por código.
      if (grupo.itens.length <= 1) return;
      const iDestino = iGrupo + direcao;
      if (iDestino < 0 || iDestino >= grupos.length) return;
      const destino = grupos[iDestino];
      const movido = { ...grupo.itens[atual], grupo: destino.nome };
      commit(
        grupos.map((g, i) => {
          if (i === iGrupo) return { ...g, itens: g.itens.filter((it) => it.id !== itemId) };
          if (i === iDestino) return { ...g, itens: direcao === 1 ? [movido, ...g.itens] : [...g.itens, movido] };
          return g;
        })
      );
      // Grupo de destino retraído esconderia o item recém-chegado.
      setExpandido((e) => ({ ...e, [destino.id]: true }));
    }
    // A tela acompanha o item — senão ele sai de vista a cada toque na seta.
    seguirElemento(idAncoraPendencia(itemId));
  };

  /* --------------------- seleção em massa (estilo SharePoint) --------------------- */
  const alternarSelecao = (id: string) =>
    setSelecionados((s) => {
      const x = new Set(s);
      x.has(id) ? x.delete(id) : x.add(id);
      return x;
    });
  /** Marca/desmarca de uma vez todos os itens visíveis de um grupo. */
  const alternarSelecaoGrupo = (grupoId: string, marcar: boolean) =>
    setSelecionados((s) => {
      const x = new Set(s);
      const alvo = grupos.find((g) => g.id === grupoId);
      for (const it of alvo?.itens.filter((i) => !i.oculto) ?? []) marcar ? x.add(it.id) : x.delete(it.id);
      return x;
    });
  const limparSelecao = () => setSelecionados(new Set());

  /**
   * Aprova os itens selecionados e, junto, deixa a OS pronta para ser emitida.
   *
   * A OS só é empurrada para "Emitir" quando ainda está "Pendente": itens que já
   * têm OS emitida ("OK"), que já estão marcados para emitir, ou que não geram OS
   * ("Não se Aplica") mantêm o status — aprovar não pode disparar uma segunda OS
   * nem ressuscitar um item declarado fora do fluxo. Os dois campos continuam
   * editáveis um a um no próprio item.
   */
  const aprovarSelecionados = () => {
    commit(
      grupos.map((g) => ({
        ...g,
        itens: g.itens.map((it) =>
          selecionados.has(it.id)
            ? { ...it, statusAprovacao: "OK" as const, statusOs: it.statusOs === "Pendente" ? ("Emitir" as const) : it.statusOs }
            : it
        ),
      }))
    );
    limparSelecao();
  };

  const totalSelecionados = selecionados.size;

  /** Oculta/reexibe um item. */
  const setOcultoItem = (id: string, oculto: boolean) => updLinha(id, { oculto });
  /** Oculta/reexibe o grupo inteiro (todos os itens). */
  const setOcultoGrupo = (grupoNome: string, oculto: boolean) =>
    commit(grupos.map((g) => (g.nome === grupoNome ? { ...g, itens: g.itens.map((it) => ({ ...it, oculto })) } : g)));
  /** Sem custo, sem fornecedor e sem observações (independente de estar oculto ou não). */
  const semConteudo = (it: EcLinha) =>
    it.valorPolobh === 0 && it.valorCliente === 0 && !it.fornecedorRazao.trim() && !it.fornecedorCnpj.trim() && it.observacoes.length === 0;
  /** Não preenchido/alterado E visível — candidato a ocultar em massa. */
  const naoPreenchido = (it: EcLinha) => !it.oculto && semConteudo(it);
  const qtdNaoPreenchidos = grupos.reduce((n, g) => n + g.itens.filter(naoPreenchido).length, 0);
  /** Oculta de uma vez todos os itens ainda não preenchidos/alterados, em todos os grupos. */
  const ocultarNaoPreenchidos = () =>
    commit(grupos.map((g) => ({ ...g, itens: g.itens.map((it) => (naoPreenchido(it) ? { ...it, oculto: true } : it)) })));
  /** Oculto e ainda não preenchido — candidato a reexibir em massa. */
  const ocultoNaoPreenchido = (it: EcLinha) => it.oculto && semConteudo(it);
  const qtdOcultosNaoPreenchidos = grupos.reduce((n, g) => n + g.itens.filter(ocultoNaoPreenchido).length, 0);
  /** Reexibe de uma vez todos os itens ocultos que ainda estão sem custo, fornecedor ou observações. */
  const reexibirNaoPreenchidos = () =>
    commit(grupos.map((g) => ({ ...g, itens: g.itens.map((it) => (ocultoNaoPreenchido(it) ? { ...it, oculto: false } : it)) })));

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
      {/* Barra de ações da seleção: aparece só com itens marcados e acompanha a
          rolagem, para as ações ficarem à mão em EC longa. */}
      {totalSelecionados > 0 && (
        <div className="sticky top-[calc(var(--altura-topnav)+var(--altura-barra-ec))] z-10 flex items-center gap-3 flex-wrap rounded-btn border border-primary bg-primary-soft px-3 py-2 shadow-card">
          <span className="text-[13px] font-extrabold text-primary-dark">
            {totalSelecionados} {totalSelecionados === 1 ? "item selecionado" : "itens selecionados"}
          </span>
          <Button
            size="sm"
            icon={<IcCheck width={15} height={15} />}
            onClick={aprovarSelecionados}
            title="Marca a Aprovação como OK e, nos itens com OS ainda Pendente, muda a OS para Emitir"
          >
            Aprovar e liberar OS
          </Button>
          <button type="button" onClick={limparSelecao} className="ml-auto text-[12.5px] font-bold text-ink-2 hover:text-ink">
            Limpar seleção
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="secondary" size="sm" icon={<IcPlus width={16} height={16} />} onClick={addGrupo}>
          Adicionar grupo
        </Button>
        <div className="flex items-center gap-3 text-[13px] font-bold text-ink-2">
          {qtdNaoPreenchidos > 0 && (
            <>
              <button onClick={ocultarNaoPreenchidos} className="hover:text-ink" title="Oculta de uma vez todos os itens sem custo, fornecedor ou observações">
                Ocultar não preenchidos ({qtdNaoPreenchidos})
              </button>
              <span className="text-border">|</span>
            </>
          )}
          {qtdOcultosNaoPreenchidos > 0 && (
            <>
              <button onClick={reexibirNaoPreenchidos} className="hover:text-ink" title="Reexibe de uma vez todos os itens ocultos que ainda estão sem custo, fornecedor ou observações">
                Reexibir não preenchidos ({qtdOcultosNaoPreenchidos})
              </button>
              <span className="text-border">|</span>
            </>
          )}
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
            {grupos.map((g, iGrupo) => (
              <GrupoCard
                key={g.id}
                g={g}
                aberto={isExp(g.id)}
                primeiroGrupo={iGrupo === 0}
                ultimoGrupo={iGrupo === grupos.length - 1}
                verFinanceiro={verFinanceiro}
                fornecedores={fornecedores}
                usuarios={usuarios}
                selecionados={selecionados}
                onToggle={() => toggle(g.id)}
                onRenomear={(v) => renomearGrupo(g.nome, v)}
                onAddItem={() => addItem(g.nome)}
                onUpdLinha={updLinha}
                onOcultoItem={setOcultoItem}
                onOcultoGrupo={(v) => setOcultoGrupo(g.nome, v)}
                onSelecionarItem={alternarSelecao}
                onSelecionarGrupo={(marcar) => alternarSelecaoGrupo(g.id, marcar)}
                onMoverItem={(itemId, direcao) => moverItem(g.id, itemId, direcao)}
                onValidarFornecedor={onValidarFornecedor}              />
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
  /** Bordas da EC: só nelas as setas do item ficam desligadas. */
  primeiroGrupo: boolean;
  ultimoGrupo: boolean;
  verFinanceiro: boolean;
  fornecedores: Fornecedor[];
  usuarios: string[];
  selecionados: Set<string>;
  onToggle: () => void;
  onRenomear: (v: string) => void;
  onAddItem: () => void;
  onUpdLinha: (id: string, patch: Partial<EcLinha>) => void;
  onOcultoItem: (id: string, oculto: boolean) => void;
  onOcultoGrupo: (oculto: boolean) => void;
  onSelecionarItem: (id: string) => void;
  onSelecionarGrupo: (marcar: boolean) => void;
  onMoverItem: (itemId: string, direcao: -1 | 1) => void;
  onValidarFornecedor: (cnpj: string) => Promise<string | null>;
}

function GrupoCard({
  g, aberto, primeiroGrupo, ultimoGrupo, verFinanceiro, fornecedores, usuarios, selecionados,
  onToggle, onRenomear, onAddItem, onUpdLinha, onOcultoItem, onOcultoGrupo,
  onSelecionarItem, onSelecionarGrupo, onMoverItem, onValidarFornecedor,
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
  const marcadosNoGrupo = visiveis.filter((l) => selecionados.has(l.id)).length;
  const todosMarcados = visiveis.length > 0 && marcadosNoGrupo === visiveis.length;
  // Conta os itens TODOS (inclusive ocultos): o grupo sobrevive enquanto tiver
  // alguma linha, mesmo que nenhuma esteja visível.
  const itemUnico = g.itens.length === 1;

  return (
    <div
      ref={setRefs}
      style={style}
      id={idGrupoEc(g.id)}
      className={cx(
        "rounded-card border bg-white",
        sortable.isDragging ? "opacity-40" : "border-border",
        grupoOculto && "opacity-70",
        droppable.isOver && !sortable.isDragging && "ring-2 ring-primary/40 border-primary"
      )}
    >
      <div className={cx("flex items-center gap-2 px-3 py-3", aberto && "border-b border-border-soft")}>
        {/* Marca de uma vez todos os itens visíveis do grupo. */}
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-[#F2820D] cursor-pointer"
          checked={todosMarcados}
          ref={(el) => { if (el) el.indeterminate = marcadosNoGrupo > 0 && !todosMarcados; }}
          onChange={(e) => onSelecionarGrupo(e.target.checked)}
          disabled={visiveis.length === 0}
          aria-label={`Selecionar todos os itens de ${g.nome}`}
          title="Selecionar todos os itens deste grupo"
        />
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
            className="inline-flex items-center rounded-btn p-1.5 text-ink-3 hover:bg-primary-soft hover:text-primary-dark"
            title={grupoOculto ? "Reexibir grupo" : "Ocultar grupo (mantém guardado)"}
            aria-label={grupoOculto ? "Reexibir grupo" : "Ocultar grupo"}
          >
            {grupoOculto ? <IcEye width={17} height={17} /> : <IcEyeOff width={17} height={17} />}
          </button>
          <Button variant="soft" size="sm" icon={<IcPlus width={15} height={15} />} onClick={onAddItem}>
            Item
          </Button>
        </div>
      </div>

      {aberto && (
        <div className="p-3 space-y-2.5">
          <SortableContext items={visiveis.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {visiveis.map((l, indice) => (
              <ItemRow
                key={l.id}
                l={l}
                verFinanceiro={verFinanceiro}
                fornecedores={fornecedores}
                usuarios={usuarios}
                selecionado={selecionados.has(l.id)}
                // Na borda de um grupo do meio a seta continua ativa: ela leva o
                // item para o grupo vizinho. Só trava nas pontas da EC ou quando
                // o item é o único do grupo (sair apagaria o grupo).
                primeiro={indice === 0 && (primeiroGrupo || itemUnico)}
                ultimo={indice === visiveis.length - 1 && (ultimoGrupo || itemUnico)}
                motivoBloqueio={itemUnico ? "Único item do grupo — tirá-lo daqui apagaria o grupo" : undefined}
                onUpd={(patch) => onUpdLinha(l.id, patch)}
                onOcultar={() => onOcultoItem(l.id, true)}
                onSelecionar={() => onSelecionarItem(l.id)}
                onMover={(direcao) => onMoverItem(l.id, direcao)}
                onValidarFornecedor={onValidarFornecedor}              />
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
  selecionado: boolean;
  primeiro: boolean;
  ultimo: boolean;
  /** Texto do tooltip quando a seta está apagada por regra, não por estar na ponta. */
  motivoBloqueio?: string;
  onUpd: (patch: Partial<EcLinha>) => void;
  onOcultar: () => void;
  onSelecionar: () => void;
  onMover: (direcao: -1 | 1) => void;
  onValidarFornecedor: (cnpj: string) => Promise<string | null>;
}

function ItemRow({
  l, verFinanceiro, fornecedores, usuarios, selecionado, primeiro, ultimo, motivoBloqueio,
  onUpd, onOcultar, onSelecionar, onMover, onValidarFornecedor,
}: ItemProps) {
  const sortable = useSortable({ id: l.id });
  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };
  const [resumoAberto, setResumoAberto] = useState(false);
  // Pendências do item = observações direcionadas ainda não resolvidas (badge vermelho).
  const pendencias = (l.observacoes ?? []).filter((o) => !o.resolvida && o.texto.trim()).length;

  const inserirResumo = (html: string) => {
    if (!html) return;
    onUpd({ descricaoCompleta: l.descricaoCompleta ? `${l.descricaoCompleta}${html}` : html });
  };

  return (
    <div
      // Âncora do navegador de pendências (pill flutuante que salta entre elas).
      id={idAncoraPendencia(l.id)}
      ref={sortable.setNodeRef}
      style={style}
      className={cx(
        "rounded-card border bg-white",
        selecionado ? "border-primary ring-1 ring-primary/40 bg-primary-soft/30" : "border-border",
        sortable.isDragging && "opacity-40"
      )}
    >
      {/* Linha 1: item + descrições + valores */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] xl:grid-cols-[auto_13rem_minmax(280px,1fr)_auto_auto] items-start gap-2 p-2.5 min-w-0">
        {/* Trilha de controles: seleção, pendências, alça e setas — empilhadas, nunca
            sobrepostas (antes o badge vermelho cobria a alça de arraste). */}
        <div className="flex flex-col items-center gap-1 shrink-0 pt-1.5">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#F2820D] cursor-pointer"
            checked={selecionado}
            onChange={onSelecionar}
            aria-label={`Selecionar item ${l.item || "sem título"}`}
            title="Selecionar item para ações em bloco"
          />
          <NotifDot inline n={pendencias} title={`${pendencias} pendência(s) neste item`} />
          <button
            ref={sortable.setActivatorNodeRef}
            {...sortable.listeners}
            {...sortable.attributes}
            className="cursor-grab active:cursor-grabbing text-ink-3 hover:text-ink touch-none"
            title="Arraste para reordenar / mover de grupo"
            aria-label={`Arrastar item ${l.item || "sem título"}`}
          >
            <IcGrip width={18} height={18} />
          </button>
          {/* Setas: uma posição por vez; na borda, passam o item para o grupo vizinho. */}
          <MoverSetas
            rotulo={`o item ${l.item || "sem título"}`}
            motivoBloqueio={motivoBloqueio}
            podeSubir={!primeiro}
            podeDescer={!ultimo}
            onSubir={() => onMover(-1)}
            onDescer={() => onMover(1)}
          />
        </div>

        <div className="min-w-0">
          <Campo label="Item">
            <Input className="!h-10 !px-2.5 !text-[13.5px] !font-semibold" placeholder="Nome do item" value={l.item} onChange={(e) => onUpd({ item: e.target.value })} />
          </Campo>
        </div>

        <div className="col-start-2 xl:col-start-auto min-w-0 grid gap-2">
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
          <div className="col-start-2 xl:col-start-auto grid grid-cols-2 gap-2 min-w-0">
            <Campo label="Pólobh" className="w-full xl:w-32">
              <CurrencyInput className="!h-10 !px-2.5 !text-[13.5px]" value={l.valorPolobh} onValue={(v) => onUpd({ valorPolobh: v })} />
            </Campo>
            <Campo label="Cliente" className="w-full xl:w-32">
              <CurrencyInput className="!h-10 !px-2.5 !text-[13.5px]" value={l.valorCliente} onValue={(v) => onUpd({ valorCliente: v })} />
            </Campo>
          </div>
        )}

        <div className="col-start-2 xl:col-start-auto flex xl:flex-col items-center justify-end gap-1 xl:pt-5">
          <button type="button" onClick={onOcultar} className="text-ink-3 hover:text-primary p-1.5" title="Ocultar item (mantém guardado)" aria-label="Ocultar item">
            <IcEyeOff width={18} height={18} />
          </button>
        </div>
      </div>

      {/* Linha 2: metadados */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[0.7fr_2.6fr_1fr_1fr_1fr_1fr_0.7fr] items-end gap-2 px-2.5 pb-2.5 pt-1 border-t border-border-soft bg-[#FCFCFD] rounded-b-card min-w-0">
        <Campo label="Aprovação" className="w-full">
          <Select className="!h-9 !px-2 !text-[12.5px]" value={l.statusAprovacao} onChange={(e) => onUpd({ statusAprovacao: e.target.value as StatusAprovacao })}>
            <option>Pendente</option>
            <option>OK</option>
          </Select>
        </Campo>
        <Campo label="Fornecedor (CNPJ / Razão social)" className="sm:col-span-2 xl:col-span-1 w-full min-w-0" obrigatorio>
          <FornecedorField
            razao={l.fornecedorRazao}
            cnpj={l.fornecedorCnpj}
            fornecedores={fornecedores}
            onChange={onUpd}
            onValidar={onValidarFornecedor}
          />
        </Campo>
        <Campo label="Documento PG" className="w-full" obrigatorio>
          <Select className="!h-9 !px-2 !text-[12.5px]" value={l.faturaNf} onChange={(e) => onUpd({ faturaNf: e.target.value as DocumentoPg })}>
            <option value="">Selecione…</option>
            <option value="Fatura">Fatura</option>
            <option value="Nota Fiscal">Nota Fiscal</option>
            <option value="Fatura e Nota Fiscal">Fatura e Nota Fiscal</option>
            <option value="Recibo Simples">Recibo Simples</option>
            <option value="Não se aplica">Não se aplica</option>
          </Select>
        </Campo>
        <Campo label="Código de Serviço" className="w-full" obrigatorio>
          <SelectComTexto value={l.codigoServico} onChange={(v) => onUpd({ codigoServico: v })} />
        </Campo>
        <Campo label="Pedido de Compra" className="w-full" obrigatorio>
          <SelectComTexto value={l.pedidoCompra} onChange={(v) => onUpd({ pedidoCompra: v })} />
        </Campo>
        <Campo label="OS" className="w-full">
          <Select className="!h-9 !px-2 !text-[12.5px]" value={l.statusOs} onChange={(e) => onUpd({ statusOs: e.target.value as StatusOs })}>
            {OPCOES_STATUS_OS.map((o) => <option key={o}>{o}</option>)}
          </Select>
        </Campo>
        {/* Contrato usa exatamente a mesma lista da OS (inclui "Emitir Nova Versão"). */}
        <Campo label="Contrato" className="w-full">
          <Select className="!h-9 !px-2 !text-[12.5px]" value={l.contratoStatus} onChange={(e) => onUpd({ contratoStatus: e.target.value as StatusOs })}>
            {OPCOES_STATUS_OS.map((o) => <option key={o}>{o}</option>)}
          </Select>
        </Campo>
      </div>

      <ObservacoesThread
        observacoes={l.observacoes}
        usuarios={usuarios}
        onChange={(obs: Observacao[]) => onUpd({ observacoes: obs })}
      />

      {resumoAberto && <ResumoPropostaModal onInserir={inserirResumo} onClose={() => setResumoAberto(false)} />}
    </div>
  );
}

/** Rótulo pequeno acima de um campo. `obrigatorio` marca com * vermelho (obrigatório só na emissão da OS). */
function Campo({ label, className, children, obrigatorio }: { label: string; className?: string; children: React.ReactNode; obrigatorio?: boolean }) {
  return (
    <label className={cx("block", className)}>
      <span className="block text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-ink-3 mb-1 truncate">
        {label}
        {obrigatorio && <span className="text-danger" title="Obrigatório para emitir a OS"> *</span>}
      </span>
      {children}
    </label>
  );
}
