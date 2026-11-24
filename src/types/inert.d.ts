// `inert` ainda não está nos tipos do React 18. No React 18 o atributo vai como string
// ("" liga, undefined desliga); no 19 passa a aceitar booleano.
import "react";

declare module "react" {
  interface HTMLAttributes<T> {
    inert?: "" | undefined;
  }
}
