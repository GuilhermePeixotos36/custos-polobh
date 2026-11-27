/**
 * AÇÕES EM LOTE NAS OS (27/11/2026) — mudar o status de várias de uma vez e
 * excluir de verdade. São do Back-office (permissões `oss.statusLote` e
 * `oss.excluir`), e moram nas listas de OS.
 *
 * Aqui ficam as duas regras que não dependem de tela: o que muda na OS quando
 * o status é trocado à mão, e quais itens da EC ficam sem OS quando uma é
 * excluída.
 */
import type { EcLinha, Os, StatusOs as StatusDoItem } from "@/data/types";
import { faseDaOs, type FaseOs } from "@/domain/faseOs";

type StatusDaOs = Os["status"];

/**
 * A OS com o status trocado, e a etapa coerente com ele:
 *  · Emitida   — a etapa vai para "emitida";
 *  · Ativa     — quem estava emitida volta para o Back-office, a última mesa
 *                antes de sair; quem já estava em andamento fica onde estava;
 *  · Arquivada — só o status muda; a etapa fica como registro de onde parou.
 * Devolve a mesma referência quando o status já é o pedido.
 */
export function osComStatus(os: Os, status: StatusDaOs, agoraIso: string): Os {
  if (os.status === status) return os;
  const faseAtual = faseDaOs(os);
  let fase: FaseOs = faseAtual;
  if (status === "Emitida") fase = "emitida";
  else if (status === "Ativa" && faseAtual === "emitida") fase = "backoffice";
  return { ...os, status, fase, faseEm: fase !== faseAtual ? agoraIso : os.faseEm };
}

/** Status de item que significam "este item tem OS". */
const COM_OS: StatusDoItem[] = ["OK", "Emitir Nova Versão"];

/**
 * Os itens da EC que ficam SEM OS VIVA depois de uma exclusão, já com o status
 * de volta em "Emitir".
 *
 * Excluir a OS não pode deixar o item dizendo "OS: OK" apontando para nada: ele
 * continua aprovado e precisa de outra OS. Item coberto por outra OS viva não
 * muda. Devolve as linhas (todas) e quantas mudaram.
 */
export function liberarItensDaOsExcluida(
  linhas: EcLinha[],
  idsLiberados: Iterable<string>,
  ossRestantes: Pick<Os, "status" | "ecLinhaIds">[]
): { linhas: EcLinha[]; liberados: number } {
  const alvo = new Set(idsLiberados);
  const cobertos = new Set(ossRestantes.filter((o) => o.status !== "Arquivada").flatMap((o) => o.ecLinhaIds));
  let liberados = 0;
  const novas = linhas.map((l) => {
    if (!alvo.has(l.id) || cobertos.has(l.id) || !COM_OS.includes(l.statusOs)) return l;
    liberados += 1;
    return { ...l, statusOs: "Emitir" as const };
  });
  return { linhas: liberados ? novas : linhas, liberados };
}
