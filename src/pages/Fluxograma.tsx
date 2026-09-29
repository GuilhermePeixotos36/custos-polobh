/**
 * FLUXOGRAMA — o processo da Pólobh, da abertura do projeto ao fechamento.
 *
 * Pedido de 29/09/2026: o fluxo de nove etapas (Produção e Financeiro) precisa
 * estar dentro do aplicativo, e não num arquivo que cada um guarda do seu jeito.
 *
 * A imagem que sai de fábrica é a do processo atual (`public/fluxograma-polobh`).
 * Quando o processo mudar, quem administra o sistema TROCA a imagem aqui mesmo:
 * a nova fica guardada em `config_app` e vale para todos, e "Restaurar a
 * original" devolve a que veio com o aplicativo. A imagem é reduzida antes de
 * guardar — um fluxograma legível não precisa de mais de ~3000 px de largura, e
 * uma foto de celular de 12 MB não cabe numa linha de configuração.
 *
 * ZOOM: botões, Ctrl + roda do mouse e "Ajustar à tela". A imagem cresce dentro
 * de uma área rolável, então dar zoom não desloca o resto da página.
 * TELA CHEIA: usa a API do navegador sobre a própria área da imagem, com os
 * mesmos comandos de zoom por cima.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/layout/AppLayout";
import { Button, Card } from "@/components/ui";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { dataHoraBR } from "@/lib/format";

const CHAVE = "fluxograma";
const IMAGEM_PADRAO = "/fluxograma-polobh.webp";
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 4;
const PASSO = 0.2;
/** Largura máxima guardada — acima disso o fluxograma só ganha peso, não nitidez. */
const LARGURA_MAX = 3000;
/** Teto do que é gravado em `config_app`. */
const BYTES_MAX = 2_500_000;

interface FluxogramaGuardado {
  dataUrl: string;
  nome: string;
  atualizadoEm: string;
  atualizadoPor: string;
}

