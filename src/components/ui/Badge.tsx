import { cx } from "@/lib/format";

/**
 * `arquivado` é o cinza de DOCUMENTO ARQUIVADO (27/11/2026): mais escuro e mais
 * cheio que o `neutral`, que é quase branco e some ao lado de um selo colorido.
 * Arquivado não é "sem status" — é um status, e precisa se ler de longe.
 */
export type Tom = "success" | "warning" | "danger" | "info" | "neutral" | "arquivado";

const tons: Record<Tom, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-[#F0F1F4] text-ink-2",
  arquivado: "bg-[#D5D8DF] text-graphite",
};

export function Badge({
  children,
  tom = "neutral",
  className,
}: {
  children: React.ReactNode;
  tom?: Tom;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-pill px-2.5 py-1 text-[11.5px] font-bold leading-none whitespace-nowrap",
        tons[tom],
        className
      )}
    >
      {children}
    </span>
  );
}

/* Mapeamentos de status do domínio -> tom do badge */

/**
 * Selo da EC. São dois estados (ver `domain/ec`) — mas as cores dos selos
 * antigos ficam de pé para uma linha do banco ainda não normalizada não
 * aparecer sem cor nenhuma. Para desenhar o selo, prefira `TOM_SITUACAO_EC`,
 * que lê a situação em vez da coluna.
 */
export const tomStatusEc: Record<string, Tom> = {
  Ativa: "info",
  Arquivada: "arquivado",
  // legado, só por segurança na leitura
  Rascunho: "neutral",
  Aguardando: "warning",
  Aprovada: "success",
  Reprovada: "danger",
  Cancelada: "neutral",
};

/**
 * AS TRÊS CORES DO DOCUMENTO (27/11/2026), iguais para EC e OS:
 *   azul  · Ativa     — está em trabalho;
 *   verde · Emitida   — saiu, está concluída;
 *   cinza · Arquivada — fora de uso (cinza cheio, para não parecer "sem status").
 * Antes a OS ativa e a arquivada eram o mesmo cinza claro, e a EC ativa era
 * verde: numa lista com as duas, não dava para separar pelo olho.
 */
export const tomStatusOs: Record<string, Tom> = {
  Ativa: "info",
  Emitida: "success",
  Arquivada: "arquivado",
};

/**
 * Esquema de cores ÚNICO dos status de processo da EC — Aprovação, OS, Contrato,
 * Código de Serviço e Pedido de Compra (definido com o Guilherme em 25/08/2026):
 *
 *   verde    · OK, Não se Aplica — e qualquer valor digitado à mão (um número de
 *              pedido de compra preenchido é assunto resolvido, como o "OK")
 *   amarelo  · Emitir / Emitir Nova Versão — está em andamento, alguém precisa agir
 *   vermelho · Pendente — não começou
 *   neutro   · vazio, ainda não respondido
 *
 * A leitura é a mesma em qualquer campo: bater o olho na linha e ver onde ela
 * está travada, sem precisar ler o texto de cada um.
 */
export function tomDoStatus(valor: string | undefined | null): Tom {
  const v = (valor ?? "").trim();
  if (!v) return "neutral";
  const normal = v.toLocaleLowerCase("pt-BR");
  if (normal === "pendente") return "danger";
  if (normal.startsWith("emitir")) return "warning";
  // "OK", "Não se Aplica"/"Não se aplica" e qualquer texto livre preenchido.
  return "success";
}

/**
 * Mesmo esquema aplicado ao próprio campo de edição (select/input): fundo e
 * texto na cor do status, mantendo a borda do design system.
 */
const CAMPO_POR_TOM: Record<Tom, string> = {
  success: "!bg-success-soft !text-success !font-bold",
  warning: "!bg-warning-soft !text-warning !font-bold",
  danger: "!bg-danger-soft !text-danger !font-bold",
  info: "!bg-info-soft !text-info !font-bold",
  neutral: "",
  arquivado: "",
};

export const classeCampoStatus = (valor: string | undefined | null): string => CAMPO_POR_TOM[tomDoStatus(valor)];

/** @deprecated Use `tomDoStatus` — mantido porque o mapa é indexado em algumas telas. */
export const tomAprovacao: Record<string, Tom> = {
  Pendente: "danger",
  OK: "success",
  Emitir: "warning",
  "Emitir Nova Versão": "warning",
  "Não se Aplica": "success",
};
