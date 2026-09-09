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
 * QUEM VÊ O QUÊ (regra revista em 08/09/2026): DUAS portas, e só elas.
 *   · o Produtor(a) Responsável do projeto — SEMPRE, para qualquer pendência
 *     nascida dentro do projeto dele, inclusive a conversa que no momento está
 *     com outra pessoa. É ele quem responde pelo projeto inteiro, e ficar de
 *     fora da própria thread era justamente o que o fazia descobrir tarde;
 *   · o DESTINATÁRIO do comentário — quem foi mencionado (@) ou escolhido como
 *     responsável da observação, e quem é dono da tarefa do check-list. Este é
 *     o "eventualmente": entra quando a vez é dele (ver `destinatariosDaVez`).
 *
 * Caíram duas portas antigas, que faziam o badge acender para quem não tinha o
 * que fazer: o PAPEL (todo Admin/Direção/Administrativo via "emitir OS" de
 * todos os projetos da casa) e o AUTOR do comentário (quem cobrava continuava
 * carregando a pendência do outro). Quem cobrou acompanha pelo projeto ou pela
 * própria thread — não pelo número vermelho.
 *
 * ONDE CADA NÚMERO É CONTADO — a regra que faz o badge bater com a pílula de
 * localização em TODAS as etapas. Cada pendência tem UMA tela onde se resolve
 * (`telaDaPendencia`) e uma `ancora`: o elemento que a pílula procura no DOM.
 *   · badge da linha da EC / da OS na listagem = o que a pílula mostra ao abrir
 *     aquela EC / aquela OS;
 *   · badge da subguia do projeto = tudo o que tem aquela `aba` — o que mora na
 *     própria subguia MAIS o que mora nas ECs/OSs que ela lista, e por isso a
 *     pílula da subguia também alcança as linhas da lista (`pendenciasDaTela`
 *     troca a âncora pela da linha);
 *   · badge do projeto = a soma das subguias; sininho = a soma de tudo.
 * Toda pendência precisa de `ancora`, senão ela viraria número sem endereço —
 * exatamente o que fazia o badge não bater com a pílula.
 *
 * Cada pendência declara QUEM deve agir, ONDE ela aparece (recurso da navegação,
 * projeto, subguia, EC e/ou OS), em qual ELEMENTO da tela ela mora (`ancora`),
 * em qual observação exata (`observacaoId`) ou em qual CAMPO do item (`campos`,
 * para "OS/Contrato a emitir"). Para adicionar uma nova regra, basta empurrar
 * mais objetos em `calcularPendencias`.
 */
import type { Checklist, Ec, Observacao, Os, Projeto, StatusOs } from "@/data/types";
import { extrairMencoes } from "@/domain/mencoes";
import { statusProjetoAutomatico } from "@/domain/statusProjeto";
// `encerrado` já é o nome do teste de projeto encerrado aqui — o do item vem com alias.
import { encerrado as itemEncerrado, situacaoPrazo } from "@/domain/checklist";

/** Chave da subguia dentro do detalhe do projeto (espelha ProjetoDetail). */
export type AbaProjeto = "dados" | "ec" | "os" | "checklist" | "cronograma" | "credenciamento" | "fornecedores";

/** Como a aba se chama no aviso — "Observação para Ana em Credenciamento: …". */
const ROTULO_ABA: Record<string, string> = {
  dados: "Dados Gerais",
  checklist: "Check-list",
  ec: "EC",
  os: "OS",
  cronograma: "Cronograma",
  credenciamento: "Credenciamento",
  fornecedores: "Fornecedores",
};

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
   * Elemento da tela onde a pendência mora — a linha da EC, o item do
   * check-list, a própria OS, o card de cronograma dela (`ancoraCronogramaOs`),
   * a linha do painel de credenciamento ou o cabeçalho da subguia EC
   * (`ancoraProjetoSemEc`). É o que o navegador do canto inferior direito usa
   * para rolar até ela (ver `idAncoraPendencia`).
   *
   * Obrigatória na prática: pendência sem âncora é número que ninguém acha, e é
   * o que fazia o badge e a pílula discordarem.
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
 * Qual tela está perguntando — o recorte da pílula do canto inferior direito.
 * Espelha os três destinos de `rotaDaPendencia`.
 */
export type TelaPendencias =
  | { ecId: string }
  | { osId: string }
  | { projetoId: string; aba: AbaProjeto };

