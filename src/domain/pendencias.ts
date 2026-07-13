/**
 * Pendências do processo: ações que faltam ser feitas por um determinado papel.
 * Centralizado aqui para alimentar os badges (bolinhas vermelhas) na navegação,
 * na lista de projetos, nas subguias e nos itens de OS.
 *
 * Cada pendência declara QUEM deve agir (papeis) e ONDE ela aparece (recurso da
 * navegação, projeto, subguia, EC e/ou OS). Para adicionar uma nova regra, basta
 * empurrar mais objetos em `calcularPendencias`.
 */
import type { Ec, Os, Papel, Projeto } from "@/data/types";

/** Chave da subguia dentro do detalhe do projeto (espelha ProjetoDetail). */
export type AbaProjeto = "dados" | "ec" | "os" | "cronograma" | "fornecedores";

export interface Pendencia {
  id: string;
  tipo: string;
  titulo: string;
  /** Papéis responsáveis por resolver esta pendência. */
  papeis: Papel[];
  /** Recurso da navegação superior onde ela aparece (hoje sempre "projetos"). */
  recurso: "projetos";
  projetoId?: string;
  aba?: AbaProjeto;
  ecId?: string;
  osId?: string;
}

// Quem emite a OS (financeiro) e quem aprova/cria — mapeamento de responsabilidade.
const EMITE_OS: Papel[] = ["Admin", "Direcao", "Administrativo"];
const ACOMPANHA_EC: Papel[] = ["Admin", "Direcao"];
const CRIA_EC: Papel[] = ["Admin", "Direcao", "Producao"];

export function calcularPendencias(projetos: Projeto[], ecs: Ec[], oss: Os[]): Pendencia[] {
  const ecPorId = new Map(ecs.map((e) => [e.id, e]));
  const ecsAtivasPorProjeto = new Map<string, number>();
  for (const e of ecs) {
    if (["Cancelada", "Arquivada"].includes(e.status)) continue;
    ecsAtivasPorProjeto.set(e.projetoId, (ecsAtivasPorProjeto.get(e.projetoId) ?? 0) + 1);
  }

  const out: Pendencia[] = [];

  // OS em rascunho → o financeiro precisa emitir/disparar.
  for (const os of oss) {
    if (os.status !== "Rascunho") continue;
    const ec = ecPorId.get(os.ecId);
    if (!ec?.projetoId) continue;
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

  for (const ec of ecs) {
    if (!ec.projetoId) continue;
    // EC aguardando aprovação → Direção/Admin acompanham o cliente.
    if (ec.status === "Aguardando") {
      out.push({
        id: `ec.aprovar:${ec.id}`,
        tipo: "ec.aprovar",
        titulo: `EC aguardando aprovação: ${ec.projeto.titulo || ec.numero}`,
        papeis: ACOMPANHA_EC,
        recurso: "projetos",
        projetoId: ec.projetoId,
        aba: "ec",
        ecId: ec.id,
      });
    }
    // Linha aprovada marcada para emitir OS, mas sem OS gerada → Produção gera a OS.
    if (!["Cancelada", "Arquivada"].includes(ec.status)) {
      const temLinhaEmitir = ec.linhas.some((l) => l.statusOs === "Emitir");
      const temOs = oss.some((o) => o.ecId === ec.id);
      if (temLinhaEmitir && !temOs) {
        out.push({
          id: `ec.gerarOs:${ec.id}`,
          tipo: "ec.gerarOs",
          titulo: `Gerar OS a partir da EC: ${ec.projeto.titulo || ec.numero}`,
          papeis: CRIA_EC,
          recurso: "projetos",
          projetoId: ec.projetoId,
          aba: "ec",
          ecId: ec.id,
        });
      }
    }
  }

  // Projeto ativo sem nenhuma EC → Produção precisa criar a estimativa.
  for (const p of projetos) {
    if (p.status !== "Ativo") continue;
    if ((ecsAtivasPorProjeto.get(p.id) ?? 0) > 0) continue;
    out.push({
      id: `projeto.semEc:${p.id}`,
      tipo: "projeto.semEc",
      titulo: `Projeto sem estimativa: ${p.nome || "Projeto"}`,
      papeis: CRIA_EC,
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

export function agregarPendencias(itens: Pendencia[], papel: Papel | undefined): PendenciasAgregadas {
  const meus = papel ? itens.filter((p) => p.papeis.includes(papel)) : [];
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
