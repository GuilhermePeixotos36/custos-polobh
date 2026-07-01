import { useMemo, useState } from "react";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import { Card, Badge, Input, Select, Button, Table, THead, Th, Tr, Td, EmptyState, type Tom } from "@/components/ui";
import { IcDownload, IcSearch } from "@/components/icons";
import { supabase } from "@/lib/supabaseClient";
import { useAsync } from "@/hooks/useAsync";
import { toast } from "@/store/toast";
import { ROTULO_PAPEL } from "@/store/auth";
import { dataHoraBR } from "@/lib/format";
import type { LogCategoria, LogEntry, LogNivel } from "@/data/types";

const NIVEL_TOM: Record<LogNivel, Tom> = { info: "info", aviso: "warning", erro: "danger" };
const NIVEL_LABEL: Record<LogNivel, string> = { info: "Info", aviso: "Aviso", erro: "Erro" };

const CATEGORIAS: LogCategoria[] = [
  "Autenticação", "Acesso", "Projeto", "EC", "OS", "Fornecedor", "Cliente", "Configuração", "Exportação", "Sistema",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLog(r: any): LogEntry {
  return {
    id: r.id,
    ts: r.ts,
    nivel: r.nivel,
    categoria: r.categoria,
    acao: r.acao,
    mensagem: r.mensagem,
    usuario: r.usuario ?? undefined,
    papel: r.papel ?? undefined,
    alvoId: r.alvo_id ?? undefined,
  };
}

export function Logs() {
  const { data, loading, error } = useAsync(async () => {
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .order("ts", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapLog);
  }, []);

  const itens = useMemo(() => data ?? [], [data]);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<LogCategoria | "">("");
  const [nivel, setNivel] = useState<LogNivel | "">("");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((l) => {
      if (categoria && l.categoria !== categoria) return false;
      if (nivel && l.nivel !== nivel) return false;
      if (q) {
        const alvo = `${l.mensagem} ${l.acao} ${l.usuario ?? ""} ${l.alvoId ?? ""}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
  }, [itens, busca, categoria, nivel]);

  function exportarCsv() {
    const cab = ["Data/Hora", "Nível", "Categoria", "Ação", "Mensagem", "Usuário", "Perfil", "Alvo"];
    const linhas = filtrados.map((l) => [
      dataHoraBR(l.ts), NIVEL_LABEL[l.nivel], l.categoria, l.acao, l.mensagem,
      l.usuario ?? "", l.papel ? ROTULO_PAPEL[l.papel] : "", l.alvoId ?? "",
    ]);
    const esc = (c: string) => `"${String(c).replace(/"/g, '""')}"`;
    const csv = [cab, ...linhas].map((r) => r.map(esc).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-polobh-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Logs exportados (CSV).", "success");
  }

  return (
    <PageShell
      breadcrumb={<Crumb>Logs do sistema</Crumb>}
      title="Logs do sistema"
      subtitle="Trilha de auditoria de acessos, alterações e eventos do aplicativo."
    >
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none">
                <IcSearch width={16} height={16} />
              </span>
              <Input className="pl-9" placeholder="Buscar por mensagem, ação, usuário…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Select className="w-[170px]" value={categoria} onChange={(e) => setCategoria(e.target.value as LogCategoria | "")}>
              <option value="">Todas as categorias</option>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select className="w-[140px]" value={nivel} onChange={(e) => setNivel(e.target.value as LogNivel | "")}>
              <option value="">Todos os níveis</option>
              {(Object.keys(NIVEL_LABEL) as LogNivel[]).map((n) => <option key={n} value={n}>{NIVEL_LABEL[n]}</option>)}
            </Select>
            <div className="flex gap-2 ml-auto">
              <Button variant="text" size="sm" icon={<IcDownload width={16} height={16} />} onClick={exportarCsv} disabled={!filtrados.length}>
                Exportar CSV
              </Button>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-ink-3">
            {filtrados.length} de {itens.length} eventos · ordenados do mais recente para o mais antigo.
          </p>
        </Card>

        <Card padded={false}>
          {loading ? (
            <div className="p-8 text-center text-ink-3">Carregando…</div>
          ) : error ? (
            <div className="p-8"><EmptyState title="Não foi possível carregar" hint="Verifique sua conexão e permissões (apenas o Administrador lê os logs)." /></div>
          ) : filtrados.length === 0 ? (
            <div className="p-8"><EmptyState title="Nenhum evento" hint="Nenhum log corresponde aos filtros aplicados." /></div>
          ) : (
            <Table>
              <THead>
                <Th className="whitespace-nowrap">Data / Hora</Th>
                <Th>Nível</Th>
                <Th>Categoria</Th>
                <Th>Evento</Th>
                <Th>Usuário</Th>
              </THead>
              <tbody>
                {filtrados.map((l) => (
                  <Tr key={l.id}>
                    <Td className="whitespace-nowrap text-ink-2 text-[12.5px]">{dataHoraBR(l.ts)}</Td>
                    <Td><Badge tom={NIVEL_TOM[l.nivel]}>{NIVEL_LABEL[l.nivel]}</Badge></Td>
                    <Td className="text-ink-2">{l.categoria}</Td>
                    <Td>
                      <div className="font-semibold text-ink">{l.mensagem}</div>
                      <div className="text-[11.5px] text-ink-3">{l.acao}{l.alvoId ? ` · ${l.alvoId}` : ""}</div>
                    </Td>
                    <Td className="text-ink-2 text-[12.5px]">
                      {l.usuario ?? "—"}
                      {l.papel && <span className="text-ink-3"> · {ROTULO_PAPEL[l.papel]}</span>}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
