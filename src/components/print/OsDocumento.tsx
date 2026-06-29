/** OS como documento A4 — visualização em tela + PDF. */
import type { Ec, Os } from "@/data/types";
import { brl, dataBR } from "@/lib/format";

function Secao({ titulo }: { titulo: string }) {
  return (
    <div className="bg-primary text-white font-bold text-[12px] uppercase tracking-wide px-3 py-1.5 mt-4 doc-avoid-break">
      {titulo}
    </div>
  );
}

function LV({ label, valor, full }: { label: string; valor?: string | number | null; full?: boolean }) {
  return (
    <div className={`grid grid-cols-[170px_1fr] border-b border-border-soft text-[12px] ${full ? "col-span-2" : ""}`}>
      <div className="bg-primary-soft font-bold px-3 py-1.5">{label}</div>
      <div className="px-3 py-1.5 whitespace-pre-line">{valor ?? ""}</div>
    </div>
  );
}

export function OsDocumento({ os, ec, restrito = false }: { os: Os; ec: Ec; restrito?: boolean }) {
  const cli = ec.cliente;
  const p = ec.projeto;
  const f = os.fornecedor;
  const b = f.dadosBancarios;
  const consolidadas = ec.linhas.filter((l) => os.ecLinhaIds.includes(l.id));

  return (
    <div className="doc-sheet p-[14mm] text-ink">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b-2 border-primary pb-3">
        <img src="/polobh-logo.png" alt="Pólobh" className="h-9 w-auto object-contain" />
        <div className="text-right">
          <div className="font-display font-extrabold text-[16px] tracking-tight leading-tight">Ordem de Serviço</div>
          <div className="text-[11px] text-ink-2">{os.numero}</div>
        </div>
      </div>

      <Secao titulo="Dados do Cliente (da EC)" />
      <LV label="Cliente" valor={cli.nome} />
      <LV label="CNPJ/CPF" valor={cli.cnpjCpf} />
      <LV label="Endereço" valor={cli.endereco} />

      <Secao titulo="Dados do Projeto (da EC)" />
      <LV label="Título" valor={p.titulo} />
      <LV label="Local" valor={`${p.local}${p.enderecoLocal ? " — " + p.enderecoLocal : ""}`} />
      <LV label="Data / Horário" valor={`${dataBR(p.evento)} · ${p.horario}`} />
      <LV label="Participantes" valor={p.participantes ?? ""} />

      <Secao titulo="Fornecedor" />
      <LV label="Fornecedor" valor={f.nomeFantasia || f.razaoSocial} />
      <LV label="Razão Social" valor={f.razaoSocial} />
      <LV label="CNPJ/CPF" valor={f.cnpj} />
      <LV label="Perfil tributário" valor={f.perfilTributario} />
      <LV label="Endereço" valor={f.endereco} />
      <LV label="Representante" valor={f.representante} />
      <LV label="Contato" valor={[f.telefone, f.email].filter(Boolean).join(" · ")} />
      <LV label="Dados bancários" valor={[b.banco, b.agencia && `Ag. ${b.agencia}`, b.conta && `Conta ${b.conta}`, b.chavePix && `Pix ${b.chavePix}`].filter(Boolean).join("  ·  ")} />

      <Secao titulo="Itens Consolidados da EC" />
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-black text-white">
            <th className="text-left px-2 py-1.5 w-[22%]">Grupo</th>
            <th className="text-left px-2 py-1.5">Item / Descrição</th>
            <th className="text-right px-2 py-1.5 w-[16%]">Pólobh</th>
            <th className="text-right px-2 py-1.5 w-[16%]">Cliente</th>
          </tr>
        </thead>
        <tbody>
          {consolidadas.map((l) => (
            <tr key={l.id} className="border-b border-border-soft doc-avoid-break">
              <td className="px-2 py-1.5 align-top text-ink-2">{l.grupo}</td>
              <td className="px-2 py-1.5 align-top">
                <b>{l.item}</b>
                {l.descricao ? <span className="text-ink-2"> — {l.descricao}</span> : null}
              </td>
              <td className="px-2 py-1.5 align-top text-right">{brl(l.valorPolobh)}</td>
              <td className="px-2 py-1.5 align-top text-right">{brl(l.valorCliente)}</td>
            </tr>
          ))}
          <tr className="bg-primary-soft font-bold">
            <td className="px-2 py-1.5" colSpan={2}>Total consolidado</td>
            <td className="px-2 py-1.5 text-right">{brl(consolidadas.reduce((s, l) => s + l.valorPolobh, 0))}</td>
            <td className="px-2 py-1.5 text-right">{brl(consolidadas.reduce((s, l) => s + l.valorCliente, 0))}</td>
          </tr>
        </tbody>
      </table>

      <Secao titulo="Detalhamento da Contratação" />
      <LV label="Modalidade" valor={os.modalidade} />
      <LV label="Descritivo" valor={os.descritivo} />
      <LV label="Entrega" valor={os.entrega} />
      {os.observacoes && <LV label="Observações" valor={os.observacoes} />}

      <Secao titulo="Cronograma Específico do Fornecedor" />
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-black text-white">
            <th className="text-left px-2 py-1.5 w-[26%]">Etapa</th>
            <th className="text-left px-2 py-1.5 w-[18%]">Data</th>
            <th className="text-left px-2 py-1.5 w-[16%]">Horário</th>
            <th className="text-left px-2 py-1.5">Atividades</th>
          </tr>
        </thead>
        <tbody>
          {os.cronograma.length === 0 ? (
            <tr><td colSpan={4} className="px-2 py-2 text-ink-3">Sem etapas cadastradas.</td></tr>
          ) : (
            [...os.cronograma]
              .sort((a, c) => (a.data || "").localeCompare(c.data || ""))
              .map((c, i) => (
                <tr key={i} className="border-b border-border-soft doc-avoid-break">
                  <td className="px-2 py-1.5 font-semibold">{c.etapa}</td>
                  <td className="px-2 py-1.5">{dataBR(c.data)}</td>
                  <td className="px-2 py-1.5">{c.horario}</td>
                  <td className="px-2 py-1.5">{c.atividades}</td>
                </tr>
              ))
          )}
        </tbody>
      </table>

      <Secao titulo="Credenciamento" />
      <LV label="Link" valor={os.credenciamento.linkFormulario} />
      <LV label="Prazo limite" valor={dataBR(os.credenciamento.prazoLimite)} />

      <Secao titulo="Orçamento" />
      <LV label="Valor do item na EC" valor={brl(os.orcamento.valorEc)} />
      <LV label="Documento fiscal" valor={os.orcamento.documentoFiscal} />
      <LV
        label="Parcelas"
        valor={os.orcamento.parcelas.map((x, i) => `${i + 1}. ${x.descricao}: ${brl(x.valor)}`).join("\n")}
      />

      {restrito && (
        <>
          <Secao titulo="Financeiro Pólobh (uso interno)" />
          <LV label="Tomador" valor={os.financeiro.tomador === "Polobh" ? "Pólobh" : os.financeiro.tomador} />
          <LV label="Descritivo NF" valor={os.financeiro.descritivoNf} />
          <LV label="CNAE / Cód. Serviço" valor={[os.financeiro.cnae, os.financeiro.codigoServico].filter(Boolean).join(" · ")} />
          <LV label="Valor total a pagar" valor={brl(os.financeiro.valorAPagar)} />
          <LV label="BV Pólobh" valor={`${os.financeiro.bvPercentual}% · ${brl(os.financeiro.bvValor)}`} />
        </>
      )}

      <div className="grid grid-cols-2 gap-8 mt-10 text-[11px] doc-avoid-break">
        <div><div className="border-t border-ink pt-1">Pólobh Eventos</div></div>
        <div><div className="border-t border-ink pt-1">{f.razaoSocial || "Fornecedor"} — Data: ____/____/______</div></div>
      </div>
    </div>
  );
}
