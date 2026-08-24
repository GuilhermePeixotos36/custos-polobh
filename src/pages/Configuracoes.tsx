import { useEffect, useState } from "react";
import { ChecklistModelosCard } from "@/components/ChecklistModelosCard";
import { createPortal } from "react-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { Card, CardTitle, Toggle, Badge, Field, Input, TelefoneInput, Select, Button, Table, THead, Th, Tr, Td, EmptyState } from "@/components/ui";
import { IcPlus, IcPencil, IcTrash, IcBloqueio, IcFechar, IcCheck } from "@/components/icons";
import { ROTULO_PAPEL, PAPEIS_AREA, TELAS, PERMISSOES_ESPECIAIS, useAuth, type Recurso } from "@/store/auth";
import { useEmpresas } from "@/store/empresas";
import { useAsync } from "@/hooks/useAsync";
import { repo } from "@/data";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { cx } from "@/lib/format";
import type { Area, Papel, Usuario } from "@/data/types";

type AbaConfig = "geral" | "checklist" | "areas" | "usuarios";
const ABAS: { key: AbaConfig; label: string }[] = [
  { key: "geral", label: "Geral" },
  { key: "checklist", label: "Check-list" },
  { key: "areas", label: "Áreas e permissões" },
  { key: "usuarios", label: "Usuários" },
];

