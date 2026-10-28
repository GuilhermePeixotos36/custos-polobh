/** Dialog de confirmação imperativo: `const ok = await confirmar({...})`. */
import { create } from "zustand";

export interface ConfirmOptions {
  titulo: string;
  mensagem?: string;
  confirmarTexto?: string;
  cancelarTexto?: string;
  tom?: "danger" | "primary";
  /** Só o botão de confirmar: é um aviso, não uma pergunta. */
  somenteOk?: boolean;
}

interface ConfirmState {
  aberto: boolean;
  opts: ConfirmOptions | null;
  _resolve: ((v: boolean) => void) | null;
  pedir: (o: ConfirmOptions) => Promise<boolean>;
  responder: (v: boolean) => void;
}

export const useConfirm = create<ConfirmState>((set, get) => ({
  aberto: false,
  opts: null,
  _resolve: null,
  pedir: (o) =>
    new Promise<boolean>((resolve) => set({ aberto: true, opts: o, _resolve: resolve })),
  responder: (v) => {
    const r = get()._resolve;
    set({ aberto: false, opts: null, _resolve: null });
    r?.(v);
  },
}));

/** Atalho para usar fora de componentes. */
export const confirmar = (o: ConfirmOptions) => useConfirm.getState().pedir(o);
