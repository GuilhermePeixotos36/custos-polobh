import { useEffect, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type Recurso } from "@/store/auth";
import { auditar } from "@/store/logs";

/** Bloqueia rota se o perfil não tem o recurso (e registra a tentativa). */
export function RequireRecurso({ r, children }: { r: Recurso; children: ReactNode }) {
  const pode = useAuth((s) => s.pode);
  const usuario = useAuth((s) => s.usuario);
  const permitido = pode(r);

  useEffect(() => {
    if (usuario && !permitido) {
      auditar({
        nivel: "aviso",
        categoria: "Acesso",
        acao: "acesso.negado",
        mensagem: `Acesso negado ao recurso "${r}"`,
        usuario: usuario.nome,
        papel: usuario.papel,
      });
    }
  }, [permitido, r, usuario]);

  if (!permitido) return <Navigate to="/" replace />;
  return <>{children}</>;
}
