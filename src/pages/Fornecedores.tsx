import { useMemo, useState } from "react";
import { PageShell } from "@/components/layout/AppLayout";
import {
  Card, CardTitle, Button, Field, Input, TelefoneInput, Select, Table, THead, Tr, Td,
  Badge, EmptyState, AvisoErro, Avatar, ThOrd, useOrdenacao,
} from "@/components/ui";
import { IcSearch, IcTrash, IcPlus } from "@/components/icons";
import { repo } from "@/data";
import { useAvisoDeSaida } from "@/hooks/useAvisoDeSaida";
import { useAsync } from "@/hooks/useAsync";
import { consultarCnpj } from "@/lib/cnpj";
import { flags } from "@/lib/flags";
import { gerarApelidoFornecedor, textoDoContato } from "@/domain/fornecedor";
import { cx, maskCpfCnpjInput } from "@/lib/format";
import { toast } from "@/store/toast";
import { useAuth } from "@/store/auth";
import type { ContatoFornecedor, Fornecedor } from "@/data/types";

export function Fornecedores() {
  const podeEditar = useAuth((s) => s.pode("fornecedores.editar"));
  const { data, loading, error, reload } = useAsync(() => repo.fornecedores.listar(), [], { oQue: "os fornecedores" });
  const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState<Fornecedor | null>(null);
  // Cadastro aberto e mexido: F5, fechar a aba ou sair da tela pedem confirmação.
  useAvisoDeSaida(edit);
  /** Apelido que o sistema usaria — mostrado como sugestão enquanto o campo está vazio. */
  const apelidoAutomatico = useMemo(
    () => gerarApelidoFornecedor(edit?.nomeFantasia, edit?.razaoSocial),
    [edit?.nomeFantasia, edit?.razaoSocial]
  );
  const [msg, setMsg] = useState("");

  /* ------------------------------ contatos ------------------------------ */

  /**
   * A agenda do fornecedor é editada NO LUGAR: cada contato é um bloco de
   * campos, não uma frase.
   *
   * O botão só acrescenta um bloco em branco — quem preenche é a pessoa, campo
   * a campo. Assim o mesmo lugar serve para criar e para corrigir, inclusive
   * um contato antigo que veio de uma frase e ficou com o nome torto. Blocos
   * que continuarem vazios somem ao salvar.
   */
  function addContato() {
    if (!edit) return;
    setEdit({ ...edit, contatos: [...(edit.contatos ?? []), { nome: "" }] });
    // O campo do bloco novo recebe o cursor: sem isso a pessoa clica em
    // "Adicionar", a tela cresce e ela ainda precisa mirar no campo certo.
    window.setTimeout(() => {
      const campos = document.querySelectorAll<HTMLInputElement>("[data-contato-nome]");
      campos[campos.length - 1]?.focus();
    }, 0);
  }

  function mudarContato(i: number, patch: Partial<ContatoFornecedor>) {
    if (!edit) return;
    const lista = [...(edit.contatos ?? [])];
    lista[i] = { ...lista[i], ...patch };
    setEdit({ ...edit, contatos: lista });
  }

  function removerContato(i: number) {
    if (!edit) return;
    setEdit({ ...edit, contatos: (edit.contatos ?? []).filter((_, j) => j !== i) });
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return data ?? [];
    // A busca cobre o que a tela mostra: era possível ver "Som & Luz" na lista
    // (nome fantasia) e não achar nada ao digitar exatamente isso.
    return (data ?? []).filter((f) =>
      [f.apelido, f.nomeFantasia, f.razaoSocial, f.cnpj, f.perfilTributario, f.email, f.telefone,
       ...(f.contatos ?? []).map(textoDoContato)]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [data, busca]);

  /** Fornecedor em branco — o cadastro manual, para quem ainda não veio de uma EC. */
  const novoFornecedor = (): Fornecedor => ({
    id: "", razaoSocial: "", apelido: "", nomeFantasia: "", cnpj: "", perfilTributario: "", endereco: "",
    inscricaoEstadual: "", inscricaoMunicipal: "",
    dadosBancarios: { tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "" },
    representante: "", telefone: "", email: "", contatos: [],
  });

  const { ordem, ordenarPor, ordenados: lista } = useOrdenacao(
    filtrados,
    {
      fornecedor: (f) => f.nomeFantasia || f.razaoSocial,
      cnpj: (f) => f.cnpj,
      perfil: (f) => f.perfilTributario,
      contato: (f) => f.email,
    },
    { col: "fornecedor", dir: "asc" }
  );

  async function consultar() {
    if (!edit) return;
    setMsg("");
    try {
      const d = await consultarCnpj(edit.cnpj);
      setEdit({ ...edit, razaoSocial: d.razaoSocial, nomeFantasia: d.nomeFantasia, endereco: d.endereco, perfilTributario: d.perfilTributario, email: d.email, telefone: d.telefone, cnaes: d.cnaes, inscricaoEstadual: d.inscricaoEstadual || edit.inscricaoEstadual || "Isenta" });
      setMsg("Dados preenchidos pela BrasilAPI.");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!edit) return;
    // Sem razão social nem CNPJ o cadastro não identifica ninguém — e era
    // possível salvar assim, criando fornecedor fantasma na lista.
    if (!edit.razaoSocial.trim() && !edit.cnpj.trim()) {
      toast("Informe ao menos a razão social ou o CNPJ/CPF do fornecedor.", "warning");
      return;
    }
    setSalvando(true);
    try {
      await repo.fornecedores.salvar(edit);
      toast("Fornecedor salvo.", "success");
      setEdit(null);
      reload();
    } catch (e) {
      // A falha (RLS, rede) subia sem tratamento: a tela ficava parada, sem
      // aviso nenhum, e a pessoa achava que tinha salvado.
      toast(`Não foi possível salvar: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <PageShell
      title="Fornecedores"
      subtitle="Consulta e edição. Os fornecedores são registrados automaticamente ao serem usados nas ECs."
      topAction={
        podeEditar && (
          // O cartão de edição já sabia dizer "Novo fornecedor", mas nada nesta
          // tela criava um: só dava para cadastrar passando por uma EC.
          <Button size="sm" icon={<IcPlus width={15} height={15} />} onClick={() => { setEdit(novoFornecedor()); setMsg(""); }}>
            Novo fornecedor
          </Button>
        )
      }
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
              <THead>
                <ThOrd col="fornecedor" ordem={ordem} onSort={ordenarPor}>Fornecedor</ThOrd>
                <ThOrd col="cnpj" ordem={ordem} onSort={ordenarPor}>CNPJ</ThOrd>
                <ThOrd col="perfil" ordem={ordem} onSort={ordenarPor}>Perfil</ThOrd>
                <ThOrd col="contato" ordem={ordem} onSort={ordenarPor}>Contato</ThOrd>
              </THead>
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
                    <Td className="text-[12.5px]">
                      <div>{f.email || "—"}</div>
                      {/* Mostra QUEM é o primeiro contato, não só quantos são:
                          "3 contato(s)" não ajuda ninguém a decidir se abre a
                          ficha; "Maria · Produção" ajuda. */}
                      {(f.contatos?.length ?? 0) > 0 && (
                        <div className="text-[11px] text-ink-3">
                          {[f.contatos![0].nome, f.contatos![0].funcao].filter(Boolean).join(" · ") || "contato sem nome"}
                          {f.contatos!.length > 1 && ` +${f.contatos!.length - 1}`}
                        </div>
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
              {/* O apelido é GERADO a partir do nome (ver domain/fornecedor) e
                  entra no título das OSs. O campo existe só como saída para
                  quando a redução automática não agradar. */}
              <Field label="Apelido" hint="(entra no título das OSs)">
                <Input
                  formato="titulo"
                  value={edit.apelido ?? ""}
                  onChange={(e) => setEdit({ ...edit, apelido: e.target.value })}
                  placeholder={apelidoAutomatico || "gerado a partir do nome"}
                />
                <p className="text-[12px] text-ink-3 mt-1.5">
                  {apelidoAutomatico
                    ? <>Em branco, o sistema usa <b>{apelidoAutomatico}</b>, tirado do nome do fornecedor.</>
                    : "Preencha a razão social ou o nome fantasia e o apelido sai sozinho."}
                </p>
              </Field>
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

              {/* A AGENDA do fornecedor: as pessoas de lá dentro, uma a uma.
                  Era uma lista de frases — dava para ler e não dava para usar:
                  nem ligar, nem mandar e-mail, nem saber quem cuida de nota
                  fiscal. Separado, cada pedaço vira uma ação. */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[12.5px] font-bold text-ink">
                    Contatos <span className="text-ink-3 font-medium">(pessoas do fornecedor)</span>
                  </span>
                  <Button variant="secondary" size="sm" icon={<IcPlus width={13} height={13} />} onClick={addContato}>
                    Adicionar
                  </Button>
                </div>
                {(edit.contatos ?? []).length === 0 ? (
                  <p className="text-[12px] text-ink-3">
                    Nenhum contato ainda. Os informados nas ECs entram aqui sozinhos, e você pode acrescentar
                    outros com <b>Adicionar</b>.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(edit.contatos ?? []).map((c, i) => (
                      <div key={i} className="rounded-btn border border-border bg-[#F7F8FA] p-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
                            Contato {i + 1}
                          </span>
                          <button
                            onClick={() => removerContato(i)}
                            className="text-ink-3 hover:text-danger shrink-0"
                            title="Remover contato"
                          >
                            <IcTrash width={14} height={14} />
                          </button>
                        </div>
                        {/* Nome e função dividem a linha; telefone e e-mail
                            ocupam a largura toda — o telefone porque vem em
                            duas caixas (DDD + número) e ficaria espremido, o
                            e-mail porque endereço cortado não serve para nada. */}
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Nome">
                            <Input
                              data-contato-nome
                              formato="titulo"
                              value={c.nome ?? ""}
                              onChange={(e) => mudarContato(i, { nome: e.target.value })}
                            />
                          </Field>
                          <Field label="Cargo / função" hint="O que a pessoa resolve ali dentro">
                            <Input
                              placeholder="Produção, Financeiro…"
                              value={c.funcao ?? ""}
                              onChange={(e) => mudarContato(i, { funcao: e.target.value })}
                            />
                          </Field>
                          <Field label="Telefone" className="col-span-2">
                            <TelefoneInput
                              value={c.telefone ?? ""}
                              onChange={(v) => mudarContato(i, { telefone: v })}
                            />
                          </Field>
                          <Field label="E-mail" className="col-span-2">
                            <Input
                              type="email"
                              value={c.email ?? ""}
                              onChange={(e) => mudarContato(i, { email: e.target.value })}
                            />
                          </Field>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                {podeEditar && <Button block onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>}
                <Button variant="secondary" block={!podeEditar} onClick={() => setEdit(null)}>{podeEditar ? "Cancelar" : "Fechar"}</Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
