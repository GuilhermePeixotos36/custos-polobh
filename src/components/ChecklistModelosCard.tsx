/**
 * Cadastro das listas padrão de check-list (Configurações → Check-list).
 *
 * É aqui que a Coordenação calibra a régua: o texto de cada tarefa, a etapa em
 * que ela entra e QUANDO ela vence. O "quando" tem dois modos, e a diferença
 * entre eles é o que faz o módulo funcionar em projeto de dois meses e em
 * projeto de dois anos:
 *
 *   • % do projeto — a tarefa "estica" junto com o período. Serve para o miolo
 *     da produção (montar a EC, contratar fornecedores).
 *   • Dias do evento — a tarefa fica grudada no dia D. Serve para o que não
 *     estica: credenciamento fecha 7 dias antes, seja qual for o projeto.
 *
 * Alterar a lista NÃO mexe nos check-lists já gerados. Cada projeto em
 * andamento recebe um aviso e decide quando trazer as tarefas novas.
 */
import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardTitle, EmptyState, Input, NumberInput, Select } from "@/components/ui";
import { IcPlus, IcTrash } from "@/components/icons";
import { MoverSetas } from "@/components/MoverSetas";
import { repo } from "@/data";
import { toast } from "@/store/toast";
import { useAuth } from "@/store/auth";
import { cx } from "@/lib/format";
import type { ItemModeloChecklist, ModalidadeProjeto, ModeloChecklist } from "@/data/types";

const MODALIDADES: ModalidadeProjeto[] = ["Corporativo", "Cultural"];

