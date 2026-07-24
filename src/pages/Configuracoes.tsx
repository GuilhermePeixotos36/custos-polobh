import { useState } from "react";
import { PageShell } from "@/components/layout/AppLayout";
import { Card, CardTitle, Toggle, Badge, Field, Input, TelefoneInput, Select, Button, Table, THead, Th, Tr, Td, EmptyState } from "@/components/ui";
import { IcCheck, IcPlus } from "@/components/icons";
import { PERMISSOES, ROTULO_PAPEL, type Recurso } from "@/store/auth";
import { useEmpresas } from "@/store/empresas";
import { useAsync } from "@/hooks/useAsync";
import { repo } from "@/data";
import { toast } from "@/store/toast";
import { cx } from "@/lib/format";
import type { Papel, Usuario } from "@/data/types";

const RECURSOS: { key: Recurso; label: string }[] = [
  { key: "projetos", label: "Projetos" },
  { key: "ecs", label: "ECs (consulta)" },
  { key: "ecs.editar", label: "ECs (editar)" },
  { key: "oss", label: "Ordens de Serviço" },
  { key: "cronogramas", label: "Cronogramas" },
  { key: "fornecedores", label: "Fornecedores" },
  { key: "financeiro", label: "Bloco financeiro" },
  { key: "configuracoes", label: "Configurações" },
  { key: "logs", label: "Logs do sistema" },
];
const PAPEIS: Papel[] = ["Admin", "Direcao", "Producao", "Administrativo"];

type AbaConfig = "geral" | "usuarios";
const ABAS: { key: AbaConfig; label: string }[] = [
  { key: "geral", label: "Geral" },
  { key: "usuarios", label: "Usuários" },
];

