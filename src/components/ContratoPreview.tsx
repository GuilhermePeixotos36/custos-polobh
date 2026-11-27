/**
 * "Visualizar Contrato" (11/11/2026): o PDF que o "Emitir Contrato PDF" enviaria,
 * aberto na tela para conferir antes. Nada é salvo aqui — é uma prévia do que
 * está na OS agora, e a versão mostrada é a que a emissão criaria.
 *
 * AS PÁGINAS SÃO DESENHADAS PELO PRÓPRIO APP (27/11/2026). Até aqui a prévia era
 * um `<iframe>` apontando para o PDF, e quem o mostrava era o leitor de PDF do
 * NAVEGADOR de cada pessoa. Isso só funciona quando esse leitor existe e está
 * ligado: com o Chrome ou o Edge configurados para baixar PDF em vez de abrir,
 * com o leitor desativado pela política da máquina ou barrado pela proteção do
 * site publicado, a janela abria em branco (ou baixava o arquivo) — e a prévia
 * "não funcionava" para parte da equipe, sem erro nenhum na tela. Desenhando as
 * páginas aqui, a prévia é a mesma em qualquer navegador.
 *
 * Os botões "Abrir em nova aba" e "Baixar" ficam como saída: se o desenho
 * falhar, o PDF ainda chega a quem precisa conferir.
 */
import { useEffect, useRef, useState } from "react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui";

export function ContratoPreview({
  url,
  bytes,
  nomeArquivo,
  titulo,
  versao,
  jaEmitido,
  onFechar,
}: {
  /** Endereço temporário do PDF — usado pelos botões de abrir e baixar. */
  url: string;
  /** O PDF em si, para desenhar as páginas. */
  bytes: Uint8Array;
  nomeArquivo: string;
  titulo: string;
  versao: number;
  /** Esta versão já foi emitida e nada mudou desde então. */
  jaEmitido: boolean;
  onFechar: () => void;
}) {
  const v = String(versao).padStart(2, "0");
  const folhas = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [paginas, setPaginas] = useState(0);

  useEffect(() => {
    let vivo = true;
    const destino = folhas.current;
    if (!destino) return;
    destino.replaceChildren();
    setEstado("carregando");
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        // Cópia: a biblioteca toma posse dos bytes que recebe.
        const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise;
        if (!vivo) return;
        setPaginas(pdf.numPages);
        // Nitidez de tela boa sem pesar: até 2x, na largura que a janela oferece.
        const largura = Math.min(destino.clientWidth || 900, 900);
        const densidade = Math.min(window.devicePixelRatio || 1, 2);
        for (let i = 1; i <= pdf.numPages; i++) {
          const pagina = await pdf.getPage(i);
          if (!vivo) return;
          const base = pagina.getViewport({ scale: 1 });
          const viewport = pagina.getViewport({ scale: (largura / base.width) * densidade });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width / densidade)}px`;
          canvas.style.height = `${Math.floor(viewport.height / densidade)}px`;
          canvas.className = "mx-auto mb-4 bg-white shadow-card";
          canvas.setAttribute("aria-label", `Página ${i} de ${pdf.numPages} do contrato`);
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("o navegador não liberou a área de desenho");
          await pagina.render({ canvas, canvasContext: ctx, viewport }).promise;
          if (!vivo) return;
          destino.appendChild(canvas);
        }
        setEstado("pronto");
      } catch (e) {
        console.error("[contrato] não foi possível desenhar a prévia:", e);
        if (vivo) setEstado("erro");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [bytes]);

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
              {estado === "pronto" && paginas > 0 ? ` ${paginas} ${paginas === 1 ? "página" : "páginas"}.` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-btn px-2.5 py-1.5 text-[12.5px] font-bold text-primary-dark hover:bg-primary-soft input-focus"
            >
              Abrir em nova aba
            </a>
            <a
              href={url}
              download={nomeArquivo}
              className="rounded-btn px-2.5 py-1.5 text-[12.5px] font-bold text-primary-dark hover:bg-primary-soft input-focus"
            >
              Baixar
            </a>
            <Button variant="secondary" size="sm" onClick={onFechar}>Fechar</Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto rounded-b-card-lg bg-[#E9EBEF] px-3 py-4">
          {estado === "carregando" && <p className="py-10 text-center text-sm text-ink-3">Montando a prévia…</p>}
          {estado === "erro" && (
            <p className="py-10 text-center text-sm text-ink-2" role="alert">
              Não foi possível mostrar a prévia aqui. Use “Abrir em nova aba” ou “Baixar”, acima, para conferir o contrato.
            </p>
          )}
          <div ref={folhas} />
        </div>
      </div>
    </div>
  );
}
