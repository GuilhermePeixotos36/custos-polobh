/**
 * "Adicionar grupo / item" da EC.
 *
 * A EC nasce em branco; os grupos e itens padrão da modalidade ficam aqui como
 * opções (ver `domain/importarModeloEc`). Em cima, a barra para criar do zero:
 * o nome, se é grupo ou item e, sendo item, em qual grupo ele entra.
 */
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Input, Select } from "@/components/ui";
import { IcChevron, IcPlus } from "@/components/icons";
import { CabecalhoJanela } from "@/components/padrao/CabecalhoJanela";
import {
  alternarGrupo,
  alternarItem,
  gruposDaModalidade,
  montarImportacao,
  selecaoVazia,
  type EntradaImportada,
} from "@/domain/importarModeloEc";
import type { ModalidadeProjeto } from "@/data/types";
import { cx } from "@/lib/format";

export interface NovoManual {
  tipo: "grupo" | "item";
  nome: string;
  /** Só para item: o grupo onde ele entra. */
  grupo: string;
}

export function AdicionarEcModal({
  modalidade,
  gruposExistentes,
  onImportar,
  onCriar,
  onFechar,
}: {
  modalidade: ModalidadeProjeto;
  gruposExistentes: string[];
  onImportar: (entradas: EntradaImportada[]) => void;
  onCriar: (novo: NovoManual) => void;
  onFechar: () => void;
}) {
  const [aba, setAba] = useState<ModalidadeProjeto>(modalidade || "Corporativo");
  const grupos = useMemo(() => gruposDaModalidade(aba), [aba]);
  const [sel, setSel] = useState(selecaoVazia);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const [tipo, setTipo] = useState<"grupo" | "item">("grupo");
  const [nome, setNome] = useState("");
  const [grupoDestino, setGrupoDestino] = useState(gruposExistentes[0] ?? "");

  const trocarAba = (m: ModalidadeProjeto) => {
    setAba(m);
    setSel(selecaoVazia());
    setAbertos(new Set());
  };
  const alternarAberto = (nomeGrupo: string) =>
    setAbertos((a) => {
      const n = new Set(a);
      if (!n.delete(nomeGrupo)) n.add(nomeGrupo);
      return n;
    });

  const entradas = montarImportacao(grupos, sel, gruposExistentes);
  const qtdGrupos = sel.grupos.size;
  const podeCriar = nome.trim() !== "" && (tipo === "grupo" || gruposExistentes.length > 0);

  const criar = () => {
    if (!podeCriar) return;
    onCriar({ tipo, nome: nome.trim(), grupo: grupoDestino || gruposExistentes[0] || "" });
    setNome("");
  };

  return createPortal(
    <div className="no-print fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onFechar} />
      <div
        role="dialog"
        aria-label="Adicionar grupo ou item"
        className="relative w-full max-w-[640px] max-h-[90vh] flex flex-col bg-surface rounded-card-lg shadow-modal overflow-hidden"
      >
        <CabecalhoJanela titulo="Adicionar grupo / item" subtitulo="Crie do zero ou importe do modelo da modalidade. Nada entra na EC sem você escolher." onFechar={onFechar} />

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {/* Criar do zero */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              criar();
            }}
            className="rounded-btn border border-border-soft bg-muted/40 p-3 space-y-2"
          >
            <div className="text-xs font-semibold text-muted-foreground">Criar novo</div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-10! flex-1 min-w-[180px]"
                placeholder={tipo === "grupo" ? "Nome do grupo" : "Nome do item"}
                formato={tipo === "grupo" ? "grupo" : "item"}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
              />
              <div className="inline-flex rounded-btn border border-border overflow-hidden text-xs font-bold">
                {(["grupo", "item"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={cx("px-3 h-10", tipo === t ? "bg-primary-soft text-brand-forte" : "bg-white text-ink-2")}
                  >
                    {t === "grupo" ? "Grupo" : "Item"}
                  </button>
                ))}
              </div>
              <Button type="submit" size="sm" icon={<IcPlus width={15} height={15} />} disabled={!podeCriar}>
                Adicionar
              </Button>
            </div>
            {tipo === "item" && (
              gruposExistentes.length > 0 ? (
                <label className="flex items-center gap-2 text-xs text-ink-2">
                  No grupo
                  <Select className="h-9! max-w-xs" value={grupoDestino} onChange={(e) => setGrupoDestino(e.target.value)}>
                    {gruposExistentes.map((g) => <option key={g}>{g}</option>)}
                  </Select>
                </label>
              ) : (
                <p className="text-xs text-warning">Crie ou importe um grupo antes de adicionar um item.</p>
              )
            )}
          </form>

          {/* Importar do modelo */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs font-semibold text-muted-foreground">Importar do modelo</div>
              <div className="ml-auto inline-flex rounded-btn border border-border overflow-hidden text-xs font-bold">
                {(["Corporativo", "Cultural"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => trocarAba(m)}
                    className={cx("px-3 h-8", aba === m ? "bg-primary-soft text-brand-forte" : "bg-white text-ink-2")}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {modalidade && aba !== modalidade && (
              <p className="text-2xs text-ink-3 mb-2">O projeto é {modalidade}; você está vendo o modelo {aba}.</p>
            )}
            <div className="space-y-1.5">
              {grupos.map((g) => {
                const marcadosNoGrupo = g.itens.filter((i) => sel.itens.has(i.chave)).length;
                const grupoMarcado = sel.grupos.has(g.nome);
                const aberto = abertos.has(g.nome);
                const jaExiste = gruposExistentes.includes(g.nome);
                return (
                  <div key={g.nome} className="rounded-btn border border-border-soft">
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary cursor-pointer"
                        checked={grupoMarcado}
                        ref={(el) => {
                          if (el) el.indeterminate = grupoMarcado && marcadosNoGrupo > 0 && marcadosNoGrupo < g.itens.length;
                        }}
                        onChange={(e) => setSel((s) => alternarGrupo(s, g, e.target.checked))}
                        aria-label={`Importar o grupo ${g.nome}`}
                      />
                      <button
                        type="button"
                        onClick={() => alternarAberto(g.nome)}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      >
                        <IcChevron width={14} height={14} className={cx("shrink-0 transition-transform", aberto && "rotate-90")} />
                        <span className="text-sm font-bold uppercase text-ink truncate">{g.nome}</span>
                        <span className="text-2xs text-ink-3 shrink-0">
                          {grupoMarcado ? `${marcadosNoGrupo} de ${g.itens.length}` : g.itens.length} {g.itens.length === 1 ? "item" : "itens"}
                        </span>
                        {jaExiste && <span className="text-2xs text-ink-3 shrink-0">· já está na EC</span>}
                      </button>
                    </div>
                    {aberto && (
                      <ul className="px-3 py-1.5 space-y-0.5">
                        {g.itens.map((i) => (
                          <li key={i.chave}>
                            <label className="flex items-center gap-2 py-1 cursor-pointer text-sm text-ink-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-primary"
                                checked={sel.itens.has(i.chave)}
                                onChange={(e) => setSel((s) => alternarItem(s, g, i.chave, e.target.checked))}
                              />
                              <span className="truncate">{i.item}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-t border-border-soft">
          <span className="text-xs text-ink-3">
            {qtdGrupos === 0
              ? "Marque grupos e itens para importar."
              : `${qtdGrupos} ${qtdGrupos === 1 ? "grupo" : "grupos"} · ${entradas.filter((e) => e.item).length} itens`}
          </span>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={onFechar}>Fechar</Button>
          <Button
            size="sm"
            disabled={entradas.length === 0}
            onClick={() => {
              onImportar(entradas);
              onFechar();
            }}
          >
            Importar selecionados
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
