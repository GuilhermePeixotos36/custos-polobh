/**
 * "Visualizar Contrato" (11/11/2026): o PDF que o "Emitir Contrato PDF" enviaria,
 * aberto na tela para conferir antes. Nada é salvo aqui — é uma prévia do que
 * está na OS agora, e a versão mostrada é a que a emissão criaria.
 */
import { CabecalhoJanela } from "@/components/padrao/CabecalhoJanela";

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
      <div className="bg-surface rounded-card-lg shadow-modal w-full max-w-[980px] h-[92vh] flex flex-col overflow-hidden">
        {/* Faixa do padrão (24/11/2026): o "Fechar" virou o X da faixa. */}
        <CabecalhoJanela titulo="Visualizar contrato" onFechar={onFechar}>
          <p className="text-xs text-white/70 truncate" title={titulo}>{titulo}</p>
          <p className="text-xs text-white/70">
            {jaEmitido
              ? `Versão (${v}), já emitida — nada mudou desde então.`
              : versao > 1
                ? `Prévia da versão (${v}): o contrato mudou desde a emissão anterior. Nada foi salvo.`
                : `Prévia da versão (${v}). Nada foi salvo — use "Emitir Contrato PDF" para enviar à pasta do projeto.`}
          </p>
        </CabecalhoJanela>
        <iframe title="Contrato em PDF" src={url} className="flex-1 w-full bg-white" />
      </div>
    </div>
  );
}
