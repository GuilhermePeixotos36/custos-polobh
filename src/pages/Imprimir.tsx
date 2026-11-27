import { imprimirPagina } from "@/lib/logs/baixarArquivo";
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
import { comDadosAtuaisDoProjeto, osComDadosAtuais } from "@/lib/projetoAoVivo";
import { RentabilidadeDocumento } from "@/components/print/RentabilidadeDocumento";
import { gastoPorLinhaViaOSs, rotuloNumeroEc } from "@/domain/calc";

export function ImprimirEc() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const usuario = useAuth((s) => s.usuario);
  const pode = useAuth((s) => s.pode);
  const { data: ec, loading } = useAsync(() => repo.ecs.obter(id), [id]);
  /**
   * `?rentabilidade=1` imprime a RENTABILIDADE em vez da EC (15/09/2026).
   *
   * Mesma rota, porque é o mesmo documento visto de outro ângulo — e porque
   * assim o PDF sai pelo caminho de sempre (a impressão do navegador sobre a
   * visualização em tela). A permissão é a própria da aba: quem não vê a margem
   * na tela não a imprime por URL.
   */
  const verRentabilidade = params.get("rentabilidade") === "1" && pode("rentabilidade");
  const { data: oss } = useAsync(
    () => (verRentabilidade ? repo.oss.listar() : Promise.resolve([])),
    [verRentabilidade]
  );
  useEffect(() => {
    if (!ec) return;
    auditar({ categoria: "Exportação", acao: "ec.imprimir", mensagem: `EC ${rotuloNumeroEc(ec.numero)} aberta para impressão/PDF`, alvoId: ec.id });
    // Nome do PDF salvo = código da EC + data (o navegador usa document.title).
    const anterior = document.title;
    document.title = `${rotuloNumeroEc(ec.numero)} - ${dataBR(ec.criadoEm)}`;
    return () => { document.title = anterior; };
  }, [ec]);
  if (!usuario) return <Navigate to="/login" replace />;
  return (
    <Moldura voltarPara={`/estimativas/${id}`} loading={loading} vazio={!ec}>
      {ec && (verRentabilidade
        ? <RentabilidadeDocumento ec={ec} gastoPorLinha={gastoPorLinhaViaOSs(ec.linhas, (oss ?? []).filter((o) => o.ecId === ec.id))} />
        : <EcDocumento ec={ec} />)}
    </Moldura>
  );
}

export function ImprimirOs() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const usuario = useAuth((s) => s.usuario);
  const pode = useAuth((s) => s.pode);
  const navigate = useNavigate();
  const { data: os, loading } = useAsync(() => repo.oss.obter(id), [id]);
  // A EC com os dados do projeto de AGORA: a OS ainda não emitida sai com o
  // cliente e o projeto do cadastro (ver `osComDadosAtuais`).
  const { data: ec } = useAsync(
    async () => (os ? ((e) => (e ? comDadosAtuaisDoProjeto(e) : e))(await repo.ecs.obter(os.ecId)) : undefined),
    [os?.ecId]
  );
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
    // BAIXAR PDF É EMITIR A OS (27/11/2026): quem decide se pode é a tela da OS,
    // com as travas da emissão — o botão daqui leva o pedido para lá.
    <Moldura voltarPara={`/ordens/${id}`} loading={loading} vazio={!os || !ec} aoBaixar={() => navigate(`/ordens/${id}?baixarPdf=1`)}>
      {os && ec && <OsDocumento os={osComDadosAtuais(os, ec)} ec={ec} restrito={restrito} />}
    </Moldura>
  );
}

function Moldura({
  voltarPara,
  loading,
  vazio,
  aoBaixar,
  children,
}: {
  voltarPara: string;
  loading: boolean;
  vazio: boolean;
  /** O que o "Baixar PDF" faz; sem isto, abre a impressão do navegador (EC). */
  aoBaixar?: () => void;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();

  // A visualização NUNCA abre a janela de impressão sozinha (27/11/2026): imprimir é o botão.
  return (
    <div className="min-h-screen bg-bg py-8">
      {/* Barra de ações — não imprime */}
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex items-center justify-between px-2">
        <button onClick={() => navigate(voltarPara)} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink font-semibold">
          <IcBack width={16} height={16} /> Voltar
        </button>
        <Button size="sm" icon={<IcDownload width={16} height={16} />} onClick={() => (aoBaixar ? aoBaixar() : imprimirPagina("PDF pela impressão"))}>
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
