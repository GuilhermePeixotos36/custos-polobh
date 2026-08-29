/**
 * Pendências do processo: ações que faltam ser feitas por uma PESSOA específica.
 * Centralizado aqui para alimentar os badges (bolinhas vermelhas) na navegação,
 * na lista de projetos, nas subguias, nos itens de EC/OS e o sininho do topo.
 *
 * Modelo (jul/2026): a cadeia de pendências nasce no Produtor Responsável definido
 * no Projeto (fica com a pendência de preencher a EC) e nas observações direcionadas
 * a alguém nos itens da EC e nas OSs (@menção ou responsável escolhido) — não há
 * mais fluxo de aprovação do cliente (removido).
 *
 * QUEM VÊ O QUÊ (regra revista em 26/08/2026): DUAS portas, e só elas.
 *   · o Produtor(a) Responsável do projeto — SEMPRE, para qualquer pendência
 *     nascida dentro do projeto dele, mesmo endereçada a outra pessoa. É ele
 *     quem responde pelo projeto inteiro;
 *   · o DESTINATÁRIO do comentário — quem foi mencionado (@) ou escolhido como
 *     responsável da observação, e quem é dono da tarefa do check-list.
 *
 * Caíram duas portas antigas, que faziam o badge acender para quem não tinha o
 * que fazer: o PAPEL (todo Admin/Direção/Administrativo via "emitir OS" de
 * todos os projetos da casa) e o AUTOR do comentário (quem cobrava continuava
 * carregando a pendência do outro). Quem cobrou acompanha pelo projeto ou pela
 * própria thread — não pelo número vermelho.
 *
 * Cada pendência declara QUEM deve agir, ONDE ela aparece (recurso da navegação,
 * projeto, subguia, EC e/ou OS) e — o que faz o número do badge bater com o
 * navegador de pendências — em qual ELEMENTO da tela ela mora (`ancora`), em
 * qual observação exata (`observacaoId`) ou em qual CAMPO do item (`campo`,
 * para "OS/Contrato a emitir"). Para adicionar uma nova regra, basta empurrar
 * mais objetos em `calcularPendencias`.
 */
import type { Checklist, Ec, Os, Projeto, StatusOs } from "@/data/types";
import { extrairMencoes } from "@/domain/mencoes";
import { statusProjetoAutomatico } from "@/domain/statusProjeto";
// `encerrado` já é o nome do teste de projeto encerrado aqui — o do item vem com alias.
import { encerrado as itemEncerrado, situacaoPrazo } from "@/domain/checklist";

/** Chave da subguia dentro do detalhe do projeto (espelha ProjetoDetail). */
export type AbaProjeto = "dados" | "ec" | "os" | "checklist" | "cronograma" | "credenciamento" | "fornecedores";

/** Campo do item que é a pendência em si (quando ela não é um comentário). */
export type CampoPendencia = "os" | "contrato";

export interface Pendencia {
  id: string;
  tipo: string;
  titulo: string;
  /** Pessoas especificamente atribuídas, pelo nome cadastrado no sistema. */
  pessoas?: string[];
  /** Produtor Responsável do projeto: vê tudo o que acontece dentro do projeto dele. */
  responsavelProjeto?: string;
  /** Recurso da navegação superior onde ela aparece (hoje sempre "projetos"). */
  recurso: "projetos";
  projetoId?: string;
  aba?: AbaProjeto;
  ecId?: string;
  osId?: string;
  /** Item do check-list que originou a pendência (leva direto até ele na tela). */
  checklistItemId?: string;
  /**
   * Elemento da tela onde a pendência mora — id da linha da EC, do item do
   * check-list ou da própria OS. É o que o navegador do canto inferior direito
   * usa para rolar até ela (ver `idAncoraPendencia`).
   */
  ancora?: string;
  /** Observação exata que originou a pendência: o navegador abre a thread e pisca nela. */
  observacaoId?: string;
  /**
   * Campos do item que piscam quando a pendência é um status a emitir. São
   * vários porque OS e Contrato entram numa pendência só (ver a emissão abaixo).
   */
  campos?: CampoPendencia[];
}

/**
 * Onde a pendência mora — a rota que o sininho e o navegador abrem antes de
 * levar a câmera até ela. Fica aqui, junto da regra, para que todas as telas
 * saltem exatamente para o mesmo lugar.
 */
export function rotaDaPendencia(p: Pendencia): string {
  if (p.ecId && p.aba === "ec") return `/estimativas/${p.ecId}`;
  if (p.osId) return `/ordens/${p.osId}`;
  if (p.projetoId) return `/projetos/${p.projetoId}${p.aba ? `?aba=${p.aba}` : ""}`;
  return "/projetos";
}

