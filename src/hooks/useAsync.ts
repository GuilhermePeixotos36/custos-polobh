import { useCallback, useEffect, useState } from "react";
import { toast } from "@/store/toast";

interface State<T> {
  data: T | undefined;
  loading: boolean;
  error: string | undefined;
  reload: () => void;
}

interface Opcoes {
  /**
   * Não avisa o usuário quando falhar. Use só quando a falha for esperada e já
   * tratada pelo chamador (ex.: consulta opcional que o perfil pode não ter
   * permissão de fazer).
   */
  silencioso?: boolean;
  /** O que está sendo carregado, para a mensagem ficar específica. */
  oQue?: string;
}

/**
 * Carrega dados assíncronos com loading/error e função de recarga.
 *
 * Toda falha vira aviso na tela. Antes o `error` era devolvido mas quase nenhum
 * chamador lia: uma consulta que falhava (rede, sessão expirada, RLS) aparecia
 * como lista vazia ou "Carregando…" eterno. Num app de custos isso é perigoso —
 * lista vazia parece "não há dados", e alguém podia concluir que um projeto não
 * tem EC quando na verdade a consulta falhou.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  opcoes: Opcoes = {}
): State<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [tick, setTick] = useState(0);

  const { silencioso, oQue } = opcoes;

  // fn é recriada a cada render pelo chamador; controlamos via deps explícitas.
  const run = useCallback(fn, deps);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    setError(undefined);
    run()
      .then((d) => vivo && setData(d))
      .catch((e) => {
        if (!vivo) return;
        const msg = e?.message ?? String(e);
        setError(msg);
        if (!silencioso) toast(`Não foi possível carregar ${oQue ?? "os dados"}: ${msg}`, "danger");
      })
      .finally(() => vivo && setLoading(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, tick]);

  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}
