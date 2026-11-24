import { Button } from "@/components/ui";
import { AvisoEmLinha } from "@/components/padrao/AvisoEmLinha";
import { cn } from "@/lib/utils";
import type { TravaEdicao } from "@/hooks/useTravaEdicao";

/**
 * A faixa que explica por que o documento está em leitura.
 *
 * Fica no topo do documento, e não num aviso que some: a pessoa precisa
 * conseguir reler o motivo enquanto decide o que fazer. E o aviso nomeia QUEM
 * está com ele — sem o nome, a única saída é perguntar na sala quem abriu o quê.
 *
 * O botão só aparece quando a posse caducou. Oferecer "assumir" enquanto a
 * colega está de fato digitando seria devolver, por um clique, exatamente o
 * problema que a trava existe para evitar.
 *
 * Desenho do padrão (`AvisoEmLinha`, tom de atenção) desde 24/11/2026, e não
 * mais uma faixa amarela própria: é o mesmo recado no mesmo tom do resto do app.
 */
export function AvisoTravaEdicao({ trava, className }: { trava: TravaEdicao; className?: string }) {
  if (!trava.aviso) return null;
  return (
    <AvisoEmLinha tom="atencao" className={cn("mb-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">{trava.aviso}</p>
        {trava.podeAssumir && (
          <Button size="sm" variant="secondary" onClick={trava.tentarDeNovo}>
            Assumir a edição
          </Button>
        )}
      </div>
    </AvisoEmLinha>
  );
}
