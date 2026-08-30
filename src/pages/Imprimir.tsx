/**
 * Página de visualização/impressão de documentos (EC e OS).
 * Renderiza só o documento numa folha A4 — sem sidebar/topbar — então a
 * impressão (Ctrl+P / "Salvar como PDF") sai limpa. Serve também como a
 * "visualização em tela" pedida no brief.
 */
import { useEffect } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/store/auth";
import { auditar } from "@/store/logs";
import { dataBR } from "@/lib/format";
import { Button } from "@/components/ui";
import { IcBack, IcDownload } from "@/components/icons";
import { EcDocumento } from "@/components/print/EcDocumento";
import { OsDocumento } from "@/components/print/OsDocumento";

export function ImprimirEc() {
  const { id = "" } = useParams();
  const usuario = useAuth((s) => s.usuario);
  const { data: ec, loading } = useAsync(() => repo.ecs.obter(id), [id]);
  useEffect(() => {
    if (!ec) return;
    auditar({ categoria: "Exportação", acao: "ec.imprimir", mensagem: `EC ${ec.numero} aberta para impressão/PDF`, alvoId: ec.id });
    // Nome do PDF salvo = código da EC + data (o navegador usa document.title).
    const anterior = document.title;
    document.title = `${ec.numero} - ${dataBR(ec.criadoEm)}`;
    return () => { document.title = anterior; };
  }, [ec]);
  if (!usuario) return <Navigate to="/login" replace />;
  return (
    <Moldura voltarPara={`/estimativas/${id}`} loading={loading} vazio={!ec}>
      {ec && <EcDocumento ec={ec} />}
    </Moldura>
  );
}

export function ImprimirOs() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const usuario = useAuth((s) => s.usuario);
  const pode = useAuth((s) => s.pode);
  const { data: os, loading } = useAsync(() => repo.oss.obter(id), [id]);
  const { data: ec } = useAsync(() => (os ? repo.ecs.obter(os.ecId) : Promise.resolve(undefined)), [os?.ecId]);
  useEffect(() => {
    if (!os) return;
    auditar({ categoria: "Exportação", acao: "os.imprimir", mensagem: `OS ${os.numero} aberta para impressão/PDF`, alvoId: os.id });
    // Nome do PDF salvo = código da OS + data.
    const anterior = document.title;
    document.title = `${os.numero} - ${dataBR(os.criadoEm)}`;
    return () => { document.title = anterior; };
  }, [os]);
  if (!usuario) return <Navigate to="/login" replace />;
  const restrito = pode("financeiro") && params.get("financeiro") !== "0";
  return (
    <Moldura voltarPara={`/ordens/${id}`} loading={loading} vazio={!os || !ec}>
      {os && ec && <OsDocumento os={os} ec={ec} restrito={restrito} />}
    </Moldura>
  );
}

function Moldura({
  voltarPara,
  loading,
  vazio,
  children,
}: {
  voltarPara: string;
  loading: boolean;
  vazio: boolean;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();

  // dispara a impressão se vier com ?auto=1
  const [params] = useSearchParams();
  useEffect(() => {
    if (!loading && !vazio && params.get("auto") === "1") {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [loading, vazio, params]);

  return (
    <div className="min-h-screen bg-bg py-8">
      {/* Barra de ações — não imprime */}
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex items-center justify-between px-2">
        <button onClick={() => navigate(voltarPara)} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink font-semibold">
          <IcBack width={16} height={16} /> Voltar
        </button>
        {/* A OS chega aqui com ?auto=1 e a janela de salvar já abre sozinha;
            este botão é para reabrir sem voltar e clicar de novo. */}
        <Button size="sm" icon={<IcDownload width={16} height={16} />} onClick={() => window.print()}>
          Baixar PDF
        </Button>
      </div>

      {loading ? (
        <p className="text-center text-ink-3">Carregando…</p>
      ) : vazio ? (
        <p className="text-center text-ink-3">Documento não encontrado.</p>
      ) : (
        children
      )}
    </div>
  );
}
