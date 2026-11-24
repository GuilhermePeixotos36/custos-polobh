import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { teclaNoGrupo, usePilulaDeslizante } from "./pilulaDeslizante";

export type OpcaoSegmentado<T extends string> = { value: T; label: string };

/**
 * Controle segmentado: duas ou três visões do mesmo bloco, lado a lado num trilho cinza, com a
 * placa branca deslizando até a escolhida.
 *
 * Não é aba de pasta. `FolderTabs` troca a SEÇÃO e emenda no painel; isto troca a visão DENTRO
 * de um cartão (assistências × coparticipações nos descontos médicos da folha) e fica contido
 * nele, sem emenda nenhuma.
 */
export function Segmentado<T extends string>({ value, options, onChange, ariaLabel, className }: {
  value: T;
  options: readonly OpcaoSegmentado<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const { grupo, refBotao, botao, pilula } = usePilulaDeslizante(value);
  return (
    <div
      ref={grupo}
      role="group"
      aria-label={ariaLabel}
      onKeyDown={(evento) => teclaNoGrupo(evento, options, value, onChange, botao)}
      className={cn("relative flex gap-1 rounded-md bg-muted/40 p-1", className)}
    >
      {pilula && (
        <span
          aria-hidden
          className="pilula-deslizante absolute left-0 top-0 rounded bg-card shadow-sm"
          data-animar={pilula.animar || undefined}
          style={{ width: pilula.largura, height: pilula.altura, transform: `translate(${pilula.x}px, ${pilula.y}px)` } as CSSProperties}
        />
      )}
      {options.map((opcao) => {
        const ativa = opcao.value === value;
        return (
          <button
            key={opcao.value}
            ref={refBotao(opcao.value)}
            type="button"
            aria-pressed={ativa}
            onClick={() => onChange(opcao.value)}
            className={cn(
              "flex-1 rounded px-3 py-1.5 text-xs font-semibold transition-colors",
              ativa ? cn("text-brand-forte", !pilula && "bg-card shadow-sm") : "text-muted-foreground hover:text-navy",
            )}
          >
            <span className="relative">{opcao.label}</span>
          </button>
        );
      })}
    </div>
  );
}
