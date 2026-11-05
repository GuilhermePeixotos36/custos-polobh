/**
 * PRIVACIDADE (LGPD, 05/11/2026) — os dados que a política mostra.
 *
 * Os prazos aqui são os mesmos que o banco aplica sozinho todo dia (migração
 * `20261105160000_retencao_de_dados`). Mudou um, muda o outro.
 */

/** Quem responde pelos dados (controladora). */
export const CONTROLADORA = {
  nome: "Pólobh Promoções LTDA",
  cnpj: "07.128.230/0001-80",
  endereco: "Av. Aggeo Pio Sobrinho, 265 - Buritis, Belo Horizonte - MG, 30575-834",
};

/**
 * Encarregado de dados (art. 41 da LGPD). Enquanto a Pólobh não nomear, a
 * política orienta a falar com a empresa pelo endereço acima.
 */
export const ENCARREGADO: { nome: string; email: string } = { nome: "", email: "" };

/** Prazos de guarda aplicados automaticamente. */
export const PRAZOS = {
  credenciamentoDias: 180,
  auditoriaAnos: 2,
  emailsAnos: 2,
} as const;

export const ATUALIZADA_EM = "05/11/2026";
