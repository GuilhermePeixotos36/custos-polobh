/**
 * Os ícones do MENU DO TOPO (27/11/2026).
 *
 * Com o menu só em ícones, eles passaram a carregar sozinhos o nome da tela —
 * e os do resto do app (`components/icons`), de traço 2 e 18px, ficavam
 * pesados e parecidos demais uns com os outros naquela fileira. Estes são um
 * conjunto próprio: 20px, traço 1,75, e um desenho por assunto, escolhido para
 * não se confundir com o vizinho.
 *
 * Ficam separados de `components/icons` de propósito: lá, o mesmo ícone serve
 * a botões e avisos em vinte telas, e trocar o desenho mexeria em todas.
 */
import type { ReactNode, SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const M = ({ children, ...p }: P & { children: ReactNode }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...p}
  >
    {children}
  </svg>
);

/** Calendário com os dias marcados. */
export const MnCalendario = (p: P) => (
  <M {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2.5" />
    <path d="M16 2v4M8 2v4M3 10h18" />
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
  </M>
);

/** Pasta aberta — os projetos em andamento. */
export const MnProjetos = (p: P) => (
  <M {...p}>
    <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
  </M>
);

/** Duas etapas ligadas por um caminho — o fluxograma do processo. */
export const MnFluxograma = (p: P) => (
  <M {...p}>
    <rect x="3" y="3" width="8" height="8" rx="2" />
    <path d="M7 11v4a2 2 0 0 0 2 2h4" />
    <rect x="13" y="13" width="8" height="8" rx="2" />
  </M>
);

/** Prédio comercial — as empresas que fornecem. */
export const MnFornecedores = (p: P) => (
  <M {...p}>
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
  </M>
);

/** Controles deslizantes — os ajustes do sistema. */
export const MnConfiguracoes = (p: P) => (
  <M {...p}>
    <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3" />
    <path d="M14 2v4M8 10v4M16 18v4" />
  </M>
);

/** Escudo com o visto — quem pode o quê. */
export const MnAcessos = (p: P) => (
  <M {...p}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </M>
);

/** Relógio que volta no tempo — o histórico do que aconteceu. */
export const MnLogs = (p: P) => (
  <M {...p}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </M>
);

/** Livro aberto — o guia do aplicativo. */
export const MnGuia = (p: P) => (
  <M {...p}>
    <path d="M12 7v14" />
    <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
  </M>
);

/** Fone de atendimento — o Help Desk. */
export const MnSuporte = (p: P) => (
  <M {...p}>
    <path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z" />
    <path d="M21 16v2a4 4 0 0 1-4 4h-5" />
  </M>
);
