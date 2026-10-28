/**
 * Cadastro das listas padrão de check-list (Configurações › Check-list).
 *
 * É aqui que a Coordenação calibra a régua: o texto de cada tarefa, a etapa em
 * que ela entra e QUANDO ela vence. O "quando" tem seis réguas (ver
 * `ModoPrazoChecklist`), e a que faz o módulo funcionar em evento criado a seis
 * meses ou a seis dias é "semanas antes do evento": a lista é escrita como o
 * prazo de manual (ex.: 11 semanas) e, em cada projeto, se estica ou se
 * comprime na janela que existe entre a criação dele e o evento — mantendo a
 * proporção entre as tarefas.
 *
 * Quem altera: só Coordenação e Direção (recurso `checklists.padrao`).
 * Alterar a lista NÃO mexe nos check-lists já gerados. Cada projeto em
 * andamento recebe um aviso e decide quando trazer as tarefas novas.
 */
import { useEffect, useMemo, useState } from "react";
import { Button, CarregandoTela, Card, CardTitle, EmptyState, Input, NumberInput, Select } from "@/components/ui";
import { IcPlus, IcTrash } from "@/components/icons";
import { MoverSetas } from "@/components/MoverSetas";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { useAuth } from "@/store/auth";
import { useSugestoes } from "@/hooks/useSugestoes";
import { cx } from "@/lib/format";
import { descreverPrazo, semanasDeReferencia } from "@/domain/checklist";
import type {
  EtapaCronogramaProjeto,
  ItemModeloChecklist,
  ModalidadeProjeto,
  ModeloChecklist,
  ModoPrazoChecklist,
  RegraPrazoChecklist,
} from "@/data/types";

const MODALIDADES: ModalidadeProjeto[] = ["Corporativo", "Cultural"];

const OPCOES_MODO: { valor: ModoPrazoChecklist; rotulo: string }[] = [
  { valor: "semanas-antes", rotulo: "Semanas antes do evento (adapta)" },
  { valor: "cronograma", rotulo: "Data do cronograma" },
  { valor: "dias-uteis-apos", rotulo: "Dias úteis após" },
  { valor: "semanas-apos", rotulo: "Semanas após o evento" },
  { valor: "ancora", rotulo: "Dias do evento" },
  { valor: "percentual", rotulo: "% do projeto" },
];

const ETAPAS_CRONOGRAMA: { valor: EtapaCronogramaProjeto; rotulo: string }[] = [
  { valor: "montagem", rotulo: "Montagem" },
  { valor: "alinhamentos", rotulo: "Alinhamentos/Testes" },
  { valor: "ensaios", rotulo: "Ensaios" },
  { valor: "evento", rotulo: "Evento" },
  { valor: "desmontagem", rotulo: "Desmontagem" },
];

/** A régua padrão ao trocar de modo — um ponto de partida que a pessoa ajusta. */
const REGRA_INICIAL: Record<ModoPrazoChecklist, RegraPrazoChecklist> = {
  "semanas-antes": { modo: "semanas-antes", semanas: 2 },
  cronograma: { modo: "cronograma", etapa: "evento", ponta: "ultima" },
  "dias-uteis-apos": { modo: "dias-uteis-apos", base: "desmontagem", diasUteis: 1 },
  "semanas-apos": { modo: "semanas-apos", base: "evento", semanas: 2 },
  ancora: { modo: "ancora", diasDoEvento: -7 },
  percentual: { modo: "percentual", percentual: 0.5 },
};

/** "Direção de Produção + Back-Office" ⇄ lista. O texto só é lido ao sair do campo. */
function CampoFuncoes({
  funcoes,
  disabled,
  onChange,
}: {
  funcoes: string[];
  disabled: boolean;
  onChange: (funcoes: string[]) => void;
}) {
  const [texto, setTexto] = useState(funcoes.join(" + "));
  useEffect(() => setTexto(funcoes.join(" + ")), [funcoes]);
  return (
    <Input
      className="!h-8 !px-2 !text-[12.5px]"
      value={texto}
      disabled={disabled}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() =>
        onChange(
          texto
            .split(/\s*[+\n;]\s*/)
            .map((f) => f.trim())
            .filter(Boolean)
        )
      }
      placeholder="Funções responsáveis (separe com +)"
      aria-label="Funções responsáveis pela tarefa"
    />
  );
}

