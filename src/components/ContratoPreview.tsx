/**
 * "Visualizar Contrato" (11/11/2026): o PDF que o "Emitir Contrato PDF" enviaria,
 * aberto na tela para conferir antes. Nada é salvo aqui — é uma prévia do que
 * está na OS agora, e a versão mostrada é a que a emissão criaria.
 */
import { Button } from "@/components/ui";

export function ContratoPreview({
  url,
  titulo,
  versao,
  jaEmitido,
  onFechar,
}: {
  url: string;
  titulo: string;
  versao: number;
  /** Esta versão já foi emitida e nada mudou desde então. */
  jaEmitido: boolean;
  onFechar: () => void;
}) {
  const v = String(versao).padStart(2, "0");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label="Visualizar contrato">
      <div className="bg-surface rounded-card-lg shadow-card w-full max-w-[980px] h-[92vh] flex flex-col">
        <div className="px-5 pt-4 pb-3 border-b border-border-soft flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display font-bold text-lg text-ink">Visualizar contrato</h2>
            <p className="text-[12.5px] text-ink-2 mt-0.5 truncate" title={titulo}>{titulo}</p>
            <p className="text-[12px] text-ink-3 mt-0.5">
              {jaEmitido
                ? `Versão (${v}), já emitida — nada mudou desde então.`
                : versao > 1
                  ? `Prévia da versão (${v}): o contrato mudou desde a emissão anterior. Nada foi salvo.`
                  : `Prévia da versão (${v}). Nada foi salvo — use "Emitir Contrato PDF" para enviar à pasta do projeto.`}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onFechar}>Fechar</Button>
        </div>
        <iframe title="Contrato em PDF" src={url} className="flex-1 w-full rounded-b-card-lg bg-white" />
      </div>
    </div>
  );
}