/**
 * A tela ONDE A PENDÊNCIA SE RESOLVE — a casa dela.
 *
 * É a peça que faz todos os números do sistema baterem: a rota do sininho, o
 * badge da linha da listagem e a pílula de localização saem todos daqui, então
 * não há como o badge contar uma coisa e a pílula achar outra. Antes cada um
 * tinha o seu próprio "de quem é essa pendência": a rota olhava `osId`, o badge
 * da EC contava QUALQUER pendência com `ecId` (inclusive as que se resolvem
 * dentro da OS) e a pílula tinha um terceiro recorte.
 *
 * A leitura é pela subguia: `aba` diz em que etapa do projeto a pendência é
 * cobrada, e só quando essa etapa é a da EC (ou a da OS) é que a casa desce
 * para a tela da EC (ou da OS).
 */
export function telaDaPendencia(p: Pendencia): TelaPendencias {
  if (p.aba === "ec" && p.ecId) return { ecId: p.ecId };
  if (p.aba === "os" && p.osId) return { osId: p.osId };
  return { projetoId: p.projetoId ?? "", aba: p.aba ?? "dados" };
}

/**
 * Onde a pendência mora — a rota que o sininho e o navegador abrem antes de
 * levar a câmera até ela. Fica aqui, junto da regra, para que todas as telas
 * saltem exatamente para o mesmo lugar.
 */
export function rotaDaPendencia(p: Pendencia): string {
  const tela = telaDaPendencia(p);
  if ("ecId" in tela) return `/estimativas/${tela.ecId}`;
  if ("osId" in tela) return `/ordens/${tela.osId}`;
  if (tela.projetoId) return `/projetos/${tela.projetoId}?aba=${tela.aba}`;
  return "/projetos";
}

/**
 * As pendências que a pílula alcança SEM sair da tela — e, por construção,
 * exatamente as que o badge daquela tela conta.
 *
 * A pílula anda em círculo, então nada aqui pode obrigá-la a navegar: o salto
 * tem de terminar num elemento desta tela. Duas leituras, conforme quem pergunta:
 *
 *  · TELA DA EC / DA OS — o que se resolve ali dentro, com a âncora do próprio
 *    item (a linha da EC, o comentário exato, os campos OS/Contrato).
 *  · SUBGUIA DO PROJETO — tudo o que é cobrado naquela etapa, inclusive o que
 *    se resolve dentro de uma EC ou de uma OS. Essas não saem da tela: a subguia
 *    LISTA a EC e a OS, então a âncora passa a ser a LINHA da listagem, e a
 *    pílula pisca a linha em vez de tentar abrir uma thread que não está aqui.
 *    É isso que faz o número do título da subguia bater com a soma dos badges
 *    da lista — antes a subguia contava e a pílula mostrava zero.
 *
 * Sem `ancora` a pendência fica de fora: seria um número sem endereço.
 */
export function pendenciasDaTela(itens: Pendencia[], tela: TelaPendencias): Pendencia[] {
  const out: Pendencia[] = [];
  for (const p of itens) {
    const projetada = projetarNaTela(p, tela);
    if (projetada) out.push(projetada);
  }
  return out;
}

/** A pendência como esta tela a mostra — ou `null` quando ela não é daqui. */
function projetarNaTela(p: Pendencia, tela: TelaPendencias): Pendencia | null {
  const casa = telaDaPendencia(p);
  if ("ecId" in tela) return "ecId" in casa && casa.ecId === tela.ecId && p.ancora ? p : null;
  if ("osId" in tela) return "osId" in casa && casa.osId === tela.osId && p.ancora ? p : null;
  if (p.projetoId !== tela.projetoId || p.aba !== tela.aba) return null;
  // Mora numa EC/OS que esta subguia lista: a âncora vira a linha da listagem, e
  // o comentário/campo exato fica para a tela da EC (aqui eles não existem).
  if ("ecId" in casa) return { ...p, ancora: casa.ecId, observacaoId: undefined, campos: undefined };
  if ("osId" in casa) return { ...p, ancora: casa.osId, observacaoId: undefined, campos: undefined };
  return p.ancora ? p : null;
}

/**
 * Âncora da conversa geral da EC — o elemento que o navegador de pendências
 * procura na tela. Mora aqui, ao lado da regra, para a tela e o cálculo nunca
 * discordarem sobre onde a thread está.
 */
