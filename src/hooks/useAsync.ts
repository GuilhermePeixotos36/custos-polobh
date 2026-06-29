import { useCallback, useEffect, useState } from "react";

interface State<T> {
  data: T | undefined;
  loading: boolean;
  error: string | undefined;
  reload: () => void;
}

/** Carrega dados assíncronos com loading/error e função de recarga. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): State<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [tick, setTick] = useState(0);

  // fn é recriada a cada render pelo chamador; controlamos via deps explícitas.
  const run = useCallback(fn, deps);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    setError(undefined);
    run()
      .then((d) => vivo && setData(d))
      .catch((e) => vivo && setError(e?.message ?? String(e)))
      .finally(() => vivo && setLoading(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, tick]);

  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}
