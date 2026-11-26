import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { registrarRotaNegada } from "@/lib/logs/registrarLog";
import { useAuth, type Recurso } from "@/store/auth";
import { auditar } from "@/store/logs";

/**
 * Bloqueia rota se o perfil não tem o recurso (e registra a tentativa).
 * Com uma LISTA de recursos, basta ter um deles — é o caso de Configurações,
 * que a Coordenação abre só pela lista padrão do check-list.
 */
export function RequireRecurso({ r, children }: { r: Recurso | Recurso[]; children: ReactNode }) {
  const pode = useAuth((s) => s.pode);
  const usuario = useAuth((s) => s.usuario);
  const permitido = (Array.isArray(r) ? r : [r]).some(pode);
  const { pathname } = useLocation();

  useEffect(() => {
    if (usuario && !permitido) {
      registrarRotaNegada(pathname);
      auditar({
        nivel: "aviso",
        categoria: "Acesso",
        acao: "acesso.negado",
        mensagem: `Acesso negado ao recurso "${Array.isArray(r) ? r.join(" / ") : r}"`,
        usuario: usuario.nome,
        papel: usuario.papel,
      });
    }
  }, [permitido, r, usuario, pathname]);

  if (!permitido) return <Navigate to="/" replace />;
  return <>{children}</>;
}