export const ancoraObservacoesGeraisEc = (ecId: string) => `ec-geral:${ecId}`;

/**
 * Âncora do cronograma dentro da OS — o card de etapas do fornecedor. A cobrança
 * de "cronograma não preenchido" não mora num item da OS, mora neste bloco; sem
 * uma âncora própria ela era contada no badge e a pílula não tinha o que achar.
 */
export const ancoraCronogramaOs = (osId: string) => `os-cronograma:${osId}`;

/**
 * Âncora de "projeto sem estimativa" — o cabeçalho da subguia EC, onde fica o
 * comando de criar a primeira EC. É o único número da subguia EC que não tem
 * linha na lista de ECs (ainda não existe EC nenhuma), então ele precisa de um
 * lugar visível ali para que o total do título continue sendo localizável.
 */
export const ancoraProjetoSemEc = (projetoId: string) => `projeto-sem-ec:${projetoId}`;

/**
 * Âncora da conversa geral de uma ABA do projeto — o card no topo dela.
 *
 * Uma por aba, e não uma por projeto: as cinco conversas são independentes, e o
 * navegador precisa levar até a que cobra a pessoa, não até o projeto.
 */
export const ancoraConversaAba = (projetoId: string, aba: string) => `projeto-conversa:${projetoId}:${aba}`;

/* ------------------------- A batata quente da thread ---------------------- */

/**
 * De quem é a vez numa conversa — a "batata quente".
 *
 * Uma observação não é um recado que fica pendurado no primeiro destinatário até
 * alguém apagá-lo: é uma CONVERSA, e a cada mensagem a bola passa para o outro
 * lado. Quem acabou de responder já agiu — viu a cobrança e fez alguma coisa
 * com ela —, então a bolinha vermelha sai de quem falou e vai para quem tem de
 * responder. Isso se repete até alguém apertar "Resolver", que encerra a
 * thread para todo mundo.
 *
 * A vez é lida da ÚLTIMA mensagem:
 *   · quem ela @menciona (na raiz, também o responsável escolhido no campo);
 *   · sem menção nenhuma, volta para quem estava esperando — o autor da última
 *     mensagem anterior que não seja da mesma pessoa;
 *   · nunca o autor da própria última mensagem.
 *
 * Devolve lista vazia quando a conversa não cobra ninguém (um recado solto que
 * não endereça e não responde a ninguém) — e aí ela não vira pendência.
 */
export function destinatariosDaVez(observacao: Observacao, usuarios: string[] = []): string[] {
  const mensagens = [
    { autor: observacao.autorNome ?? "", texto: observacao.texto ?? "", raiz: true },
    ...(observacao.respostas ?? []).map((r) => ({ autor: r.autorNome ?? "", texto: r.texto ?? "", raiz: false })),
  ];
  const ultima = mensagens[mensagens.length - 1];
  const alvos = new Set<string>();
  for (const m of extrairMencoes(ultima.texto, usuarios)) alvos.add(m);
  // O responsável escolhido no campo é endereço da RAIZ. Depois que a conversa
  // anda, quem manda é a última mensagem — senão ele carregaria a thread para
  // sempre, mesmo já tendo respondido.
  if (ultima.raiz && observacao.responsavelNome?.trim()) alvos.add(observacao.responsavelNome.trim());

  if (!alvos.size) {
    // Resposta sem endereço ("ok, feito"): a bola volta para quem falou antes —
    // pulando as mensagens seguidas da mesma pessoa, que são continuação da fala.
    const eu = normalizarPessoa(ultima.autor);
    for (let i = mensagens.length - 2; i >= 0; i--) {
      const autor = mensagens[i].autor.trim();
      if (autor && normalizarPessoa(autor) !== eu) {
        alvos.add(autor);
        break;
      }
    }
  }

  const autorDaVez = normalizarPessoa(ultima.autor);
  return [...alvos].filter((nome) => nome.trim() && normalizarPessoa(nome) !== autorDaVez);
}

