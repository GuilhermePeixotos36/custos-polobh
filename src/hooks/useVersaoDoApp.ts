/**
 * Detecta quando há uma versão NOVA do aplicativo publicada.
 *
 * O `index.html` não fica em cache (vercel.json), então quem ABRE o app sempre
 * recebe a versão atual. O problema é a aba que fica aberta dias seguidos: ela
 * continua rodando o código de quando foi carregada, e a pessoa vê tela, botão e
 * permissão de antes — "parece que a versão dela tava desatualizada".
 *
 * A cada poucos minutos, e sempre que a aba volta ao primeiro plano, lemos
 * `/version.json` (gerado no build) e comparamos com a versão embutida no
 * código. Diferente = há deploy novo, e a tela oferece atualizar.
 */
import { useEffect, useState } from "react";

const INTERVALO_MS = 5 * 60 * 1000;

export async function versaoPublicada(): Promise<string | null> {
  try {
    const resp = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) return null;
    const dados = (await resp.json()) as { versao?: string };
    return dados.versao ?? null;
  } catch {
    return null; // sem rede, sem aviso — nunca derruba a tela
  }
}

export function useVersaoDoApp(): boolean {
  const [desatualizado, setDesatualizado] = useState(false);

  useEffect(() => {
    // Em desenvolvimento não há version.json: o aviso ficaria piscando à toa.
    if (import.meta.env.DEV) return;
    let vivo = true;
    const conferir = async () => {
      const publicada = await versaoPublicada();
      if (vivo && publicada && publicada !== __APP_VERSION__) setDesatualizado(true);
    };
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void conferir();
    };
    void conferir();
    const relogio = window.setInterval(() => void conferir(), INTERVALO_MS);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      vivo = false;
      window.clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, []);

  return desatualizado;
}
