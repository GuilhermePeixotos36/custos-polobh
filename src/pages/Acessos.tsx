/**
 * ACESSOS — Usuários e Grupos de permissão (padrão de Acessos, 26/11/2026).
 *
 * Substitui Configurações › Usuários e Áreas. Toda escrita passa pelo banco (RPCs) ou pela Edge
 * `acessos` — a tela só evita o erro: quem recusa é o servidor. Regras que valem sempre:
 *   · login só com e-mail e senha; a senha definida aqui é PROVISÓRIA (a pessoa troca no 1º acesso);
 *   · CPF obrigatório, validado e único; fora do campo de digitação aparece sempre mascarado;
 *   · nunca se exclui: inativa; inativo não se edita (primeiro ativa);
 *   · quem não é Administrador de sistema nunca concede mais do que tem.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { SubGuias } from "@/components/layout/SubGuias";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Table, THead, Th, Tr, Td, Toggle, type Tom } from "@/components/ui";
import { IcEye, IcFechar, IcPencil, IcPlus, IcSearch } from "@/components/icons";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { dataHoraBR } from "@/lib/format";
import { CATALOGO } from "@/config/acessos/catalogo";
import {
  carregarGrupos, carregarUsuarios, conferirDuplicidade, criarUsuario, definirAcessoDoUsuario, definirSenha, salvarGrupo,
  ErroDaEdge, type GrupoAcesso, type UsuarioDoAcesso,
} from "@/lib/acessos/acessosStore";
import { acoesDaTela, alternarAcao, alternarModulo, moduloTemPermissao, permissoesValidas, pode as podePermissao, resumoDoGrupo, type Permissao } from "@/lib/acessos/permissoes";
import { errosDeDuplicidade, errosDosDados, normalizarBusca, ROTULO_STATUS, type ErrosDosDados } from "@/lib/acessos/usuarios";
import { formatarCpf, motivoDoCpfInvalido } from "@/lib/acessos/cpf";
import { gerarSenha, motivoDaSenhaInvalida } from "@/lib/acessos/senha";

type Aba = "usuarios" | "grupos";
const TOM_STATUS: Record<string, Tom> = { ativo: "success", pendente: "warning", inativo: "neutral" };
const ROTULO_NIVEL: Record<string, string> = { Admin: "Administrador", Direcao: "Direção", Producao: "Produção", Administrativo: "Financeiro" };

/** O que quem está na tela pode conceder (a mesma regra do banco, só para não oferecer o que ele recusaria). */
function concedivel(g: GrupoAcesso, eu: { sistema: boolean; papel: string; permissoes: Permissao[] }): boolean {
  if (!g.ativo) return false;
  if (eu.sistema) return true;
  if (g.sistema) return false;
  if (g.papelBase !== "Producao" && g.papelBase !== eu.papel) return false;
  return g.permissoes.every((p) => podePermissao(eu.permissoes, p.tela, p.acao));
}

