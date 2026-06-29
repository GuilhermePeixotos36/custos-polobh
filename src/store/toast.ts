/** Toasts transitórios (feedback de ações). */
import { create } from "zustand";

export type ToastTom = "success" | "danger" | "info" | "warning";

export interface Toast {
  id: number;
  tom: ToastTom;
  texto: string;
}

interface ToastState {
  toasts: Toast[];
  push: (texto: string, tom?: ToastTom) => void;
  dismiss: (id: number) => void;
}

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (texto, tom = "info") => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, tom, texto }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Atalho fora de componentes. */
export const toast = (texto: string, tom: ToastTom = "info") =>
  useToast.getState().push(texto, tom);
