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
import { Input, AutoTextarea, Select, CurrencyInput, NumberInput, Button, classeCampoStatus } from "@/components/ui";
import { IcGrip, IcChevron, IcPlus, IcEyeOff, IcTrash, IcSpark, IcCheck, IcBack } from "@/components/icons";
import { FornecedorField } from "@/components/FornecedorField";
import { RichTextField } from "@/components/RichTextField";
import { ObservacoesThread } from "@/components/ObservacoesPopup";
import { ResumoPropostaModal } from "@/components/ResumoPropostaModal";
import { NotifDot } from "@/components/NotifDot";
import { MoverSetas } from "@/components/MoverSetas";
import { OcultosEcModal } from "@/components/OcultosEcModal";
import { AdicionarEcModal, type NovoManual } from "@/components/AdicionarEcModal";
import type { EntradaImportada } from "@/domain/importarModeloEc";
import { confirmar } from "@/store/confirm";
import { toast } from "@/store/toast";
import { aplicarAlteracaoDeLinha } from "@/domain/ec";
import { grupoVisivel, ocultarTudo, ocultosPorGrupo, reexibirItens, totalOcultos } from "@/domain/ocultosEc";
import { destacarElemento, seguirElemento, idAncoraPendencia, idCampoDescricaoCompleta, idCampoPendencia, idGrupoEc } from "@/lib/destaque";
import { aprovarLinha, faltasParaEmitirOs, reverterAprovacaoLinha, opcaoNaoSeAplica, OPCOES_VALOR_ITEM, bvVazio, bvDaLinha, bvExigeJustificativa, limitarBvPercentual, BV_PADRAO_PERCENTUAL } from "@/domain/calc";
import { flags } from "@/lib/flags";
import { brl, cx } from "@/lib/format";
import type { BvItem, EcLinha, Fornecedor, ModalidadeProjeto, Observacao, OpcaoValorDefinida, StatusAprovacao, StatusOs } from "@/data/types";
import type { Sugestoes } from "@/domain/sugestoes";

/** Opções de status de OS e de Contrato — a mesma lista nos dois campos. */
const OPCOES_STATUS_OS: StatusOs[] = ["Pendente", "Emitir", "Emitir Nova Versão", "OK", "Não se Aplica"];


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
    valorComBvNf: 0,
    valorSemBvComNf: 0,
    valorSemBvSemNf: 0,
    valoresNaoAplicaveis: [],
    bv: bvVazio(),
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
  /** O que a casa já escreveu nestes campos em outras ECs (ver `domain/sugestoes`). */
  sugestoes: Sugestoes;
  /**
   * Pendências DO USUÁRIO por linha (id -> quantidade). O badge do item conta o
   * mesmo que o badge da EC e o navegador: "o que é seu", não "o que existe".
   */
  pendenciasPorLinha?: Record<string, number>;
  onValidarFornecedor: (cnpj: string) => Promise<string | null>;
  /** Modalidade ATUAL do projeto: define o modelo oferecido em "Adicionar grupo / item". */
  modalidade?: ModalidadeProjeto;
}