/** Lê o arquivo, reduz para `LARGURA_MAX` e devolve um data URL (webp; jpeg se o navegador não gravar webp). */
async function prepararImagem(arquivo: File): Promise<string> {
  const bruto = await new Promise<string>((ok, erro) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result));
    leitor.onerror = () => erro(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
  const img = await new Promise<HTMLImageElement>((ok, erro) => {
    const el = new Image();
    el.onload = () => ok(el);
    el.onerror = () => erro(new Error("O arquivo não é uma imagem válida."));
    el.src = bruto;
  });
  const escala = Math.min(1, LARGURA_MAX / img.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * escala);
  canvas.height = Math.round(img.naturalHeight * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("O navegador não conseguiu preparar a imagem.");
  // Fundo branco: PNG com transparência viraria preto ao passar para jpeg.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let saida = canvas.toDataURL("image/webp", 0.92);
  if (!saida.startsWith("data:image/webp")) saida = canvas.toDataURL("image/jpeg", 0.92);
  return saida;
}

export function Fluxograma() {
  const podeTrocar = useAuth((s) => s.pode("configuracoes"));
  const usuario = useAuth((s) => s.usuario);
  const { data: guardado, loading } = useAsync(
    () => repo.config.ler<FluxogramaGuardado>(CHAVE),
    [],
    { silencioso: true, oQue: "o fluxograma" }
  );
  const [local, setLocal] = useState<FluxogramaGuardado | null | undefined>(undefined);
  const atual = local === undefined ? guardado : local;
  const fonte = atual?.dataUrl || IMAGEM_PADRAO;

  const [zoom, setZoom] = useState(1);
  const [cheia, setCheia] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const rolagem = useRef<HTMLDivElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  const ajustar = useCallback(() => setZoom(1), []);
  const mais = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + PASSO).toFixed(2)));
  const menos = () => setZoom((z) => Math.max(ZOOM_MIN, +(z - PASSO).toFixed(2)));

  // Ctrl + roda do mouse dá zoom na imagem, e só nela (sem o zoom da página).
  useEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z + (e.deltaY < 0 ? PASSO : -PASSO)).toFixed(2))));
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, []);

  useEffect(() => {
    const muda = () => setCheia(document.fullscreenElement === area.current);
    document.addEventListener("fullscreenchange", muda);
    return () => document.removeEventListener("fullscreenchange", muda);
  }, []);

  async function alternarTelaCheia() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await area.current?.requestFullscreen();
    } catch {
      toast("Este navegador não permitiu a tela cheia.", "warning");
    }
  }

  async function trocar(f: File | undefined) {
    if (!f) return;
    setSalvando(true);
    try {
      const dataUrl = await prepararImagem(f);
      if (dataUrl.length > BYTES_MAX) throw new Error("A imagem ficou grande demais; use uma com menos detalhes ou menor resolução.");
      const novo: FluxogramaGuardado = {
        dataUrl,
        nome: f.name,
        atualizadoEm: new Date().toISOString(),
        atualizadoPor: usuario?.nome ?? "",
      };
      await repo.config.gravar(CHAVE, novo);
      setLocal(novo);
      setZoom(1);
      toast("Fluxograma atualizado para todos.", "success");
    } catch (e) {
      toast(`Não foi possível trocar a imagem: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
      if (arquivo.current) arquivo.current.value = "";
    }
  }

  async function restaurar() {
    if (!(await confirmar({
      titulo: "Voltar ao fluxograma original?",
      mensagem: "A imagem trocada deixa de valer para todos e volta a que veio com o aplicativo.",
      confirmarTexto: "Restaurar original",
    }))) return;
    setSalvando(true);
    try {
      await repo.config.gravar(CHAVE, null);
      setLocal(null);
      setZoom(1);
      toast("Fluxograma original restaurado.", "success");
    } catch (e) {
      toast(`Não foi possível restaurar: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  }

  const comandos = (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Button variant="secondary" size="sm" onClick={menos} disabled={zoom <= ZOOM_MIN} aria-label="Diminuir o zoom" title="Diminuir o zoom">−</Button>
      <span className="min-w-[3.2rem] text-center text-[12.5px] font-bold text-ink tabular-nums" aria-live="polite">{Math.round(zoom * 100)}%</span>
      <Button variant="secondary" size="sm" onClick={mais} disabled={zoom >= ZOOM_MAX} aria-label="Aumentar o zoom" title="Aumentar o zoom">+</Button>
      <Button variant="secondary" size="sm" onClick={ajustar} title="Voltar ao tamanho que cabe na tela">Ajustar à tela</Button>
      <Button size="sm" onClick={() => void alternarTelaCheia()}>{cheia ? "Sair da tela cheia" : "Tela cheia"}</Button>
    </div>
  );

  return (
    <PageShell
      title="Fluxograma"
      subtitle="O processo da Pólobh — da abertura do projeto ao fechamento, em nove etapas."
      topAction={
        podeTrocar ? (
          <div className="flex gap-2 flex-wrap">
            <input
              ref={arquivo}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => void trocar(e.target.files?.[0])}
            />
            <Button size="sm" variant="secondary" disabled={salvando} onClick={() => arquivo.current?.click()}>
              {salvando ? "Salvando…" : "Trocar imagem"}
            </Button>
            {atual?.dataUrl && (
              <Button size="sm" variant="text" disabled={salvando} onClick={() => void restaurar()}>
                Restaurar a original
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <Card padded={false}>
        <div ref={area} className={cheia ? "bg-white flex flex-col h-screen" : ""}>
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-border-soft bg-surface">
            {comandos}
            <span className="text-[11.5px] text-ink-3">
              {atual?.dataUrl
                ? `Imagem trocada${atual.atualizadoPor ? ` por ${atual.atualizadoPor}` : ""} em ${dataHoraBR(atual.atualizadoEm)}`
                : "Imagem original do aplicativo"}{" "}
              · Ctrl + roda do mouse dá zoom
            </span>
          </div>
          <div
            ref={rolagem}
            className={`overflow-auto bg-[#F6F7F9] ${cheia ? "flex-1" : "max-h-[calc(100vh-15rem)] min-h-[320px]"}`}
          >
            {loading && !atual ? (
              <div className="p-10 text-center text-ink-3 text-sm">Carregando…</div>
            ) : (
              <img
                src={fonte}
                alt="Fluxograma do processo da Pólobh — produção e financeiro"
                draggable={false}
                style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
                className="block mx-auto select-none"
              />
            )}
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