/**
 * Uma conversa aberta vira pendência de quem está com a batata — e do Produtor
 * Responsável do projeto, SEMPRE (regra revista em 08/09/2026).
 *
 * Por um tempo ele só entrava quando a vez era dele, para o badge não crescer a
 * cada resposta trocada entre duas colegas. O efeito colateral foi pior do que o
 * ruído: uma cobrança podia ficar semanas parada com outra pessoa sem que quem
 * responde pelo projeto tivesse qualquer sinal disso. Ele volta a ver tudo o que
 * nasce no projeto dele; o "eventualmente" é do destinatário, que entra e sai
 * conforme a vez.
 */
function pendenciaDeConversa(
  observacao: Observacao,
  usuarios: string[],
  responsavelProjeto?: string
): { pessoas: string[]; responsavelProjeto?: string; resumo: string } | null {
  const texto = observacao.texto?.trim() ?? "";
  if (!texto || observacao.resolvida) return null;
  const pessoas = destinatariosDaVez(observacao, usuarios);
  if (!pessoas.length) return null;
  // A última mensagem é o que está em pauta — é ela que a pessoa precisa ler.
  const ultima = (observacao.respostas ?? []).at(-1)?.texto?.trim() || texto;
  return {
    pessoas,
    responsavelProjeto: responsavelProjeto?.trim() || undefined,
    resumo: ultima.length > 80 ? `${ultima.slice(0, 77)}…` : ultima,
  };
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

/**
 * EC encerrada não cobra mais nada de ninguém.
 *
 * A regra é a de sempre; o que mudou foi o vocabulário do `status` (ver
 * `domain/ec`): com dois estados, "Arquivada" passou a ser toda EC fora do ar, e
 * 'Cancelada' fica na lista para as linhas antigas que ainda a tenham.
 */
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
      const vez = pendenciaDeConversa(observacao, usuarios, respDe(ec.projetoId));
      if (!vez) return;
      out.push({
        id: `os.observacao:${os.id}:${observacao.id || indice}`,
        tipo: "os.observacao",
        titulo: `Observação para ${vez.pessoas.join(", ")} na OS ${os.numero}: ${vez.resumo}`,
        pessoas: vez.pessoas,
        responsavelProjeto: vez.responsavelProjeto,
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
        // Cobrada na etapa da OS, e não na do Cronograma do projeto: as etapas
        // do fornecedor se preenchem DENTRO da OS, e a subguia Cronograma só
        // consolida o que já existe. Contar lá era pôr o número numa tela onde
        // não há o que fazer — e a pílula de lá não tinha o que achar.
        aba: "os",
        ecId: os.ecId,
        osId: os.id,
        ancora: ancoraCronogramaOs(os.id),
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
        // A linha do fornecedor no painel de credenciamento — é ela que pisca.
        ancora: os.id,
      });
    }
  }

  for (const ec of ecs) {
    // EC arquivada/cancelada (ou de projeto encerrado) não cobra observação de ninguém.
    if (!ec.projetoId || encerrado(ec.projetoId) || EC_ENCERRADA.includes(ec.status)) continue;

    // Conversa GERAL da EC — a pauta do evento, antes de virar assunto de item.
    (ec.observacoes ?? []).forEach((observacao, indice) => {
      const vez = pendenciaDeConversa(observacao, usuarios, respDe(ec.projetoId));
      if (!vez) return;
      out.push({
        id: `ec.observacaoGeral:${ec.id}:${observacao.id || indice}`,
        tipo: "ec.observacaoGeral",
        titulo: `Observação geral para ${vez.pessoas.join(", ")} na ${ec.numero}: ${vez.resumo}`,
        pessoas: vez.pessoas,
        responsavelProjeto: vez.responsavelProjeto,
        recurso: "projetos",
        projetoId: ec.projetoId,
        aba: "ec",
        ecId: ec.id,
        // A thread geral mora no topo da EC; a âncora é a própria EC.
        ancora: ancoraObservacoesGeraisEc(ec.id),
        observacaoId: observacao.id || undefined,
      });
    });

    for (const linha of ec.linhas) {
      // Item oculto está guardado: fora dos totais, do Excel e da leitura da EC.
      // Ele só reaparece pela gaveta "Itens ocultos", sem endereço na tela — se
      // cobrasse, seria um número que a pílula conta e não consegue achar.
      if (linha.oculto) continue;
      (linha.observacoes ?? []).forEach((observacao, indice) => {
        // Resolvida, sem texto ou sem ninguém com a vez: não cobra ninguém.
        const vez = pendenciaDeConversa(observacao, usuarios, respDe(ec.projetoId));
        if (!vez) return;
        out.push({
          id: `ec.observacao:${ec.id}:${linha.id}:${observacao.id || indice}`,
          tipo: "ec.observacao",
          titulo: `Observação para ${vez.pessoas.join(", ")} em ${linha.item || linha.grupo}: ${vez.resumo}`,
          pessoas: vez.pessoas,
          responsavelProjeto: vez.responsavelProjeto,
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
      if (linha.oculto) continue; // guardado: não entra em total nenhum, nem neste
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
        const vez = pendenciaDeConversa(observacao, usuarios, responsavelProjeto);
        if (!vez) continue;
        out.push({
          id: `checklist.observacao:${item.id}:${observacao.id}`,
          tipo: "checklist.observacao",
          titulo: `Observação para ${vez.pessoas.join(", ")} em ${nomeItem}: ${vez.resumo}`,
          pessoas: vez.pessoas,
          responsavelProjeto: vez.responsavelProjeto,
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

  // A conversa GERAL de cada aba do projeto — o corredor da etapa.
  //
  // Mesma régua da conversa da EC (`pendenciaDeConversa`): quem foi @mencionado
  // fica com a vez, e o Produtor Responsável enxerga o que acontece no projeto
  // dele. A pendência mora na ABA, então ela é contada no badge daquela subguia
  // e o navegador leva até o card no topo dela.
  for (const p of projetos) {
    if (statusProjetoAutomatico(p, ecs) === "Concluido") continue;
    for (const [aba, observacoes] of Object.entries(p.conversas ?? {})) {
      for (const [indice, observacao] of (observacoes ?? []).entries()) {
        const vez = pendenciaDeConversa(observacao, usuarios, p.info.produtoraResponsavel?.trim() || "");
        if (!vez) continue;
        out.push({
          id: `projeto.conversa:${p.id}:${aba}:${observacao.id || indice}`,
          tipo: "projeto.conversa",
          titulo: `Observação para ${vez.pessoas.join(", ")} em ${ROTULO_ABA[aba] ?? aba}: ${vez.resumo}`,
          pessoas: vez.pessoas,
          responsavelProjeto: vez.responsavelProjeto,
          recurso: "projetos",
          projetoId: p.id,
          aba: aba as AbaProjeto,
          ancora: ancoraConversaAba(p.id, aba),
          observacaoId: observacao.id || undefined,
        });
      }
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
      // Não há EC para apontar: a âncora é o cabeçalho da subguia, onde fica o
      // comando de criar a primeira. Sem ela este era o número "a mais" do
      // título da subguia EC — contado ali e sem par na lista de ECs.
      ancora: ancoraProjetoSemEc(p.id),
    });
  }

  return out;
}

/**
 * Agregações prontas para os componentes, já filtradas ao papel do usuário.
 *
 * Todas saem de `telaDaPendencia`, e não de "tem `ecId`?" / "tem `osId`?": é o
 * que garante que o badge da linha da EC mostre o mesmo número da pílula ao
 * abrir aquela EC. Antes `porEc` contava também as pendências que se resolvem
 * DENTRO da OS (elas carregam o `ecId` de origem), e a linha da EC vinha
 * inflada com o que não se acha lá dentro.
 */
export interface PendenciasAgregadas {
  total: number;
  itens: Pendencia[];
  porRecurso: Record<string, number>;
  porProjeto: Record<string, number>;
  /** chave `${projetoId}:${aba}` — o título da subguia; soma das linhas dela. */
  porAba: Record<string, number>;
  /** Só o que se resolve DENTRO da EC — o mesmo que a pílula mostra lá. */
  porEc: Record<string, number>;
  /** Só o que se resolve DENTRO da OS — o mesmo que a pílula mostra lá. */
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
    // A subguia conta a ETAPA inteira — inclusive o que se resolve dentro de uma
    // EC ou de uma OS listada nela. Por isso é a soma das linhas da lista (mais
    // o que estiver ancorado na própria subguia), e a pílula de lá alcança tudo.
    if (p.projetoId && p.aba) inc(ag.porAba, `${p.projetoId}:${p.aba}`);
    // Já a linha da lista conta só o que a tela dela resolve.
    const tela = telaDaPendencia(p);
    if ("ecId" in tela) inc(ag.porEc, tela.ecId);
    else if ("osId" in tela) inc(ag.porOs, tela.osId);
  }
  return ag;
}
