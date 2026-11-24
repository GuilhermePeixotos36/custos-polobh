/**
 * Classes de controle que se repetiam, letra por letra, de arquivo em arquivo.
 *
 * A auditoria de nov/2026 achou `const inputCls = "..."` declarado em 21 arquivos, em meia dúzia
 * de variações que só diferiam no foco. Depois de o redesign "Crachá" unificar o foco, as
 * declarações idênticas passaram a apontar para cá: mudar a altura ou o contorno do campo é uma
 * linha, e não uma busca pelo app.
 *
 * Só entra aqui o que é igual de verdade. Variação com sentido (campo de 28px da grade do ponto,
 * campo de 44px do login, `text-base` no celular) continua onde está.
 */

/** Campo de formulário: entrada de texto, seleção, data. */
export const campoCls =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none transition-[border-color,box-shadow] hover:border-brand/40 focus:border-brand focus:ring-2 focus:ring-brand/15";

/** O mesmo campo, para o formulário que desabilita controles (gozo já iniciado, folha fechada). */
export const campoDesabilitavelCls = `${campoCls} disabled:opacity-50`;
