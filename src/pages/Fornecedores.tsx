import { useMemo, useState } from "react";
import { PageShell } from "@/components/layout/AppLayout";
import {
  Card, CardTitle, Button, Field, Input, TelefoneInput, Select, Table, THead, Th, Tr, Td,
  Badge, EmptyState, AvisoErro, Avatar,
} from "@/components/ui";
import { IcSearch, IcTrash } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { consultarCnpj } from "@/lib/cnpj";
import { flags } from "@/lib/flags";
import { cx, maskCpfCnpjInput } from "@/lib/format";
import { toast } from "@/store/toast";
import { useAuth } from "@/store/auth";
import type { Fornecedor } from "@/data/types";

export function Fornecedores() {
  const podeEditar = useAuth((s) => s.pode("fornecedores.editar"));
  const { data, loading, error, reload } = useAsync(() => repo.fornecedores.listar(), [], { oQue: "os fornecedores" });
  const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState<Fornecedor | null>(null);
  const [msg, setMsg] = useState("");
  const [novoContato, setNovoContato] = useState("");

  function addContato() {
    if (!edit) return;
    const c = novoContato.trim();
    if (!c) return;
    const atuais = edit.contatos ?? [];
    if (!atuais.includes(c)) setEdit({ ...edit, contatos: [...atuais, c] });
    setNovoContato("");
  }

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
      title="Fornecedores"
      subtitle="Consulta e edição. Os fornecedores são registrados automaticamente ao serem usados nas ECs."
    >
      <div className={cx(edit ? "grid lg:grid-cols-[1.5fr_1fr] gap-4 items-start" : "max-w-5xl mx-auto")}>
        <Card padded={false}>
          <div className="p-4 border-b border-border-soft">
            <div className="relative max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"><IcSearch width={16} height={16} /></span>
              <Input className="!h-10 pl-9" placeholder="Buscar fornecedor…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          {error ? <AvisoErro erro={error} oQue="os fornecedores" onTentarDeNovo={reload} /> : loading ? <div className="p-8 text-ink-3 text-sm">Carregando…</div> : lista.length === 0 ? (
            <EmptyState title="Nenhum fornecedor" />
          ) : (
            <Table>
              <THead><Th>Fornecedor</Th><Th>CNPJ</Th><Th>Perfil</Th><Th>Contato</Th></THead>
              <tbody>
                {lista.map((f) => (
                  <Tr key={f.id} onClick={() => { setEdit(structuredClone(f)); setMsg(""); setNovoContato(""); }}>
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
                    <Td className="text-[12.5px]">
                      <div>{f.email || "—"}</div>
                      {(f.contatos?.length ?? 0) > 0 && (
                        <div className="text-[11px] text-ink-3">{f.contatos!.length} contato(s) das ECs</div>
                      )}
                    </Td>
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
              <Field label="Razão social"><Input formato="titulo-empresa" value={edit.razaoSocial} onChange={(e) => setEdit({ ...edit, razaoSocial: e.target.value })} /></Field>
              <Field label="Nome fantasia"><Input formato="titulo" value={edit.nomeFantasia} onChange={(e) => setEdit({ ...edit, nomeFantasia: e.target.value })} /></Field>
              <Field label="Perfil tributário">
                <Select value={edit.perfilTributario} onChange={(e) => setEdit({ ...edit, perfilTributario: e.target.value })}>
                  <option value="">Selecione…</option>
                  <option>MEI</option><option>Simples Nacional</option><option>Lucro Presumido/Real</option>
                </Select>
              </Field>
              <Field label="Endereço"><Input formato="titulo" value={edit.endereco} onChange={(e) => setEdit({ ...edit, endereco: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefone"><TelefoneInput value={edit.telefone} onChange={(v) => setEdit({ ...edit, telefone: v })} /></Field>
                <Field label="E-mail"><Input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
              </div>
              {edit.cnaes && edit.cnaes.length > 0 && (
                <div>
                  <span className="block mb-1.5 text-[12.5px] font-bold text-ink">CNAEs <span className="text-ink-3 font-medium">(do CNPJ)</span></span>
                  <div className="flex flex-wrap gap-1.5">
                    {edit.cnaes.map((c, i) => (
                      <span key={i} className="text-[11px] bg-[#F0F1F4] text-ink-2 rounded-pill px-2 py-1">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="block mb-1.5 text-[12.5px] font-bold text-ink">Contatos <span className="text-ink-3 font-medium">(acumulados das ECs)</span></span>
                {(edit.contatos ?? []).length === 0 ? (
                  <p className="text-[12px] text-ink-3">Nenhum contato ainda. São adicionados conforme os registros nas ECs.</p>
                ) : (
                  <div className="space-y-1">
                    {(edit.contatos ?? []).map((c, i) => (
                      <div key={i} className="flex items-center gap-2 bg-[#F7F8FA] rounded-btn px-2.5 py-1.5">
                        <span className="text-[12.5px] text-ink flex-1 break-words">{c}</span>
                        <button
                          onClick={() => setEdit({ ...edit, contatos: (edit.contatos ?? []).filter((_, j) => j !== i) })}
                          className="text-ink-3 hover:text-danger shrink-0"
                          title="Remover contato"
                        >
                          <IcTrash width={14} height={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <Input
                    className="!h-9"
                    placeholder="Novo contato (nome · telefone / e-mail)"
                    value={novoContato}
                    onChange={(e) => setNovoContato(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addContato(); } }}
                  />
                  <Button variant="secondary" size="sm" onClick={addContato}>Adicionar</Button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                {podeEditar && <Button block onClick={salvar}>Salvar</Button>}
                <Button variant="secondary" block={!podeEditar} onClick={() => setEdit(null)}>{podeEditar ? "Cancelar" : "Fechar"}</Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