export function EcGrupos({
  linhas, onChange, verFinanceiro, fornecedores, usuarios, sugestoes,
  pendenciasPorLinha = {}, onValidarFornecedor, modalidade = "",
}: Props) {
  const [grupos, setGrupos] = useState<Grupo[]>(() => agrupar(linhas));
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [ativo, setAtivo] = useState<{ tipo: "grupo" | "item"; chave: string } | null>(null);
  const [popupOcultos, setPopupOcultos] = useState(false);
  const [popupAdicionar, setPopupAdicionar] = useState(false);
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
    commit(grupos.map((g) => ({ ...g, itens: g.itens.map((it) => (it.id === id ? aplicarAlteracaoDeLinha(it, patch) : it)) })));

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

  /**
   * Importa do modelo da modalidade. O item cai dentro do grupo de mesmo nome
   * (se a EC já o tem); "só o grupo" entra com uma linha em branco, porque o
   * grupo só existe enquanto tem ao menos uma linha.
   */
  const importarDoModelo = (entradas: EntradaImportada[]) => {
    const proximos = grupos.map((g) => ({ ...g, itens: [...g.itens] }));
    let ultimoId = "";
    for (const e of entradas) {
      const linha = { ...novaLinhaBase(), grupo: e.grupo, item: e.item, descricao: e.descricao };
      let g = proximos.find((x) => x.nome === e.grupo);
      if (!g) {
        g = { id: `grupo-${linha.id}`, nome: e.grupo, itens: [] };
        proximos.push(g);
      }
      g.itens.push(linha);
      ultimoId = g.id;
    }
    commit(proximos);
    if (ultimoId) setExpandido((x) => ({ ...x, [ultimoId]: true }));
    toast(`${entradas.length} ${entradas.length === 1 ? "linha importada" : "linhas importadas"} do modelo.`, "success");
  };

  /** Cria do zero: um grupo novo (com uma linha em branco) ou um item num grupo. */
  const criarManual = (n: NovoManual) => {
    if (n.tipo === "item") {
      const alvo = grupos.find((g) => g.nome === n.grupo);
      if (!alvo) return;
      const nova = { ...novaLinhaBase(), grupo: alvo.nome, item: n.nome, descricao: n.nome };
      commit(grupos.map((g) => (g === alvo ? { ...g, itens: [...g.itens, nova] } : g)));
      setExpandido((x) => ({ ...x, [alvo.id]: true }));
      destacarElemento(idAncoraPendencia(nova.id));
      return;
    }
    const nome = nomeGrupoUnico(n.nome, grupos);
    const linha = { ...novaLinhaBase(), grupo: nome };
    const id = `grupo-${linha.id}`;
    commit([...grupos, { id, nome, itens: [linha] }]);
    setExpandido((x) => ({ ...x, [id]: true }));
    destacarElemento(idGrupoEc(id));
  };

  const excluirItem = async (id: string) => {
    const alvo = grupos.flatMap((g) => g.itens).find((i) => i.id === id);
    if (!alvo) return;
    const impede = motivoQueImpedeExcluir(alvo);
    if (impede) {
      toast(impede, "warning");
      return;
    }
    const grupo = grupos.find((g) => g.itens.some((i) => i.id === id))!;
    const ultimo = grupo.itens.length === 1;
    const ok = await confirmar({
      titulo: "Excluir este item?",
      mensagem: `“${alvo.item || "Item sem nome"}” será removido da EC${ultimo ? ", e o grupo " + grupo.nome + " também, por ficar sem itens" : ""}. A exclusão vale ao salvar a EC.`,
      confirmarTexto: "Excluir item",
      tom: "danger",
    });
    if (!ok) return;
    commit(
      grupos
        .map((g) => (g === grupo ? { ...g, itens: g.itens.filter((i) => i.id !== id) } : g))
        .filter((g) => g.itens.length > 0),
    );
  };

  const excluirGrupo = async (grupoId: string) => {
    const grupo = grupos.find((g) => g.id === grupoId);
    if (!grupo) return;
    const impede = grupo.itens.map(motivoQueImpedeExcluir).find(Boolean);
    if (impede) {
      toast(impede, "warning");
      return;
    }
    const n = grupo.itens.length;
    const ok = await confirmar({
      titulo: "Excluir este grupo?",
      mensagem: `O grupo ${grupo.nome} e ${n === 1 ? "o seu 1 item" : `os seus ${n} itens`} serão removidos da EC. A exclusão vale ao salvar a EC.`,
      confirmarTexto: "Excluir grupo",
      tom: "danger",
    });
    if (!ok) return;
    setSelecionados((sel) => {
      const novo = new Set(sel);
      grupo.itens.forEach((i) => novo.delete(i.id));
      return novo;
    });
    commit(grupos.filter((g) => g.id !== grupoId));
  };

  /**
   * Move um GRUPO inteiro uma posição para cima ou para baixo.
   *
   * Mesmo par de setas dos itens, agora na barra do grupo: numa EC com muitos
   * grupos, arrastar um card inteiro por cima dos outros é desconfortável, e a
   * ordem dos grupos é justamente o que define a leitura da EC e do Excel.
   */
  const moverGrupo = (grupoId: string, direcao: -1 | 1) => {
    // O vizinho é o grupo VISÍVEL mais próximo: grupo oculto some da tela, e uma
    // seta que trocasse com ele pareceria não fazer nada.
    const idsVisiveis = grupos.filter((g) => grupoVisivel(g.itens)).map((g) => g.id);
    const alvoId = idsVisiveis[idsVisiveis.indexOf(grupoId) + direcao];
    const atual = grupos.findIndex((g) => g.id === grupoId);
    const destino = grupos.findIndex((g) => g.id === alvoId);
    if (atual < 0 || destino < 0) return;
    commit(arrayMove(grupos, atual, destino));
    // A tela acompanha o grupo — senão ele sai de vista a cada toque na seta.
    seguirElemento(idGrupoEc(grupoId));
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
      // Grupo oculto some da tela: o item passa para o próximo grupo VISÍVEL.
      let iDestino = iGrupo + direcao;
      while (iDestino >= 0 && iDestino < grupos.length && !grupoVisivel(grupos[iDestino].itens)) iDestino += direcao;
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
  /** Marca de uma vez, na EC inteira, todo item visível com Aprovação pendente. */
  const selecionarPendentes = () => setSelecionados(new Set(pendentesAprovacao.map((l) => l.id)));

  /**
   * Poda a seleção sempre que a lista de itens muda.
   *
   * Sem isto o id de um item ocultado, apagado ou substituído (troca de versão
   * da EC / template) continuava marcado: o contador da barra inflava e a ação
   * em bloco alcançava item que já não estava na tela.
   */
  useEffect(() => {
    setSelecionados((s) => {
      if (s.size === 0) return s;
      const validos = new Set(grupos.flatMap((g) => g.itens.filter((i) => !i.oculto).map((i) => i.id)));
      if ([...s].every((id) => validos.has(id))) return s; // nada mudou — evita re-render à toa
      return new Set([...s].filter((id) => validos.has(id)));
    });
  }, [grupos]);

  /** Itens de fato marcados e à vista — base de toda ação em bloco. */
  const linhasSelecionadas = grupos.flatMap((g) => g.itens).filter((it) => !it.oculto && selecionados.has(it.id));
  /** Só entram na aprovação em bloco os que ainda estão pendentes. */
  const aAprovar = linhasSelecionadas.filter((l) => l.statusAprovacao === "Pendente");
  /** Já aprovados: a ação não os toca (reaprovar item sem alteração não faz sentido). */
  const jaAprovados = linhasSelecionadas.filter((l) => l.statusAprovacao === "OK");
  /**
   * Prévia do bloqueio: roda a peneira da emissão sobre o item já simulado como
   * aprovado. Assim a barra avisa ANTES do clique quantos itens vão ficar
   * marcados para emitir mas travados por falta de dado fiscal — em vez de a
   * pessoa só descobrir isso lá na tela de emissão.
   */
  const previaAprovacao = aAprovar
    .map(aprovarLinha)
    .filter((l) => l.statusOs === "Emitir" || l.statusOs === "Emitir Nova Versão")
    .map((l) => faltasParaEmitirOs(l, verFinanceiro));
  const bloqueiosPrevistos = previaAprovacao.filter((faltas) => faltas.length > 0);
  /** Campos que travam a seleção atual — vira o texto do aviso. */
  const camposFaltantes = [...new Set(bloqueiosPrevistos.flat())];
  /** Vão sair da barra prontos para virar OS. */
  const liberadosPrevistos = previaAprovacao.length - bloqueiosPrevistos.length;

  /**
   * Aplica uma transição de status a todos os itens marcados e visíveis.
   *
   * A regra de cada transição mora em `domain/calc` (`aprovarLinha` /
   * `reverterAprovacaoLinha`), que devolve o item intacto quando ele não se
   * enquadra — aqui só sobra percorrer os grupos. Os dois campos continuam
   * editáveis um a um no próprio item, sem restrição.
   */
  const aplicarNaSelecao = (transicao: (l: EcLinha) => EcLinha) => {
    commit(
      grupos.map((g) => ({
        ...g,
        itens: g.itens.map((it) => (selecionados.has(it.id) && !it.oculto ? transicao(it) : it)),
      }))
    );
    limparSelecao();
  };

  const aprovarSelecionados = () => aplicarNaSelecao(aprovarLinha);
  const reverterSelecionados = () => aplicarNaSelecao(reverterAprovacaoLinha);

  /**
   * Os TRÊS status, em massa, separadamente ou em conjunto (pedido de
   * 15/09/2026): *"o sistema deverá permitir a seleção de todos ou de alguns
   * itens para alterar simultaneamente os Status Aprovação, OS e Contrato"*.
   *
   * A barra tinha só o par pronto "Aprovar e liberar OS" — que continua sendo o
   * atalho do dia a dia, porque aprovar e pedir a OS é um gesto só. O que
   * faltava era mexer em UM dos três sem mexer nos outros: marcar trinta itens
   * como "Contrato: Não se Aplica" era trinta cliques em trinta seletores.
   *
   * Aprovação continua passando pela regra da casa (`aprovarLinha` /
   * `reverterAprovacaoLinha`), que também acerta a OS: fora dela, "OK" aqui
   * deixaria o item aprovado com a OS parada em Pendente, que é o defeito que
   * essa regra existe para evitar.
   */
  const definirAprovacaoSelecionados = (valor: StatusAprovacao) =>
    aplicarNaSelecao(valor === "OK" ? aprovarLinha : reverterAprovacaoLinha);
  const definirStatusSelecionados = (campo: "statusOs" | "contratoStatus", valor: StatusOs) =>
    aplicarNaSelecao((l) => ({ ...l, [campo]: valor }));

  const totalSelecionados = linhasSelecionadas.length;
  /** Todo item visível com Aprovação pendente, na EC inteira (atalho da barra de ferramentas). */
  const pendentesAprovacao = grupos.flatMap((g) => g.itens).filter((it) => !it.oculto && it.statusAprovacao === "Pendente");
  /** Já estão todos marcados? Então o atalho vira "limpar" em vez de repetir a ação. */
  const todosPendentesMarcados =
    pendentesAprovacao.length > 0 && pendentesAprovacao.every((l) => selecionados.has(l.id)) && totalSelecionados === pendentesAprovacao.length;

  /** Item com OS emitida (ou a reemitir) não se apaga nem se oculta: a OS perderia o vínculo. */
  const itemTemOs = (l: EcLinha) => l.statusOs === "OK" || l.statusOs === "Emitir Nova Versão";
  const motivoQueImpedeExcluir = (l: EcLinha): string | null =>
    itemTemOs(l) ? `O item “${l.item || "sem nome"}” já tem OS (${l.statusOs}). Resolva a OS antes de excluí-lo.` : null;
  const motivoQueImpedeOcultar = (l: EcLinha): string | null =>
    itemTemOs(l) ? `O item “${l.item || "sem nome"}” já tem OS (${l.statusOs}) e não pode ser ocultado.` : null;

  /** Oculta um item: ele some da tela (volta pelo popup "Ocultos"). */
  const setOcultoItem = (id: string, oculto: boolean) => {
    const alvo = grupos.flatMap((g) => g.itens).find((i) => i.id === id);
    const impede = oculto && alvo ? motivoQueImpedeOcultar(alvo) : null;
    if (impede) {
      toast(impede, "warning");
      return;
    }
    updLinha(id, { oculto });
  };
  /** Oculta o grupo inteiro (todos os itens): o card some da tela. */
  const setOcultoGrupo = (grupoNome: string, oculto: boolean) => {
    const alvo = grupos.find((g) => g.nome === grupoNome);
    const impede = oculto ? alvo?.itens.map(motivoQueImpedeOcultar).find(Boolean) : null;
    if (impede) {
      toast(`O grupo ${grupoNome} não pode ser ocultado. ${impede}`, "warning");
      return;
    }
    commit(grupos.map((g) => (g.nome === grupoNome ? { ...g, itens: g.itens.map((it) => ({ ...it, oculto })) } : g)));
  };
  /**
   * OCULTAR TUDO: oculta o que já foi criado até este clique. Substitui o
   * "ocultar não preenchidos" — item e grupo sem preço também precisam ficar
   * descritos na EC, então "vazio" não é critério para esconder.
   */
  const ocultarTudoAgora = () => {
    const comOs = grupos.flatMap((g) => g.itens).filter((i) => !i.oculto && itemTemOs(i)).length;
    // Item com OS fica na tela: só ele escapa do "ocultar tudo".
    commit(grupos.map((g) => ({ ...g, itens: ocultarTudo(g.itens).map((i, k) => (itemTemOs(g.itens[k]) ? g.itens[k] : i)) })));
    if (comOs) toast(`${comOs} ${comOs === 1 ? "item com OS permaneceu" : "itens com OS permaneceram"} na tela.`, "info");
  };
  const todasAsLinhas = grupos.flatMap((g) => g.itens);
  const qtdVisiveis = todasAsLinhas.length - totalOcultos(todasAsLinhas);
  const qtdOcultos = totalOcultos(todasAsLinhas);
  /** Reexibe os itens escolhidos no popup. */
  const reexibir = (ids: string[]) => {
    const alvo = new Set(ids);
    commit(grupos.map((g) => ({ ...g, itens: reexibirItens(g.itens, alvo) })));
    // Os grupos que voltaram aparecem abertos, para o resultado ficar à vista.
    setExpandido((e) => {
      const novo = { ...e };
      for (const g of grupos) if (g.itens.some((i) => alvo.has(i.id))) novo[g.id] = true;
      return novo;
    });
  };
  const gruposVisiveis = grupos.filter((g) => grupoVisivel(g.itens));

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
        <div className="sticky top-[calc(var(--altura-topnav)+var(--altura-cabecalho)+8px)] z-10 space-y-1.5 rounded-btn border border-primary bg-primary-soft px-3 py-2 shadow-card">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[13px] font-extrabold text-primary-dark">
              {totalSelecionados} {totalSelecionados === 1 ? "item selecionado" : "itens selecionados"}
            </span>
            <Button
              size="sm"
              icon={<IcCheck width={15} height={15} />}
              onClick={aprovarSelecionados}
              disabled={aAprovar.length === 0}
              title={
                aAprovar.length === 0
                  ? "Nenhum item pendente na seleção — os marcados já estão aprovados"
                  : "Marca a Aprovação como OK e, nos itens com OS ainda Pendente, muda a OS para Emitir"
              }
            >
              Aprovar e liberar OS ({aAprovar.length})
            </Button>
            {jaAprovados.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                icon={<IcBack width={15} height={15} />}
                onClick={reverterSelecionados}
                title="Volta a Aprovação para Pendente e desfaz a OS que ficou em Emitir (não mexe em OS já emitida)"
              >
                Reverter para Pendente ({jaAprovados.length})
              </Button>
            )}
            <button type="button" onClick={limparSelecao} className="ml-auto text-[12.5px] font-bold text-ink-2 hover:text-ink">
              Limpar seleção
            </button>
          </div>

          {/* Os três status, um a um: o atalho acima faz o par mais comum
              (aprovar + liberar OS); aqui se muda só o que se quer mudar. */}
          <div className="flex items-center gap-2 flex-wrap border-t border-primary/20 pt-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-primary-dark/80">
              Alterar em massa
            </span>
            <SeletorEmMassa
              rotulo="Aprovação"
              opcoes={["Pendente", "OK"]}
              onEscolher={(v) => definirAprovacaoSelecionados(v as StatusAprovacao)}
            />
            <SeletorEmMassa
              rotulo="OS"
              opcoes={OPCOES_STATUS_OS}
              onEscolher={(v) => definirStatusSelecionados("statusOs", v as StatusOs)}
            />
            <SeletorEmMassa
              rotulo="Contrato"
              opcoes={OPCOES_STATUS_OS}
              onEscolher={(v) => definirStatusSelecionados("contratoStatus", v as StatusOs)}
            />
          </div>

          {/* Prévia do efeito: o que sai pronto para OS e o que ainda vai travar.
              Evita a descoberta tardia na tela de emissão. */}
          {aAprovar.length > 0 && (
            <div className="text-[12px] font-bold text-ink-2 leading-snug">
              {liberadosPrevistos > 0 && (
                <span className="text-primary-dark">
                  {liberadosPrevistos} {liberadosPrevistos === 1 ? "item fica pronto" : "itens ficam prontos"} para emitir OS
                </span>
              )}
              {liberadosPrevistos > 0 && bloqueiosPrevistos.length > 0 && <span className="text-border"> · </span>}
              {bloqueiosPrevistos.length > 0 && (
                <span title={`Falta preencher: ${camposFaltantes.join(", ")}`}>
                  {bloqueiosPrevistos.length} {bloqueiosPrevistos.length === 1 ? "ficará bloqueado" : "ficarão bloqueados"} até preencher{" "}
                  <span className="text-danger">{camposFaltantes.join(", ")}</span>
                </span>
              )}
            </div>
          )}
          {jaAprovados.length > 0 && (
            <div className="text-[12px] font-bold text-ink-3 leading-snug">
              {jaAprovados.length} {jaAprovados.length === 1 ? "item já aprovado" : "itens já aprovados"} — a aprovação não os altera.
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="secondary" size="sm" icon={<IcPlus width={16} height={16} />} onClick={() => setPopupAdicionar(true)}>
          Adicionar grupo / item
        </Button>
        <div className="flex items-center gap-3 text-[13px] font-bold text-ink-2">
          {pendentesAprovacao.length > 0 && (
            <>
              <button
                onClick={todosPendentesMarcados ? limparSelecao : selecionarPendentes}
                className="hover:text-ink"
                title="Marca de uma vez, na EC inteira, todos os itens visíveis com Aprovação ainda pendente"
              >
                {todosPendentesMarcados ? "Limpar seleção" : `Selecionar todos os pendentes (${pendentesAprovacao.length})`}
              </button>
              <span className="text-border">|</span>
            </>
          )}
          {qtdVisiveis > 0 && (
            <>
              <button onClick={ocultarTudoAgora} className="hover:text-ink" title="Oculta tudo o que já foi criado até agora — o que você criar depois aparece normalmente. Dá para reexibir em Ocultos.">
                Ocultar tudo ({qtdVisiveis})
              </button>
              <span className="text-border">|</span>
            </>
          )}
          {qtdOcultos > 0 && (
            <>
              <button onClick={() => setPopupOcultos(true)} className="hover:text-ink" title="Escolher quais grupos e itens voltam para a tela">
                Ocultos ({qtdOcultos})
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
          A EC está em branco. Use “Adicionar grupo / item” para criar do zero ou importar do modelo da modalidade.
        </div>
      )}
      {grupos.length > 0 && gruposVisiveis.length === 0 && (
        <div className="text-center text-ink-3 text-sm py-8 border border-dashed border-border rounded-card">
          Tudo está oculto. Use “Adicionar grupo / item” para criar um novo ou “Ocultos ({qtdOcultos})” para reexibir.
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <SortableContext items={gruposVisiveis.map((g) => GID(g.id))} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {gruposVisiveis.map((g, iGrupo) => (
              <GrupoCard
                key={g.id}
                g={g}
                aberto={isExp(g.id)}
                primeiroGrupo={iGrupo === 0}
                ultimoGrupo={iGrupo === gruposVisiveis.length - 1}
                verFinanceiro={verFinanceiro}
                fornecedores={fornecedores}
                usuarios={usuarios}
                sugestoes={sugestoes}
                pendenciasPorLinha={pendenciasPorLinha}
                selecionados={selecionados}
                onToggle={() => toggle(g.id)}
                onRenomear={(v) => renomearGrupo(g.nome, v)}
                onAddItem={() => addItem(g.nome)}
                onUpdLinha={updLinha}
                onOcultoItem={setOcultoItem}
                onOcultoGrupo={(v) => setOcultoGrupo(g.nome, v)}
                onExcluirItem={excluirItem}
                onExcluirGrupo={() => excluirGrupo(g.id)}
                onSelecionarItem={alternarSelecao}
                onSelecionarGrupo={(marcar) => alternarSelecaoGrupo(g.id, marcar)}
                onMoverItem={(itemId, direcao) => moverItem(g.id, itemId, direcao)}
                onMoverGrupo={(direcao) => moverGrupo(g.id, direcao)}
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

      {popupAdicionar && (
        <AdicionarEcModal
          modalidade={modalidade}
          gruposExistentes={grupos.map((g) => g.nome)}
          onImportar={importarDoModelo}
          onCriar={criarManual}
          onFechar={() => setPopupAdicionar(false)}
        />
      )}

      {popupOcultos && (
        <OcultosEcModal
          grupos={ocultosPorGrupo(todasAsLinhas)}
          onReexibir={reexibir}
          onFechar={() => setPopupOcultos(false)}
        />
      )}
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
  sugestoes: Sugestoes;
  pendenciasPorLinha: Record<string, number>;
  selecionados: Set<string>;
  onToggle: () => void;
  onRenomear: (v: string) => void;
  onAddItem: () => void;
  onUpdLinha: (id: string, patch: Partial<EcLinha>) => void;
  onOcultoItem: (id: string, oculto: boolean) => void;
  onOcultoGrupo: (oculto: boolean) => void;
  onExcluirItem: (id: string) => void;
  onExcluirGrupo: () => void;
  onSelecionarItem: (id: string) => void;
  onSelecionarGrupo: (marcar: boolean) => void;
  onMoverItem: (itemId: string, direcao: -1 | 1) => void;
  onMoverGrupo: (direcao: -1 | 1) => void;
  onValidarFornecedor: (cnpj: string) => Promise<string | null>;
}

function GrupoCard({
  g, aberto, primeiroGrupo, ultimoGrupo, verFinanceiro, fornecedores, usuarios, sugestoes,
  pendenciasPorLinha, selecionados,
  onToggle, onRenomear, onAddItem, onUpdLinha, onOcultoItem, onOcultoGrupo, onExcluirItem, onExcluirGrupo,
  onSelecionarItem, onSelecionarGrupo, onMoverItem, onMoverGrupo, onValidarFornecedor,
}: GrupoProps) {
  const sortable = useSortable({ id: GID(g.id) });
  const droppable = useDroppable({ id: CID(g.id) });
  const setRefs = (node: HTMLElement | null) => {
    sortable.setNodeRef(node);
    droppable.setNodeRef(node);
  };
  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };

  const visiveis = g.itens.filter((l) => !l.oculto);
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
        {/* Mesmas setas dos itens: uma posição por vez, sem precisar arrastar o card. */}
        <MoverSetas
          rotulo={`o grupo ${g.nome}`}
          podeSubir={!primeiroGrupo}
          podeDescer={!ultimoGrupo}
          onSubir={() => onMoverGrupo(-1)}
          onDescer={() => onMoverGrupo(1)}
        />
        <button onClick={onToggle} className="shrink-0 text-ink-2 hover:text-ink" title={aberto ? "Retrair" : "Expandir"}>
          <IcChevron width={20} height={20} className={cx("transition-transform duration-200", aberto && "rotate-90")} />
        </button>
        <Input
          className="!h-10 !px-2.5 !text-[15px] !font-bold !uppercase max-w-sm"
          formato="grupo"
          value={g.nome}
          sugestoes={sugestoes.valores.grupoEc}
          onChange={(e) => onRenomear(e.target.value)}
        />
        <span className="shrink-0 text-[12px] font-bold text-ink-3 bg-[#F0F1F4] rounded-pill px-2.5 py-1">
          {visiveis.length} {visiveis.length === 1 ? "item" : "itens"}
        </span>
        {verFinanceiro && subtotal > 0 && (
          <span className="shrink-0 text-[14px] font-display font-bold text-ink-2">{brl(subtotal)}</span>
        )}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onOcultoGrupo(true)}
            className="inline-flex items-center rounded-btn p-1.5 text-ink-3 hover:bg-primary-soft hover:text-primary-dark"
            title="Ocultar grupo — some da tela e fica guardado (reexibir em Ocultos)"
            aria-label="Ocultar grupo"
          >
            <IcEyeOff width={17} height={17} />
          </button>
          <button
            type="button"
            onClick={onExcluirGrupo}
            className="inline-flex items-center rounded-btn p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger"
            title="Excluir grupo e todos os seus itens"
            aria-label="Excluir grupo"
          >
            <IcTrash width={17} height={17} />
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
                sugestoes={sugestoes}
                pendencias={pendenciasPorLinha[l.id] ?? 0}
                selecionado={selecionados.has(l.id)}
                // Na borda de um grupo do meio a seta continua ativa: ela leva o
                // item para o grupo vizinho. Só trava nas pontas da EC ou quando
                // o item é o único do grupo (sair apagaria o grupo).
                primeiro={indice === 0 && (primeiroGrupo || itemUnico)}
                ultimo={indice === visiveis.length - 1 && (ultimoGrupo || itemUnico)}
                motivoBloqueio={itemUnico ? "Único item do grupo — tirá-lo daqui apagaria o grupo" : undefined}
                onUpd={(patch) => onUpdLinha(l.id, patch)}
                onOcultar={() => onOcultoItem(l.id, true)}
                onExcluir={() => onExcluirItem(l.id)}
                onSelecionar={() => onSelecionarItem(l.id)}
                onMover={(direcao) => onMoverItem(l.id, direcao)}
                onValidarFornecedor={onValidarFornecedor}              />
            ))}
          </SortableContext>

          {visiveis.length === 0 && (
            <div className="text-center text-ink-3 text-[13px] py-4">Este grupo não tem itens.</div>
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
  sugestoes: Sugestoes;
  /** Pendências do usuário nesta linha — o mesmo número do badge da EC. */
  pendencias: number;
  selecionado: boolean;
  primeiro: boolean;
  ultimo: boolean;
  /** Texto do tooltip quando a seta está apagada por regra, não por estar na ponta. */
  motivoBloqueio?: string;
  onUpd: (patch: Partial<EcLinha>) => void;
  onOcultar: () => void;
  onExcluir: () => void;
  onSelecionar: () => void;
  onMover: (direcao: -1 | 1) => void;
  onValidarFornecedor: (cnpj: string) => Promise<string | null>;
}

function ItemRow({
  l, verFinanceiro, fornecedores, usuarios, sugestoes, pendencias, selecionado, primeiro, ultimo, motivoBloqueio,
  onUpd, onOcultar, onExcluir, onSelecionar, onMover, onValidarFornecedor,
}: ItemProps) {
  const sortable = useSortable({ id: l.id });
  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };
  const [resumoAberto, setResumoAberto] = useState(false);

  /**
   * O resumo da proposta entra na Descrição Completa — e a tela mostra onde.
   *
   * O texto é ACRESCENTADO ao que já existe (ninguém quer perder o descritivo
   * que escreveu), só que num campo já preenchido ele caía abaixo da dobra do
   * editor: o modal fechava, nada aparecia, e o recurso parecia quebrado. Agora
   * o campo é destacado depois da inserção, com a mesma marca do resto do
   * sistema para "isto acabou de aparecer".
   */
  const inserirResumo = (html: string) => {
    if (!html) return;
    onUpd({ descricaoCompleta: l.descricaoCompleta ? `${l.descricaoCompleta}${html}` : html });
    destacarElemento(idCampoDescricaoCompleta(l.id), "novo");
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
          <NotifDot inline n={pendencias} title={`${pendencias} pendência(s) sua(s) neste item`} />
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
            <Input
              className="!h-10 !px-2.5 !text-[13.5px] !font-semibold"
              placeholder="Nome do item"
              formato="item"
              value={l.item}
              sugestoes={sugestoes.valores.itemEc}
              onChange={(e) => onUpd({ item: e.target.value })}
            />
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
          <Campo label="Descrição Completa" id={idCampoDescricaoCompleta(l.id)}>
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
          <button type="button" onClick={onOcultar} className="text-ink-3 hover:text-primary p-1.5" title="Ocultar item — some da tela e fica guardado (reexibir em Ocultos)" aria-label="Ocultar item">
            <IcEyeOff width={18} height={18} />
          </button>
          <button type="button" onClick={onExcluir} className="text-ink-3 hover:text-danger p-1.5" title="Excluir item" aria-label="Excluir item">
            <IcTrash width={18} height={18} />
          </button>
        </div>
      </div>

      {/* Linha 2: metadados */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[0.7fr_2.6fr_1fr_1fr_1fr_1fr_0.7fr] items-end gap-2 px-2.5 pb-2.5 pt-1 border-t border-border-soft bg-[#FCFCFD] rounded-b-card min-w-0">
        <Campo label="Aprovação" className="w-full">
          {/* Aprovar o item JÁ pede a OS: a mesma regra do botão "Aprovar
              selecionados" (ver `aprovarLinha`), para o campo OS não ficar em
              "Pendente" num item que o cliente já liberou. Voltar para Pendente
              desfaz só a OS que a aprovação criou. */}
          <Select
            className={cx("!h-9 !px-2 !text-[12.5px]", classeCampoStatus(l.statusAprovacao))}
            value={l.statusAprovacao}
            onChange={(e) => {
              const escolhido = e.target.value as StatusAprovacao;
              const revisto = escolhido === "OK" ? aprovarLinha(l) : reverterAprovacaoLinha(l);
              onUpd({ statusAprovacao: revisto.statusAprovacao, statusOs: revisto.statusOs });
            }}
          >
            <option>Pendente</option>
            <option>OK</option>
          </Select>
        </Campo>
        {/* OS e CONTRATO logo depois da Aprovação (15/09/2026): é a sequência
            da decisão — aprovou, decide o que emitir — e era o que obrigava a
            atravessar os dados do fornecedor para chegar nos dois seletores que
            mais se mexem.
            Os dois levam id próprio: "OS a emitir" é uma pendência, e o
            navegador/sininho pisca exatamente este pedaço da linha. */}
        <Campo label="OS" className="w-full" id={idCampoPendencia(l.id, "os")}>
          <Select className={cx("!h-9 !px-2 !text-[12.5px]", classeCampoStatus(l.statusOs))} value={l.statusOs} onChange={(e) => onUpd({ statusOs: e.target.value as StatusOs })}>
            {OPCOES_STATUS_OS.map((o) => <option key={o}>{o}</option>)}
          </Select>
        </Campo>
        {/* Contrato usa exatamente a mesma lista da OS (inclui "Emitir Nova Versão"). */}
        <Campo label="Contrato" className="w-full" id={idCampoPendencia(l.id, "contrato")}>
          <Select className={cx("!h-9 !px-2 !text-[12.5px]", classeCampoStatus(l.contratoStatus))} value={l.contratoStatus} onChange={(e) => onUpd({ contratoStatus: e.target.value as StatusOs })}>
            {OPCOES_STATUS_OS.map((o) => <option key={o}>{o}</option>)}
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
        {/* DOCUMENTO PG, CÓDIGO DE SERVIÇO e PEDIDO DE COMPRA são LEITURA aqui
            (15/09/2026). Eles são decididos na OS, por quem emite o faturamento,
            e voltam preenchidos para o item da EC válida. Editáveis dos dois
            lados, a EC e a OS discordavam sobre o mesmo dado — e, pior, a EC
            esperava por eles para deixar a OS nascer. */}
        <Campo label="Documento PG" className="w-full">
          <DaOs valor={l.faturaNf} />
        </Campo>
        <Campo label="Código de Serviço" className="w-full">
          <DaOs valor={l.codigoServico} />
        </Campo>
        <Campo label="Pedido de Compra" className="w-full">
          <DaOs valor={l.pedidoCompra} />
        </Campo>
      </div>

      {verFinanceiro && <OpcoesDeValor l={l} onUpd={onUpd} />}

      <ObservacoesThread
        ancora={l.id}
        observacoes={l.observacoes}
        usuarios={usuarios}
        onChange={(obs: Observacao[]) => onUpd({ observacoes: obs })}
      />

      {resumoAberto && <ResumoPropostaModal onInserir={inserirResumo} onClose={() => setResumoAberto(false)} />}
    </div>
  );
}

/**
 * Campo do item que a OS preenche — aqui ele é leitura.
 *
 * Vazio não é erro: quer dizer que a OS daquele fornecedor ainda não chegou a
 * esta etapa. Escrever de onde vem evita o que acontecia antes, que era alguém
 * digitar um código de serviço na EC e a OS gravar outro por cima.
 */
function DaOs({ valor }: { valor: string }) {
  return (
    <div
      className="h-9 px-2 flex items-center rounded-btn bg-[#F1F2F5] border border-border-soft text-[12.5px] text-ink-2 truncate"
      title={valor ? `${valor} — preenchido na OS` : "Será preenchido na OS deste fornecedor"}
    >
      {valor || <span className="text-ink-3">— vem da OS</span>}
    </div>
  );
}

/**
 * ALTERNATIVAS DE CUSTOS — as três formas de cobrar o item, numa tabela.
 *
 * O que são: a produção levanta quanto o item custaria de cada forma (ou
 * responde "Não se aplica"), e as três seguem lado a lado para a OS, que é onde
 * se decide por qual delas o item vai ser pago. Na EC não há escolha — havia um
 * rádio elegendo "a que vale", e ele obrigava a fechar a condição de pagamento
 * dentro de um documento ainda em montagem.
 *
 * COMO É DESENHADO mudou em 15/09/2026. Eram três cartões lado a lado, e eles
 * comiam a largura da tela em toda linha da EC, preenchidos ou não. A Pólobh
 * pediu "a menor ocupação possível" e "poder ser ocultada ou exibida, em cada
 * item": virou uma tabela de três linhas — Modalidade · Valor · BV · Observações
 * sob o BV —, recolhida por padrão, com uma linha-resumo que diz o que já foi
 * informado. Quem está lançando custo abre; quem está conferindo outra coisa
 * não perde meia tela com ela.
 *
 * O BV entra AQUI, e não só na OS, porque é aqui que ele é combinado: quem
 * negocia o valor negocia a bonificação no mesmo gesto. Ele só existe na linha
 * "com BV e NF" — nas outras duas, por definição, não há BV, e a coluna diz
 * isso em vez de ficar vazia.
 */
function OpcoesDeValor({ l, onUpd }: { l: EcLinha; onUpd: (patch: Partial<EcLinha>) => void }) {
  const [aberta, setAberta] = useState(false);

  /**
   * Alterna entre digitar o valor e responder "Não se aplica".
   *
   * O valor digitado NÃO é apagado ao marcar "não se aplica" — quem marcou por
   * engano volta atrás sem perder o que tinha escrito.
   */
  const alternarNaoSeAplica = (opcao: OpcaoValorDefinida) => {
    const atuais = l.valoresNaoAplicaveis ?? [];
    const marcando = !atuais.includes(opcao);
    onUpd({
      valoresNaoAplicaveis: marcando ? [...atuais, opcao] : atuais.filter((o) => o !== opcao),
    });
  };

  // O resumo da linha fechada: o que já foi respondido, sem precisar abrir.
  const respondidas = OPCOES_VALOR_ITEM.filter(
    ({ opcao, campo }) => opcaoNaoSeAplica(l, opcao) || Number(l[campo] ?? 0) > 0
  ).length;

  return (
    <div className="px-2.5 pb-2 pt-1.5 border-t border-border-soft bg-[#FCFCFD]">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="w-full flex items-center gap-2 text-left py-0.5 group/alt"
      >
        <IcChevron
          width={12}
          height={12}
          className={cx("shrink-0 text-ink-3 transition-transform", aberta ? "rotate-90" : "")}
        />
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-ink-3 group-hover/alt:text-ink-2">
          Alternativas de Custos
        </span>
        <span className="text-[11px] text-ink-3 truncate">
          {aberta
            ? "Informe as negociações possíveis a serem definidas no ato da emissão das OS's"
            : `${respondidas} de 3 formas informadas · a escolha é feita na OS`}
        </span>
      </button>

      {aberta && (
        <div className="mt-1.5 overflow-x-auto">
          <table className="w-full text-[12px] border-separate border-spacing-0">
            <thead>
              <tr className="text-left">
                {["Modalidade", "Valor", "BV", "Observações sob o BV"].map((c) => (
                  <th
                    key={c}
                    className="px-2 py-1 text-[9.5px] font-extrabold uppercase tracking-[0.05em] text-ink-3 border-b border-border-soft"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OPCOES_VALOR_ITEM.map(({ opcao, rotulo, campo }) => {
                const naoSeAplica = opcaoNaoSeAplica(l, opcao);
                return (
                  <tr key={opcao} className="align-top">
                    <td className="px-2 py-1 border-b border-border-soft">
                      <span className="block text-[11.5px] font-bold text-ink-2 leading-tight">{rotulo}</span>
                      {/* "Valor Sem BV e Sem NF" só aceita valor (tabela da
                          Pólobh de 29/09/2026): o "Não se aplica" não é oferecido.
                          Se um item antigo já o tem marcado, o botão aparece só
                          para desfazer. */}
                      {(opcao !== "semBvSemNf" || naoSeAplica) && (
                        <button
                          type="button"
                          onClick={() => alternarNaoSeAplica(opcao)}
                          className="text-[10px] font-bold text-ink-3 hover:text-primary-dark input-focus rounded"
                          title={naoSeAplica ? "Voltar a informar um valor" : "Este item não é cobrado desta forma"}
                        >
                          {naoSeAplica ? "Informar valor" : "Não se aplica"}
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-1 border-b border-border-soft w-[9rem]">
                      {/* Ou o valor, ou "Não se aplica" — as duas respostas
                          possíveis, ambas diferentes de deixar em branco. */}
                      {naoSeAplica ? (
                        <div className="h-8 flex items-center rounded-btn border border-border-soft bg-[#F1F2F5] px-2 text-[11.5px] font-bold text-ink-3">
                          Não se aplica
                        </div>
                      ) : (
                        <CurrencyInput
                          className="!h-8 !px-2 !text-[12.5px]"
                          value={l[campo]}
                          onValue={(v) => onUpd({ [campo]: v } as Partial<EcLinha>)}
                          title={l.valorPolobh > 0 ? `Até ${brl(l.valorPolobh)} (valor definido do item)` : undefined}
                          aria-label={`${rotulo} do item ${l.item || "sem título"}`}
                        />
                      )}
                    </td>
                    <td className="px-2 py-1 border-b border-border-soft w-[11rem]">
                      {opcao === "comBvNf" ? (
                        naoSeAplica ? (
                          <span className="text-[11px] text-ink-3">—</span>
                        ) : (
                          <CamposBv l={l} onUpd={onUpd} />
                        )
                      ) : (
                        <span className="text-[11px] text-ink-3">Não se aplica</span>
                      )}
                    </td>
                    <td className="px-2 py-1 border-b border-border-soft">
                      <ObservacaoDaForma opcao={opcao} l={l} onUpd={onUpd} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * A observação de UMA forma de cobrança.
 *
 * Na linha "com BV e NF" ela é a justificativa do BV, que a casa exige quando o
 * BV foge do padrão — e aí o campo fica vermelho enquanto faltar. Nas outras
 * duas é uma nota livre ("o fornecedor não trabalha com BV"), guardada dentro do
 * próprio `bv` para não custar coluna nova (ver `BvItem`).
 */
function ObservacaoDaForma({
  opcao,
  l,
  onUpd,
}: {
  opcao: OpcaoValorDefinida;
  l: EcLinha;
  onUpd: (patch: Partial<EcLinha>) => void;
}) {
  const bv = l.bv ?? bvVazio();
  if (opcao === "comBvNf") {
    const exigida = bvExigeJustificativa(l);
    const escrita = (bv.justificativa ?? "").trim();
    const faltando = exigida && !escrita;
    return (
      <>
        <AutoTextarea
          className={cx("!text-[12px]", faltando && "!border-danger !bg-danger-soft")}
          rows={1}
          value={bv.justificativa ?? ""}
          onChange={(e) => onUpd({ bv: { ...bv, justificativa: e.target.value } })}
          placeholder={exigida ? "Por que este item sai sem BV ou abaixo de 15%" : "Observação (opcional)"}
          aria-label={`Justificativa do BV do item ${l.item || "sem título"}`}
        />
        {faltando && (
          <p className="mt-0.5 text-[10px] font-bold text-danger">
            Obrigatória: {opcaoNaoSeAplica(l, "comBvNf")
              ? "este item não é cobrado com BV"
              : `o BV está ${bvDaLinha(l).valor > 0 ? `abaixo de ${BV_PADRAO_PERCENTUAL}%` : "zerado"}`}.
          </p>
        )}
      </>
    );
  }
  const chave = opcao === "semBvComNf" ? "observacaoSemBvComNf" : "observacaoSemBvSemNf";
  return (
    <AutoTextarea
      className="!text-[12px]"
      rows={1}
      value={bv[chave] ?? ""}
      onChange={(e) => onUpd({ bv: { ...bv, [chave]: e.target.value } })}
      placeholder="Observação (opcional)"
      aria-label={`Observação da forma ${opcao} do item ${l.item || "sem título"}`}
    />
  );
}

/**
 * Percentual ou valor fixo do BV, dentro da opção "com BV e NF".
 *
 * Os dois modos existem porque a casa negocia dos dois jeitos — "15% sobre o
 * item" e "R$ 1.200 fechados" —, e converter um no outro à mão é onde o número
 * se perde. É o mesmo par modo/valor de honorários e encargos da EC.
 */
function CamposBv({ l, onUpd }: { l: EcLinha; onUpd: (patch: Partial<EcLinha>) => void }) {
  const bv = l.bv ?? bvVazio();
  const calculado = bvDaLinha(l);
  const abaixoDoPadrao = calculado.percentual < BV_PADRAO_PERCENTUAL;
  const mudar = (patch: Partial<BvItem>) => onUpd({ bv: { ...bv, ...patch } });

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        {/* Dois botões, não um <select>: são duas opções, e a escolhida precisa
            ser lida de relance enquanto se digita o número ao lado. */}
        <div className="flex rounded-btn border border-border-soft overflow-hidden">
          {(["percentual", "fixo"] as const).map((modo) => (
            <button
              key={modo}
              type="button"
              onClick={() => mudar({ modo })}
              className={cx(
                "px-1.5 py-0.5 text-[10px] font-bold transition-colors",
                bv.modo === modo ? "bg-primary text-white" : "bg-surface text-ink-3 hover:text-ink"
              )}
            >
              {modo === "percentual" ? "%" : "R$"}
            </button>
          ))}
        </div>
      </div>
      {bv.modo === "percentual" ? (
        <NumberInput
          className="!h-8 !px-2 !text-[12.5px]"
          value={bv.valor}
          onValue={(v: number) => mudar({ valor: limitarBvPercentual(v) })}
          aria-label={`Percentual do BV do item ${l.item || "sem título"}`}
        />
      ) : (
        <CurrencyInput
          className="!h-8 !px-2 !text-[12.5px]"
          value={bv.valor}
          onValue={(v: number) => mudar({ valor: v })}
          aria-label={`Valor fixo do BV do item ${l.item || "sem título"}`}
        />
      )}
      {/* O outro lado da conta, sempre à vista: quem digita % quer conferir o
          reais, e quem digita reais quer conferir o percentual. */}
      <p className={cx("text-[10.5px] font-semibold", abaixoDoPadrao ? "text-warning" : "text-ink-3")}>
        {bv.modo === "percentual" ? brl(calculado.valor) : `${calculado.percentual.toLocaleString("pt-BR")}%`}
        {abaixoDoPadrao && ` · abaixo de ${BV_PADRAO_PERCENTUAL}%`}
      </p>
    </div>
  );
}

/**
 * Um seletor da barra de seleção: escolhe o valor e aplica em todos os marcados.
 *
 * Volta para "—" depois de aplicar, de propósito: ele não descreve o estado dos
 * itens (que podem ter valores diferentes entre si), é um comando. Deixá-lo
 * mostrando a última escolha sugeriria que aquele é o valor de todos.
 */
function SeletorEmMassa({
  rotulo,
  opcoes,
  onEscolher,
}: {
  rotulo: string;
  opcoes: readonly string[];
  onEscolher: (valor: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[11.5px] font-bold text-ink-2">{rotulo}</span>
      <Select
        className="!h-8 !px-2 !text-[12px] !w-auto"
        value=""
        onChange={(e) => {
          if (!e.target.value) return;
          onEscolher(e.target.value);
          e.target.value = "";
        }}
        aria-label={`Alterar ${rotulo} dos itens selecionados`}
      >
        <option value="">—</option>
        {opcoes.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </Select>
    </label>
  );
}

/** Rótulo pequeno acima de um campo. `obrigatorio` marca com * vermelho (obrigatório só na emissão da OS). */
function Campo({ label, className, children, obrigatorio, id }: { label: string; className?: string; children: React.ReactNode; obrigatorio?: boolean; id?: string }) {
  return (
    <label id={id} className={cx("block", className)}>
      <span className="block text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-ink-3 mb-1 truncate">
        {label}
        {obrigatorio && <span className="text-danger" title="Obrigatório para emitir a OS"> *</span>}
      </span>
      {children}
    </label>
  );
}
