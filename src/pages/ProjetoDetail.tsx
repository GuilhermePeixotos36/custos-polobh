import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import {
  Card, CardTitle, Button, Field, Input, Textarea, Select, Badge,
  Table, THead, Th, Tr, Td, EmptyState, tomStatusEc, tomStatusOs, type Tom,
} from "@/components/ui";
import { IcChevron, IcPlus, IcBack } from "@/components/icons";
import { TimelineConsolidada, type ItemConsolidado } from "@/components/Timeline";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { cx, maskCpfCnpjInput, maskTelefone } from "@/lib/format";
import { toast } from "@/store/toast";
import type { Cliente, Projeto, ProjetoInfo, StatusProjeto } from "@/data/types";

const tomStatusProjeto: Record<StatusProjeto, Tom> = {
  Ativo: "success", Arquivado: "neutral", Concluido: "info", Cancelado: "danger",
};

const clienteVazio = (): Cliente => ({
  id: "", nome: "", razaoSocial: "", endereco: "", cnpjCpf: "",
  inscricaoEstadual: "", inscricaoMunicipal: "",
  representante: { nome: "", cargo: "", telefones: "", email: "" },
});
const infoVazio = (): ProjetoInfo => ({
  titulo: "", local: "", enderecoLocal: "", participantes: null,
  produtoraResponsavel: "", telefoneProdutora: "", emailProdutora: "",
  preEvento: "", evento: "", posEvento: "", horario: "", roteiro: "", incentivosFiscais: "",
});
const projetoVazio = (): Projeto => ({
  id: "", nome: "", cliente: clienteVazio(), info: infoVazio(),
  docsUrl: "", status: "Ativo", criadoEm: "", atualizadoEm: "",
});

type Aba = "dados" | "ec" | "os" | "cronograma" | "fornecedores";
const ABAS: { key: Aba; label: string }[] = [
  { key: "dados", label: "Dados Gerais" },
  { key: "ec", label: "EC" },
  { key: "os", label: "OS" },
  { key: "cronograma", label: "Cronograma" },
  { key: "fornecedores", label: "Fornecedores" },
];

