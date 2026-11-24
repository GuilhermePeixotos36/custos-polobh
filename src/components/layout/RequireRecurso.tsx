import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Eye, ShieldX } from "lucide-react";
import { useAuth, type Recurso } from "@/store/auth";
import { auditar } from "@/store/logs";
import { registrarRotaNegada } from "@/lib/logs/registrarLog";
import { usePermissoes } from "@/lib/acessos/usePermissoes";
import { EstadoVazio } from "@/components/padrao/EstadoVazio";

/**
 * Bloqueia rota se o perfil não tem o recurso (e registra a tentativa).
 * Com uma LISTA de recursos, basta ter um deles — é o caso de Configurações,
 * que a Coordenação abre só pela lista padrão do check-list.
 *
 * PADRÃO DE ACESSOS (24/11/2026): sem permissão, a tela diz o motivo no lugar do conteúdo, em vez
 * de mandar para "/". O desvio para a página inicial escondia o motivo — e, para quem não vê
 * Projetos, virava um vaivém sem fim entre "/" e "/calendario". E quem vê a tela sem poder
 * alterar nada nela recebe a faixa "Somente leitura" (a regra mora em `lib/acessos/permissoes`).
 */
export function RequireRecurso({ r, children }: { r: Recurso | Recurso[]; children: ReactNode }) {
  const pode = useAuth((s) => s.pode);
  const usuario = useAuth((s) => s.usuario);
  const { somenteLeitura } = usePermissoes();
  const { pathname } = useLocation();
  const permitido = (Array.isArray(r) ? r : [r]).some(pode);

  useEffect(() => {
    if (usuario && !permitido) {
      auditar({
        nivel: "aviso",
        categoria: "Acesso",
        acao: "acesso.negado",
        mensagem: `Acesso negado ao recurso "${Array.isArray(r) ? r.join(" / ") : r}"`,
        usuario: usuario.nome,
        papel: usuario.papel,
      });
      // Tela Logs › Acessos: uma vez por rota por sessão do navegador.
      registrarRotaNegada(pathname);
    }
  }, [permitido, r, usuario, pathname]);

  if (!permitido) {
    return (
      <div className="flex-1 px-(--gutter) py-10">
        <EstadoVazio icone={ShieldX} titulo="Seu grupo não tem permissão para acessar esta tela." />
      </div>
    );
  }
  return (
    <>
      {somenteLeitura(pathname) && (
        <div role="status" className="no-print mx-(--gutter) mt-3 flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
          <Eye aria-hidden className="h-4 w-4 shrink-0" />
          Somente leitura: seu grupo pode ver esta tela, mas não alterar.
        </div>
      )}
      {children}
    </>
  );
}
