/**
 * CONSUMO DE IA (05/11/2026) — Configurações > Consumo de IA.
 *
 * Mostra, por mês, quanto as revisões de texto e as leituras de orçamento
 * gastaram em tokens e em dólar (custo ESTIMADO pela tabela de preços do
 * modelo; a conta oficial é a do painel da OpenAI). Exporta para Excel.
 * Os dados vêm da tabela `ia_uso`, que só a Direção, o Administrativo e o
 * Admin podem ler.
 */
import { useMemo, useState } from "react";
import { Card, CardTitle, Input, Button, Table, THead, Th, Tr, Td, EmptyState, Badge } from "@/components/ui";
import { IcDownload } from "@/components/icons";
import { supabase } from "@/lib/supabaseClient";
import { useAsync } from "@/hooks/useAsync";
import { dataHoraBR } from "@/lib/format";
import { toast } from "@/store/toast";
import {
  ROTULO_FUNCAO_IA, formatarTokens, formatarUsd, resumirConsumo,
  type FuncaoIa, type RegistroIa, type Totais,
} from "@/domain/consumoIa";

const mesAtual = () => new Date().toISOString().slice(0, 7);

function intervaloDoMes(mes: string): { de: string; ate: string } {
  const [a, m] = mes.split("-").map(Number);
  return { de: new Date(a, m - 1, 1).toISOString(), ate: new Date(a, m, 1).toISOString() };
}

async function carregar(mes: string): Promise<RegistroIa[]> {
  const { de, ate } = intervaloDoMes(mes);
  const { data, error } = await supabase
    .from("ia_uso")
    .select("*")
    .gte("criado_em", de)
    .lt("criado_em", ate)
    .order("criado_em", { ascending: false })
    .limit(5000);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    criadoEm: r.criado_em,
    usuario: r.usuario ?? "",
    funcao: r.funcao as FuncaoIa,
    modelo: r.modelo ?? "",
    tokensEntrada: Number(r.tokens_entrada) || 0,
    tokensSaida: Number(r.tokens_saida) || 0,
    custoUsd: Number(r.custo_usd) || 0,
    sucesso: !!r.sucesso,
    erro: r.erro ?? "",
    itens: Number(r.itens) || 0,
    duracaoMs: Number(r.duracao_ms) || 0,
  }));
}

