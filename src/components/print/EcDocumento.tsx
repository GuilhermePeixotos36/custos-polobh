/** EC como documento A4 (Proposta Comercial) — visualização em tela + PDF. */
import { Fragment } from "react";
import type { Ec } from "@/data/types";
import { calcularTotais } from "@/domain/calc";
import { juntarDivisoes } from "@/domain/divisaoEc";
import { brl, cx, dataBR } from "@/lib/format";
import { sanitizarHtmlEditor } from "@/lib/sanitizeHtml";

/** Rich-text vazio ("<p></p>") não conta como descrição. */
const texto = (html?: string) => (html ?? "").replace(/<[^>]+>|&nbsp;/g, "").trim();

function Secao({ titulo }: { titulo: string }) {
  return (
    <div className="bg-primary text-white font-bold text-[12px] uppercase tracking-wide px-3 py-1.5 mt-4">
      {titulo}
    </div>
  );
}

function LV({ label, valor }: { label: string; valor?: string | number | null }) {
  return (
    <div className="grid grid-cols-[180px_1fr] border-b border-border-soft text-[12px]">
      <div className="bg-primary-soft font-bold px-3 py-1.5">{label}</div>
      <div className="px-3 py-1.5 whitespace-pre-line">{valor ?? ""}</div>
    </div>
  );
}

