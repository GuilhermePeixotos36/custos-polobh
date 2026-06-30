import { useMemo, useState } from "react";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import {
  Card, CardTitle, Button, Field, Input, Select, Table, THead, Th, Tr, Td,
  Badge, EmptyState, Avatar,
} from "@/components/ui";
import { IcPlus, IcSearch } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { consultarCnpj } from "@/lib/cnpj";
import { flags } from "@/lib/flags";
import { maskCpfCnpjInput, maskTelefone } from "@/lib/format";
import { toast } from "@/store/toast";
import type { Fornecedor } from "@/data/types";

const vazio = (): Fornecedor => ({
  id: "", razaoSocial: "", nomeFantasia: "", cnpj: "", perfilTributario: "", endereco: "",
  inscricaoEstadual: "", inscricaoMunicipal: "",
  dadosBancarios: { tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "" },
  representante: "", telefone: "", email: "",
});

export function Fornecedores() {
  const { data, loading, reload } = useAsync(() => repo.fornecedores.listar(), []);
  const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState<Fornecedor | null>(null);
  const [msg, setMsg] = useState("");

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data ?? []).filter((f) => !q ? true : [f.razaoSocial, f.cnpj, f.perfilTributario].join(" ").toLowerCase().includes(q));
  }, [data, busca]);

  async function consultar() {
    if (!edit) return;
    setMsg("");
    try {
      const d = await consultarCnpj(edit.cnpj);
      setEdit({ ...edit, razaoSocial: d.razaoSocial, nomeFantasia: d.nomeFantasia, endereco: d.endereco, perfilTributario: d.perfilTributario, email: d.email, telefone: d.telefone, cnaes: d.cnaes });
      setMsg("Dados preenchidos pela BrasilAPI.");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function salvar() {
    if (!edit) return;
    await repo.fornecedores.salvar(edit);
    toast("Fornecedor salvo.", "success");
    setEdit(null);
    reload();
  }

  return (
    <PageShell
      breadcrumb={<Crumb>Fornecedores</Crumb>}
      title="Fornecedores"
      subtitle="Cadastro com CNPJ, perfil tributário e contato."
      topAction={<Button size="sm" icon={<IcPlus width={16} height={16} />} onClick={() => { setEdit(vazio()); setMsg(""); }}>Novo fornecedor</Button>}
    >
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4 items-start">
        <Card padded={false}>
          <div className="p-4 border-b border-border-soft">
            <div className="relative max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"><IcSearch width={16} height={16} /></span>
              <Input className="!h-10 pl-9" placeholder="Buscar fornecedor…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          {loading ? <div className="p-8 text-ink-3 text-sm">Carregando…</div> : lista.length === 0 ? (
            <EmptyState title="Nenhum fornecedor" />
          ) : (
            <Table>
              <THead><Th>Fornecedor</Th><Th>CNPJ</Th><Th>Perfil</Th><Th>Contato</Th></THead>
              <tbody>
                {lista.map((f) => (
                  <Tr key={f.id} onClick={() => { setEdit(structuredClone(f)); setMsg(""); }}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar nome={f.razaoSocial} size={34} />
                        <div>
                          <div className="font-bold text-ink">{f.nomeFantasia || f.razaoSocial}</div>
                          <div className="text-[12px] text-ink-2">{f.razaoSocial}</div>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-[12.5px]">{f.cnpj}</Td>
                    <Td><Badge tom="info">{f.perfilTributario || "—"}</Badge></Td>
                    <Td className="text-[12.5px]">{f.email}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {edit && (
          <Card>
            <CardTitle action={
              <Button variant="soft" size="sm" icon={<IcSearch width={15} height={15} />} onClick={consultar} disabled={!flags.consultaCnpj}>Consultar CNPJ</Button>
            }>{edit.id ? "Editar fornecedor" : "Novo fornecedor"}</CardTitle>
            {msg && <div className="mb-3 text-[12.5px] text-info bg-info-soft rounded-btn px-3 py-2">{msg}</div>}
            <div className="grid gap-3">
              <Field label="CNPJ/CPF"><Input value={edit.cnpj} onChange={(e) => setEdit({ ...edit, cnpj: maskCpfCnpjInput(e.target.value) })} inputMode="numeric" placeholder="00.000.000/0000-00" /></Field>
              <Field label="Razão social"><Input value={edit.razaoSocial} onChange={(e) => setEdit({ ...edit, razaoSocial: e.target.value })} /></Field>
              <Field label="Nome fantasia"><Input value={edit.nomeFantasia} onChange={(e) => setEdit({ ...edit, nomeFantasia: e.target.value })} /></Field>
              <Field label="Perfil tributário">
                <Select value={edit.perfilTributario} onChange={(e) => setEdit({ ...edit, perfilTributario: e.target.value })}>
                  <option value="">Selecione…</option>
                  <option>MEI</option><option>Simples Nacional</option><option>Lucro Presumido/Real</option>
                </Select>
              </Field>
              <Field label="Endereço"><Input value={edit.endereco} onChange={(e) => setEdit({ ...edit, endereco: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefone"><Input value={edit.telefone} onChange={(e) => setEdit({ ...edit, telefone: maskTelefone(e.target.value) })} inputMode="tel" placeholder="(31) 90000-0000" /></Field>
                <Field label="E-mail"><Input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
              </div>
              <div className="flex gap-2 pt-1">
                <Button block onClick={salvar}>Salvar</Button>
                <Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