export function ProjetoDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const novo = id === "novo";

  const { data: existente, loading } = useAsync(() => (novo ? Promise.resolve(undefined) : repo.projetos.obter(id)), [id]);
  const { data: ecsAll } = useAsync(() => repo.ecs.listar(), []);
  const { data: ossAll } = useAsync(() => repo.oss.listar(), []);

  const [p, setP] = useState<Projeto>(projetoVazio());
  const [aba, setAba] = useState<Aba>("dados");
  const [salvando, setSalvando] = useState(false);
  const [tplNova, setTplNova] = useState<"Corporativo" | "Cultural" | "">("Corporativo");

  useEffect(() => {
    if (novo) setP(projetoVazio());
    else if (existente) setP(structuredClone(existente));
  }, [existente, novo]);

  const ecsDoProjeto = useMemo(() => (ecsAll ?? []).filter((e) => e.projetoId === id), [ecsAll, id]);
  const ecIds = useMemo(() => new Set(ecsDoProjeto.map((e) => e.id)), [ecsDoProjeto]);
  const ossDoProjeto = useMemo(() => (ossAll ?? []).filter((o) => ecIds.has(o.ecId)), [ossAll, ecIds]);

  const etapas = useMemo<ItemConsolidado[]>(
    () => ossDoProjeto.flatMap((o) => o.cronograma.map((c) => ({ ...c, fornecedor: o.fornecedor.razaoSocial || "Fornecedor" }))),
    [ossDoProjeto]
  );
  const fornecedores = useMemo(() => {
    const m = new Map<string, { razao: string; cnpj: string; email: string }>();
    for (const o of ossDoProjeto) {
      const f = o.fornecedor;
      const chave = f.cnpj || f.razaoSocial;
      if (chave && !m.has(chave)) m.set(chave, { razao: f.razaoSocial, cnpj: f.cnpj, email: f.email });
    }
    return [...m.values()];
  }, [ossDoProjeto]);

  const upd = (patch: Partial<Projeto>) => setP((x) => ({ ...x, ...patch }));
  const updCli = (patch: Partial<Cliente>) => setP((x) => ({ ...x, cliente: { ...x.cliente, ...patch } }));
  const updInfo = (patch: Partial<ProjetoInfo>) => setP((x) => ({ ...x, info: { ...x.info, ...patch }, nome: patch.titulo ?? x.nome }));

  async function salvar() {
    setSalvando(true);
    try {
      const salvo = await repo.projetos.salvar({ ...p, nome: p.info.titulo || p.nome || "Projeto" });
      toast("Projeto salvo.", "success");
      navigate(`/projetos/${salvo.id}`);
    } catch (e) {
      toast(`Erro ao salvar: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <PageShell breadcrumb={<Crumb>Projeto</Crumb>} title="Carregando…">{null}</PageShell>;
  if (!novo && !existente) return <PageShell breadcrumb={<Crumb>Projeto</Crumb>} title="Projeto não encontrado">{null}</PageShell>;

  return (
    <PageShell
      breadcrumb={
        <>
          <button onClick={() => navigate("/projetos")} className="hover:text-ink">Projetos</button>
          <IcChevron width={14} height={14} />
          <Crumb>{novo ? "Novo projeto" : p.nome || "Projeto"}</Crumb>
        </>
      }
      title={novo ? "Novo projeto" : p.nome || "Projeto"}
      topAction={
        (aba === "dados" || novo) && (
          <Button size="sm" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar projeto"}</Button>
        )
      }
    >
      <button onClick={() => navigate("/projetos")} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink mb-4 font-semibold">
        <IcBack width={16} height={16} /> Voltar
      </button>

      {!novo && (
        <div className="flex items-center gap-2 mb-4">
          <Badge tom={tomStatusProjeto[p.status]}>{p.status}</Badge>
        </div>
      )}

      {/* Subguias */}
      <div className="flex gap-1 border-b border-border mb-5 overflow-x-auto">
        {ABAS.map((a) => {
          const bloqueada = novo && a.key !== "dados";
          return (
            <button
              key={a.key}
              disabled={bloqueada}
              onClick={() => setAba(a.key)}
              className={cx(
                "px-4 h-10 text-[13.5px] font-bold whitespace-nowrap border-b-2 -mb-px transition-colors",
                bloqueada ? "text-ink-3/40 cursor-not-allowed border-transparent"
                  : aba === a.key ? "text-primary-dark border-primary" : "text-ink-2 hover:text-ink border-transparent"
              )}
            >
              {a.label}
            </button>
          );
        })}
      </div>

      {aba === "dados" && (
        <div className="space-y-4 max-w-4xl">
          <Card>
            <CardTitle>Cliente</CardTitle>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="CNPJ/CPF"><Input value={p.cliente.cnpjCpf} inputMode="numeric" onChange={(e) => updCli({ cnpjCpf: maskCpfCnpjInput(e.target.value) })} placeholder="00.000.000/0000-00" /></Field>
              <Field label="Cliente (nome)"><Input value={p.cliente.nome} onChange={(e) => updCli({ nome: e.target.value })} /></Field>
              <Field label="Razão Social" className="md:col-span-2"><Input value={p.cliente.razaoSocial} onChange={(e) => updCli({ razaoSocial: e.target.value })} /></Field>
              <Field label="Endereço" className="md:col-span-2"><Input value={p.cliente.endereco} onChange={(e) => updCli({ endereco: e.target.value })} /></Field>
              <Field label="Representante"><Input value={p.cliente.representante.nome} onChange={(e) => updCli({ representante: { ...p.cliente.representante, nome: e.target.value } })} /></Field>
              <Field label="E-mail do representante"><Input value={p.cliente.representante.email} onChange={(e) => updCli({ representante: { ...p.cliente.representante, email: e.target.value } })} /></Field>
            </div>
          </Card>

          <Card>
            <CardTitle>Informações do projeto</CardTitle>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Título do projeto" className="md:col-span-2"><Input value={p.info.titulo} onChange={(e) => updInfo({ titulo: e.target.value })} /></Field>
              <Field label="Local"><Input value={p.info.local} onChange={(e) => updInfo({ local: e.target.value })} /></Field>
              <Field label="Endereço do local"><Input value={p.info.enderecoLocal} onChange={(e) => updInfo({ enderecoLocal: e.target.value })} /></Field>
              <Field label="Nº de participantes"><Input type="number" value={p.info.participantes ?? ""} onChange={(e) => updInfo({ participantes: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Produtora responsável"><Input value={p.info.produtoraResponsavel} onChange={(e) => updInfo({ produtoraResponsavel: e.target.value })} /></Field>
              <Field label="Telefone produtora"><Input value={p.info.telefoneProdutora} inputMode="tel" onChange={(e) => updInfo({ telefoneProdutora: maskTelefone(e.target.value) })} /></Field>
              <Field label="E-mail produtora"><Input value={p.info.emailProdutora} onChange={(e) => updInfo({ emailProdutora: e.target.value })} /></Field>
              <Field label="Pré-evento"><Input type="date" value={p.info.preEvento} onChange={(e) => updInfo({ preEvento: e.target.value })} /></Field>
              <Field label="Evento"><Input type="date" value={p.info.evento} onChange={(e) => updInfo({ evento: e.target.value })} /></Field>
              <Field label="Pós-evento"><Input type="date" value={p.info.posEvento} onChange={(e) => updInfo({ posEvento: e.target.value })} /></Field>
              <Field label="Horário"><Input value={p.info.horario} onChange={(e) => updInfo({ horario: e.target.value })} placeholder="08h às 18h" /></Field>
              <Field label="Roteiro" className="md:col-span-2"><Textarea value={p.info.roteiro} onChange={(e) => updInfo({ roteiro: e.target.value })} /></Field>
            </div>
          </Card>

          <Card>
            <CardTitle>Documentos & status</CardTitle>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Link de documentos do projeto" className="md:col-span-2"><Input value={p.docsUrl} onChange={(e) => upd({ docsUrl: e.target.value })} placeholder="https://drive.google.com/…" /></Field>
              <Field label="Status">
                <Select value={p.status} onChange={(e) => upd({ status: e.target.value as StatusProjeto })}>
                  <option value="Ativo">Ativo</option>
                  <option value="Concluido">Concluído</option>
                  <option value="Arquivado">Arquivado</option>
                  <option value="Cancelado">Cancelado</option>
                </Select>
              </Field>
            </div>
          </Card>
        </div>
      )}

      {aba === "ec" && (
        <Card padded={false}>
          <div className="p-5 flex items-center justify-between gap-3 flex-wrap">
            <CardTitle hint="Estimativas de custo deste projeto (incluindo versões)">Estimativas (EC)</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] text-ink-3 font-semibold">Modelo</span>
              <Select className="!h-9 !w-40 !text-[13px]" value={tplNova} onChange={(e) => setTplNova(e.target.value as typeof tplNova)}>
                <option value="Corporativo">Corporativo</option>
                <option value="Cultural">Cultural</option>
                <option value="">Em branco</option>
              </Select>
              <Button size="sm" icon={<IcPlus width={16} height={16} />} onClick={() => navigate(`/estimativas/nova?projeto=${id}${tplNova ? `&template=${tplNova}` : ""}`)}>Nova EC</Button>
            </div>
          </div>
          {ecsDoProjeto.length === 0 ? (
            <div className="p-6"><EmptyState title="Nenhuma EC" hint="Crie a primeira EC deste projeto." /></div>
          ) : (
            <Table>
              <THead><Th>Número / Evento</Th><Th align="center">Versão</Th><Th align="center">Status</Th></THead>
              <tbody>
                {ecsDoProjeto.map((e) => (
                  <Tr key={e.id} onClick={() => navigate(`/estimativas/${e.id}`)}>
                    <Td><div className="font-bold text-ink">{e.projeto.titulo || e.numero}</div><div className="text-[12px] text-ink-3">{e.numero}</div></Td>
                    <Td align="center"><Badge tom="neutral">V{String(e.versao).padStart(2, "0")}</Badge></Td>
                    <Td align="center"><Badge tom={tomStatusEc[e.status]}>{e.status}</Badge></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {aba === "os" && (
        <Card padded={false}>
          <div className="p-5"><CardTitle hint="Ordens de serviço geradas a partir das ECs deste projeto">Ordens de Serviço</CardTitle></div>
          {ossDoProjeto.length === 0 ? (
            <div className="p-6"><EmptyState title="Nenhuma OS" hint="Gere OSs a partir das ECs do projeto." /></div>
          ) : (
            <Table>
              <THead><Th>OS</Th><Th>Fornecedor</Th><Th align="center">Status</Th></THead>
              <tbody>
                {ossDoProjeto.map((o) => (
                  <Tr key={o.id} onClick={() => navigate(`/ordens/${o.id}`)}>
                    <Td className="font-bold">{o.numero}</Td>
                    <Td>{o.fornecedor.razaoSocial || "—"}</Td>
                    <Td align="center"><Badge tom={tomStatusOs[o.status]}>{o.status}</Badge></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {aba === "cronograma" && (
        <Card>
          <CardTitle hint="Linha do tempo consolidada de todos os fornecedores do projeto">Cronograma consolidado</CardTitle>
          <TimelineConsolidada itens={etapas} />
        </Card>
      )}

      {aba === "fornecedores" && (
        <Card padded={false}>
          <div className="p-5"><CardTitle hint="Fornecedores presentes nas OSs deste projeto">Fornecedores do projeto</CardTitle></div>
          {fornecedores.length === 0 ? (
            <div className="p-6"><EmptyState title="Nenhum fornecedor" hint="Aparecem aqui os fornecedores das OSs do projeto." /></div>
          ) : (
            <Table>
              <THead><Th>Fornecedor</Th><Th>CNPJ</Th><Th>Contato</Th></THead>
              <tbody>
                {fornecedores.map((f, i) => (
                  <Tr key={i}>
                    <Td className="font-bold text-ink">{f.razao || "—"}</Td>
                    <Td className="text-[12.5px]">{f.cnpj || "—"}</Td>
                    <Td className="text-[12.5px]">{f.email || "—"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </PageShell>
  );
}
