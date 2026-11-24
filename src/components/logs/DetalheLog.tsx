/**
 * Popup "Detalhe do evento" da tela Logs (padrão LSPRO, 24/11/2026).
 *
 * REGRA DE SEGURANÇA: tudo o que vem do log é TEXTO. Mensagem, nome, user-agent e o detalhe (JSON
 * em `<pre>`, como filho de texto do React) nunca viram HTML, Markdown nem link — parte do log é
 * escrita por quem nem entrou no app (o user-agent da falha de login).
 */
import { useId, type ReactNode } from "react";
import { CabecalhoJanela } from "@/components/padrao/CabecalhoJanela";
import { JanelaModal } from "@/components/padrao/JanelaModal";
import { Button } from "@/components/padrao/button";
import { dataHoraBr, detalheComoTexto } from "@/lib/logs/csv";
import {
  ROTULO_NIVEL, ROTULO_RESULTADO, antesEDepois, rotuloDaAcao, rotuloDaOrigem, rotuloDaTela, type ItemLog,
} from "@/lib/logs/logsStore";

const traco = (valor: string | null | undefined) => (valor && valor.trim() ? valor : "—");

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-semibold text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

function BlocoTexto({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="min-w-0">
      <p className="text-2xs font-semibold text-muted-foreground">{titulo}</p>
      <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
        {texto || "—"}
      </pre>
    </div>
  );
}

export function DetalheLog({ item, onFechar, onMesmaCorrelacao }: {
  item: ItemLog;
  onFechar: () => void;
  /** Fecha o popup e liga o filtro de correlação. */
  onMesmaCorrelacao: (correlacao: string) => void;
}) {
  const tituloId = useId();
  const alteracao = antesEDepois(item);
  const alvo = [item.alvoTipo, item.alvoRotulo ?? item.alvoId].filter((v) => v && String(v).trim()).join(" · ");
  // O nome da tela e, quando ele não é o próprio caminho, o caminho entre parênteses (a sub-rota
  // diz qual projeto/EC/OS era).
  const rotuloTela = rotuloDaTela(item.tela);
  const nomeDaTela = !item.tela ? "" : rotuloTela === item.tela ? item.tela : `${rotuloTela} (${item.tela})`;

  return (
    <JanelaModal onFechar={onFechar} rotuloId={tituloId} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden bg-card">
      <CabecalhoJanela titulo="Detalhe do evento" subtitulo={rotuloDaAcao(item.acao)} tituloId={tituloId} onFechar={onFechar} />

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo rotulo="Data e hora">{dataHoraBr(item.em)}</Campo>
          <Campo rotulo="Usuário">{traco(item.atorNome)}</Campo>
          <Campo rotulo="Ação">{rotuloDaAcao(item.acao)}</Campo>
          <Campo rotulo="Resultado">{ROTULO_RESULTADO[item.resultado] ?? traco(item.resultado)}</Campo>
          <Campo rotulo="Nível">{ROTULO_NIVEL[item.nivel] ?? traco(item.nivel)}</Campo>
          <Campo rotulo="Origem">{rotuloDaOrigem(item)}</Campo>
          <Campo rotulo="Tela">{traco(nomeDaTela)}</Campo>
          <Campo rotulo="Alvo">{traco(alvo)}</Campo>
          <Campo rotulo="IP">{traco(item.ip)}</Campo>
        </dl>

        {item.mensagem?.trim() && <BlocoTexto titulo="Mensagem" texto={item.mensagem} />}

        {alteracao ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BlocoTexto titulo="Antes" texto={detalheComoTexto(alteracao.antes)} />
            <BlocoTexto titulo="Depois" texto={detalheComoTexto(alteracao.depois)} />
          </div>
        ) : item.detalhe !== null && item.detalhe !== undefined ? (
          <BlocoTexto titulo="Detalhe" texto={detalheComoTexto(item.detalhe)} />
        ) : null}

        {item.userAgent?.trim() && <BlocoTexto titulo="Navegador (user-agent)" texto={item.userAgent} />}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
        {item.correlacao && (
          <Button variant="outline" onClick={() => onMesmaCorrelacao(item.correlacao!)}>
            Ver eventos da mesma correlação
          </Button>
        )}
        <Button variant="outline" onClick={onFechar}>Fechar</Button>
      </div>
    </JanelaModal>
  );
}