export function Configuracoes() {
  const [aba, setAba] = useState<AbaConfig>("geral");
  const [retencao, setRetencao] = useState(24);
  const [arquivamentoAuto, setArquivamentoAuto] = useState(true);

  return (
    <PageShell title="Configurações" subtitle="Empresas de emissão, perfis de acesso, usuários e retenção de dados.">
      <div className="flex gap-1 border-b border-border mb-5">
        {ABAS.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={cx(
              "px-4 h-10 text-[13.5px] font-bold whitespace-nowrap border-b-2 -mb-px transition-colors",
              aba === a.key ? "text-primary-dark border-primary" : "text-ink-2 hover:text-ink border-transparent"
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === "geral" && (
        <div className="space-y-4">
          <EmpresasGrupoCard />

          <Card padded={false}>
            <div className="p-5"><CardTitle hint="Quem enxerga e edita cada recurso">Matriz de perfis × recursos</CardTitle></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border bg-[#FAFAFB]">
                    <th className="text-left px-4 py-2.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Recurso</th>
                    {PAPEIS.map((p) => (
                      <th key={p} className="px-4 py-2.5 text-center text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">{ROTULO_PAPEL[p]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RECURSOS.map((r) => (
                    <tr key={r.key} className="border-b border-border-soft">
                      <td className="px-4 py-3 font-semibold text-ink">{r.label}</td>
                      {PAPEIS.map((p) => (
                        <td key={p} className="px-4 py-3 text-center">
                          {PERMISSOES[p].includes(r.key) ? (
                            <span className="inline-flex text-success"><IcCheck width={18} height={18} /></span>
                          ) : (
                            <span className="text-ink-3">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardTitle hint="Arquivar ≠ apagar — registros arquivados continuam consultáveis">Retenção de dados</CardTitle>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink">Arquivamento automático</span>
                <Toggle checked={arquivamentoAuto} onChange={setArquivamentoAuto} />
              </div>
              <div>
                <label className="text-[12.5px] font-bold text-ink">Prazo de arquivamento: <span className="text-primary-dark">{retencao} meses</span></label>
                <input type="range" min={6} max={48} step={6} value={retencao} onChange={(e) => setRetencao(Number(e.target.value))} className="w-full accent-[#F2820D] mt-2" />
              </div>
              <p className="text-[12.5px] text-ink-2">Ao concluir um projeto, os dados são arquivados (não apagados) e seguem disponíveis para consulta e duplicação.</p>
            </div>
          </Card>
        </div>
      )}

      {aba === "usuarios" && <UsuariosCard />}
    </PageShell>
  );
}

/**
 * Empresas do grupo Pólobh (Pólobh Promoções Eireli / MF Promoções Eireli).
 * Preenchem os dados fiscais da OS quando o tomador/contratante é a Pólobh.
 * Fonte: Supabase (tabela empresas_grupo). Edita ao digitar, salva ao sair do campo.
 */
function EmpresasGrupoCard() {
  const { empresas, carregado, editar, persistir, definirPadrao } = useEmpresas();

  const salvar = async (id: string) => {
    try {
      await persistir(id);
    } catch (e) {
      toast(`Não foi possível salvar: ${(e as Error).message}`, "danger");
    }
  };

  return (
    <Card>
      <CardTitle hint="Preenchem os dados fiscais da OS quando o tomador ou o contratante é a própria Pólobh">
        Empresas do grupo (emissão de nota fiscal)
      </CardTitle>

      {!carregado && empresas.length === 0 ? (
        <p className="text-ink-3 text-sm">Carregando…</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {empresas.map((e) => (
            <div
              key={e.id}
              className={cx(
                "rounded-card border p-4",
                e.padrao ? "border-active-border bg-primary-soft/40" : "border-border bg-surface"
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <h4 className="font-display font-bold text-[14px] text-ink">{e.nome}</h4>
                {e.padrao ? (
                  <Badge tom="success">Padrão p/ emissão</Badge>
                ) : (
                  <button
                    onClick={async () => { await definirPadrao(e.id); toast(`${e.nome} definida como padrão.`, "success"); }}
                    className="text-[12px] font-bold text-primary-dark hover:underline"
                  >
                    Tornar padrão
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <Field label="Razão Social">
                  <Input value={e.razaoSocial} onChange={(ev) => editar(e.id, { razaoSocial: ev.target.value })} onBlur={() => salvar(e.id)} placeholder="Ex.: Pólobh Promoções Eireli" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="CNPJ">
                    <Input value={e.cnpj} onChange={(ev) => editar(e.id, { cnpj: ev.target.value })} onBlur={() => salvar(e.id)} placeholder="00.000.000/0000-00" />
                  </Field>
                  <Field label="Inscrição Estadual">
                    <Input value={e.inscricaoEstadual} onChange={(ev) => editar(e.id, { inscricaoEstadual: ev.target.value })} onBlur={() => salvar(e.id)} />
                  </Field>
                </div>
                <Field label="Endereço">
                  <Input value={e.endereco} onChange={(ev) => editar(e.id, { endereco: ev.target.value })} onBlur={() => salvar(e.id)} />
                </Field>
                <Field label="Inscrição Municipal">
                  <Input value={e.inscricaoMunicipal} onChange={(ev) => editar(e.id, { inscricaoMunicipal: ev.target.value })} onBlur={() => salvar(e.id)} />
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[12.5px] text-ink-2 mt-3">
        As alterações são salvas ao sair de cada campo. A empresa <b>padrão</b> é usada na emissão;
        se o tomador/contratante da OS for a Pólobh, estes dados entram na planilha.
      </p>
    </Card>
  );
}

const usuarioVazio = (): Usuario => ({ id: "", nome: "", email: "", telefone: "", papel: "Producao" });

/**
 * Cadastro de usuários (perfis + login). Criar usuário convida por e-mail (o próprio
 * usuário define a senha); editar altera nome/telefone/papel e, se preciso, o e-mail
 * do login. Tudo passa pela Edge Function `gerenciar-usuarios` (chave de serviço).
 */
function UsuariosCard() {
  const { data, loading, error, reload } = useAsync(() => repo.auth.usuariosCompletos(), []);
  const [edit, setEdit] = useState<Usuario | null>(null);
  const [salvando, setSalvando] = useState(false);

  const lista = data ?? [];

  async function salvar() {
    if (!edit) return;
    setSalvando(true);
    try {
      if (edit.id) {
        await repo.auth.atualizarUsuario({ id: edit.id, nome: edit.nome, telefone: edit.telefone, papel: edit.papel, email: edit.email });
        toast("Usuário atualizado.", "success");
      } else {
        await repo.auth.criarUsuario({ email: edit.email, nome: edit.nome, papel: edit.papel, telefone: edit.telefone });
        toast(`Convite enviado para ${edit.email}.`, "success");
      }
      setEdit(null);
      reload();
    } catch (e) {
      toast(`Não foi possível salvar: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={cx(edit ? "grid lg:grid-cols-[1.5fr_1fr] gap-4 items-start" : "max-w-5xl mx-auto")}>
      <Card padded={false}>
        <div className="p-5 flex items-center justify-between gap-3 flex-wrap">
          <CardTitle hint="Nome, e-mail (login), telefone e grupo de permissão de cada usuário do sistema">Usuários</CardTitle>
          <Button size="sm" icon={<IcPlus width={16} height={16} />} onClick={() => setEdit(usuarioVazio())}>
            Novo usuário
          </Button>
        </div>
        {error && (
          <div className="mx-5 mt-3 text-[13px] text-danger bg-danger-soft rounded-btn px-3 py-2 flex items-center justify-between gap-3">
            <span>Não foi possível carregar os usuários: {error}</span>
            <button onClick={reload} className="font-bold underline shrink-0">Tentar de novo</button>
          </div>
        )}
        {loading ? <div className="p-8 text-ink-3 text-sm">Carregando…</div> : error ? null : lista.length === 0 ? (
          <EmptyState title="Nenhum usuário cadastrado" />
        ) : (
          <Table>
            <THead><Th>Nome</Th><Th>E-mail</Th><Th>Telefone</Th><Th align="center">Grupo</Th></THead>
            <tbody>
              {lista.map((u) => (
                <Tr key={u.id} onClick={() => setEdit({ ...u })}>
                  <Td className="font-bold">{u.nome}</Td>
                  <Td className="text-[12.5px]">{u.email || "—"}</Td>
                  <Td className="text-[12.5px]">{u.telefone || "—"}</Td>
                  <Td align="center"><Badge tom="info">{ROTULO_PAPEL[u.papel]}</Badge></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {edit && (
        <Card>
          <CardTitle>{edit.id ? "Editar usuário" : "Novo usuário"}</CardTitle>
          {!edit.id && (
            <div className="mb-3 text-[12.5px] text-info bg-info-soft rounded-btn px-3 py-2">
              Um convite por e-mail será enviado — o próprio usuário define a senha ao aceitar.
            </div>
          )}
          <div className="grid gap-3">
            <Field label="Nome"><Input formato="titulo" value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></Field>
            <Field label="E-mail"><Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="nome@polobh.com.br" /></Field>
            <Field label="Telefone"><TelefoneInput value={edit.telefone} onChange={(v) => setEdit({ ...edit, telefone: v })} /></Field>
            <Field label="Grupo de permissão">
              <Select value={edit.papel} onChange={(e) => setEdit({ ...edit, papel: e.target.value as Papel })}>
                {PAPEIS.map((p) => <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>)}
              </Select>
            </Field>
            <div className="flex gap-2 pt-1">
              <Button block onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
              <Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