/**
 * Qual tela está perguntando — o recorte da pílula do canto inferior direito.
 * Espelha os três destinos de `rotaDaPendencia`.
 */
export type TelaPendencias =
  | { ecId: string }
  | { osId: string }
  | { projetoId: string; aba: AbaProjeto };

/**
 * As pendências que a pílula pode alcançar SEM sair da tela.
 *
 * A pílula anda em círculo entre as pendências: quando uma delas morava em outra
 * tela, o salto virava navegação e a viagem acabava ali — a tela de destino tem
 * outra lista, sem as anteriores, e não havia como voltar para continuar. Então
 * ela passa a listar só o que está ali na frente: a pendência de outra tela
 * continua existindo no sininho, que é o lugar de atravessar o sistema.
 *
 * Duas condições, e as duas são necessárias:
 *  · a pendência NASCE nesta tela (uma observação de item de EC é da EC, mesmo
 *    quando aparece contada na aba EC do projeto);
 *  · ela tem `ancora` — sem um elemento para procurar no DOM, a seta não teria
 *    para onde levar a câmera.
 */
export function pendenciasDaTela(itens: Pendencia[], tela: TelaPendencias): Pendencia[] {
  return itens.filter((p) => {
    if (!p.ancora) return false;
    if ("ecId" in tela) return p.ecId === tela.ecId && p.aba === "ec";
    if ("osId" in tela) return p.osId === tela.osId;
    // No projeto sobra o que é do próprio projeto: o check-list. O que pertence
    // a uma EC ou a uma OS se resolve na tela dela.
    return p.projetoId === tela.projetoId && p.aba === tela.aba && !p.ecId && !p.osId;
  });
}

/** Status de OS/Contrato que significam "falta emitir" (ver `Pendencia.campos`). */
const A_EMITIR: StatusOs[] = ["Emitir", "Emitir Nova Versão"];

/**
 * Como a emissão pendente de um item se anuncia.
 *
 * Quando OS e Contrato pedem a mesma coisa — o caso comum, porque os dois viram
 * "Emitir" no mesmo gesto —, dizem isso juntos: "OS e Contrato — Emitir". Quando
 * pedem coisas diferentes, cada um traz o seu status.
 */
function rotuloEmissao(faltando: { rotulo: string; status: StatusOs }[]): string {
  const [primeiro, segundo] = faltando;
  if (segundo && primeiro.status === segundo.status) {
    return `${primeiro.rotulo} e ${segundo.rotulo} — ${primeiro.status}`;
  }
  return faltando.map((c) => `${c.rotulo} — ${c.status}`).join(" · ");
}

/** EC encerrada não cobra mais nada de ninguém. */
const EC_ENCERRADA = ["Cancelada", "Arquivada"];
const OS_ENCERRADA = ["Cancelada", "Arquivada"];

