import { Button } from "@/components/ui";
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
 */
export function AvisoTravaEdicao({ trava }: { trava: TravaEdicao }) {
  if (!trava.aviso) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-btn bg-warning-soft px-4 py-3">
      <p className="text-[13px] font-semibold text-warning">{trava.aviso}</p>
      {trava.podeAssumir && (
        <Button size="sm" variant="secondary" onClick={trava.tentarDeNovo}>
          Assumir a edição
        </Button>
      )}
    </div>
  );
}
