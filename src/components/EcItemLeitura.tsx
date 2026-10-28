/**
 * Um item da EC em modo leitura — o MESMO desenho do modo edição (09/10/2026).
 *
 * Mesmo cartão, mesma trilha de controles à esquerda (seleção + setas), mesmos
 * campos com o rótulo em cima; a diferença é que aqui nada se digita. As setas
 * aparecem apagadas — reordenar é coisa da edição — e a seleção serve para
 * escolher quais itens entram na emissão de OS.
 *
 * A segunda linha (status e contratação) quebra de linha sozinha quando falta
 * largura, e cada campo tem só a largura de que precisa: nada é cortado.
 */
import { type ReactNode } from "react";
import { Badge, Select, classeCampoStatus, tomDoStatus } from "@/components/ui";
import { OPCOES_STATUS_OS, type MudancaDeStatus } from "@/domain/statusEc";
import { ObservacoesThread } from "@/components/ObservacoesPopup";
import { MoverSetas } from "@/components/MoverSetas";
import { FaixaDivisao } from "@/components/FaixaDivisao";
import type { InfoDivisao } from "@/domain/divisaoEc";
import { idAncoraPendencia, idCampoPendencia } from "@/lib/destaque";
import { sanitizarHtmlEditor } from "@/lib/sanitizeHtml";
import { brl, cx } from "@/lib/format";
import type { EcLinha, Observacao } from "@/data/types";

