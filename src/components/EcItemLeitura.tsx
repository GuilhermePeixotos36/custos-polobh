/**
 * Um item da EC em modo leitura.
 *
 * O desenho anterior era uma grade de 7 colunas esticada na largura inteira da
 * tela: com os campos de contratação vazios (o caso comum enquanto a EC está em
 * montagem), sobravam vãos enormes e um punhado de "—" soltos no meio do nada, e
 * os valores flutuavam na borda direita sem ligação visual com o item.
 *
 * Aqui a informação é lida em três faixas curtas, cada peça ocupando só o
 * espaço de que precisa e quebrando linha quando falta espaço:
 *   1. identificação (nome + descrições) e o bloco dos dois valores;
 *   2. uma única linha com status e contratação, campos separados por um traço;
 *   3. observações.
 */
import { Fragment, type ReactNode } from "react";
import { Badge, tomDoStatus } from "@/components/ui";
import { ObservacoesThread } from "@/components/ObservacoesPopup";
import { idAncoraPendencia } from "@/components/NavegadorPendencias";
import { sanitizarHtmlEditor } from "@/lib/sanitizeHtml";
import { brl, cx } from "@/lib/format";
import type { EcLinha, Observacao } from "@/data/types";

export function EcItemLeitura({
  linha: l,
  verFinanceiro,
  veDescricaoCompleta,
  usuarios,
  onObservacoes,
}: {
  linha: EcLinha;
  /** Mostra os valores Pólobh/Cliente (restrito ao papel financeiro). */
  verFinanceiro: boolean;
  /** Administrativo lê só a Descrição Financeiro; os demais papéis veem a completa. */
  veDescricaoCompleta: boolean;
  usuarios: string[];
  onObservacoes: (obs: Observacao[]) => void;
}) {
  return (
    <div id={idAncoraPendencia(l.id)} className="px-4 pt-4 pb-1 hover:bg-[#FCFCFD]">
      {/* Faixa 1 — identificação do item e os dois valores, lado a lado. */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-ink text-[13.5px]">{l.item || "—"}</div>
          {l.descricao && <div className="text-[12.5px] text-ink-2 whitespace-pre-wrap mt-0.5">{l.descricao}</div>}
          {veDescricaoCompleta && l.descricaoCompleta && (
            <div
              className="text-[12.5px] text-ink-2 mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              dangerouslySetInnerHTML={{ __html: sanitizarHtmlEditor(l.descricaoCompleta) }}
            />
          )}
        </div>
        {/* Os dois valores num bloco só, com fundo próprio: antes flutuavam
            soltos na borda direita, longe do item a que se referem. */}
        {verFinanceiro && (
          <div className="shrink-0 flex items-center gap-4 rounded-btn bg-[#F4F5F8] px-3 py-1.5">
            <ValorItem rotulo="Pólobh" valor={l.valorPolobh} />
            <span className="h-7 w-px bg-border" aria-hidden="true" />
            <ValorItem rotulo="Cliente" valor={l.valorCliente} />
          </div>
        )}
      </div>

      {/* Faixa 2 — status e contratação numa ÚNICA linha, com um traço fino
          separando cada campo do seguinte. Antes eram duas fileiras empilhadas,
          e sem divisor não dava para saber onde um campo terminava e o outro
          começava. Em tela estreita a linha quebra sozinha. */}
      <div className="mt-3 pt-3 pb-3 border-t border-border-soft">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {[
            <ChipStatus key="aprovacao" rotulo="Aprovação"><Badge tom={tomDoStatus(l.statusAprovacao)}>{l.statusAprovacao}</Badge></ChipStatus>,
            <ChipStatus key="os" rotulo="OS"><Badge tom={tomDoStatus(l.statusOs)}>{l.statusOs}</Badge></ChipStatus>,
            <ChipStatus key="contrato" rotulo="Contrato"><Badge tom={tomDoStatus(l.contratoStatus)}>{l.contratoStatus}</Badge></ChipStatus>,
            <DadoInline key="fornecedor" rotulo="Fornecedor" valor={l.fornecedorRazao} extra={l.fornecedorCnpj} />,
            <DadoInline key="documento" rotulo="Documento PG" valor={l.faturaNf} />,
            // Mesmo esquema de cores dos status: preenchido é assunto resolvido.
            <ChipStatus key="codigo" rotulo="Código de Serviço">
              {l.codigoServico.trim()
                ? <Badge tom={tomDoStatus(l.codigoServico)}>{l.codigoServico}</Badge>
                : <span className="text-[12.5px] text-ink-3/60">—</span>}
            </ChipStatus>,
            <ChipStatus key="pedido" rotulo="Pedido de Compra">
              {l.pedidoCompra.trim()
                ? <Badge tom={tomDoStatus(l.pedidoCompra)}>{l.pedidoCompra}</Badge>
                : <span className="text-[12.5px] text-ink-3/60">—</span>}
            </ChipStatus>,
          ].map((campo, i) => (
            <Fragment key={campo.key}>
              {i > 0 && <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />}
              {campo}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Rodapé alinhado ao conteúdo do item (o padding lateral já vem do contêiner). */}
      <ObservacoesThread className="!px-0" observacoes={l.observacoes} usuarios={usuarios} onChange={onObservacoes} />
    </div>
  );
}

/** Um dos dois valores do item (Pólobh / Cliente), dentro do bloco de valores. */
function ValorItem({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="text-right">
      <span className="block text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">{rotulo}</span>
      <span className="font-display font-bold text-ink text-[13px] whitespace-nowrap">{brl(valor)}</span>
    </div>
  );
}

/** Rótulo curto colado no badge de status (Aprovação, OS, Contrato). */
function ChipStatus({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">{rotulo}</span>
      {children}
    </span>
  );
}

/** Rótulo + valor numa única linha. Vazio fica esmaecido, sem roubar destaque. */
function DadoInline({ rotulo, valor, extra }: { rotulo: string; valor?: string; extra?: string }) {
  const preenchido = !!valor?.trim();
  return (
    <span className="inline-flex items-baseline gap-1.5 min-w-0">
      <span className="text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3 whitespace-nowrap">{rotulo}</span>
      <span className={cx("text-[12.5px] truncate", preenchido ? "text-ink font-medium" : "text-ink-3/60")}>
        {preenchido ? valor : "—"}
      </span>
      {preenchido && extra?.trim() && <span className="text-[11px] text-ink-3 whitespace-nowrap">({extra})</span>}
    </span>
  );
}
