/**
 * Pendências do processo: ações que faltam ser feitas por uma PESSOA específica.
 * Centralizado aqui para alimentar os badges (bolinhas vermelhas) na navegação,
 * na lista de projetos, nas subguias e nos itens de EC/OS.
 *
 * Modelo (jul/2026): a cadeia de pendências nasce no Produtor Responsável definido
 * no Projeto (fica com a pendência de preencher a EC) e nas observações direcionadas
 * a alguém nos itens da EC e nas OSs (@menção ou responsável escolhido). O único
 * ponto que ainda é por PAPEL (não por pessoa fixa) é "Emitir OS", função do
 * financeiro — não há mais fluxo de aprovação do cliente (removido).
 *
 * Cada pendência declara QUEM deve agir (papeis e/ou pessoas) e ONDE ela aparece
 * (recurso da navegação, projeto, subguia, EC e/ou OS). Para adicionar uma nova
 * regra, basta empurrar mais objetos em `calcularPendencias`.
 */
import type { Ec, Os, Papel, Projeto } from "@/data/types";
import { extrairMencoes } from "@/domain/mencoes";
import { statusProjetoAutomatico } from "@/domain/statusProjeto";

/** Chave da subguia dentro do detalhe do projeto (espelha ProjetoDetail). */
export type AbaProjeto = "dados" | "ec" | "os" | "cronograma" | "fornecedores";

export interface Pendencia {
  id: string;
  tipo: string;
  titulo: string;
  /** Papéis responsáveis por resolver esta pendência. */
  papeis: Papel[];
  /** Pessoas especificamente atribuídas, pelo nome cadastrado no sistema. */
  pessoas?: string[];
  /** Recurso da navegação superior onde ela aparece (hoje sempre "projetos"). */
  recurso: "projetos";
  projetoId?: string;
  aba?: AbaProjeto;
  ecId?: string;
  osId?: string;
}

// Emitir OS é função do financeiro — único ponto ainda roteado por papel (não por pessoa fixa).
const EMITE_OS: Papel[] = ["Admin", "Direcao", "Administrativo"];

/** EC encerrada não cobra mais nada de ninguém. */
const EC_ENCERRADA = ["Cancelada", "Arquivada"];
const OS_ENCERRADA = ["Cancelada", "Arquivada"];

export function calcularPendencias(
  projetos: Projeto[],
  ecs: Ec[],
  oss: Os[],
  usuarios: string[] = [],
  /** OSs que já receberam resposta de credenciamento — o resto ainda está devendo. */
  osComCredenciamento: string[] = []
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
      papeis: EMITE_OS,
      recurso: "projetos",
      projetoId: ec.projetoId,
      aba: "os",
      ecId: os.ecId,
      osId: os.id,
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
        titulo: `Observação para você na OS ${os.numero}: ${resumo}`,
        papeis: [],
        pessoas: [...destinatarios],
        recurso: "projetos",
        projetoId: ec.projetoId,
        aba: "os",
        ecId: os.ecId,
        osId: os.id,
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
        papeis: [],
        pessoas: [responsavel],
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
        papeis: [],
        pessoas: [responsavel],
        recurso: "projetos",
        projetoId: ec.projetoId,
        aba: "os",
        ecId: os.ecId,
        osId: os.id,
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
          titulo: `Observação para você em ${linha.item || linha.grupo}: ${resumo}`,
          papeis: [],
          pessoas: [...destinatarios],
          recurso: "projetos",
          projetoId: ec.projetoId,
          aba: "ec",
          ecId: ec.id,
        });
      });
    }
    // Linha marcada para emitir OS ("Emitir"/"Emitir Nova Versão") → o financeiro precisa
    // apertar "Emitir OS" no topo da EC (o botão cria as OSs e marca as linhas como OK).
    // ECs encerradas já foram descartadas na entrada do laço.
    if (ec.linhas.some((l) => l.statusOs === "Emitir" || l.statusOs === "Emitir Nova Versão")) {
      out.push({
        id: `ec.emitirOs:${ec.id}`,
        tipo: "ec.emitirOs",
        titulo: `Emitir OS a partir da EC: ${ec.projeto.titulo || ec.numero}`,
        papeis: EMITE_OS,
        recurso: "projetos",
        projetoId: ec.projetoId,
        aba: "ec",
        ecId: ec.id,
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
      papeis: [],
      pessoas: [responsavel],
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

export function agregarPendencias(itens: Pendencia[], papel: Papel | undefined, pessoa?: string): PendenciasAgregadas {
  const nome = pessoa ? normalizarPessoa(pessoa) : "";
  const meus = papel
    ? itens.filter((p) => p.papeis.includes(papel) || (!!nome && p.pessoas?.some((n) => normalizarPessoa(n) === nome)))
    : [];
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