async function exportarExcel(mes: string, registros: RegistroIa[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const { total, porFuncao, porPessoa } = resumirConsumo(registros);
  const cabecalho = (ws: import("exceljs").Worksheet) => {
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => { c.width = Math.max(14, String(c.header ?? "").length + 4); });
  };
  const linhaTotais = (t: Totais) => [t.chamadas, t.falhas, t.tokensEntrada, t.tokensSaida, t.tokensEntrada + t.tokensSaida, Number(t.custoUsd.toFixed(6))];
  const colsTotais = ["Chamadas", "Falhas", "Tokens de entrada", "Tokens de saída", "Tokens no total", "Custo estimado (US$)"];

  const resumo = wb.addWorksheet("Resumo");
  resumo.columns = [{ header: "Tipo de uso" }, ...colsTotais.map((h) => ({ header: h }))];
  porFuncao.forEach((f) => resumo.addRow([ROTULO_FUNCAO_IA[f.funcao] ?? f.funcao, ...linhaTotais(f.totais)]));
  resumo.addRow(["Total", ...linhaTotais(total)]).font = { bold: true };
  cabecalho(resumo);

  const pessoas = wb.addWorksheet("Por pessoa");
  pessoas.columns = [{ header: "Pessoa" }, ...colsTotais.map((h) => ({ header: h }))];
  porPessoa.forEach((p) => pessoas.addRow([p.usuario, ...linhaTotais(p.totais)]));
  cabecalho(pessoas);

  const chamadas = wb.addWorksheet("Chamadas");
  chamadas.columns = ["Data e hora", "Pessoa", "Tipo de uso", "Modelo", "Itens", "Tokens de entrada", "Tokens de saída", "Custo estimado (US$)", "Duração (s)", "Resultado"].map((h) => ({ header: h }));
  registros.forEach((r) => chamadas.addRow([
    dataHoraBR(r.criadoEm), r.usuario, ROTULO_FUNCAO_IA[r.funcao] ?? r.funcao, r.modelo, r.itens,
    r.tokensEntrada, r.tokensSaida, Number(r.custoUsd.toFixed(6)), Math.round(r.duracaoMs / 100) / 10,
    r.sucesso ? "OK" : `Falhou: ${r.erro}`,
  ]));
  cabecalho(chamadas);

  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `consumo-ia-polobh-${mes}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Relatório de consumo de IA exportado.", "success");
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-card border border-border bg-white px-4 py-3">
      <div className="text-[11.5px] font-bold text-ink-3 uppercase tracking-wide">{rotulo}</div>
      <div className="font-display font-bold text-[22px] text-ink mt-0.5">{valor}</div>
      {detalhe && <div className="text-[11.5px] text-ink-3">{detalhe}</div>}
    </div>
  );
}

export function ConsumoIaCard() {
  const [mes, setMes] = useState(mesAtual());
  const { data, loading } = useAsync(() => carregar(mes), [mes], { oQue: "o consumo de IA" });
  const registros = useMemo(() => data ?? [], [data]);
  const { total, porFuncao, porPessoa } = useMemo(() => resumirConsumo(registros), [registros]);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle hint="Tokens e custo estimado de cada revisão de texto e leitura de orçamento feita com IA. A conta oficial é a do painel da OpenAI.">
          Consumo de IA
        </CardTitle>
        <div className="flex flex-wrap items-end gap-3 mt-1">
          <label className="text-[12.5px] font-bold text-ink-2">
            Mês
            <Input type="month" className="mt-1 w-[170px]" value={mes} onChange={(e) => setMes(e.target.value || mesAtual())} />
          </label>
          <Button variant="secondary" size="sm" onClick={() => void exportarExcel(mes, registros)} disabled={!registros.length}>
            <IcDownload width={15} height={15} /> Exportar Excel
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <Numero rotulo="Custo estimado" valor={formatarUsd(total.custoUsd)} detalhe="no mês escolhido" />
          <Numero rotulo="Chamadas" valor={String(total.chamadas)} detalhe={total.falhas ? `${total.falhas} com falha` : "nenhuma falha"} />
          <Numero rotulo="Tokens" valor={formatarTokens(total.tokensEntrada + total.tokensSaida)} detalhe={`${formatarTokens(total.tokensEntrada)} de entrada · ${formatarTokens(total.tokensSaida)} de saída`} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padded={false}>
          <div className="px-5 pt-4"><CardTitle>Por tipo de uso</CardTitle></div>
          {porFuncao.length ? (
            <Table>
              <THead><Tr><Th>Tipo</Th><Th align="right">Chamadas</Th><Th align="right">Tokens</Th><Th align="right">Custo</Th></Tr></THead>
              <tbody>
                {porFuncao.map((f) => (
                  <Tr key={f.funcao}>
                    <Td>{ROTULO_FUNCAO_IA[f.funcao] ?? f.funcao}</Td>
                    <Td align="right">{f.totais.chamadas}</Td>
                    <Td align="right">{formatarTokens(f.totais.tokensEntrada + f.totais.tokensSaida)}</Td>
                    <Td align="right">{formatarUsd(f.totais.custoUsd)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : <EmptyState title={loading ? "Carregando…" : "Nenhum uso de IA neste mês."} />}
        </Card>
        <Card padded={false}>
          <div className="px-5 pt-4"><CardTitle>Por pessoa</CardTitle></div>
          {porPessoa.length ? (
            <Table>
              <THead><Tr><Th>Pessoa</Th><Th align="right">Chamadas</Th><Th align="right">Tokens</Th><Th align="right">Custo</Th></Tr></THead>
              <tbody>
                {porPessoa.map((p) => (
                  <Tr key={p.usuario}>
                    <Td>{p.usuario}</Td>
                    <Td align="right">{p.totais.chamadas}</Td>
                    <Td align="right">{formatarTokens(p.totais.tokensEntrada + p.totais.tokensSaida)}</Td>
                    <Td align="right">{formatarUsd(p.totais.custoUsd)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : <EmptyState title={loading ? "Carregando…" : "Nenhum uso de IA neste mês."} />}
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-5 pt-4"><CardTitle hint="As 100 mais recentes do mês; a lista completa vai no Excel">Chamadas</CardTitle></div>
        {registros.length ? (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <Tr><Th>Data e hora</Th><Th>Pessoa</Th><Th>Tipo</Th><Th>Modelo</Th><Th align="right">Tokens</Th><Th align="right">Custo</Th><Th>Resultado</Th></Tr>
              </THead>
              <tbody>
                {registros.slice(0, 100).map((r) => (
                  <Tr key={r.id}>
                    <Td className="whitespace-nowrap text-ink-2">{dataHoraBR(r.criadoEm)}</Td>
                    <Td>{r.usuario}</Td>
                    <Td>{ROTULO_FUNCAO_IA[r.funcao] ?? r.funcao}{r.itens ? <span className="text-ink-3"> · {r.itens}</span> : null}</Td>
                    <Td className="text-ink-2 text-[12px]">{r.modelo || "—"}</Td>
                    <Td align="right">{formatarTokens(r.tokensEntrada + r.tokensSaida)}</Td>
                    <Td align="right">{formatarUsd(r.custoUsd)}</Td>
                    <Td>{r.sucesso ? <Badge tom="success">OK</Badge> : <span title={r.erro}><Badge tom="danger">Falhou</Badge></span>}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : <EmptyState title={loading ? "Carregando…" : "Nenhum uso de IA neste mês."} />}
      </Card>
    </div>
  );
}
