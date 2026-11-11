/** OS como documento A4 — visualização em tela + PDF. Espelha o modelo em Excel. */
import { itensParaDocumento, temContrato, CAMPOS_LOGISTICA, CAMPOS_INFRAESTRUTURA, osIncentivada, incentivoDoContrato } from "@/domain/os";
import type { Cliente, Ec, Os } from "@/data/types";
import { brl, dataBR } from "@/lib/format";
import { textoObjetoContrato, FORMA_PAGAMENTO_PADRAO, OBS_CONTRATO_PADRAO } from "@/domain/calc";
import { bvDaContratacao, COLUNAS_CONTRATACAO, resumoContratacao, sincronizarContratacao } from "@/domain/contratacaoOs";
import { calcularAcerto, percentualDoBv } from "@/domain/acertoFinanceiro";
import { datasDoEvento, horariosDoEvento, resumoCronogramaProjeto } from "@/domain/projeto";
import { useEmpresas } from "@/store/empresas";
import { dadosDoTomador, RETENCOES_PADRAO } from "@/domain/tomadorOs";

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
      <div className="bg-[#F2F2F2] font-bold px-3 py-1">{label}</div>
      <div className="px-3 py-1 whitespace-pre-line">{valor ?? ""}</div>
    </div>
  );
}

/**
 * Dados fiscais do tomador/contratante — do domínio, não daqui.
 *
 * Esta função já teve a regra inteira dentro dela, e era uma de três cópias
 * (tela, documento, contrato). Com o tomador ganhando MF e "Outro" em
 * 15/09/2026, a regra foi para `domain/tomadorOs` e aqui ficou só o formato que
 * este documento usa.
 */
function fiscaisDe(quem: string, cliente: Cliente, avulso?: Os["financeiro"]["tomadorAvulso"]) {
  const d = dadosDoTomador(quem, { cliente, empresas: useEmpresas.getState().empresas, avulso });
  if (!d) return null;
  return { rotulo: d.rotulo, razao: d.razaoSocial, end: d.endereco, doc: d.cnpjCpf, ie: d.inscricaoEstadual, im: d.inscricaoMunicipal };
}