export function EcItemLeitura({
  linha: l,
  verFinanceiro,
  veDescricaoCompleta,
  usuarios,
  selecionado,
  onSelecionar,
  editavelStatus,
  onStatus,
  divisao,
  onObservacoes,
}: {
  linha: EcLinha;
  /** Mostra os valores Pólobh/Cliente (restrito ao papel financeiro). */
  verFinanceiro: boolean;
  /** Administrativo lê só a Descrição Financeiro; os demais papéis veem a completa. */
  veDescricaoCompleta: boolean;
  usuarios: string[];
  selecionado: boolean;
  onSelecionar: () => void;
  /** Aprovação, OS e Contrato viram seletores: mudar status não exige editar a EC. */
  editavelStatus: boolean;
  onStatus: (m: MudancaDeStatus) => void;
  /** Parte de um item com mais de um fornecedor. */
  divisao?: InfoDivisao;
  onObservacoes: (obs: Observacao[]) => void;
}) {
  return (
    <div
      id={idAncoraPendencia(l.id)}
      className={cx(
        "rounded-card border bg-white",
        selecionado ? "border-primary ring-1 ring-primary/40 bg-primary-soft/30" : "border-border"
      )}
    >
      {divisao && <FaixaDivisao info={divisao} verFinanceiro={verFinanceiro} />}
      {/* Linha 1: trilha de controles + identificação + valores */}
      <div className="flex items-start gap-2 p-2.5 min-w-0 flex-wrap">
        <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary cursor-pointer"
            checked={selecionado}
            onChange={onSelecionar}
            aria-label={`Selecionar item ${l.item || "sem título"}`}
            title="Selecionar o item — a emissão de OS passa a valer só para os selecionados"
          />
          <MoverSetas
            className="hidden sm:flex"
            rotulo={`o item ${l.item || "sem título"}`}
            podeSubir={false}
            podeDescer={false}
            motivoBloqueio="Para reordenar, edite a EC"
            onSubir={() => {}}
            onDescer={() => {}}
          />
        </div>

        <div className="flex-1 min-w-48 pt-1">
          <div className="font-bold text-ink text-[13.5px]">{l.item || "—"}</div>
          {l.descricao && <div className="text-[12.5px] text-ink-2 whitespace-pre-wrap mt-0.5">{l.descricao}</div>}
          {veDescricaoCompleta && l.descricaoCompleta && (
            <div
              className="text-[12.5px] text-ink-2 mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              dangerouslySetInnerHTML={{ __html: sanitizarHtmlEditor(l.descricaoCompleta) }}
            />
          )}
        </div>

        {verFinanceiro && (
          <div className="shrink-0 flex items-center gap-4 rounded-btn bg-[#F4F5F8] px-3 py-1.5">
            <ValorItem rotulo="Pólobh" valor={l.valorPolobh} />
            <span className="h-7 w-px bg-border" aria-hidden="true" />
            <ValorItem rotulo="Cliente" valor={l.valorCliente} />
          </div>
        )}
      </div>

      {/* Linha 2: status e contratação, com a mesma largura dos campos da edição. */}
      <div className="flex flex-wrap items-end gap-x-2 gap-y-2 px-2.5 pb-2.5 pt-2 border-t border-border-soft bg-[#FCFCFD] rounded-b-card min-w-0">
        <Campo label="Aprovação" className="w-28 shrink-0">
          {editavelStatus ? (
            <Select
              className={cx("h-9! px-2! text-[12.5px]!", classeCampoStatus(l.statusAprovacao))}
              value={l.statusAprovacao}
              onChange={(e) => onStatus({ aprovacao: e.target.value as "Pendente" | "OK" })}
              aria-label={`Aprovação do item ${l.item || "sem título"}`}
            >
              <option>Pendente</option>
              <option>OK</option>
            </Select>
          ) : (
            <Badge tom={tomDoStatus(l.statusAprovacao)}>{l.statusAprovacao}</Badge>
          )}
        </Campo>
        {/* Os dois levam id próprio: "OS/Contrato a emitir" é pendência, e o
            navegador pisca este campo em vez da linha inteira. */}
        <Campo label="OS" className="w-38 shrink-0" id={idCampoPendencia(l.id, "os")}>
          {editavelStatus ? (
            <Select className={cx("h-9! px-2! text-[12.5px]!", classeCampoStatus(l.statusOs))} value={l.statusOs} onChange={(e) => onStatus({ os: e.target.value as EcLinha["statusOs"] })} aria-label={`OS do item ${l.item || "sem título"}`}>
              {OPCOES_STATUS_OS.map((o) => <option key={o}>{o}</option>)}
            </Select>
          ) : (
            <Badge tom={tomDoStatus(l.statusOs)}>{l.statusOs}</Badge>
          )}
        </Campo>
        <Campo label="Contrato" className="w-38 shrink-0" id={idCampoPendencia(l.id, "contrato")}>
          {editavelStatus ? (
            <Select className={cx("h-9! px-2! text-[12.5px]!", classeCampoStatus(l.contratoStatus))} value={l.contratoStatus} onChange={(e) => onStatus({ contrato: e.target.value as EcLinha["contratoStatus"] })} aria-label={`Contrato do item ${l.item || "sem título"}`}>
              {OPCOES_STATUS_OS.map((o) => <option key={o}>{o}</option>)}
            </Select>
          ) : (
            <Badge tom={tomDoStatus(l.contratoStatus)}>{l.contratoStatus}</Badge>
          )}
        </Campo>
        <Campo label="Fornecedor (CNPJ / Razão social)" className="basis-full min-w-0 sm:basis-auto sm:flex-[2_1_22rem] sm:min-w-[16rem]">
          <Texto valor={l.fornecedorRazao} extra={l.fornecedorCnpj} />
        </Campo>
        <Campo label="Documento PG" className="flex-[1_1_8rem] min-w-28">
          <Texto valor={l.faturaNf} />
        </Campo>
        <Campo label="Código de Serviço" className="flex-[1_1_8rem] min-w-28">
          {l.codigoServico.trim() ? <Badge tom={tomDoStatus(l.codigoServico)}>{l.codigoServico}</Badge> : <Texto valor="" />}
        </Campo>
        <Campo label="Pedido de Compra" className="flex-[1_1_8rem] min-w-28">
          {l.pedidoCompra.trim() ? <Badge tom={tomDoStatus(l.pedidoCompra)}>{l.pedidoCompra}</Badge> : <Texto valor="" />}
        </Campo>
      </div>

      <ObservacoesThread ancora={l.id} observacoes={l.observacoes} usuarios={usuarios} onChange={onObservacoes} />
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

/** Rótulo pequeno em cima do campo, como na edição. */
function Campo({ label, className, children, id }: { label: string; className?: string; children: ReactNode; id?: string }) {
  return (
    <div id={id} className={cx("block", className)}>
      <span className="block text-[10.5px] font-extrabold uppercase tracking-wider text-ink-3 mb-1 truncate">{label}</span>
      <div className="min-h-9 flex items-center">{children}</div>
    </div>
  );
}

/** Texto de leitura. Vazio fica esmaecido, sem roubar destaque. */
function Texto({ valor, extra }: { valor?: string; extra?: string }) {
  const preenchido = !!valor?.trim();
  return (
    <span className="min-w-0 truncate text-[12.5px]" title={preenchido ? [valor, extra].filter(Boolean).join(" · ") : undefined}>
      {preenchido ? (
        <>
          <span className="text-ink font-medium">{valor}</span>
          {extra?.trim() && <span className="text-[11px] text-ink-3"> ({extra})</span>}
        </>
      ) : (
        <span className="text-ink-3/60">—</span>
      )}
    </span>
  );
}