export function calcularPendencias(
  projetos: Projeto[],
  ecs: Ec[],
  oss: Os[],
  usuarios: string[] = [],
  /** OSs que já receberam resposta de credenciamento — o resto ainda está devendo. */
  osComCredenciamento: string[] = [],
  /** Check-lists dos projetos — geram pendência de prazo e de observação. */
  checklists: Checklist[] = [],
  /** "Hoje" em ISO — injetado para o cálculo ser testável e estável. */
  hojeIso: string = new Date().toISOString().slice(0, 10)
): Pendencia[] {
  const ecPorId = new Map(ecs.map((e) => [e.id, e]));
  const credenciamentoRespondido = new Set(osComCredenciamento);
  // Cronograma e credenciamento são cobrados de quem toca o projeto.
  const responsavelPorProjeto = new Map(
    projetos.map((p) => [p.id, p.info.produtoraResponsavel?.trim() ?? ""] as const)
  );
  const ecsAtivasPorProjeto = new Map<string, number>();
  for (const e of ecs) {
    if (EC_ENCERRADA.includes(e.status)) continue;
    ecsAtivasPorProjeto.set(e.projetoId, (ecsAtivasPorProjeto.get(e.projetoId) ?? 0) + 1);
  }

  // Arquivar um projeto encerra as pendências dele: nada gerado abaixo vale para
  // projeto arquivado ou cancelado (pedido da Marisa, 09/08/2026).
  const projetoEncerrado = new Set(
    projetos.filter((p) => ["Arquivado", "Cancelado"].includes(statusProjetoAutomatico(p, ecs))).map((p) => p.id)
  );
  const encerrado = (projetoId?: string) => !!projetoId && projetoEncerrado.has(projetoId);
  /**
   * Produtor Responsável do projeto, carimbado em TODA pendência dele: é assim
   * que ele passa a ver o projeto inteiro sem precisar ser mencionado em cada
   * observação (ver `agregarPendencias`).
   */
  const respDe = (projetoId?: string) => (projetoId && responsavelPorProjeto.get(projetoId)) || undefined;

  const out: Pendencia[] = [];

  // OS em rascunho → o financeiro precisa emitir/disparar.
  for (const os of oss) {
    if (os.status !== "Rascunho") continue;
    const ec = ecPorId.get(os.ecId);
    if (!ec?.projetoId || encerrado(ec.projetoId)) continue;
    out.push({
      id: `os.emitir:${os.id}`,
      tipo: "os.emitir",
      titulo: `Emitir OS ${os.numero}`,
      responsavelProjeto: respDe(ec.projetoId),
      recurso: "projetos",
      projetoId: ec.projetoId,
      aba: "os",
      ecId: os.ecId,
      osId: os.id,
      ancora: os.id,
    });
  }

  // Observações da OS direcionadas a alguém → pendência dessa pessoa (mesma regra da EC).
  for (const os of oss) {
    if (OS_ENCERRADA.includes(os.status)) continue;
    const ec = ecPorId.get(os.ecId);
    if (!ec?.projetoId || encerrado(ec.projetoId)) continue;
    (os.observacoes ?? []).forEach((observacao, indice) => {
      const texto = observacao.texto.trim();
      if (!texto || observacao.resolvida) return;
      const destinatarios = new Set<string>();
      if (observacao.responsavelNome?.trim()) destinatarios.add(observacao.responsavelNome.trim());
      for (const m of extrairMencoes(texto, usuarios)) destinatarios.add(m);
      if (!destinatarios.size) return;
      const resumo = texto.length > 80 ? `${texto.slice(0, 77)}…` : texto;
      out.push({
        id: `os.observacao:${os.id}:${observacao.id || indice}`,
        tipo: "os.observacao",
        titulo: `Observação para ${[...destinatarios].join(", ")} na OS ${os.numero}: ${resumo}`,
        pessoas: [...destinatarios],
        responsavelProjeto: respDe(ec.projetoId),
        recurso: "projetos",
        projetoId: ec.projetoId,
        aba: "os",
        ecId: os.ecId,
        osId: os.id,
        ancora: os.id,
        observacaoId: observacao.id || undefined,
      });
    });
  }

  // Cronograma e credenciamento da OS (pedido da Marisa, 09/08/2026) — ambos cobrados
  // do Produtor Responsável do projeto, e só depois que a OS foi disparada ao fornecedor.
  for (const os of oss) {
    if (os.status !== "Disparada") continue;
    const ec = ecPorId.get(os.ecId);
    if (!ec?.projetoId || encerrado(ec.projetoId)) continue;
    const responsavel = responsavelPorProjeto.get(ec.projetoId);
    if (!responsavel) continue; // sem responsável definido, não há para quem endereçar

    if (!(os.cronograma ?? []).length) {
      out.push({
        id: `os.cronograma:${os.id}`,
        tipo: "os.cronograma",
        titulo: `Cronograma não preenchido na OS ${os.numero}`,
        pessoas: [responsavel],
        responsavelProjeto: responsavel,
        recurso: "projetos",
        projetoId: ec.projetoId,
        aba: "cronograma",
        ecId: os.ecId,
        osId: os.id,
      });
    }

    // O prazo-limite preenchido é o que marca "esta OS exige credenciamento" — o
    // slug do link existe em toda OS (default do banco), então não serve de sinal.
    const exigeCredenciamento = !!os.credenciamento?.prazoLimite?.trim();
    if (exigeCredenciamento && !credenciamentoRespondido.has(os.id)) {
      out.push({
        id: `os.credenciamento:${os.id}`,
        tipo: "os.credenciamento",
        titulo: `Credenciamento não respondido pelo fornecedor na OS ${os.numero}`,
        pessoas: [responsavel],
        responsavelProjeto: responsavel,
        recurso: "projetos",
        projetoId: ec.projetoId,
        // Cobrada na subaba do PROJETO: é de lá que se reenvia o link, e é lá
        // que se vê quem ainda falta. Sem `osId`, senão a rota levaria à OS,
        // que não fala mais de credenciamento.
        aba: "credenciamento",
        ecId: os.ecId,
      });
    }
  }

  for (const ec of ecs) {
    // EC arquivada/cancelada (ou de projeto encerrado) não cobra observação de ninguém.
    if (!ec.projetoId || encerrado(ec.projetoId) || EC_ENCERRADA.includes(ec.status)) continue;
    for (const linha of ec.linhas) {
      (linha.observacoes ?? []).forEach((observacao, indice) => {
        const texto = observacao.texto.trim();
        if (!texto) return;
        // Observação resolvida deixa de ser pendência (fica só no histórico).
        if (observacao.resolvida) return;
        // Endereçada a uma pessoa: pelo responsável escolhido e/ou por @menção no texto.
        const destinatarios = new Set<string>();
        if (observacao.responsavelNome?.trim()) destinatarios.add(observacao.responsavelNome.trim());
        for (const m of extrairMencoes(texto, usuarios)) destinatarios.add(m);
        if (!destinatarios.size) return;
        const resumo = texto.length > 80 ? `${texto.slice(0, 77)}…` : texto;
        out.push({
          id: `ec.observacao:${ec.id}:${linha.id}:${observacao.id || indice}`,
          tipo: "ec.observacao",
          titulo: `Observação para ${[...destinatarios].join(", ")} em ${linha.item || linha.grupo}: ${resumo}`,
          pessoas: [...destinatarios],
          responsavelProjeto: respDe(ec.projetoId),
          recurso: "projetos",
          projetoId: ec.projetoId,
          aba: "ec",
          ecId: ec.id,
          ancora: linha.id,
          observacaoId: observacao.id || undefined,
        });
      });
    }
    // Item marcado para emitir ("Emitir"/"Emitir Nova Versão"): uma pendência POR
    // ITEM, e não uma por EC nem uma por campo. É o que faz o número do badge
    // bater com o que se acha na tela — cada uma leva à linha e pisca os campos
    // exatos (antes existia uma pendência solta "Emitir OS a partir da EC", sem
    // âncora: o navegador contava e não tinha para onde rolar).
    //
    // OS e Contrato entram JUNTAS. Elas quase sempre viram "Emitir" no mesmo
    // gesto, e cobrá-las em separado dobrava o número sem dizer nada a mais: na
    // pílula do canto virava um item repetido, com a câmera parada na mesma
    // linha. A pendência aponta quais dos dois campos faltam.
    // ECs encerradas já foram descartadas na entrada do laço.
    for (const linha of ec.linhas) {
      const faltando = [
        { campo: "os" as const, status: linha.statusOs, rotulo: "OS" },
        { campo: "contrato" as const, status: linha.contratoStatus, rotulo: "Contrato" },
      ].filter((c) => A_EMITIR.includes(c.status));
      if (!faltando.length) continue;
      out.push({
        id: `ec.emitir:${ec.id}:${linha.id}`,
        tipo: "ec.emitir",
        titulo: `${rotuloEmissao(faltando)}: ${linha.item || linha.grupo || "item sem nome"}`,
        responsavelProjeto: respDe(ec.projetoId),
        recurso: "projetos",
        projetoId: ec.projetoId,
        aba: "ec",
        ecId: ec.id,
        ancora: linha.id,
        campos: faltando.map((c) => c.campo),
      });
    }
  }

  // ---------------------------------------------------------------- check-list
  // Duas cobranças: a observação endereçada a alguém (igual à da EC) e a tarefa
  // cujo prazo é HOJE ou já passou. A segunda é a razão de existir do módulo — é
  // o que troca a cobrança informal por um aviso no quadro de pendências.
  //
  // O corte é hoje, e não "os próximos 3 dias" (regra revista em 25/08/2026):
  // pendência é o que precisa de ação agora. O que ainda tem prazo aparece na
  // Agenda e nos avisos do check-list, sem inflar o badge vermelho.
  for (const checklist of checklists) {
    if (!checklist.projetoId || encerrado(checklist.projetoId)) continue;
    const responsavelProjeto = responsavelPorProjeto.get(checklist.projetoId)?.trim() ?? "";
    for (const item of checklist.itens) {
      if (itemEncerrado(item)) continue; // concluído/não se aplica: não cobra mais nada

      // Tarefa criada à mão pode estar sem título até alguém escrever nela.
      const nomeItem = item.titulo.trim() || "(tarefa sem título)";
      for (const observacao of item.observacoes ?? []) {
        const texto = observacao.texto.trim();
        if (!texto || observacao.resolvida) continue;
        const destinatarios = new Set<string>();
        if (observacao.responsavelNome?.trim()) destinatarios.add(observacao.responsavelNome.trim());
        for (const m of extrairMencoes(texto, usuarios)) destinatarios.add(m);
        if (!destinatarios.size) continue;
        const resumo = texto.length > 80 ? `${texto.slice(0, 77)}…` : texto;
        out.push({
          id: `checklist.observacao:${item.id}:${observacao.id}`,
          tipo: "checklist.observacao",
          titulo: `Observação para ${[...destinatarios].join(", ")} em ${nomeItem}: ${resumo}`,
          pessoas: [...destinatarios],
          responsavelProjeto: responsavelProjeto || undefined,
          recurso: "projetos",
          projetoId: checklist.projetoId,
          aba: "checklist",
          checklistItemId: item.id,
          ancora: item.id,
          observacaoId: observacao.id || undefined,
        });
      }

      const situacao = situacaoPrazo(item, hojeIso);
      if (situacao !== "atrasado" && situacao !== "hoje") continue;
      // Sem responsável no item, quem responde é o produtor do projeto — a
      // tarefa não pode ficar órfã só porque ninguém foi nomeado nela.
      const dono = item.responsavel?.trim() || responsavelProjeto;
      if (!dono) continue;
      out.push({
        id: `checklist.prazo:${item.id}`,
        tipo: situacao === "atrasado" ? "checklist.atrasado" : "checklist.vencendo",
        titulo: situacao === "atrasado" ? `Tarefa atrasada: ${nomeItem}` : `Tarefa para hoje: ${nomeItem}`,
        pessoas: [dono],
        responsavelProjeto: responsavelProjeto || undefined,
        recurso: "projetos",
        projetoId: checklist.projetoId,
        aba: "checklist",
        checklistItemId: item.id,
        ancora: item.id,
      });
    }
  }

  // Projeto ativo sem nenhuma EC → pendência do Produtor Responsável definido no projeto.
  for (const p of projetos) {
    if (statusProjetoAutomatico(p, ecs) !== "Ativo") continue;
    if ((ecsAtivasPorProjeto.get(p.id) ?? 0) > 0) continue;
    const responsavel = p.info.produtoraResponsavel?.trim();
    if (!responsavel) continue; // sem responsável definido, não há para quem endereçar
    out.push({
      id: `projeto.semEc:${p.id}`,
      tipo: "projeto.semEc",
      titulo: `Projeto sem estimativa: ${p.nome || "Projeto"}`,
      pessoas: [responsavel],
      responsavelProjeto: responsavel,
      recurso: "projetos",
      projetoId: p.id,
      aba: "ec",
    });
  }

  return out;
}