export function Configuracoes() {
  const [aba, setAba] = useState<AbaConfig>("geral");
  const [retencao, setRetencao] = useState(24);
  const [arquivamentoAuto, setArquivamentoAuto] = useState(true);

  return (
    <PageShell title="Configurações" subtitle="Empresas de emissão, áreas de acesso, usuários e retenção de dados.">
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

      {aba === "checklist" && <ChecklistModelosCard />}

      {aba === "areas" && <AreasCard />}
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

/* --------------------------------- Áreas --------------------------------- */

const areaVazia = (): Area => ({ id: "", nome: "", papelBase: "Producao", recursos: ["projetos", "guia"], ativa: true });

/**
 * Marcador de permissão. Em edição é um checkbox; em leitura vira check/traço —
 * checkbox desabilitado fica cinza demais para se distinguir do desmarcado.
 */
function Marcador({
  checked,
  onChange,
  editando = true,
  travado,
  titulo,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  editando?: boolean;
  travado?: boolean;
  titulo?: string;
}) {
  if (!editando) {
    return checked ? (
      <span className="inline-flex text-success" title={titulo}><IcCheck width={17} height={17} /></span>
    ) : (
      <span className="text-ink-3">—</span>
    );
  }
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={travado}
      title={titulo}
      onChange={(e) => onChange(e.target.checked)}
      className="w-[17px] h-[17px] accent-[#F2820D] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

/**
 * Cadastro de áreas (grupos de permissão). Cada área marca quais telas enxerga
 * e quais pode editar. O "nível de segurança" define o que a área alcança no
 * banco — é ele que faz, por exemplo, o Financeiro ver só a descrição financeira
 * da EC e o Produção não ver os valores do cliente.
 */
function AreasCard() {
  const { data, loading, error, reload } = useAsync(() => repo.areas.listar(), []);
  const { data: usuarios } = useAsync(() => repo.auth.usuarios().catch(() => [] as Usuario[]), []);
  const areaDoUsuario = useAuth((s) => s.usuario?.areaId);
  /** Área aberta no popup. `novo` entra já em modo de edição. */
  const [aberta, setAberta] = useState<{ area: Area; novo: boolean } | null>(null);

  const lista = data ?? [];
  const quantosUsuarios = (areaId: string) => (usuarios ?? []).filter((u) => u.areaId === areaId).length;

  const abrir = (a: Area) => setAberta({ area: { ...a, recursos: [...a.recursos] }, novo: false });

  /** Área sem nenhum usuário some de vez; área com histórico só pode ser inativada. */
  async function remover(a: Area) {
    const ok = await confirmar({
      titulo: `Excluir a área "${a.nome}"?`,
      mensagem: "Nenhum usuário está vinculado a ela. Esta ação não pode ser desfeita.",
      tom: "danger",
    });
    if (!ok) return;
    try {
      await repo.areas.remover(a.id);
      toast("Área excluída.", "success");
      if (aberta?.area.id === a.id) setAberta(null);
      reload();
    } catch (e) {
      toast(`Não foi possível excluir: ${(e as Error).message}`, "danger");
    }
  }

  async function alternarAtiva(a: Area) {
    if (a.ativa && a.id === areaDoUsuario) return toast("Você não pode inativar a sua própria área.", "danger");
    const emUso = quantosUsuarios(a.id);
    if (a.ativa) {
      const ok = await confirmar({
        titulo: `Inativar a área "${a.nome}"?`,
        mensagem: `Ela tem ${emUso} usuário(s) e registros no sistema, então não pode ser excluída. Inativada, deixa de ser oferecida a novos usuários; quem já está nela mantém o acesso.`,
        confirmarTexto: "Inativar",
        tom: "danger",
      });
      if (!ok) return;
    }
    try {
      await repo.areas.definirAtiva(a.id, !a.ativa);
      toast(a.ativa ? "Área inativada." : "Área reativada.", "success");
      reload();
    } catch (e) {
      toast(`Não foi possível alterar: ${(e as Error).message}`, "danger");
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Card padded={false}>
        <div className="p-5 flex items-center justify-between gap-3 flex-wrap">
          <CardTitle hint="Cada área define as telas que seus usuários enxergam e editam">Áreas</CardTitle>
          <Button size="sm" icon={<IcPlus width={16} height={16} />} onClick={() => setAberta({ area: areaVazia(), novo: true })}>Nova área</Button>
        </div>
        {error && (
          <div className="mx-5 mt-3 text-[13px] text-danger bg-danger-soft rounded-btn px-3 py-2 flex items-center justify-between gap-3">
            <span>Não foi possível carregar as áreas: {error}</span>
            <button onClick={reload} className="font-bold underline shrink-0">Tentar de novo</button>
          </div>
        )}
        {loading ? <div className="p-8 text-ink-3 text-sm">Carregando…</div> : error ? null : lista.length === 0 ? (
          <EmptyState title="Nenhuma área cadastrada" />
        ) : (
          <Table>
            <THead><Th>Área</Th><Th>Nível de segurança</Th><Th align="center">Telas</Th><Th align="center">Usuários</Th><Th align="center">Ações</Th></THead>
            <tbody>
              {lista.map((a) => {
                const emUso = quantosUsuarios(a.id) > 0;
                return (
                  <Tr key={a.id} onClick={() => abrir(a)}>
                    <Td className={cx("font-bold", !a.ativa && "text-ink-3")}>
                      {a.nome}
                      {!a.ativa && <span className="ml-2"><Badge tom="neutral">Inativa</Badge></span>}
                    </Td>
                    <Td className="text-[12.5px]">{ROTULO_PAPEL[a.papelBase]}</Td>
                    <Td align="center" className="text-[12.5px]">{TELAS.filter((t) => a.recursos.includes(t.ver)).length}/{TELAS.length}</Td>
                    <Td align="center" className="text-[12.5px]">{quantosUsuarios(a.id)}</Td>
                    <Td align="center">
                      <div className="inline-flex items-center gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); abrir(a); }}
                          className="text-ink-3 hover:text-primary-dark inline-flex"
                          title="Editar área"
                        >
                          <IcPencil width={16} height={16} />
                        </button>
                        {/* Com usuários vinculados a área guarda histórico: só dá para inativar. */}
                        {emUso ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); void alternarAtiva(a); }}
                            className={cx("inline-flex", a.ativa ? "text-danger hover:text-danger" : "text-ink-3 hover:text-success")}
                            title={a.ativa ? "Inativar área (tem usuários vinculados)" : "Reativar área"}
                          >
                            <IcBloqueio width={16} height={16} />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); void remover(a); }}
                            className="text-ink-3 hover:text-danger inline-flex"
                            title="Excluir área"
                          >
                            <IcTrash width={16} height={16} />
                          </button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {aberta && (
        <AreaModal
          area={aberta.area}
          novo={aberta.novo}
          areaDoUsuario={areaDoUsuario}
          onFechar={() => setAberta(null)}
          onSalvo={() => { setAberta(null); reload(); }}
        />
      )}
    </div>
  );
}

/**
 * Popup de uma área. Abre em leitura; o lápis no topo troca para edição, e aí
 * o lápis dá lugar a Salvar/Cancelar. O X fecha em qualquer um dos dois modos.
 */
function AreaModal({
  area,
  novo,
  areaDoUsuario,
  onFechar,
  onSalvo,
}: {
  area: Area;
  novo: boolean;
  areaDoUsuario?: string;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [editando, setEditando] = useState(novo);
  const [form, setForm] = useState<Area>(area);
  const [salvando, setSalvando] = useState(false);

  // Esc fecha (mas não durante o salvamento, para não deixar a gravação órfã).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !salvando) onFechar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar, salvando]);

  const marcado = (r: Recurso) => form.recursos.includes(r);
  function alternar(r: Recurso, v: boolean) {
    let recursos = v ? [...form.recursos, r] : form.recursos.filter((x) => x !== r);
    // Editar sem ver não existe: marcar "editar" liga o "ver"; desmarcar "ver" desliga o "editar".
    const tela = TELAS.find((t) => t.ver === r || t.editar === r);
    if (tela?.editar) {
      if (v && r === tela.editar && !recursos.includes(tela.ver)) recursos.push(tela.ver);
      if (!v && r === tela.ver) recursos = recursos.filter((x) => x !== tela.editar);
    }
    setForm({ ...form, recursos });
  }

  async function salvar() {
    if (!form.nome.trim()) return toast("Dê um nome para a área.", "danger");
    setSalvando(true);
    try {
      await repo.areas.salvar(form);
      toast(novo ? "Área criada." : "Área atualizada.", "success");
      onSalvo();
    } catch (e) {
      toast(`Não foi possível salvar: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  }

  /** Numa área nova não há o que voltar: cancelar fecha o popup. */
  const cancelar = () => (novo ? onFechar() : (setForm(area), setEditando(false)));

  const telasVisiveis = TELAS.filter((t) => form.recursos.includes(t.ver)).length;

  return createPortal(
    <div className="no-print fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={editando ? undefined : onFechar}
      />
      <div className="relative w-full max-w-[620px] bg-surface rounded-card-lg shadow-modal border border-border animate-[fadein_.12s_ease] flex flex-col max-h-[88vh]">
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-[17px] text-ink tracking-[-0.3px] truncate">
              {novo ? "Nova área" : form.nome || "Área"}
            </h3>
            <p className="text-[12.5px] text-ink-2 mt-0.5">
              Nível {ROTULO_PAPEL[form.papelBase]} · {telasVisiveis} de {TELAS.length} telas
              {!form.ativa && " · inativa"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editando ? (
              <>
                <Button size="sm" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
                <Button size="sm" variant="secondary" onClick={cancelar} disabled={salvando}>Cancelar</Button>
              </>
            ) : (
              <button
                onClick={() => setEditando(true)}
                title="Editar área"
                className="h-8 w-8 grid place-items-center rounded-btn text-ink-2 hover:text-primary-dark hover:bg-[#F5F6F8]"
              >
                <IcPencil width={16} height={16} />
              </button>
            )}
            <button
              onClick={onFechar}
              title="Fechar"
              disabled={salvando}
              className="h-8 w-8 grid place-items-center rounded-btn text-ink-2 hover:text-ink hover:bg-[#F5F6F8] disabled:opacity-40"
            >
              <IcFechar width={17} height={17} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 overflow-y-auto grid gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nome da área">
              {editando ? (
                <Input formato="titulo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Atendimento" />
              ) : (
                <div className="text-[13.5px] font-semibold text-ink py-1.5">{form.nome || "—"}</div>
              )}
            </Field>
            <Field label="Nível de segurança" hint={editando ? "Define o que a área alcança no banco" : undefined}>
              {editando ? (
                <Select value={form.papelBase} onChange={(e) => setForm({ ...form, papelBase: e.target.value as Papel })}>
                  {PAPEIS_AREA.map((p) => <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>)}
                </Select>
              ) : (
                <div className="text-[13.5px] font-semibold text-ink py-1.5">{ROTULO_PAPEL[form.papelBase]}</div>
              )}
            </Field>
          </div>

          <div className="rounded-card border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-[#FAFAFB]">
                  <th className="text-left px-4 py-2.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Tela</th>
                  <th className="px-4 py-2.5 w-24 text-center text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Ver</th>
                  <th className="px-4 py-2.5 w-24 text-center text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Editar</th>
                </tr>
              </thead>
              <tbody>
                {TELAS.map((t) => (
                  <tr key={t.ver} className="border-b border-border-soft last:border-0">
                    <td className="px-4 py-2.5 font-semibold text-ink">{t.label}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Marcador checked={marcado(t.ver)} editando={editando} onChange={(v) => alternar(t.ver, v)} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {t.editar
                        ? <Marcador checked={marcado(t.editar)} editando={editando} onChange={(v) => alternar(t.editar!, v)} />
                        : <span className="text-ink-3">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-card border border-border p-4 space-y-3">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Permissões especiais</div>
            {PERMISSOES_ESPECIAIS.map((p) => {
              // Ninguém pode se trancar para fora: a própria área não perde Configurações.
              const travado = p.key === "configuracoes" && form.id === areaDoUsuario;
              return (
                <label key={p.key} className={cx("flex items-start gap-3", editando && !travado && "cursor-pointer")}>
                  <span className="pt-0.5">
                    <Marcador
                      checked={marcado(p.key)}
                      editando={editando}
                      travado={travado}
                      titulo={editando && travado ? "Você não pode remover Configurações da sua própria área." : undefined}
                      onChange={(v) => alternar(p.key, v)}
                    />
                  </span>
                  <span>
                    <span className="block text-[13px] font-bold text-ink">{p.label}</span>
                    <span className="block text-[12px] text-ink-2">{p.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <p className="text-[12.5px] text-ink-2">
            O <b>nível de segurança</b> vale também fora da tela: mesmo que uma área marque o bloco
            financeiro, os valores só chegam ao navegador se o nível permitir (Direção ou Financeiro).
            Trocar o nível de uma área muda o acesso de todos os usuários dela.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* -------------------------------- Usuários -------------------------------- */

const usuarioVazio = (): Usuario => ({ id: "", nome: "", email: "", telefone: "", papel: "Producao", areaId: "" });

/**
 * Cadastro de usuários (perfis + login). Criar usuário convida por e-mail (o próprio
 * usuário define a senha); editar altera nome/telefone/papel e, se preciso, o e-mail
 * do login. Tudo passa pela Edge Function `gerenciar-usuarios` (chave de serviço).
 */
function UsuariosCard() {
  const { data, loading, error, reload } = useAsync(() => repo.auth.usuariosCompletos(), []);
  const { data: areas } = useAsync(() => repo.areas.listar(), []);
  const [edit, setEdit] = useState<Usuario | null>(null);
  const [salvando, setSalvando] = useState(false);

  const lista = data ?? [];

  async function salvar() {
    if (!edit) return;
    // O Admin (desenvolvedor) não pertence a área nenhuma — enxerga tudo pelo papel.
    const areaId = edit.areaId ?? "";
    if (!areaId && edit.papel !== "Admin") return toast("Selecione a área do usuário.", "danger");
    setSalvando(true);
    try {
      if (edit.id) {
        await repo.auth.atualizarUsuario({ id: edit.id, nome: edit.nome, telefone: edit.telefone, areaId, email: edit.email });
        toast("Usuário atualizado.", "success");
      } else {
        await repo.auth.criarUsuario({ email: edit.email, nome: edit.nome, areaId, telefone: edit.telefone });
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
          <CardTitle hint="Nome, e-mail (login), telefone e área de cada usuário do sistema">Usuários</CardTitle>
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
            <THead><Th>Nome</Th><Th>E-mail</Th><Th>Telefone</Th><Th align="center">Área</Th></THead>
            <tbody>
              {lista.map((u) => (
                <Tr key={u.id} onClick={() => setEdit({ ...u })}>
                  <Td className="font-bold">{u.nome}</Td>
                  <Td className="text-[12.5px]">{u.email || "—"}</Td>
                  <Td className="text-[12.5px]">{u.telefone || "—"}</Td>
                  {/* Sem área é o caso do desenvolvedor (papel Admin) — não é uma área, é a ausência dela. */}
                  <Td align="center">
                    {u.areaNome ? <Badge tom="info">{u.areaNome}</Badge> : <span className="text-ink-3">—</span>}
                  </Td>
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
            <Field label="Área" hint="Define as telas que este usuário enxerga e edita">
              <Select value={edit.areaId ?? ""} onChange={(e) => setEdit({ ...edit, areaId: e.target.value })}>
                <option value="">
                  {edit.papel === "Admin" ? "Sem área — acesso total (desenvolvedor)" : "Selecione a área…"}
                </option>
                {/* Áreas inativas não são oferecidas — exceto a que o usuário já ocupa. */}
                {(areas ?? [])
                  .filter((a) => a.ativa || a.id === edit.areaId)
                  .map((a) => <option key={a.id} value={a.id}>{a.nome}{a.ativa ? "" : " (inativa)"}</option>)}
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