export function OsDocumento({ os, ec, restrito = false }: { os: Os; ec: Ec; restrito?: boolean }) {
  // Cliente e dados do evento saem do SNAPSHOT da OS, não da EC: o que o
  // fornecedor recebeu impresso não muda depois (ver `Os.projeto`). Da EC vêm
  // só os itens consolidados, que são dela mesmo.
  const cli = os.cliente;
  const p = os.projeto;
  const incentivada = osIncentivada(os);
  const f = os.fornecedor;
  const b = f.dadosBancarios;
  const consolidadas = ec.linhas.filter((l) => os.ecLinhaIds.includes(l.id));
  /** Só o que se aplica a esta OS — o resto não vira linha para o fornecedor ler. */
  // `itensParaDocumento` traz os itens fixos E os criados nesta OS, na ordem da
  // tela (15/09/2026): o item que alguém acrescentou é dado do fornecedor como
  // qualquer outro, e ficar de fora do papel seria pior do que não existir.
  const logistica = itensParaDocumento(os.logistica, CAMPOS_LOGISTICA);
  // O que a OS DEFINIU item a item (ver `domain/contratacaoOs`).
  // OS gravada antes desta revisão não tem contratação nenhuma: `sincronizar`
  // parte do que a EC levantou, para o documento nunca sair com a tabela vazia.
  const resumo = resumoContratacao(sincronizarContratacao(os.itens ?? [], consolidadas), consolidadas);
  /** Só as colunas com algum valor vão ao fornecedor — ver `resumoContratacao`. */
  const colunas = COLUNAS_CONTRATACAO.filter((c) => resumo.colunas[c.chave]);
  const infraestrutura = itensParaDocumento(os.infraestrutura, CAMPOS_INFRAESTRUTURA);
  const tom = fiscaisDe(os.financeiro.tomador, cli, os.financeiro.tomadorAvulso);
  const acerto = calcularAcerto(os.financeiro, os.orcamento, bvDaContratacao(os.itens ?? []).valor);
  /** "R$ 300,00 (15%)" — o percentual só aparece quando há BV e valor original. */
  const pctBv = percentualDoBv(acerto);
  const bvComPercentual =
    brl(acerto.bvSobreOriginal) +
    (pctBv === null ? "" : ` (${pctBv.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)`);
  const contr = fiscaisDe(os.contrato.contratante, cli);

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
      {incentivada && <LV label="Incentivos Fiscais" valor={p.incentivosFiscais} />}
      {/* Todas as faixas do evento, e não só a primeira: é este papel que vai
          ao fornecedor, e um evento de três dias saía dali como se fosse de um. */}
      <LV label="Data(s)" valor={datasDoEvento(p)} />
      <LV label="Horário(s)" valor={horariosDoEvento(p)} />
      <LV label="Local" valor={p.local} />
      <LV label="Nº Participantes" valor={p.participantes ?? ""} />
      <LV label="Endereço do Local" valor={p.enderecoLocal} />
      <LV label="Produtora Responsável" valor={p.produtoraResponsavel} />
      <LV label="Telefone" valor={p.telefoneProdutora} />
      <LV label="E-mail" valor={p.emailProdutora} />
      <LV label="Cronograma do Projeto" valor={resumoCronogramaProjeto(p)} />

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

      {/* Só item e descrição (21/10/2026): os valores da EC são o preço ao
          cliente, e não vão no documento do fornecedor. */}
      <Secao titulo="Itens Consolidados da EC" />
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-[#595959] text-white">
            <th className="text-left px-2 py-1.5 w-[22%]">Grupo</th>
            <th className="text-left px-2 py-1.5">Item / Descrição</th>
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
            </tr>
          ))}
        </tbody>
      </table>

      <Secao titulo="Detalhamento da Contratação" />
      <LV label="Modalidade" valor={os.modalidade} />
      <LV label="Descritivo" valor={os.descritivo} />
      {/* Item marcado como "não se aplica" nem aparece — ver `itensParaDocumento`.
          Bloco inteiro fora do documento quando nada se aplica. */}
      {logistica.length > 0 && (
        <LV
          label="Logística do Fornecedor"
          valor={logistica.map(({ rotulo, valor }) => `${rotulo}: ${valor || "____"}`).join("\n")}
        />
      )}
      {infraestrutura.length > 0 && (
        <LV
          label="Infraestrutura"
          valor={infraestrutura.map(({ rotulo, valor }) => `${rotulo}: ${valor || "____"}`).join("\n")}
        />
      )}
      {/* GRUPOS criados nesta OS, depois dos dois fixos (15/09/2026). */}
      {(os.gruposExtras ?? [])
        .filter((g) => !g.naoSeAplica && g.itens.some((i) => !i.naoSeAplica))
        .map((g) => (
          <LV
            key={g.id}
            label={g.nome || "Outros"}
            valor={g.itens
              .filter((i) => !i.naoSeAplica)
              .map(({ rotulo, valor }) => `${rotulo}: ${valor || "____"}`)
              .join("\n")}
          />
        ))}
      {/* Só o campo LIVRE. A thread de `os.observacoes` é conversa interna da
          equipe e saía impressa aqui, no documento que o fornecedor recebe.
          Marcado "não se aplica", o bloco não sai — como qualquer outro. */}
      {!os.observacoesGeraisNaoSeAplica && <LV label="Observações Gerais" valor={os.observacoesGerais} />}

      {/* Cronograma marcado como "não se aplica" não vira uma tabela vazia para
          o fornecedor preencher: o bloco inteiro fica fora (15/09/2026). */}
      {!os.cronogramaNaoSeAplica && (
      <>
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
      </>
      )}

      {/* O CREDENCIAMENTO saiu da OS (29/08/2026): virou subaba do Projeto, e o
          link chega ao fornecedor por e-mail. */}

      <Secao titulo="Resumo dos Custos" />
      {/* O item e a forma como cada um é pago. Só entram as colunas que TÊM
          valor: este papel vai ao fornecedor, e uma coluna inteira vazia é ruído
          numa tabela que ele confere linha a linha. */}
      {resumo.linhas.length > 0 && colunas.length > 0 ? (
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-[#F2F2F2] font-bold">
              <th className="text-left px-3 py-1.5 border-b border-border-soft">Item</th>
              {colunas.map((c) => (
                <th key={c.chave} className="text-right px-3 py-1.5 border-b border-border-soft">{c.curto}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resumo.linhas.map((l) => (
              <tr key={l.ecLinhaId}>
                <td className="px-3 py-1 border-b border-border-soft">{l.item}</td>
                {colunas.map((c) => (
                  <td key={c.chave} className="px-3 py-1 border-b border-border-soft text-right">
                    {l[c.chave] === null ? "Não se aplica" : brl(l[c.chave] as number)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td className="px-3 py-1.5">Total por forma de cobrança</td>
              {colunas.map((c) => (
                <td key={c.chave} className="px-3 py-1.5 text-right">{brl(resumo.totais[c.chave])}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      ) : null}
      {/* A emissão fala das duas colunas COM nota; o "sem nota" sai separado,
          para os dois não se lerem como um total só. Cada linha só aparece
          quando há o que dizer nela. */}
      {resumo.totalComNota > 0 && (
        <LV label="Total a Faturar — Com BV e NF + Sem BV e Com NF" valor={brl(resumo.totalComNota)} />
      )}
      {resumo.totalSemNota > 0 && (
        <LV label="Total Sem Nota Fiscal — Sem BV e Sem NF" valor={brl(resumo.totalSemNota)} />
      )}
      <LV label="Documento Fiscal" valor={os.orcamento.documentoFiscal} />
      <LV
        label="Dados para Pagamento"
        valor={[
          b.tipoConta && `Conta ${b.tipoConta}`,
          b.banco,
          [b.agencia && `Ag. ${b.agencia}`, b.conta && `C/C ${b.conta}`].filter(Boolean).join("  ·  "),
          b.chavePix && `Pix: ${b.chavePix}`,
        ].filter(Boolean).join("\n")}
      />
      <LV
        label="Prazo de Pagamento"
        valor={
          os.orcamento.parcelas.length === 0
            ? "____"
            : os.orcamento.parcelas
                .map((x, i) => `${i + 1}ª — ${x.descricao || "Parcela"}${x.data ? ` — pagamento em ${dataBR(x.data)}` : ""}: ${brl(x.valor)}`)
                .join("\n")
        }
      />

      {restrito && (
        <>
          <Secao titulo="Dados Emissão Faturamento" />
          <LV label="Tomador dos Serviços" valor={tom?.rotulo ?? ""} />
          <LV label="Razão Social" valor={tom?.razao ?? ""} />
          <LV label="Endereço" valor={tom?.end ?? ""} />
          <LV label="CNPJ/CPF" valor={tom?.doc ?? ""} />
          <LV label="Inscrição Estadual" valor={tom?.ie ?? ""} />
          <LV label="Inscrição Municipal" valor={tom?.im ?? ""} />
          <LV label="Descritivo Nota Fiscal" valor={os.financeiro.descritivoNf} />
          {/* Só em projeto incentivado (cultural): corporativo não tem lei de incentivo. */}
          {incentivada && (
            <>
              <LV label="Nome do Projeto Incentivado" valor={os.financeiro.projetoIncentivado || p.incentivosFiscais} />
              {/* A lei já traz o número do projeto na mesma linha ("… — PRONAC 26 1234"). */}
              <LV label="Lei de Incentivo à Cultura" valor={os.financeiro.leiIncentivo || p.incentivosFiscais} />
            </>
          )}
          <LV label="CNAE" valor={os.financeiro.cnae} />
          {/* Os VALORES sobem e os dois códigos descem (15/09/2026): é pelos
              valores que se confere a nota. */}
          <LV label="Valor unitário" valor={brl(os.financeiro.valorUnitario)} />
          <LV label="Valor total" valor={brl(os.financeiro.valorTotal)} />
          <LV label="Desconto Especial Negociado" valor={brl(os.financeiro.descontoNegociado)} />
          {/* O bloco de emissão termina no valor a pagar — BV e acerto vão no fim. */}
          <LV label="Valor total a pagar" valor={brl(os.financeiro.valorAPagar)} />
          <LV label="Forma de Pagamento" valor={os.financeiro.formaPagamento ?? ""} />
          <LV label="Código de Serviço" valor={os.financeiro.codigoServico} />
          <LV label="Ordem de Compra" valor={os.financeiro.ordemCompra ?? ""} />

          {/* RETENÇÕES FISCAIS em destaque: é o aviso que evita o retrabalho
              mais caro da OS (ver `RETENCOES_PADRAO`). Em box âmbar, e não como
              mais uma linha cinza — a linha cinza é justamente o que ninguém lê. */}
          <div className="mt-2 border-2 border-[#FFC000] bg-[#FFF8E6] px-3 py-2 text-[11px] doc-avoid-break">
            <div className="font-bold uppercase tracking-wide text-[10.5px] mb-0.5">Retenções Fiscais</div>
            <div className="whitespace-pre-line">
              {os.financeiro.retencoesNaoSeAplica ? "Não se aplica" : os.financeiro.retencoes || RETENCOES_PADRAO}
            </div>
          </div>

          {/* Contrato só sai quando a EC pediu contrato para algum item desta
              OS — ver `temContrato`. */}
          {temContrato(os, consolidadas) && (
          <>
          <SubSecao titulo="Dados para Contrato" />
          <LV label="Contratante" valor={contr?.rotulo ?? ""} />
          <LV label="Razão Social" valor={contr?.razao ?? ""} />
          <LV label="Endereço" valor={contr?.end ?? ""} />
          <LV label="CNPJ/CPF" valor={contr?.doc ?? ""} />
          <LV label="Inscrição Estadual" valor={contr?.ie ?? ""} />
          <LV label="Inscrição Municipal" valor={contr?.im ?? ""} />
          <LV label="Objeto do Contrato" valor={textoObjetoContrato({ ...os.financeiro, ...incentivoDoContrato(os) }, incentivada)} />
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

          {/* ACERTOS FINANCEIROS (15/09/2026): saíram os dois campos de BV —
              ele é combinado item a item, no Detalhamento — e entrou a conta de
              quanto o fornecedor devolve à Pólobh. "Não se aplica" é o padrão. */}
          <Secao titulo="Acertos Financeiros" />
          {os.financeiro.acertoNaoSeAplica ?? true ? (
            <LV label="Acerto Financeiro" valor="Não se aplica" />
          ) : (
            <>
              <LV label="Valor original dos serviços" valor={brl(acerto.valorOriginal)} />
              <LV label="BV sobre o valor original" valor={bvComPercentual} />
              <LV label="Valor da NF" valor={brl(acerto.valorNf)} />
              <LV label="Valor do acréscimo" valor={brl(acerto.acrescimo)} />
              <LV label={`Encargos sobre o acréscimo (${acerto.encargosPercentual}%)`} valor={brl(acerto.encargosSobreAcrescimo)} />
              <LV label="Valor devolução Pólobh" valor={brl(acerto.devolucaoPolobh)} />
            </>
          )}
          <LV label="Observações" valor={os.financeiro.acertoFinanceiro} />
        </>
      )}

      <div className="grid grid-cols-2 gap-8 mt-10 text-[11px] doc-avoid-break">
        <div><div className="border-t border-ink pt-1">Pólobh Promoções</div></div>
        <div><div className="border-t border-ink pt-1">{f.razaoSocial || "Fornecedor"} — Data: ____ ____ ______</div></div>
      </div>
    </div>
  );
}
