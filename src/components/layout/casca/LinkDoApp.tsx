/**
 * Ponto único de troca do roteador: a casca (BarraLateral, MenuInferior) importa o `Link` daqui.
 * React Router (padrão): reexporta o dele. TanStack Router: troque pela linha comentada (o `Link`
 * dele também usa `to`, `className` e aceita `aria-current`). Outro roteador: exporte um componente
 * `Link` com `to`, `className`, `children` e os atributos `aria-*`/`title`.
 */
export { Link } from 'react-router-dom'
// export { Link } from '@tanstack/react-router'