export function Acessos() {
  const podeAcao = useAuth((s) => s.podeAcao);
  const usuarioLogado = useAuth((s) => s.usuario);
  const grupoSistema = useAuth((s) => s.grupoSistema);
  const minhasPermissoes = useAuth((s) => s.permissoesGrupo);
  const verUsuarios = podeAcao("acessos.usuarios", "ver");
  const verGrupos = podeAcao("acessos.grupos", "ver");
  const [aba, setAba] = useState<Aba>(verUsuarios ? "usuarios" : "grupos");
  const [grupos, setGrupos] = useState<GrupoAcesso[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioDoAcesso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [novoUsuario, setNovoUsuario] = useState(false);
  const [editando, setEditando] = useState<UsuarioDoAcesso | null>(null);
  const [vendo, setVendo] = useState<UsuarioDoAcesso | null>(null);
  const [grupoAberto, setGrupoAberto] = useState<GrupoAcesso | "novo" | null>(null);

  const eu = useMemo(
    () => ({ sistema: grupoSistema, papel: usuarioLogado?.papel ?? "", permissoes: minhasPermissoes }),
    [grupoSistema, usuarioLogado?.papel, minhasPermissoes],
  );

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [g, u] = await Promise.all([carregarGrupos(verUsuarios), verUsuarios ? carregarUsuarios() : Promise.resolve([])]);
      setGrupos(g);
      setUsuarios([...u].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os acessos.");
    } finally {
      setCarregando(false);
    }
  }, [verUsuarios]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const nomeDoGrupo = (id: string | null) => grupos.find((g) => g.id === id)?.nome ?? "—";
  const sistemaId = grupos.find((g) => g.sistema)?.id;
  const concedidos = grupos.filter((g) => concedivel(g, eu));
  const filtrados = useMemo(() => {
    const q = normalizarBusca(busca);
    if (!q) return usuarios;
    return usuarios.filter((u) => normalizarBusca(`${u.nome} ${u.email} ${u.cpfMascarado} ${u.cargo} ${nomeDoGrupo(u.grupoId)}`).includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarios, busca, grupos]);

  async function alternarStatus(u: UsuarioDoAcesso) {
    const ativar = u.status === "inativo";
    const ok = await confirmar({
      titulo: ativar ? `Ativar ${u.nome}?` : `Inativar ${u.nome}?`,
      mensagem: ativar
        ? "A pessoa volta a entrar no app, com o grupo de permissão que tinha."
        : "A pessoa deixa de entrar no app. Nada é apagado: dá para ativar de novo depois.",
      confirmarTexto: ativar ? "Ativar" : "Inativar",
      tom: ativar ? "primary" : "danger",
    });
    if (!ok) return;
    try {
      await definirAcessoDoUsuario({ usuarioId: u.id, grupoId: null, status: ativar ? "ativo" : "inativo" });
      toast(ativar ? "Usuário ativado." : "Usuário inativado.", "success");
      await recarregar();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível alterar o usuário.", "danger");
    }
  }

  const abas = [
    ...(verUsuarios ? [{ key: "usuarios" as const, label: "Usuários" }] : []),
    ...(verGrupos ? [{ key: "grupos" as const, label: "Grupos de permissão" }] : []),
  ];
  const botaoNovo =
    aba === "usuarios" && podeAcao("acessos.usuarios", "criar") ? (
      <Button icon={<IcPlus width={16} height={16} />} onClick={() => setNovoUsuario(true)}>Novo usuário</Button>
    ) : aba === "grupos" && podeAcao("acessos.grupos", "criar") ? (
      <Button icon={<IcPlus width={16} height={16} />} onClick={() => setGrupoAberto("novo")}>Novo grupo</Button>
    ) : undefined;

  return (
    <PageShell
      title="Acessos"
      subtitle="Quem entra no app e o que cada grupo pode fazer."
      topAction={botaoNovo}
      subabas={<SubGuias<Aba> rotulo="Acessos" atual={aba} onChange={setAba} abas={abas} />}
    >
      {carregando && !usuarios.length && !grupos.length ? (
        <Card><div className="p-6 text-center text-ink-3">Carregando…</div></Card>
      ) : erro ? (
        <Card><div className="p-6 text-center text-danger font-semibold" role="alert">{erro}</div></Card>
      ) : aba === "usuarios" ? (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"><IcSearch width={16} height={16} /></span>
                <Input className="pl-9" placeholder="Buscar por nome, e-mail, CPF ou cargo" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <span className="text-[12px] text-ink-3">{filtrados.length} usuário(s)</span>
            </div>
          </Card>
          <Card padded={false}>
            {filtrados.length === 0 ? (
              <div className="p-8"><EmptyState title="Nenhum usuário encontrado." /></div>
            ) : (
              <Table>
                <THead>
                  <Th>Nome</Th><Th>E-mail</Th><Th>CPF</Th><Th>Grupo de permissão</Th><Th>Status</Th><Th align="right">Ações</Th>
                </THead>
                <tbody>
                  {filtrados.map((u) => {
                    const ehEu = u.id === usuarioLogado?.id;
                    const doAdmin = u.grupoId === sistemaId;
                    const travado = ehEu || (doAdmin && !grupoSistema);
                    return (
                      <Tr key={u.id}>
                        <Td className="font-semibold text-ink">
                          {u.nome}
                          {u.senhaProvisoria && <span className="ml-2"><Badge tom="warning">Senha provisória</Badge></span>}
                        </Td>
                        <Td className="text-[12.5px] text-ink-2">{u.email}</Td>
                        <Td className="text-[12.5px] text-ink-2">{u.cpfMascarado || "—"}</Td>
                        <Td className="text-[12.5px]">{nomeDoGrupo(u.grupoId)}</Td>
                        <Td><Badge tom={TOM_STATUS[u.status]}>{ROTULO_STATUS[u.status]}</Badge></Td>
                        <Td align="right">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" title="Ver detalhes" className="rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5] hover:text-ink" onClick={() => setVendo(u)}>
                              <IcEye width={16} height={16} />
                            </button>
                            {u.status !== "inativo" && podeAcao("acessos.usuarios", "editar") && (
                              <button type="button" disabled={travado} title={travado ? (ehEu ? "Você não pode alterar o seu próprio acesso." : "Só um Administrador de sistema altera membros desse grupo.") : "Editar"}
                                className="rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5] hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => setEditando(u)}>
                                <IcPencil width={16} height={16} />
                              </button>
                            )}
                            {(u.status === "inativo" ? podeAcao("acessos.usuarios", "editar") : podeAcao("acessos.usuarios", "inativar")) && (
                              <Button size="sm" variant="secondary" disabled={travado} onClick={() => void alternarStatus(u)}>
                                {u.status === "inativo" ? "Ativar" : "Inativar"}
                              </Button>
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
        </div>
      ) : (
        <Card padded={false}>
          <Table>
            <THead><Th>Grupo</Th><Th>Nível</Th><Th>Permissões</Th><Th>Usuários</Th><Th>Status</Th><Th align="right">Ações</Th></THead>
            <tbody>
              {grupos.map((g) => (
                <Tr key={g.id}>
                  <Td className="font-semibold text-ink">{g.nome}{g.sistema && <span className="ml-2"><Badge tom="info">Sistema</Badge></span>}</Td>
                  <Td className="text-[12.5px]">{ROTULO_NIVEL[g.papelBase] ?? g.papelBase}</Td>
                  <Td className="text-[12.5px] text-ink-2">{g.sistema ? "Tudo liberado" : resumoDoGrupo(g.permissoes)}</Td>
                  <Td className="text-[12.5px]">{g.usuariosAtivos ?? "—"}</Td>
                  <Td><Badge tom={g.ativo ? "success" : "neutral"}>{g.ativo ? "Ativo" : "Inativo"}</Badge></Td>
                  <Td align="right">
                    <button type="button" title={g.sistema ? "Ver" : "Editar"} className="rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5] hover:text-ink" onClick={() => setGrupoAberto(g)}>
                      {g.sistema || !podeAcao("acessos.grupos", "editar") ? <IcEye width={16} height={16} /> : <IcPencil width={16} height={16} />}
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {novoUsuario && (
        <NovoUsuario grupos={concedidos} onClose={() => setNovoUsuario(false)} onCriado={() => { setNovoUsuario(false); void recarregar(); }} />
      )}
      {editando && (
        <EditarUsuario usuario={editando} grupos={concedidos} onClose={() => setEditando(null)} onSalvo={() => { setEditando(null); void recarregar(); }} />
      )}
      {vendo && <DetalhesUsuario usuario={vendo} grupo={nomeDoGrupo(vendo.grupoId)} onClose={() => setVendo(null)} />}
      {grupoAberto && (
        <GrupoPopup
          grupo={grupoAberto === "novo" ? null : grupoAberto}
          somenteLeitura={grupoAberto !== "novo" && (grupoAberto.sistema || !podeAcao("acessos.grupos", "editar"))}
          eu={eu}
          onClose={() => setGrupoAberto(null)}
          onSalvo={() => { setGrupoAberto(null); void recarregar(); }}
        />
      )}
    </PageShell>
  );
}

/* ------------------------------------------------------------------------------------------------ */

function Popup({ titulo, subtitulo, largura = 520, onClose, children, rodape }: {
  titulo: string; subtitulo?: string; largura?: number; onClose: () => void; children: ReactNode; rodape?: ReactNode;
}) {
  return createPortal(
    <div className="no-print fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" />
      <div role="dialog" aria-label={titulo} style={{ maxWidth: largura }} className="relative w-full bg-surface rounded-card-lg shadow-modal border border-border p-6 max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onClose} title="Fechar" className="absolute right-3 top-3 rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5]">
          <IcFechar width={18} height={18} />
        </button>
        <h2 className="font-display text-lg font-bold pr-8">{titulo}</h2>
        {subtitulo && <p className="text-[13px] text-ink-2 mt-1">{subtitulo}</p>}
        <div className="mt-4">{children}</div>
        {rodape && <div className="mt-5 flex justify-end gap-2">{rodape}</div>}
      </div>
    </div>,
    document.body,
  );
}

const Erro = ({ texto }: { texto?: string }) => (texto ? <p className="mt-1 text-[12px] font-semibold text-danger">{texto}</p> : null);

function CampoSenha({ senha, setSenha }: { senha: string; setSenha: (s: string) => void }) {
  const motivo = senha ? motivoDaSenhaInvalida(senha) : null;
  return (
    <div>
      <div className="flex gap-2">
        <Input type="text" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" placeholder="Digite ou gere uma senha" />
        <Button type="button" variant="secondary" onClick={() => setSenha(gerarSenha())}>Gerar</Button>
      </div>
      <p className="mt-1 text-[12px] text-ink-3">Mínimo de 8 caracteres, com letra e número. É provisória: a pessoa troca no primeiro acesso.</p>
      <Erro texto={motivo ?? undefined} />
    </div>
  );
}

function NovoUsuario({ grupos, onClose, onCriado }: { grupos: GrupoAcesso[]; onClose: () => void; onCriado: () => void }) {
  const [passo, setPasso] = useState<"dados" | "senha" | "pronto">("dados");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [setor, setSetor] = useState("");
  const [cargo, setCargo] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [senha, setSenha] = useState("");
  const [erros, setErros] = useState<ErrosDosDados>({});
  const [enviando, setEnviando] = useState(false);

  async function continuar() {
    const e = errosDosDados({ nome, email, cpf, grupoId: grupoId || null });
    setErros(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    try {
      const dup = errosDeDuplicidade(await conferirDuplicidade(email, cpf));
      setErros(dup);
      if (!Object.keys(dup).length) setPasso("senha");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível conferir os dados.", "danger");
    } finally {
      setEnviando(false);
    }
  }

  async function criar() {
    if (motivoDaSenhaInvalida(senha)) return;
    setEnviando(true);
    try {
      await criarUsuario({ origem: "avulso", nome: nome.trim(), email: email.trim(), cpf, cargo: cargo.trim(), setor: setor.trim(), senha, grupoId });
      setPasso("pronto");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível cadastrar o usuário.";
      if (err instanceof ErroDaEdge && (err.codigo === "EMAIL_DUPLICADO" || err.codigo === "CPF_DUPLICADO")) {
        setErros(err.codigo === "EMAIL_DUPLICADO" ? { email: msg } : { cpf: msg });
        setPasso("dados");
      } else {
        toast(msg, "danger");
      }
    } finally {
      setEnviando(false);
    }
  }

  if (passo === "pronto") {
    return (
      <Popup titulo="Usuário cadastrado" onClose={onCriado} rodape={<Button onClick={onCriado}>Concluir</Button>}>
        <p className="text-[13px] text-ink-2">Passe à pessoa o login e a senha abaixo. A senha aparece só agora e é provisória: no primeiro acesso o app pede uma nova.</p>
        <div className="mt-3 rounded-btn bg-[#F5F6F8] p-3 text-[13px]">
          <div><b>Login:</b> {email.trim().toLowerCase()}</div>
          <div><b>Senha:</b> <span className="font-mono select-all">{senha}</span></div>
        </div>
      </Popup>
    );
  }
  if (passo === "senha") {
    return (
      <Popup titulo="Login e senha" subtitulo={nome} onClose={onClose}
        rodape={<><Button variant="secondary" onClick={() => setPasso("dados")} disabled={enviando}>Voltar</Button><Button onClick={() => void criar()} disabled={enviando || !!motivoDaSenhaInvalida(senha)}>{enviando ? "Cadastrando…" : "Cadastrar"}</Button></>}>
        <Field label="Login" className="mb-4"><Input value={email.trim().toLowerCase()} disabled /></Field>
        <Field label="Senha inicial" obrigatorio><CampoSenha senha={senha} setSenha={setSenha} /></Field>
      </Popup>
    );
  }
  return (
    <Popup titulo="Novo usuário" subtitulo="Dados do usuário" onClose={onClose} largura={560}
      rodape={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => void continuar()} disabled={enviando}>{enviando ? "Conferindo…" : "Continuar"}</Button></>}>
      <div className="grid gap-3">
        <Field label="Nome" obrigatorio><Input value={nome} onChange={(e) => setNome(e.target.value)} /><Erro texto={erros.nome} /></Field>
        <Field label="E-mail corporativo" obrigatorio><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /><Erro texto={erros.email} /></Field>
        <Field label="CPF" obrigatorio><Input inputMode="numeric" value={cpf} onChange={(e) => setCpf(formatarCpf(e.target.value))} placeholder="000.000.000-00" /><Erro texto={erros.cpf} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Setor"><Input value={setor} onChange={(e) => setSetor(e.target.value)} /></Field>
          <Field label="Cargo/função"><Input value={cargo} onChange={(e) => setCargo(e.target.value)} /></Field>
        </div>
        <Field label="Grupo de permissão" obrigatorio>
          <Select value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
            <option value="">Escolha o grupo</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </Select>
          <Erro texto={erros.grupo} />
        </Field>
      </div>
    </Popup>
  );
}

function EditarUsuario({ usuario, grupos, onClose, onSalvo }: { usuario: UsuarioDoAcesso; grupos: GrupoAcesso[]; onClose: () => void; onSalvo: () => void }) {
  const liberar = usuario.status === "pendente";
  const [nome, setNome] = useState(usuario.nome);
  const [setor, setSetor] = useState(usuario.setor);
  const [cargo, setCargo] = useState(usuario.cargo);
  const [grupoId, setGrupoId] = useState(usuario.grupoId ?? "");
  const [cpf, setCpf] = useState("");
  const [novaSenha, setNovaSenha] = useState<string | null>(null);
  const [erroCpf, setErroCpf] = useState("");
  const [enviando, setEnviando] = useState(false);
  const opcoes = grupos.some((g) => g.id === usuario.grupoId) || !usuario.grupoId ? grupos : [...grupos];

  async function salvar() {
    if (cpf) {
      const m = motivoDoCpfInvalido(cpf);
      if (m) { setErroCpf(m); return; }
      if (!usuario.cpfMascarado || cpf) {
        const dup = errosDeDuplicidade(await conferirDuplicidade("", cpf, usuario.id));
        if (dup.cpf) { setErroCpf(dup.cpf); return; }
      }
    }
    if (liberar && !grupoId) { toast("Escolha o grupo de permissão para liberar o acesso.", "warning"); return; }
    if (novaSenha !== null && motivoDaSenhaInvalida(novaSenha)) return;
    setEnviando(true);
    try {
      await definirAcessoDoUsuario({
        usuarioId: usuario.id,
        grupoId: grupoId && grupoId !== usuario.grupoId ? grupoId : null,
        status: liberar ? "ativo" : undefined,
        nome: nome.trim() !== usuario.nome ? nome.trim() : null,
        setor: setor.trim() !== usuario.setor ? setor.trim() : null,
        cargo: cargo.trim() !== usuario.cargo ? cargo.trim() : null,
        cpf: cpf || null,
      });
      if (novaSenha) await definirSenha(usuario.id, novaSenha);
      toast(novaSenha ? `Salvo. Nova senha provisória: ${novaSenha}` : "Usuário salvo.", "success");
      onSalvo();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível salvar.", "danger");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Popup titulo={liberar ? "Liberar acesso" : "Editar usuário"} subtitulo={usuario.email} onClose={onClose} largura={560}
      rodape={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => void salvar()} disabled={enviando}>{enviando ? "Salvando…" : "Salvar"}</Button></>}>
      <div className="grid gap-3">
        <Field label="Nome" obrigatorio><Input value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Setor"><Input value={setor} onChange={(e) => setSetor(e.target.value)} /></Field>
          <Field label="Cargo/função"><Input value={cargo} onChange={(e) => setCargo(e.target.value)} /></Field>
        </div>
        <Field label="Grupo de permissão" obrigatorio>
          <Select value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
            {!grupoId && <option value="">Escolha o grupo</option>}
            {usuario.grupoId && !opcoes.some((g) => g.id === usuario.grupoId) && <option value={usuario.grupoId}>(grupo atual)</option>}
            {opcoes.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </Select>
        </Field>
        <Field label={usuario.cpfMascarado ? `CPF (atual: ${usuario.cpfMascarado})` : "CPF (ainda não informado)"}>
          <Input inputMode="numeric" value={cpf} onChange={(e) => { setCpf(formatarCpf(e.target.value)); setErroCpf(""); }} placeholder={usuario.cpfMascarado ? "Alterar CPF" : "000.000.000-00"} />
          <Erro texto={erroCpf} />
        </Field>
        {novaSenha === null ? (
          <div><Button size="sm" variant="secondary" onClick={() => setNovaSenha(gerarSenha())}>Definir nova senha</Button></div>
        ) : (
          <Field label="Nova senha (provisória)"><CampoSenha senha={novaSenha} setSenha={setNovaSenha} /></Field>
        )}
      </div>
    </Popup>
  );
}

function DetalhesUsuario({ usuario, grupo, onClose }: { usuario: UsuarioDoAcesso; grupo: string; onClose: () => void }) {
  const linha = (rotulo: string, valor: string) => (
    <div><div className="text-[11px] font-bold uppercase tracking-wide text-ink-3">{rotulo}</div><div className="text-[13px] text-ink">{valor || "—"}</div></div>
  );
  return (
    <Popup titulo="Detalhes do usuário" subtitulo={usuario.nome} onClose={onClose} rodape={<Button onClick={onClose}>Fechar</Button>}>
      <div className="grid grid-cols-2 gap-3">
        {linha("E-mail", usuario.email)}
        {linha("CPF", usuario.cpfMascarado)}
        {linha("Grupo de permissão", grupo)}
        {linha("Status", ROTULO_STATUS[usuario.status])}
        {linha("Setor", usuario.setor)}
        {linha("Cargo/função", usuario.cargo)}
        {linha("Senha", usuario.senhaProvisoria ? "Provisória (ainda não trocada)" : "Definida pela pessoa")}
        {linha("Último acesso", usuario.ultimoAcesso ? dataHoraBR(usuario.ultimoAcesso) : "")}
      </div>
    </Popup>
  );
}

function GrupoPopup({ grupo, somenteLeitura, eu, onClose, onSalvo }: {
  grupo: GrupoAcesso | null; somenteLeitura: boolean; eu: { sistema: boolean; papel: string; permissoes: Permissao[] };
  onClose: () => void; onSalvo: () => void;
}) {
  const [nome, setNome] = useState(grupo?.nome ?? "");
  const [descricao, setDescricao] = useState(grupo?.descricao ?? "");
  const [nivel, setNivel] = useState<"Direcao" | "Producao" | "Administrativo">(
    grupo && grupo.papelBase !== "Admin" ? grupo.papelBase : "Producao",
  );
  const [ativo, setAtivo] = useState(grupo?.ativo ?? true);
  const [permissoes, setPermissoes] = useState<Permissao[]>(grupo?.permissoes ?? []);
  const [enviando, setEnviando] = useState(false);
  const niveis = (["Producao", "Direcao", "Administrativo"] as const).filter((n) => eu.sistema || n === "Producao" || n === eu.papel || n === grupo?.papelBase);
  const alcanco = (tela: string, acao: string) => eu.sistema || podePermissao(eu.permissoes, tela, acao);

  async function salvar() {
    setEnviando(true);
    try {
      await salvarGrupo({ id: grupo?.id, nome: nome.trim(), descricao: descricao.trim(), ativo, papel_base: nivel, permissoes: permissoesValidas(permissoes) });
      toast("Grupo salvo.", "success");
      onSalvo();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível salvar o grupo.", "danger");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Popup titulo={grupo ? (somenteLeitura ? grupo.nome : "Editar grupo") : "Novo grupo"} onClose={onClose} largura={880}
      rodape={somenteLeitura ? <Button onClick={onClose}>Fechar</Button> : <><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => void salvar()} disabled={enviando || nome.trim().length < 2}>{enviando ? "Salvando…" : "Salvar"}</Button></>}>
      <fieldset disabled={somenteLeitura} className="min-w-0 border-0 p-0 m-0">
        <div className="grid grid-cols-[1fr_200px] gap-3">
          <Field label="Nome do grupo" obrigatorio><Input value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
          <Field label="Nível (papel no banco)">
            <Select value={grupo?.sistema ? "Admin" : nivel} onChange={(e) => setNivel(e.target.value as typeof nivel)}>
              {grupo?.sistema ? <option value="Admin">Administrador</option> : niveis.map((n) => <option key={n} value={n}>{ROTULO_NIVEL[n]}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Descrição" className="mt-3"><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Field>
        {grupo && !grupo.sistema && (
          <label className="mt-3 flex items-center gap-2 text-[13px]"><Toggle checked={ativo} onChange={setAtivo} /> Grupo ativo</label>
        )}
        {grupo?.sistema ? (
          <p className="mt-4 text-[13px] text-ink-2">O Administrador de sistema libera tudo, inclusive Acessos e Logs. Não se renomeia, não se inativa e nunca fica sem usuário ativo.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {CATALOGO.map((m) => {
              const ligado = moduloTemPermissao(permissoes, m.id);
              return (
                <div key={m.id} className="rounded-card border border-border">
                  <div className="flex items-center justify-between px-3 py-2 bg-[#F7F8FA] rounded-t-card">
                    <div className="font-bold text-[13.5px]">{m.rotulo}</div>
                    <label className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-2">
                      Acesso ao módulo <Toggle checked={ligado} onChange={(v) => setPermissoes((p) => alternarModulo(p, m.id, v))} />
                    </label>
                  </div>
                  {ligado && (
                    <div className="divide-y divide-border">
                      {m.telas.map((t) => (
                        <div key={t.chave} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                          <div className="w-[200px] text-[13px] font-semibold">{t.rotulo}</div>
                          {acoesDaTela(t).map((acao) => {
                            const rotulo = t.acoes.includes(acao as never) ? { ver: "Ver", criar: "Criar", editar: "Editar", inativar: "Inativar" }[acao] : t.extras?.find((x) => x.chave === acao)?.rotulo;
                            const marcado = podePermissao(permissoes, t.chave, acao);
                            const fora = !alcanco(t.chave, acao);
                            return (
                              <label key={acao} className={`flex items-center gap-1.5 text-[12.5px] ${fora ? "opacity-40" : ""}`} title={fora ? "Você só pode conceder o que você mesmo tem." : undefined}>
                                <input type="checkbox" className="w-[15px] h-[15px] accent-[#F2820D]" checked={marcado} disabled={fora && !marcado}
                                  onChange={(e) => setPermissoes((p) => alternarAcao(p, t.chave, acao, e.target.checked))} />
                                {rotulo}
                              </label>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </fieldset>
    </Popup>
  );
}
