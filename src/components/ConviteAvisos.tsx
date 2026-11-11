/**
 * O CONVITE para ligar os avisos (11/11/2026).
 *
 * O botão "Ativar avisos" mora no rodapé do sininho, e quem não abre o sininho
 * não sabe que ele existe — a Marisa passou a achar que "o sininho não
 * funciona fora do aplicativo" justamente por nunca o ter ligado. Esta faixa
 * aparece para quem ainda não decidiu e leva direto ao botão.
 *
 * É um CLIQUE da pessoa que pede a permissão ao navegador — o único jeito que
 * ele aceita. Quem escolhe "Agora não" só volta a ver o convite depois de três
 * dias; quem já permitiu ou bloqueou nunca o vê.
 */
import { useState } from "react";
import { useAtivarAvisos } from "@/components/AvisosNoAparelho";
import { iosForaDaTelaDeInicio, pushSuportado } from "@/lib/push";

const CHAVE = "polobh:convite-avisos-ate";
const TRES_DIAS = 3 * 24 * 60 * 60 * 1000;

const adiado = (): boolean => {
  try {
    return Number(localStorage.getItem(CHAVE) ?? 0) > Date.now();
  } catch {
    return false;
  }
};

export function ConviteAvisos() {
  const { ativar, ocupado, permissao } = useAtivarAvisos();
  const [escondido, setEscondido] = useState(adiado);
  const [feito, setFeito] = useState(false);

  // Só convida quem ainda não decidiu e pode receber: com a permissão dada ou
  // negada, ou fora do alcance do push, a faixa não tem o que oferecer.
  if (escondido || feito || permissao !== "nao-pedida" || !pushSuportado() || iosForaDaTelaDeInicio()) return null;

  return (
    <div className="no-print flex items-center justify-center gap-3 flex-wrap bg-primary-soft text-primary-dark border-b border-primary/20 px-4 py-2 text-[13px]">
      <span className="font-bold">Receba as suas pendências como aviso no computador ou no celular, mesmo com o navegador fechado.</span>
      <span className="flex gap-2">
        <button
          type="button"
          disabled={ocupado}
          onClick={async () => {
            const r = await ativar();
            if (r === "ativo") setFeito(true);
          }}
          className="rounded-btn bg-primary text-white px-3 py-1 text-[12.5px] font-extrabold hover:bg-primary-dark disabled:opacity-60"
        >
          {ocupado ? "Ativando…" : "Ativar avisos"}
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(CHAVE, String(Date.now() + TRES_DIAS));
            } catch {
              /* sem localStorage a faixa só some até recarregar */
            }
            setEscondido(true);
          }}
          className="rounded-btn px-3 py-1 text-[12.5px] font-bold hover:bg-primary/10"
        >
          Agora não
        </button>
      </span>
    </div>
  );
}
