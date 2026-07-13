/** Feature flags (lidas de import.meta.env, desligadas por padrão). */
const on = (v: unknown) => v === "true" || v === "1" || v === true;

export const flags = {
  /** Consulta de CNPJ via BrasilAPI. Ligada por padrão (API pública, sem chave). */
  consultaCnpj: import.meta.env.VITE_FEATURE_CNPJ == null
    ? true
    : on(import.meta.env.VITE_FEATURE_CNPJ),
  /** Descritivo por IA. Desligado por padrão (precisa de Edge Function). */
  descritivoIA: on(import.meta.env.VITE_FEATURE_IA),
  /** Resumo da Proposta (IA OpenRouter via Edge Function). Ligado por padrão;
   *  se a função não tiver a OPENROUTER_API_KEY, ela devolve erro tratado. */
  resumoIA: import.meta.env.VITE_FEATURE_RESUMO_IA == null
    ? true
    : on(import.meta.env.VITE_FEATURE_RESUMO_IA),
  /** Envio de e-mails (Brevo via Edge Function). Desligado até configurar a função. */
  email: on(import.meta.env.VITE_FEATURE_EMAIL),
};
