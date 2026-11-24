/**
 * Logs (24/11/2026, padrão LSPRO): Atividades, Acessos e Erros do app, para quem tem o recurso
 * `logs` — o mesmo portão que o banco confere (`pode_ver_logs()`); esconder a rota é só cortesia.
 *
 * A rota é fina: a tela mora em `components/logs/TelaLogs`, que recebe a consulta por prop.
 * Enquanto a migration dos logs não estiver aplicada, `consultarComReserva` cai para a trilha
 * antiga (`audit_log`) e a tela avisa.
 *
 * "Exportar CSV" segue o mesmo recurso `logs`: a Pólobh ainda não tem permissão separada de
 * exportar (vem com o padrão de Acessos, como `admin.logs` › exportar).
 */
import { PageShell } from "@/components/layout/AppLayout";
import { BarraConfiguracoes } from "@/components/layout/BarraSecao";
import { TelaLogs } from "@/components/logs/TelaLogs";
import { carregarUsuariosDoFiltro, consultarComReserva } from "@/lib/logs/logsStore";
import { useAuth } from "@/store/auth";

export function Logs() {
  const podeExportar = useAuth((s) => s.pode("logs"));
  return (
    <PageShell
      title="Logs"
      subtitle="Quem entrou, o que foi alterado ou exportado e que erro apareceu — sem abrir o Supabase."
      subabas={<BarraConfiguracoes atual="logs" />}
      // A tela dos logs traz as próprias abas (Atividades · Acessos · Erros) e a
      // tabela de ponta a ponta: dentro do painel de Configurações, sem recuo.
      painelSemRecuo
    >
      <TelaLogs aninhada consultar={consultarComReserva} podeExportar={podeExportar} carregarUsuarios={carregarUsuariosDoFiltro} />
    </PageShell>
  );
}
