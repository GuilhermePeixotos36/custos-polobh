import { chipVariants } from "@heroui/styles";
import { cx } from "@/lib/format";

export type Tom = "success" | "warning" | "danger" | "info" | "neutral";

/** Selo = Chip "soft" do HeroUI v3, na cor do tom. Azul (info) não existe lá: vai por classe. */
const COR: Record<Tom, "success" | "warning" | "danger" | "default"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "default",
  neutral: "default",
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
  const { base, label } = chipVariants({ color: COR[tom], variant: "soft", size: "sm" });
  return (
    <span className={cx(base(), "font-semibold whitespace-nowrap", tom === "info" && "bg-info-soft! text-info!", className)}>
      <span className={label()}>{children}</span>
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
  Ativa: "success",
  Arquivada: "neutral",
  // legado, só por segurança na leitura
  Rascunho: "neutral",
  Aguardando: "warning",
  Aprovada: "success",
  Reprovada: "danger",
  Cancelada: "neutral",
};

export const tomStatusOs: Record<string, Tom> = {
  Rascunho: "neutral",
  Emitida: "info",
  Cancelada: "danger",
  Arquivada: "neutral",
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
  success: "bg-success-soft! text-success! font-bold!",
  warning: "bg-warning-soft! text-warning! font-bold!",
  danger: "bg-danger-soft! text-danger! font-bold!",
  info: "bg-info-soft! text-info! font-bold!",
  neutral: "",
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
