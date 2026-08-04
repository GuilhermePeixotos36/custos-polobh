/** OS como documento A4 — visualização em tela + PDF. Espelha o modelo em Excel. */
import type { Ec, Os } from "@/data/types";
import { brl, dataBR } from "@/lib/format";
import { textoObjetoContrato, FORMA_PAGAMENTO_PADRAO, OBS_CONTRATO_PADRAO } from "@/domain/calc";
import { ETAPAS_CRONOGRAMA } from "@/domain/projeto";
import { empresaPadrao } from "@/store/empresas";

/** Faixa de seção — cinza das barras do modelo original Pólobh (COR.sectionGray). */
function Secao({ titulo }: { titulo: string }) {
  return (
    <div className="bg-[#C0C0C0] text-ink font-bold text-[12px] uppercase tracking-wide px-3 py-1.5 mt-4 doc-avoid-break">
      {titulo}
    </div>
  );
}

/** Sub-cabeçalho — cinza claro das barras de grupo da planilha (COR.groupGray). */
function SubSecao({ titulo }: { titulo: string }) {
  return (
    <div className="bg-[#D9D9D9] text-ink font-bold text-[11px] uppercase tracking-wide px-3 py-1.5 mt-3 doc-avoid-break">
      {titulo}
    </div>
  );
}

function LV({ label, valor, full }: { label: string; valor?: string | number | null; full?: boolean }) {
  return (
    <div className={`grid grid-cols-[170px_1fr] border-b border-border-soft text-[12px] ${full ? "col-span-2" : ""}`}>
      <div className="bg-[#F2F2F2] font-bold px-3 py-1.5">{label}</div>
      <div className="px-3 py-1.5 whitespace-pre-line">{valor ?? ""}</div>
    </div>
  );
}

/** Cronograma do projeto (da EC) em texto, uma etapa por linha. */
function cronogramaProjetoTexto(ec: Ec): string {
  const linhas: string[] = [];
  for (const { key, label } of ETAPAS_CRONOGRAMA) {
    if ((ec.projeto.etapasOcultas ?? []).includes(key)) continue;
    const faixas = (ec.projeto.cronograma?.[key] ?? []).filter((x) => x.data || x.inicio || x.fim);
    if (!faixas.length) continue;
    const detalhe = faixas
      .map((x) => [dataBR(x.data), [x.inicio, x.fim].filter(Boolean).join(" às ")].filter(Boolean).join(" · "))
      .join("  |  ");
    linhas.push(`${label}: ${detalhe}`);
  }
  return linhas.join("\n");
}

/** Dados fiscais do tomador/contratante — cliente (da EC) ou empresa do grupo Pólobh. */
function fiscaisDe(quem: "Polobh" | "Cliente" | "", ec: Ec) {
  const emp = empresaPadrao();
  if (quem === "Cliente") {
    const c = ec.cliente;
    return { rotulo: "Cliente", razao: c.razaoSocial, end: c.endereco, doc: c.cnpjCpf, ie: c.inscricaoEstadual, im: c.inscricaoMunicipal };
  }
  if (quem === "Polobh") {
    return {
      rotulo: emp?.nome ? `Pólobh — ${emp.nome}` : "Pólobh",
      razao: emp?.razaoSocial ?? "", end: emp?.endereco ?? "", doc: emp?.cnpj ?? "",
      ie: emp?.inscricaoEstadual ?? "", im: emp?.inscricaoMunicipal ?? "",
    };
  }
  return null;
}

