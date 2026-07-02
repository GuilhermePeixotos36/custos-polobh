import { useRef, useState } from "react";
import { Input, Textarea, Select, NumberInput, Button } from "@/components/ui";
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

const normalizar = (linhas: EcLinha[]) => achatar(agrupar(linhas));

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

type Drag = { tipo: "grupo"; nome: string } | { tipo: "item"; id: string } | null;
type Over =
  | { tipo: "grupo"; nome: string; pos: "antes" | "depois" }
  | { tipo: "item"; id: string; pos: "antes" | "depois" }
  | { tipo: "corpo"; nome: string }
  | null;

interface Props {
  linhas: EcLinha[];
  onChange: (linhas: EcLinha[]) => void;
  verFinanceiro: boolean;
  fornecedores: Fornecedor[];
  onValidarFornecedor: (cnpj: string) => Promise<string | null>;
}

export function EcGrupos({ linhas, onChange, verFinanceiro, fornecedores, onValidarFornecedor }: Props) {
  const grupos = agrupar(linhas);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const dragRef = useRef<Drag>(null);
  const [over, setOver] = useState<Over>(null);
  const datalistId = "ec-fornecedores-cnpj";

  const isExp = (nome: string) => expandido[nome] ?? false;
  const toggle = (nome: string) => setExpandido((e) => ({ ...e, [nome]: !isExp(nome) }));
  const expandirTodos = (v: boolean) =>
    setExpandido(Object.fromEntries(grupos.map((g) => [g.nome, v])));

  /* ------- edição de linhas ------- */
  const updLinha = (id: string, patch: Partial<EcLinha>) =>
    onChange(linhas.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const renomearGrupo = (nomeAntigo: string, novo: string) => {
    onChange(linhas.map((l) => (l.grupo === nomeAntigo ? { ...l, grupo: novo } : l)));
    setExpandido((e) => {
      const { [nomeAntigo]: v, ...resto } = e;
      return { ...resto, [novo]: v ?? false };
    });
  };

  const addItem = (grupoNome: string) => {
    onChange(normalizar([...linhas, { ...novaLinhaBase(), grupo: grupoNome }]));
    setExpandido((e) => ({ ...e, [grupoNome]: true }));
  };

  const addGrupo = () => {
    const nome = nomeGrupoUnico("NOVO GRUPO", grupos);
    onChange(normalizar([...linhas, { ...novaLinhaBase(), grupo: nome }]));
    setExpandido((e) => ({ ...e, [nome]: true }));
  };

  const delGrupo = async (g: Grupo) => {
    const temConteudo = g.itens.some(
      (l) => l.item || l.descricao || l.valorPolobh || l.valorCliente || l.fornecedorRazao
    );
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
    onChange(linhas.filter((l) => l.grupo !== g.nome));
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
    onChange(linhas.filter((x) => x.id !== l.id));
  };

  /* ------- drag & drop ------- */
  const limpar = () => {
    dragRef.current = null;
    setOver(null);
  };

  const metade = (e: React.DragEvent): "antes" | "depois" => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2 ? "antes" : "depois";
  };

  const soltarGrupo = (alvoNome: string, pos: "antes" | "depois") => {
    const d = dragRef.current;
    if (!d || d.tipo !== "grupo" || d.nome === alvoNome) return;
    const gs = agrupar(linhas);
    const from = gs.findIndex((g) => g.nome === d.nome);
    const [movido] = gs.splice(from, 1);
    let to = gs.findIndex((g) => g.nome === alvoNome);
    if (pos === "depois") to += 1;
    gs.splice(to, 0, movido);
    onChange(achatar(gs));
  };

  const soltarItem = (destGrupo: string, alvoId: string | null, pos: "antes" | "depois") => {
    const d = dragRef.current;
    if (!d || d.tipo !== "item") return;
    const gs = agrupar(linhas).map((g) => ({ nome: g.nome, itens: [...g.itens] }));
    let movido: EcLinha | undefined;
    for (const g of gs) {
      const i = g.itens.findIndex((x) => x.id === d.id);
      if (i >= 0) {
        movido = g.itens.splice(i, 1)[0];
        break;
      }
    }
    if (!movido) return;
    movido = { ...movido, grupo: destGrupo };
    let dest = gs.find((g) => g.nome === destGrupo);
    if (!dest) {
      dest = { nome: destGrupo, itens: [] };
      gs.push(dest);
    }
    if (alvoId == null) {
      dest.itens.push(movido);
    } else {
      const j = dest.itens.findIndex((x) => x.id === alvoId);
      const at = j < 0 ? dest.itens.length : j + (pos === "depois" ? 1 : 0);
      dest.itens.splice(at, 0, movido);
    }
    onChange(achatar(gs.filter((g) => g.itens.length > 0)));
  };

  return (
    <div className="space-y-3">
      {/* datalist compartilhado: mostra os fornecedores registrados ao digitar o CNPJ */}
      <datalist id={datalistId}>
        {fornecedores.map((f) => (
          <option key={f.id} value={maskCpfCnpjInput(onlyDigits(f.cnpj))}>
            {f.nomeFantasia || f.razaoSocial}
          </option>
        ))}
      </datalist>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<IcPlus width={16} height={16} />} onClick={addGrupo}>
            Adicionar grupo
          </Button>
        </div>
        <div className="flex gap-3 text-[12.5px] font-bold text-ink-2">
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

      {grupos.map((g) => {
        const aberto = isExp(g.nome);
        const subtotal = g.itens.reduce((s, l) => s + (l.valorPolobh || 0) + (l.valorCliente || 0), 0);
        const overGrupoAntes = over?.tipo === "grupo" && over.nome === g.nome && over.pos === "antes";
        const overGrupoDepois = over?.tipo === "grupo" && over.nome === g.nome && over.pos === "depois";
        const overCorpo = over?.tipo === "corpo" && over.nome === g.nome;
        return (
          <div
            key={g.nome}
            className={cx(
              "rounded-card border bg-white transition-colors",
              overCorpo ? "border-primary ring-2 ring-primary/20" : "border-border",
              overGrupoAntes && "border-t-2 border-t-primary",
              overGrupoDepois && "border-b-2 border-b-primary"
            )}
          >
            {/* Cabeçalho do grupo (arrastável + solta grupo/append item) */}
            <div
              onDragOver={(e) => {
                const d = dragRef.current;
                if (!d) return;
                e.preventDefault();
                if (d.tipo === "grupo") setOver({ tipo: "grupo", nome: g.nome, pos: metade(e) });
                else setOver({ tipo: "corpo", nome: g.nome });
              }}
              onDrop={(e) => {
                e.preventDefault();
                const d = dragRef.current;
                if (d?.tipo === "grupo") soltarGrupo(g.nome, metade(e));
                else if (d?.tipo === "item") soltarItem(g.nome, null, "depois");
                limpar();
              }}
              className="flex items-center gap-2 px-3 py-2.5"
            >
              <span
                draggable
                onDragStart={() => (dragRef.current = { tipo: "grupo", nome: g.nome })}
                onDragEnd={limpar}
                className="cursor-grab active:cursor-grabbing text-ink-3 hover:text-ink shrink-0"
                title="Arraste para reordenar o grupo"
              >
                <IcGrip width={18} height={18} />
              </span>
              <button onClick={() => toggle(g.nome)} className="shrink-0 text-ink-2 hover:text-ink" title={aberto ? "Retrair" : "Expandir"}>
                <IcChevron width={18} height={18} className={cx("transition-transform", aberto && "rotate-90")} />
              </button>
              <Input
                className="!h-9 !px-2 !text-[13px] !font-bold !uppercase max-w-xs"
                value={g.nome}
                onChange={(e) => renomearGrupo(g.nome, e.target.value)}
              />
              <span className="shrink-0 text-[11px] font-bold text-ink-3 bg-[#F0F1F4] rounded-pill px-2 py-0.5">
                {g.itens.length} {g.itens.length === 1 ? "item" : "itens"}
              </span>
              {verFinanceiro && subtotal > 0 && (
                <span className="shrink-0 text-[12.5px] font-display font-bold text-ink-2">{brl(subtotal)}</span>
              )}
              <div className="ml-auto flex items-center gap-1 shrink-0">
                <Button variant="soft" size="sm" icon={<IcPlus width={15} height={15} />} onClick={() => addItem(g.nome)}>
                  Item
                </Button>
                <button onClick={() => delGrupo(g)} className="text-ink-3 hover:text-danger p-1.5" title="Remover grupo">
                  <IcTrash width={16} height={16} />
                </button>
              </div>
            </div>

            {/* Corpo do grupo (itens) */}
            {aberto && (
              <div className="border-t border-border-soft overflow-x-auto">
                <div className="min-w-[900px]">
                  {/* legenda de colunas */}
                  <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-ink-3 bg-[#FAFAFB]">
                    <span className="w-5 shrink-0" />
                    <span className="w-40 shrink-0">Item</span>
                    <span className="flex-1 min-w-[180px]">Descrição</span>
                    <span className="w-56 shrink-0">Fornecedor</span>
                    {verFinanceiro && <span className="w-24 shrink-0 text-right">Pólobh</span>}
                    {verFinanceiro && <span className="w-24 shrink-0 text-right">Cliente</span>}
                    <span className="w-24 shrink-0">Aprov.</span>
                    <span className="w-24 shrink-0">OS</span>
                    <span className="w-28 shrink-0">Contrato</span>
                    <span className="w-7 shrink-0" />
                  </div>

                  {g.itens.map((l) => {
                    const overAntes = over?.tipo === "item" && over.id === l.id && over.pos === "antes";
                    const overDepois = over?.tipo === "item" && over.id === l.id && over.pos === "depois";
                    return (
                      <div
                        key={l.id}
                        onDragOver={(e) => {
                          const d = dragRef.current;
                          if (d?.tipo !== "item") return;
                          e.preventDefault();
                          e.stopPropagation();
                          setOver({ tipo: "item", id: l.id, pos: metade(e) });
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (dragRef.current?.tipo === "item") soltarItem(g.nome, l.id, metade(e));
                          limpar();
                        }}
                        className={cx(
                          "flex items-start gap-2 px-3 py-2 border-b border-border-soft",
                          overAntes && "border-t-2 border-t-primary",
                          overDepois && "border-b-2 border-b-primary"
                        )}
                      >
                        <span
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            dragRef.current = { tipo: "item", id: l.id };
                          }}
                          onDragEnd={limpar}
                          className="cursor-grab active:cursor-grabbing text-ink-3 hover:text-ink shrink-0 mt-1.5"
                          title="Arraste para reordenar / mover de grupo"
                        >
                          <IcGrip width={16} height={16} />
                        </span>
                        <div className="w-40 shrink-0">
                          <Input className="!h-9 !px-2 !text-[12.5px]" placeholder="Item" value={l.item} onChange={(e) => updLinha(l.id, { item: e.target.value })} />
                        </div>
                        <div className="flex-1 min-w-[180px]">
                          <Textarea className="!min-h-9 !py-1.5 !px-2 !text-[12.5px]" rows={1} placeholder="Descrição" value={l.descricao} onChange={(e) => updLinha(l.id, { descricao: e.target.value })} />
                        </div>
                        <div className="w-56 shrink-0">
                          <FornecedorField
                            razao={l.fornecedorRazao}
                            cnpj={l.fornecedorCnpj}
                            contato={l.fornecedorContato}
                            fornecedores={fornecedores}
                            datalistId={datalistId}
                            onChange={(patch) => updLinha(l.id, patch)}
                            onValidar={onValidarFornecedor}
                          />
                        </div>
                        {verFinanceiro && (
                          <div className="w-24 shrink-0">
                            <NumberInput className="!h-9 !px-2 !text-[12.5px]" value={l.valorPolobh} onValue={(v) => updLinha(l.id, { valorPolobh: v })} />
                          </div>
                        )}
                        {verFinanceiro && (
                          <div className="w-24 shrink-0">
                            <NumberInput className="!h-9 !px-2 !text-[12.5px]" value={l.valorCliente} onValue={(v) => updLinha(l.id, { valorCliente: v })} />
                          </div>
                        )}
                        <div className="w-24 shrink-0">
                          <Select className="!h-9 !px-2 !text-[12px]" value={l.statusAprovacao} onChange={(e) => updLinha(l.id, { statusAprovacao: e.target.value as StatusAprovacao })}>
                            <option>Pendente</option>
                            <option>OK</option>
                          </Select>
                        </div>
                        <div className="w-24 shrink-0">
                          <Select className="!h-9 !px-2 !text-[12px]" value={l.statusOs} onChange={(e) => updLinha(l.id, { statusOs: e.target.value as StatusOs })}>
                            <option>Pendente</option>
                            <option>Emitir</option>
                            <option>OK</option>
                          </Select>
                        </div>
                        <div className="w-28 shrink-0">
                          <Input className="!h-9 !px-2 !text-[12.5px]" placeholder="Nº/ref." value={l.contrato} onChange={(e) => updLinha(l.id, { contrato: e.target.value })} />
                        </div>
                        <button onClick={() => delItem(l)} className="text-ink-3 hover:text-danger p-1.5 shrink-0 mt-1" title="Remover linha">
                          <IcTrash width={16} height={16} />
                        </button>
                      </div>
                    );
                  })}

                  <div className="px-3 py-2">
                    <Button variant="secondary" size="sm" icon={<IcPlus width={15} height={15} />} onClick={() => addItem(g.nome)}>
                      Adicionar item ao grupo
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