export function EcDocumento({ ec }: { ec: Ec }) {
  const t = calcularTotais(ec.linhas, ec.producao, ec.honorarios, ec.encargos);
  const cli = ec.cliente;
  const p = ec.projeto;

  // Item pago a vários fornecedores (04/11/2026) sai como UMA linha, com a soma
  // dos valores e os fornecedores juntos — como no Excel financeiro.
  const ordenadas = [...ec.linhas].sort((a, b) => a.ordem - b.ordem);
  const fornecedoresDaDivisao = new Map<string, string[]>();
  for (const l of ordenadas) {
    if (!l.divisao || l.oculto || !l.fornecedorRazao?.trim()) continue;
    const nomes = fornecedoresDaDivisao.get(l.divisao) ?? [];
    if (!nomes.includes(l.fornecedorRazao.trim())) nomes.push(l.fornecedorRazao.trim());
    fornecedoresDaDivisao.set(l.divisao, nomes);
  }
  const fornecedorDe = (l: Ec["linhas"][number]) =>
    l.divisao && fornecedoresDaDivisao.has(l.divisao) ? fornecedoresDaDivisao.get(l.divisao)!.join(", ") : l.fornecedorRazao;

  const grupos = new Map<string, typeof ec.linhas>();
  for (const l of juntarDivisoes(ordenadas)) {
    const g = l.grupo || "GERAL";
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push(l);
  }

  return (
    <div className="doc-sheet p-[14mm] text-ink">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b-2 border-primary pb-3">
        <img src="/polobh-logo.png" alt="Pólobh" className="h-9 w-auto object-contain" />
        <div className="text-right">
          <div className="font-display font-extrabold text-[16px] tracking-tight leading-tight">
            Estimativa de Custos | Proposta Comercial
          </div>
          <div className="text-[11px] text-ink-2">{ec.numero}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px] text-ink-2 mt-2">
        <div><b className="text-ink">Data:</b> {dataBR(ec.atualizadoEm)}</div>
        <div><b className="text-ink">Versão:</b> V{String(ec.versao).padStart(2, "0")}</div>
        <div className="text-right"><b className="text-ink">Validade:</b> {ec.validadeDias} dias</div>
      </div>

      {/* Cliente */}
      <Secao titulo="Cliente" />
      <LV label="Cliente" valor={cli.nome} />
      <LV label="Razão Social" valor={cli.razaoSocial} />
      <LV label="Endereço" valor={cli.endereco} />
      <LV label="CNPJ/CPF" valor={cli.cnpjCpf} />
      {cli.inscricaoEstadual && <LV label="Inscrição Estadual" valor={cli.inscricaoEstadual} />}
      <LV
        label="Representante"
        valor={[cli.representante.nome, cli.representante.cargo, cli.representante.telefones, cli.representante.email]
          .filter(Boolean)
          .join("\n")}
      />

      {/* Projeto */}
      <Secao titulo="Projeto" />
      <LV label="Título" valor={p.titulo} />
      <LV label="Local" valor={`${p.local}${p.enderecoLocal ? " — " + p.enderecoLocal : ""}`} />
      <LV label="Nº Participantes" valor={p.participantes ?? ""} />
      <LV label="Produtora Responsável" valor={p.produtoraResponsavel} />
      <LV label="Datas" valor={`Pré: ${dataBR(p.preEvento)}  ·  Evento: ${dataBR(p.evento)} ${p.horario}  ·  Pós: ${dataBR(p.posEvento)}`} />
      {p.roteiro && <LV label="Roteiro" valor={p.roteiro} />}

      {/* Estimativa de custos */}
      <Secao titulo="Estimativa de Custos" />
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-black text-white">
            <th className="text-left px-2 py-1.5 w-[20%]">Item</th>
            <th className="text-left px-2 py-1.5">Descrição</th>
            <th className="text-left px-2 py-1.5 w-[22%]">Fornecedor</th>
            <th className="text-right px-2 py-1.5 w-[13%]">Pólobh</th>
            <th className="text-right px-2 py-1.5 w-[13%]">Cliente</th>
          </tr>
        </thead>
        <tbody>
          {[...grupos.entries()].map(([grupo, linhas]) => (
            <Fragment key={grupo}>
              <tr className="bg-primary-soft">
                <td colSpan={5} className="px-2 py-1 font-bold text-[11px] border-b border-border">{grupo}</td>
              </tr>
              {linhas.map((l) => (
                <tr key={l.id} className="border-b border-border-soft doc-avoid-break">
                  <td className="px-2 py-1.5 align-top font-semibold">{l.item}</td>
                  <td className="px-2 py-1.5 align-top">
                    {/* Resumo e, logo abaixo, a Descrição Completa (28/10/2026):
                        antes o PDF só trazia o resumo, e o detalhe sumia. */}
                    {l.descricao && <div className="whitespace-pre-wrap">{l.descricao}</div>}
                    {texto(l.descricaoCompleta) && (
                      <div
                        className={cx(l.descricao && "mt-1", "[&_p]:my-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4")}
                        dangerouslySetInnerHTML={{ __html: sanitizarHtmlEditor(l.descricaoCompleta) }}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top text-ink-2">{fornecedorDe(l)}</td>
                  <td className="px-2 py-1.5 align-top text-right">{brl(l.valorPolobh)}</td>
                  <td className="px-2 py-1.5 align-top text-right">{brl(l.valorCliente)}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>

      {/* Totais */}
      <div className="mt-4 flex justify-end doc-avoid-break">
        <table className="text-[11.5px] w-[58%]">
          <tbody>
            <Total label="Soma dos fornecedores" v={brl(t.somaFornecedores)} />
            <Total label="Honorários Pólobh (15%)" v={brl(t.honorariosPolobh)} />
            <Total label="Encargos (16,33%)" v={brl(t.encargos)} />
            <Total label="Sub-total Pólobh" v={brl(t.subTotalPolobh)} bold />
            <Total label="Faturamento terceiros" v={brl(t.faturamentoTerceiros)} />
            <Total label="Honorários cliente (15%)" v={brl(t.honorariosCliente)} />
            <tr className="bg-primary text-white">
              <td className="px-3 py-2 font-bold">Valor total bruto</td>
              <td className="px-3 py-2 font-bold text-right">{brl(t.valorTotalBruto)}</td>
            </tr>
            <Total label="Faturamento Pólobh" v={brl(t.faturamentoPolobh)} />
          </tbody>
        </table>
      </div>

      {/* Informações gerais / rodapé */}
      <Secao titulo="Informações Gerais" />
      <p className="text-[10px] text-ink-2 leading-relaxed mt-2 text-justify">
        A aprovação desta proposta, seja por meio de assinatura ou por e-mail, tem força contratual,
        gera obrigações entre as partes e pressupõe que o cliente concorda e aceita os termos nela descritos,
        com os valores devidos à Pólobh (reembolsos, honorários pelos serviços de organização e planejamento e
        taxa de administração sobre serviços de terceiros). O pagamento será efetuado no prazo máximo de 30 dias
        a partir da apresentação da(s) nota(s) fiscal(is) da Pólobh.
      </p>
      <p className="text-[10px] text-ink-2 mt-2 italic">
        Obs.: Esta EC | Orçamento cancela e substitui todas as anteriores referentes ao mesmo projeto.
      </p>

      <div className="grid grid-cols-2 gap-8 mt-10 text-[11px] doc-avoid-break">
        <div>
          <div className="border-t border-ink pt-1">Visto Pólobh — {ec.responsavel}</div>
        </div>
        <div>
          <div className="border-t border-ink pt-1">Aprovação do Cliente — Data: ____ ____ ______</div>
        </div>
      </div>
    </div>
  );
}

function Total({ label, v, bold }: { label: string; v: string; bold?: boolean }) {
  return (
    <tr className="border-b border-border-soft">
      <td className={`px-3 py-1.5 ${bold ? "font-bold" : "text-ink-2"}`}>{label}</td>
      <td className={`px-3 py-1.5 text-right ${bold ? "font-bold" : "font-semibold"}`}>{v}</td>
    </tr>
  );
}