export function OsDocumento({ os, ec, restrito = false }: { os: Os; ec: Ec; restrito?: boolean }) {
  const cli = ec.cliente;
  const p = ec.projeto;
  const f = os.fornecedor;
  const b = f.dadosBancarios;
  const consolidadas = ec.linhas.filter((l) => os.ecLinhaIds.includes(l.id));
  const tom = fiscaisDe(os.financeiro.tomador, ec);
  const contr = fiscaisDe(os.contrato.contratante, ec);

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

      <LV label="Número da OS" valor={os.numero} />
      <LV label="Projeto" valor={p.titulo} />
      <LV label="Data de emissão" valor={dataBR(os.criadoEm)} />
      <LV label="Status da OS" valor={os.status} />

      <Secao titulo="Dados do Cliente" />
      <LV label="Cliente" valor={cli.nome} />
      <LV label="Razão Social" valor={cli.razaoSocial} />
      <LV label="Endereço" valor={cli.endereco} />
      <LV label="CNPJ/CPF" valor={cli.cnpjCpf} />
      <LV label="Inscrição Estadual" valor={cli.inscricaoEstadual} />
      <LV label="Inscrição Municipal" valor={cli.inscricaoMunicipal} />

      <Secao titulo="Dados do Projeto" />
      <LV label="Título" valor={p.titulo} />
      <LV label="Modalidade" valor={p.modalidade} />
      <LV label="Incentivos Fiscais" valor={p.incentivosFiscais} />
      <LV label="Data" valor={dataBR(p.evento)} />
      <LV label="Horário" valor={p.horario} />
      <LV label="Local" valor={p.local} />
      <LV label="Nº Participantes" valor={p.participantes ?? ""} />
      <LV label="Endereço do Local" valor={p.enderecoLocal} />
      <LV label="Produtora Responsável" valor={p.produtoraResponsavel} />
      <LV label="Telefone" valor={p.telefoneProdutora} />
      <LV label="E-mail" valor={p.emailProdutora} />
      <LV label="Cronograma do Projeto" valor={cronogramaProjetoTexto(ec)} />

      <Secao titulo="Dados do Fornecedor" />
      <LV label="Fornecedor" valor={f.nomeFantasia || f.razaoSocial} />
      <LV label="CNPJ/CPF" valor={f.cnpj} />
      <LV label="Perfil (MEI / Simples / etc.)" valor={f.perfilTributario} />
      <LV label="Razão Social" valor={f.razaoSocial} />
      <LV label="Endereço" valor={f.endereco} />
      <LV label="Inscrição Estadual" valor={f.inscricaoEstadual} />
      <LV label="Inscrição Municipal" valor={f.inscricaoMunicipal} />
      <LV label="Conta PJ / PF" valor={b.tipoConta} />
      <LV label="Dados bancários" valor={[b.banco, b.agencia && `Ag. ${b.agencia}`, b.conta && `Conta ${b.conta}`, b.chavePix && `Pix ${b.chavePix}`].filter(Boolean).join("  ·  ")} />
      <LV label="Representante" valor={f.representante} />
      <LV label="Telefone" valor={f.telefone} />
      <LV label="E-mail" valor={f.email} />

      <Secao titulo="Itens Consolidados da EC" />
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-[#595959] text-white">
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
          <tr className="bg-[#D9D9D9] font-bold">
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
      <LV
        label="Logística do Fornecedor"
        valor={[
          ["Transporte Material", os.logistica.transporteMaterial],
          ["Transporte Equipe", os.logistica.transporteEquipe],
          ["Hospedagem Equipe", os.logistica.hospedagem],
          ["Alimentação Equipe", os.logistica.alimentacao],
          ["Estacionamento Carga", os.logistica.estacionamentoCarga],
          ["Estacionamento Equipe", os.logistica.estacionamentoEquipe],
          ["Uniformização Equipe", os.logistica.uniformizacao],
        ].map(([n, v]) => `${n}: ${v || "____"}`).join("\n")}
      />
      <LV
        label="Infraestrutura"
        valor={[
          ["Energia", os.infraestrutura.energia],
          ["Internet", os.infraestrutura.internet],
          ["Pontos Elétricos", os.infraestrutura.pontosEletricos],
          ["Estruturas Diversas", os.infraestrutura.estruturas],
          ["Serviços de Apoio", os.infraestrutura.servicosApoio],
          ["ART, Laudos e Certificações", os.infraestrutura.artLaudos],
        ].map(([n, v]) => `${n}: ${v || "____"}`).join("\n")}
      />
      <LV
        label="Observações Gerais"
        valor={(os.observacoes ?? [])
          .filter((o) => o.texto.trim())
          .map((o) => `${o.texto}${o.autorNome ? " — " + o.autorNome : ""}${o.resolvida ? " (resolvida)" : ""}`)
          .join("\n")}
      />

      <Secao titulo="Cronograma Específico do Fornecedor" />
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-[#595959] text-white">
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
      <LV label="Valor do Item na EC do Projeto" valor={brl(os.orcamento.valorEc)} />
      <LV label="Valor com BV e NF" valor={brl(os.orcamento.valorComBvNf)} />
      <LV label="Valor Sem BV e Com Nota Fiscal" valor={brl(os.orcamento.valorSemBvComNf)} />
      <LV label="Valor Sem BV e Sem NF" valor={brl(os.orcamento.valorSemBvSemNf)} />
      <LV
        label="Prazo de Pagamento"
        valor={
          os.orcamento.parcelas.length === 0
            ? "____"
            : os.orcamento.parcelas.map((x, i) => `${i + 1}ª — ${x.descricao || "Parcela"}: ${brl(x.valor)}`).join("\n")
        }
      />
      <LV label="Documento Fiscal" valor={os.orcamento.documentoFiscal} />

      {restrito && (
        <>
          <Secao titulo="Informações a serem preenchidas pelo Financeiro da Pólobh" />
          <SubSecao titulo="Dados Emissão — Recibo Simples | Fatura | Nota Fiscal | Fatura e Nota Fiscal" />
          <LV label="Tomador dos Serviços" valor={tom?.rotulo ?? ""} />
          <LV label="Razão Social" valor={tom?.razao ?? ""} />
          <LV label="Endereço" valor={tom?.end ?? ""} />
          <LV label="CNPJ/CPF" valor={tom?.doc ?? ""} />
          <LV label="Inscrição Estadual" valor={tom?.ie ?? ""} />
          <LV label="Inscrição Municipal" valor={tom?.im ?? ""} />
          <LV label="Descritivo Nota Fiscal" valor={os.financeiro.descritivoNf} />
          <LV label="Nome do Projeto Incentivado" valor={os.financeiro.projetoIncentivado || p.incentivosFiscais} />
          <LV label="Lei de Incentivo à Cultura" valor={os.financeiro.leiIncentivo} />
          <LV label="Nº do Projeto Incentivado" valor={os.financeiro.numeroProjetoIncentivado} />
          <LV label="CNAE" valor={os.financeiro.cnae} />
          <LV label="Código de Serviço" valor={os.financeiro.codigoServico} />
          <LV label="Valor unitário" valor={brl(os.financeiro.valorUnitario)} />
          <LV label="Valor total" valor={brl(os.financeiro.valorTotal)} />
          <LV label="Desconto Especial Negociado" valor={brl(os.financeiro.descontoNegociado)} />
          <LV label="Valor total a pagar" valor={brl(os.financeiro.valorAPagar)} />
          <LV label="BV Pólobh — Percentual" valor={`${os.financeiro.bvPercentual || 0}%`} />
          <LV label="BV Pólobh — Valor" valor={brl(os.financeiro.bvValor)} />
          <LV label="Acerto Financeiro" valor={os.financeiro.acertoFinanceiro} />

          <SubSecao titulo="Dados para Contrato" />
          <LV label="Contratante" valor={contr?.rotulo ?? ""} />
          <LV label="Razão Social" valor={contr?.razao ?? ""} />
          <LV label="Endereço" valor={contr?.end ?? ""} />
          <LV label="CNPJ/CPF" valor={contr?.doc ?? ""} />
          <LV label="Inscrição Estadual" valor={contr?.ie ?? ""} />
          <LV label="Inscrição Municipal" valor={contr?.im ?? ""} />
          <LV label="Objeto do Contrato" valor={textoObjetoContrato(os.financeiro)} />
          <LV
            label="Descritivo dos Serviços e/ou Produtos"
            valor={os.contrato.descritivoServicos || os.financeiro.descritivoNf || os.descritivo}
          />
          <LV label="Informações Complementares" valor={os.contrato.informacoesComplementares} />
          <LV label="Valor unitário" valor={brl(os.contrato.valorUnitario)} />
          <LV label="Valor total" valor={brl(os.contrato.valorTotal)} />
          <LV label="Desconto Especial Negociado" valor={brl(os.contrato.descontoNegociado)} />
          <LV label="Valor total a pagar" valor={brl(os.contrato.valorAPagar)} />
          <LV label="Forma de Pagamento" valor={os.contrato.formaPagamento || FORMA_PAGAMENTO_PADRAO} />
          <LV label="Observações Gerais" valor={os.contrato.observacoesGerais || OBS_CONTRATO_PADRAO} />
          <LV label="Data do Contrato" valor={dataBR(os.contrato.dataContrato)} />
          <LV label="Rubrica" valor={os.contrato.rubrica} />
        </>
      )}

      <div className="grid grid-cols-2 gap-8 mt-10 text-[11px] doc-avoid-break">
        <div><div className="border-t border-ink pt-1">Pólobh Eventos</div></div>
        <div><div className="border-t border-ink pt-1">{f.razaoSocial || "Fornecedor"} — Data: ____/____/______</div></div>
      </div>
    </div>
  );
}
