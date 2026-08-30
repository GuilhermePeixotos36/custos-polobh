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

  /* ------------------------- travas de homologação ------------------------ */

  /**
   * O e-mail pode ir para o destinatário REAL?
   *
   * Desligada por padrão, e é isso que importa: enquanto o app está em
   * homologação, TODA mensagem é redirecionada para o endereço de teste (ver
   * `lib/email/seguranca`), não importa quem esteja no `para`. Um clique errado
   * numa tela de fornecedores não manda nada para fornecedor nenhum.
   *
   * Só se liga no dia da virada, e é uma decisão de quem publica — não de quem
   * usa o sistema.
   */
  emailDestinoReal: on(import.meta.env.VITE_EMAIL_DESTINO_REAL),

  /**
   * Os botões de DISPARAR OS e de enviar cronograma aparecem habilitados?
   *
   * Desligados por padrão, a pedido do Guilherme (30/08/2026): a equipe está
   * usando o sistema para conferir dados, e um disparo acidental chegaria a
   * fornecedor de verdade. Separada da trava acima de propósito: para testar o
   * disparo basta ligar esta, que o e-mail continua caindo no endereço de teste.
   */
  disparoFornecedor: on(import.meta.env.VITE_DISPARO_FORNECEDOR),
};