export function ChecklistModelosCard() {
  // A RLS de `checklist_modelos` só aceita escrita de Admin e Direção. A tela
  // precisa usar a MESMA regra: com o recurso "configuracoes" genérico, o perfil
  // Administrativo via o botão "Salvar" habilitado e tomava erro do banco.
  const papel = useAuth((s) => s.usuario?.papel);
  const podeEditar = papel === "Admin" || papel === "Direcao";
  const [modelos, setModelos] = useState<ModeloChecklist[]>([]);
  const [modalidade, setModalidade] = useState<ModalidadeProjeto>("Corporativo");
  const [itens, setItens] = useState<ItemModeloChecklist[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setModelos(await repo.checklists.listarModelos());
      } catch (erro) {
        toast(`Não foi possível carregar as listas padrão: ${(erro as Error).message}`, "danger");
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const modelo = useMemo(() => modelos.find((m) => m.modalidade === modalidade), [modelos, modalidade]);

  // Troca de modalidade recarrega a lista da tela a partir do modelo escolhido.
  useEffect(() => {
    setItens(modelo ? [...modelo.itens].sort((a, b) => a.ordem - b.ordem) : []);
    setSujo(false);
  }, [modelo]);

  const alterar = (id: string, patch: Partial<ItemModeloChecklist>) => {
    setItens((lista) => lista.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    setSujo(true);
  };

  const mover = (id: string, direcao: 1 | -1) => {
    setItens((lista) => {
      const i = lista.findIndex((x) => x.id === id);
      const j = i + direcao;
      if (i < 0 || j < 0 || j >= lista.length) return lista;
      const copia = [...lista];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia.map((item, n) => ({ ...item, ordem: n }));
    });
    setSujo(true);
  };

  const adicionar = () => {
    setItens((lista) => [
      ...lista,
      {
        // Id estável e legível: é ele que liga a tarefa do projeto ao molde.
        id: `mi-${globalThis.crypto.randomUUID().slice(0, 8)}`,
        titulo: "Nova tarefa",
        descricao: "",
        etapa: lista[lista.length - 1]?.etapa ?? "",
        prazo: { modo: "percentual", percentual: 0.5 },
        responsavelPadrao: "",
        ordem: lista.length,
      },
    ]);
    setSujo(true);
  };

  const remover = (id: string) => {
    setItens((lista) => lista.filter((i) => i.id !== id).map((item, n) => ({ ...item, ordem: n })));
    setSujo(true);
  };

  const salvar = async () => {
    if (!modelo) return;
    setSalvando(true);
    try {
      const salvo = await repo.checklists.salvarModelo({ ...modelo, itens });
      setModelos((lista) => lista.map((m) => (m.id === salvo.id ? salvo : m)));
      setSujo(false);
      toast("Lista padrão salva.", "success");
    } catch (erro) {
      toast(`Erro ao salvar: ${(erro as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <Card><div className="text-center text-ink-3 text-sm py-6">Carregando…</div></Card>;

  return (
    <Card>
      <CardTitle
        hint="As tarefas que o sistema cria automaticamente ao definir a modalidade de um projeto. Alterar aqui não mexe nos check-lists já criados — cada projeto em andamento é avisado e decide quando trazer as novas."
        action={
          podeEditar && (
            <Button size="sm" onClick={() => void salvar()} disabled={!sujo || salvando}>
              {salvando ? "Salvando…" : sujo ? "Salvar lista" : "Salvo"}
            </Button>
          )
        }
      >
        Listas padrão de check-list
      </CardTitle>

      <div className="flex items-center gap-2 mb-3">
        {MODALIDADES.map((m) => (
          <button
            key={m}
            onClick={() => setModalidade(m)}
            className={cx(
              "rounded-btn px-3 h-9 text-[13px] font-bold border-[1.5px] transition-colors",
              modalidade === m
                ? "border-primary bg-primary-soft text-primary-dark"
                : "border-[#D6D9E0] text-ink-2 hover:bg-[#FAFAFB]"
            )}
          >
            Projetos {m}s
          </button>
        ))}
        <span className="ml-auto text-[12.5px] font-bold text-ink-3">
          {itens.length} {itens.length === 1 ? "tarefa" : "tarefas"}
        </span>
      </div>

      {!modelo && (
        <EmptyState
          title={`Sem lista cadastrada para projetos ${modalidade}`}
          hint="A lista é criada pela migração do módulo. Fale com o suporte se ela não aparecer."
        />
      )}

      {modelo && (
        <div className="space-y-1.5">
          {itens.map((item, indice) => (
            <div key={item.id} className="rounded-card border border-border bg-white p-2.5">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                <div className="pt-1">
                  <MoverSetas
                    rotulo={item.titulo || "tarefa"}
                    podeSubir={indice > 0}
                    podeDescer={indice < itens.length - 1}
                    onSubir={() => mover(item.id, -1)}
                    onDescer={() => mover(item.id, 1)}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      className="!h-8 !px-2 !text-[13.5px] !font-bold flex-1 min-w-[220px]"
                      value={item.titulo}
                      disabled={!podeEditar}
                      onChange={(e) => alterar(item.id, { titulo: e.target.value })}
                      aria-label="Título da tarefa padrão"
                    />
                    {podeEditar && (
                      <button
                        type="button"
                        onClick={() => remover(item.id)}
                        className="rounded-btn p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger"
                        title="Remover da lista padrão"
                      >
                        <IcTrash width={16} height={16} />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_9rem]">
                    <Input
                      className="!h-8 !px-2 !text-[12.5px] !uppercase"
                      value={item.etapa}
                      disabled={!podeEditar}
                      onChange={(e) => alterar(item.id, { etapa: e.target.value })}
                      placeholder="Etapa (ex.: PRÉ-PRODUÇÃO)"
                      aria-label="Etapa"
                    />
                    <Select
                      className="!h-8 !px-2 !text-[12.5px]"
                      value={item.prazo.modo}
                      disabled={!podeEditar}
                      onChange={(e) =>
                        alterar(item.id, {
                          prazo:
                            e.target.value === "ancora"
                              ? { modo: "ancora", diasDoEvento: -7 }
                              : { modo: "percentual", percentual: 0.5 },
                        })
                      }
                      aria-label="Modo do prazo"
                    >
                      <option value="percentual">% do projeto</option>
                      <option value="ancora">Dias do evento</option>
                    </Select>
                    {item.prazo.modo === "percentual" ? (
                      <NumberInput
                        className="!h-8 !px-2 !text-[12.5px]"
                        value={Math.round((item.prazo.percentual ?? 0) * 100)}
                        disabled={!podeEditar}
                        onValue={(v) =>
                          alterar(item.id, {
                            prazo: { modo: "percentual", percentual: Math.min(100, Math.max(0, v)) / 100 },
                          })
                        }
                        aria-label="Percentual do período do projeto (0 a 100)"
                      />
                    ) : (
                      <NumberInput
                        className="!h-8 !px-2 !text-[12.5px]"
                        value={item.prazo.diasDoEvento ?? 0}
                        disabled={!podeEditar}
                        onValue={(v) => alterar(item.id, { prazo: { modo: "ancora", diasDoEvento: v } })}
                        aria-label="Dias em relação ao evento (negativo = antes)"
                      />
                    )}
                  </div>
                  <p className="text-[11.5px] font-bold text-ink-3">
                    {item.prazo.modo === "percentual"
                      ? `Vence a ${Math.round((item.prazo.percentual ?? 0) * 100)}% do período do projeto.`
                      : (item.prazo.diasDoEvento ?? 0) < 0
                      ? `Vence ${Math.abs(item.prazo.diasDoEvento ?? 0)} dia(s) ANTES do evento.`
                      : (item.prazo.diasDoEvento ?? 0) === 0
                      ? "Vence no dia do evento."
                      : `Vence ${item.prazo.diasDoEvento} dia(s) DEPOIS do evento.`}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {podeEditar && (
            <Button variant="secondary" size="sm" icon={<IcPlus width={16} height={16} />} onClick={adicionar}>
              Adicionar tarefa à lista padrão
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