export function ChecklistModelosCard() {
  // A RLS de `checklist_modelos` exige o recurso `checklists.padrao` (só
  // Coordenação e Direção — 01/10/2026). A tela usa a MESMA chave: sem ela o
  // botão "Salvar" ficaria habilitado e o banco recusaria.
  const podeEditar = useAuth((s) => s.pode("checklists.padrao"));
  // Título e etapa saem das tarefas reais dos projetos: é o mesmo vocabulário,
  // e a lista padrão nasce justamente do que a casa já faz em cada evento.
  const sugestoes = useSugestoes();
  // Responsável padrão sai da lista real de usuários: digitado à mão, o nome
  // não bateria com o do cadastro e a tarefa nasceria sem dono de verdade.
  const { data: usuariosData } = useAsync(() => repo.auth.usuarios(), []);
  const usuarios = (usuariosData ?? []).map((u) => u.nome).filter(Boolean);
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
  // Sair da tela com a lista alterada apagava o trabalho em silêncio.
  useUnsavedGuard(sujo);

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
        prazo: { modo: "semanas-antes", semanas: 2 },
        responsavelPadrao: "",
        funcoes: [],
        ordem: lista.length,
      },
    ]);
    setSujo(true);
  };

  const remover = (id: string) => {
    setItens((lista) => lista.filter((i) => i.id !== id).map((item, n) => ({ ...item, ordem: n })));
    setSujo(true);
  };

  /**
   * Trocar de modalidade recarrega a lista da tela — e, com alteração pendente,
   * isso apagava o que a pessoa tinha acabado de escrever, sem aviso. A trava
   * de saída da página não pega este caso: a navegação é interna.
   */
  const trocarModalidade = async (m: ModalidadeProjeto) => {
    if (m === modalidade) return;
    if (sujo && !(await confirmar({
      titulo: "Trocar de lista sem salvar?",
      mensagem: "As alterações feitas nesta lista padrão serão perdidas.",
      confirmarTexto: "Trocar e descartar",
      tom: "danger",
    }))) return;
    setModalidade(m);
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
      {salvando && <CarregandoTela />}
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
            onClick={() => void trocarModalidade(m)}
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

      {modelo && semanasDeReferencia(modelo) > 0 && (
        <p className="mb-3 rounded-btn bg-primary-soft px-3 py-2 text-[12.5px] font-bold text-primary-dark">
          Prazo de manual desta lista: {semanasDeReferencia(modelo)} semanas antes do evento. Em cada projeto, as
          tarefas “semanas antes do evento” se esticam ou se comprimem para caber entre o dia em que o projeto é
          criado e o evento, mantendo a proporção entre elas. Tarefa marcada “não adaptar” fica sempre na semana escrita.
        </p>
      )}

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
                      sugestoes={sugestoes.valores.tituloTarefa}
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
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem]">
                    <Input
                      className="!h-8 !px-2 !text-[12.5px] !uppercase"
                      sugestoes={sugestoes.valores.etapaTarefa}
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
                      onChange={(e) => alterar(item.id, { prazo: REGRA_INICIAL[e.target.value as ModoPrazoChecklist] })}
                      aria-label="Modo do prazo"
                    >
                      {OPCOES_MODO.map((o) => (
                        <option key={o.valor} value={o.valor}>{o.rotulo}</option>
                      ))}
                    </Select>
                  </div>
                  <CampoPrazo
                    prazo={item.prazo}
                    disabled={!podeEditar}
                    onChange={(prazo) => alterar(item.id, { prazo })}
                  />
                  {/* Descrição e responsável padrão JÁ eram copiados para a
                      tarefa de cada projeto (ver `itemDoModelo`), mas não havia
                      onde preenchê-los: a lista nascia sempre sem explicação e
                      sem dono. São o que transforma "Fechar fornecedores" numa
                      instrução que a pessoa consegue seguir sozinha. */}
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_13rem]">
                    <Input
                      className="!h-8 !px-2 !text-[12.5px]"
                      value={item.descricao}
                      disabled={!podeEditar}
                      onChange={(e) => alterar(item.id, { descricao: e.target.value })}
                      placeholder="O que precisa ser feito (aparece na tarefa do projeto)"
                      aria-label="Descrição da tarefa padrão"
                    />
                    <Select
                      className="!h-8 !px-2 !text-[12.5px]"
                      value={item.responsavelPadrao}
                      disabled={!podeEditar}
                      onChange={(e) => alterar(item.id, { responsavelPadrao: e.target.value })}
                      aria-label="Responsável padrão pela tarefa"
                    >
                      <option value="">Sem responsável padrão</option>
                      {/* Nome já gravado que saiu do quadro de usuários continua
                          na lista: sem isto o `select` apareceria vazio e salvar
                          apagaria o responsável sem ninguém ver. */}
                      {[...new Set([item.responsavelPadrao, ...usuarios].filter(Boolean))].map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </Select>
                  </div>
                  <CampoFuncoes
                    funcoes={item.funcoes ?? []}
                    disabled={!podeEditar}
                    onChange={(funcoes) => alterar(item.id, { funcoes })}
                  />
                  <p className="text-[11.5px] font-bold text-ink-3">{descreverPrazo(item.prazo)}</p>
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

/**
 * Os campos da régua de prazo de uma tarefa — cada modo pede os seus.
 * Fica fora do card para o card não virar um `switch` de 80 linhas.
 */
function CampoPrazo({
  prazo,
  disabled,
  onChange,
}: {
  prazo: RegraPrazoChecklist;
  disabled: boolean;
  onChange: (prazo: RegraPrazoChecklist) => void;
}) {
  const classe = "!h-8 !px-2 !text-[12.5px]";
  switch (prazo.modo) {
    case "semanas-antes":
      return (
        <div className="flex items-center gap-3 flex-wrap">
          <NumberInput
            className={cx(classe, "!w-24")}
            value={prazo.semanas ?? 1}
            disabled={disabled}
            onValue={(v) => onChange({ ...prazo, semanas: Math.max(0, Math.round(v)) })}
            aria-label="Quantas semanas antes do evento"
          />
          <label className="inline-flex items-center gap-2 text-[12.5px] font-bold text-ink-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#F2820D]"
              checked={!!prazo.fixo}
              disabled={disabled}
              onChange={(e) => onChange({ modo: "semanas-antes", semanas: prazo.semanas ?? 1, ...(e.target.checked ? { fixo: true } : {}) })}
            />
            Não adaptar ao prazo do projeto
          </label>
        </div>
      );
    case "cronograma":
      return (
        <div className="grid gap-2 sm:grid-cols-3">
          <Select className={classe} value={prazo.etapa ?? "evento"} disabled={disabled}
            onChange={(e) => onChange({ ...prazo, etapa: e.target.value as EtapaCronogramaProjeto })}
            aria-label="Etapa do cronograma">
            {ETAPAS_CRONOGRAMA.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </Select>
          <Select className={classe} value={prazo.ponta ?? "ultima"} disabled={disabled}
            onChange={(e) => onChange({ ...prazo, ponta: e.target.value as "primeira" | "ultima" })}
            aria-label="Primeiro ou último dia da etapa">
            <option value="ultima">Último dia da etapa</option>
            <option value="primeira">Primeiro dia da etapa</option>
          </Select>
          <Select className={classe} value={prazo.ou ?? ""} disabled={disabled}
            onChange={(e) => {
              const { ou: _ignorado, ...resto } = prazo;
              onChange(e.target.value ? { ...resto, ou: e.target.value as EtapaCronogramaProjeto } : resto);
            }}
            aria-label="Etapa de reserva">
            <option value="">Sem etapa de reserva</option>
            {ETAPAS_CRONOGRAMA.filter((o) => o.valor !== (prazo.etapa ?? "evento")).map((o) => (
              <option key={o.valor} value={o.valor}>Se vazia, usar {o.rotulo}</option>
            ))}
          </Select>
        </div>
      );
    case "dias-uteis-apos":
      return (
        <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <NumberInput className={classe} value={prazo.diasUteis ?? 1} disabled={disabled}
            onValue={(v) => onChange({ ...prazo, diasUteis: Math.max(0, Math.round(v)) })}
            aria-label="Quantos dias úteis" />
          <Select className={classe} value={prazo.base ?? "desmontagem"} disabled={disabled}
            onChange={(e) => onChange({ ...prazo, base: e.target.value as "evento" | "desmontagem" })}
            aria-label="A partir de quê">
            <option value="desmontagem">após a desmontagem</option>
            <option value="evento">após o evento</option>
          </Select>
        </div>
      );
    case "semanas-apos":
      return (
        <NumberInput className={cx(classe, "!w-24")} value={prazo.semanas ?? 1} disabled={disabled}
          onValue={(v) => onChange({ ...prazo, semanas: Math.max(0, Math.round(v)) })}
          aria-label="Quantas semanas após o evento" />
      );
    case "ancora":
      return (
        <NumberInput className={cx(classe, "!w-24")} value={prazo.diasDoEvento ?? 0} disabled={disabled}
          onValue={(v) => onChange({ modo: "ancora", diasDoEvento: v })}
          aria-label="Dias em relação ao evento (negativo = antes)" />
      );
    default:
      return (
        <NumberInput className={cx(classe, "!w-24")} value={Math.round((prazo.percentual ?? 0) * 100)} disabled={disabled}
          onValue={(v) => onChange({ modo: "percentual", percentual: Math.min(100, Math.max(0, v)) / 100 })}
          aria-label="Percentual do período do projeto (0 a 100)" />
      );
  }
}