/** Agregações prontas para os componentes, já filtradas ao papel do usuário. */
export interface PendenciasAgregadas {
  total: number;
  itens: Pendencia[];
  porRecurso: Record<string, number>;
  porProjeto: Record<string, number>;
  /** chave `${projetoId}:${aba}` */
  porAba: Record<string, number>;
  porEc: Record<string, number>;
  porOs: Record<string, number>;
}

function normalizarPessoa(valor: string): string {
  return valor.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

/**
 * Filtra as pendências que são DESTA pessoa. Duas portas, e só elas:
 *
 *  1. ela é o Produtor(a) Responsável do projeto — e aí conta QUALQUER pendência
 *     nascida ali dentro, mesmo endereçada a outra pessoa;
 *  2. ela foi mencionada/escolhida na observação, ou é dona da tarefa.
 *
 * Nenhuma outra: nem o papel, nem quem escreveu o comentário. O número vermelho
 * é uma lista de tarefas, não um resumo do que anda acontecendo na casa — e todo
 * badge, popup e sininho do sistema sai desta mesma lista, então tudo o que é
 * contado pode ser encontrado na tela.
 */
export function agregarPendencias(itens: Pendencia[], pessoa?: string): PendenciasAgregadas {
  const nome = pessoa ? normalizarPessoa(pessoa) : "";
  const souEu = (valor?: string) => !!nome && !!valor && normalizarPessoa(valor) === nome;
  const meus = nome ? itens.filter((p) => souEu(p.responsavelProjeto) || p.pessoas?.some(souEu)) : [];
  const inc = (obj: Record<string, number>, k: string) => (obj[k] = (obj[k] ?? 0) + 1);
  const ag: PendenciasAgregadas = {
    total: meus.length,
    itens: meus,
    porRecurso: {},
    porProjeto: {},
    porAba: {},
    porEc: {},
    porOs: {},
  };
  for (const p of meus) {
    inc(ag.porRecurso, p.recurso);
    if (p.projetoId) inc(ag.porProjeto, p.projetoId);
    if (p.projetoId && p.aba) inc(ag.porAba, `${p.projetoId}:${p.aba}`);
    if (p.ecId) inc(ag.porEc, p.ecId);
    if (p.osId) inc(ag.porOs, p.osId);
  }
  return ag;
}
