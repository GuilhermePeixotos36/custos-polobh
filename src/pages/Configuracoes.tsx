import { useEffect, useState } from "react";
import { useAvisoDeSaida } from "@/hooks/useAvisoDeSaida";
import { ChecklistModelosCard } from "@/components/ChecklistModelosCard";
import { ConsumoIaCard } from "@/components/ConsumoIaCard";
import { AvisosNoAparelho } from "@/components/AvisosNoAparelho";
import { gravarTestemunhasDaCasa, testemunhasDaCasa } from "@/lib/contratoPdf";
import { TESTEMUNHAS_PADRAO, type TestemunhaFixa } from "@/domain/testemunhasContrato";
import { maskCpfCnpjInput } from "@/lib/format";
import { ManutencaoDevCard } from "@/components/ManutencaoDevCard";
import { createPortal } from "react-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { BarraConfiguracoes, useSecaoConfig } from "@/components/layout/BarraSecao";
import { NAV_CONFIG } from "@/components/layout/nav";
import { Card, CardTitle, Toggle, Badge, Field, Input, Textarea, TelefoneInput, Select, Button, Table, THead, Th, Tr, Td, EmptyState, CarregandoTela } from "@/components/ui";
import { IcPlus, IcPencil, IcTrash, IcBloqueio, IcFechar, IcCheck } from "@/components/icons";
import { ROTULO_PAPEL, PAPEIS_AREA, TELAS, PERMISSOES_ESPECIAIS, useAuth, type Recurso } from "@/store/auth";
import { useEmpresas } from "@/store/empresas";
import { useConfigApp } from "@/store/configApp";
import { useAsync } from "@/hooks/useAsync";
import { repo } from "@/data";
import { gravarResponsavelFeriados, lerFeriados, lerResponsavelFeriados, salvarFeriadosMunicipais } from "@/lib/feriados";
import { idAncoraPendencia } from "@/lib/destaque";
import { feriadosVazios, responsavelPadraoDosFeriados, type Feriado } from "@/domain/feriados";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { cx } from "@/lib/format";
import {
  motivoParaNaoMudar,
  podeAtivarUsuarios,
  quantosPodemAtivar,
} from "@/domain/usuarioAtivo";
import {
  CONFIG_BACKUP_PADRAO,
  OPCOES_FREQUENCIA,
  formatarTamanho,
  haQuantoTempo,
  lerDestinatarios,
  podeTirarBackup,
  situacaoDoBackup,
  type ConfigBackup,
  type Frequencia,
} from "@/domain/backup";
import { baixarArquivoBase64 } from "@/lib/backup/baixar";
import type { Area, Papel, Usuario } from "@/data/types";

type AbaConfig = "geral" | "checklist" | "areas" | "usuarios" | "backup" | "ia";

/**
 * A aba vem da URL (`?aba=`), e não de estado solto: a barra de Configurações
 * agora atravessa rotas — Agenda, Fornecedores e Logs são telas próprias que
 * moram nesta mesma barra (ver `BarraConfiguracoes`). Sem a URL mandar, voltar
 * de uma delas cairia sempre em "Geral".
 */
export function Configuracoes() {
  const pode = useAuth((s) => s.pode);
  const pedida = useSecaoConfig() as AbaConfig;
  // A rota abre para quem tem `configuracoes` OU só a lista padrão do check-list
  // (a Coordenação). Quem não pode ver a seção pedida na URL cai na primeira que
  // pode — sem isto, abrir ?aba=usuarios à mão mostraria a seção inteira.
  const permitidas = NAV_CONFIG.filter((s) => s.rota.startsWith("/configuracoes") && (!s.recurso || pode(s.recurso) || !!s.ou?.some(pode)));
  const aba = (permitidas.some((s) => s.key === pedida) ? pedida : permitidas[0]?.key ?? "geral") as AbaConfig;
  const [retencao, setRetencao] = useState(24);
  const [arquivamentoAuto, setArquivamentoAuto] = useState(true);

  return (
    <PageShell
      title="Configurações"
      subtitle="Empresas de emissão, áreas de acesso, usuários, agenda, fornecedores e logs."
      // Gruda com o cabeçalho, como nas demais telas com subabas.
      subabas={<BarraConfiguracoes atual={aba} />}
    >
      {aba === "geral" && (
        <div className="space-y-4">
          <EmpresasGrupoCard />

          <TestemunhasContratoCard />

          <NotificacoesCard />

          <HelpDeskCard />

          <FeriadosCard />

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

          {/* Só o desenvolvedor (papel Admin) enxerga — para os demais não renderiza nada. */}
          <ManutencaoDevCard />
        </div>
      )}

      {aba === "checklist" && <ChecklistModelosCard />}

      {aba === "areas" && <AreasCard />}
      {aba === "usuarios" && <UsuariosCard />}
      {aba === "backup" && <BackupCard />}
      {aba === "ia" && <ConsumoIaCard />}
    </PageShell>
  );
}

/**
 * Notificações do sistema — a do canto do Windows, a da barra do celular.
 *
 * A permissão mora AQUI, atrás de um clique, e não no carregamento do app: os
 * navegadores só aceitam o pedido a partir de um gesto da pessoa e, quando o
 * site tenta sozinho, o Chrome bloqueia o pedido de vez. Uma tentativa mal
 * colocada custaria a permissão para sempre naquele navegador.
 *
 * A permissão é por NAVEGADOR e por aparelho: quem usa no computador e no
 * celular precisa autorizar nos dois, e é isso que o texto explica.
 */
function NotificacoesCard() {
  return (
    <Card>
      <CardTitle hint="Avisos fora do app: a notificação do Windows e a da barra do celular">
        Notificações no aparelho
      </CardTitle>
      <AvisosNoAparelho />
    </Card>
  );
}

/**
 * As TESTEMUNHAS FIXAS dos contratos (11/11/2026): o Tiago e a Viviane assinam
 * todos os contratos, então os dados deles moram aqui, uma vez, e não em cada
 * OS. Só quem administra grava (a mesma regra dos demais ajustes da casa).
 */
function TestemunhasContratoCard() {
  const [lista, setLista] = useState<TestemunhaFixa[]>(TESTEMUNHAS_PADRAO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void testemunhasDaCasa().then(setLista);
  }, []);

  const editar = (i: number, patch: Partial<TestemunhaFixa>) =>
    setLista((l) => l.map((t, k) => (k === i ? { ...t, ...patch } : t)));

  async function salvar() {
    setSalvando(true);
    try {
      await gravarTestemunhasDaCasa(lista);
      toast("Testemunhas dos contratos salvas.", "success");
    } catch (e) {
      toast(`Não foi possível salvar: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card>
      <CardTitle hint="Assinam todos os contratos gerados pelo sistema — não é preciso preencher em cada OS">
        Testemunhas dos contratos
      </CardTitle>
      <div className="grid md:grid-cols-2 gap-4">
        {lista.map((t, i) => (
          <div key={i} className="space-y-2">
            <Field label={`Testemunha ${i + 1} — nome`}>
              <Input formato="titulo" value={t.nome} onChange={(e) => editar(i, { nome: e.target.value })} />
            </Field>
            <Field label="CPF">
              <Input value={t.cpf} onChange={(e) => editar(i, { cpf: maskCpfCnpjInput(e.target.value) })} inputMode="numeric" placeholder="000.000.000-00" />
            </Field>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <Button size="sm" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar testemunhas"}
        </Button>
      </div>
    </Card>
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
                <Field label="Telefone (entra no contrato, na qualificação do Contratante)">
                  <TelefoneInput value={e.telefone ?? ""} onChange={(v) => editar(e.id, { telefone: v })} />
                  <button type="button" className="mt-1 text-[11.5px] font-bold text-primary-dark hover:underline" onClick={() => salvar(e.id)}>
                    Salvar telefone
                  </button>
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

/* ------------------------------- Feriados -------------------------------- */

/**
 * Os feriados MUNICIPAIS de Belo Horizonte, lançados à mão.
 *
 * A pergunta da Pólobh foi "qual seria a nossa fonte oficial?", e a resposta
 * honesta tem duas partes: os NACIONAIS vêm da BrasilAPI, sozinhos, inclusive
 * as datas móveis; os MUNICIPAIS não têm fonte oficial em formato de dados —
 * eles saem de lei municipal, e o que circula na internet são listas de
 * terceiros que ninguém garante.
 *
 * Então eles são lançados aqui, uma vez por ano, por quem administra. É pouco
 * trabalho (são três ou quatro datas) e é a única forma de o quadro não mentir:
 * um feriado municipal errado é uma montagem marcada num dia em que a cidade
 * para.
 */
function FeriadosCard() {
  const anoAtual = new Date().getFullYear();
  // Em janeiro a tela abre no ano SEGUINTE — é o que o lembrete cobra.
  const [ano, setAno] = useState(new Date().getMonth() === 0 ? anoAtual + 1 : anoAtual);
  const { data, loading, reload } = useAsync(() => lerFeriados(), []);
  const [rascunho, setRascunho] = useState<Feriado[] | null>(null);
  useAvisoDeSaida(rascunho);
  const { data: usuarios } = useAsync(() => repo.auth.usuarios().catch(() => [] as Usuario[]), []);
  const { data: escolhido, reload: recarregarResponsavel } = useAsync(() => lerResponsavelFeriados(), []);
  const ativos = (usuarios ?? []).filter((u) => u.ativo !== false);
  // Sem escolha, o padrão é o Tiago (financeiro) — a tela mostra quem é.
  const responsavel = escolhido || responsavelPadraoDosFeriados(ativos);

  async function trocarResponsavel(nome: string) {
    try {
      await gravarResponsavelFeriados(nome);
      recarregarResponsavel();
      toast("Responsável pelo lembrete de janeiro atualizado.", "success");
    } catch (e) {
      toast(`Não foi possível salvar: ${(e as Error).message}`, "danger");
    }
  }

  const guardados = data ?? feriadosVazios();
  const municipais = rascunho ?? guardados.municipais[String(ano)] ?? [];
  const nacionais = guardados.nacionais[String(ano)] ?? [];

  const mudar = (i: number, patch: Partial<Feriado>) =>
    setRascunho(municipais.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  async function salvar() {
    try {
      await salvarFeriadosMunicipais(ano, municipais.filter((f) => f.data));
      setRascunho(null);
      reload();
      toast("Feriados salvos.", "success");
    } catch (e) {
      toast(`Não foi possível salvar: ${(e as Error).message}`, "danger");
    }
  }

  return (
    <Card>
      <div id={idAncoraPendencia("feriados-do-calendario")}>
      <CardTitle hint="Os nacionais vêm sozinhos da BrasilAPI; os municipais de BH não têm fonte oficial em dados e são lançados aqui">
        Feriados do calendário
      </CardTitle>

      {/* Todo mês de janeiro o sistema cria uma pendência para esta pessoa
          lançar os feriados municipais do ANO SEGUINTE; ela some quando o ano
          tem feriado lançado. Quem administra (Admin, Direção, Coordenação,
          Financeiro) escolhe quem recebe. */}
      <Field label="Quem recebe o lembrete de janeiro" className="max-w-[22rem] mb-3">
        <Select value={responsavel} onChange={(e) => void trocarResponsavel(e.target.value)}>
          <option value="">Ninguém</option>
          {ativos.map((u) => (
            <option key={u.id} value={u.nome}>{u.nome}</option>
          ))}
        </Select>
      </Field>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Field label="Ano" className="max-w-[8rem]">
          <Input
            type="number"
            value={ano}
            onChange={(e) => { setAno(Number(e.target.value) || anoAtual); setRascunho(null); }}
          />
        </Field>
        <span className="text-[12.5px] text-ink-3 self-end pb-2">
          {loading ? "Carregando…" : `${nacionais.length} feriado(s) nacional(is) já no sistema`}
        </span>
      </div>

      <div className="space-y-2">
        {municipais.map((f, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <Input
              type="date"
              className="max-w-[11rem]"
              value={f.data}
              onChange={(e) => mudar(i, { data: e.target.value })}
              aria-label="Data do feriado"
            />
            <Input
              className="flex-1 min-w-[14rem]"
              value={f.nome}
              placeholder="Nome do feriado (ex.: Nossa Senhora da Conceição)"
              onChange={(e) => mudar(i, { nome: e.target.value })}
              aria-label="Nome do feriado"
            />
            <button
              type="button"
              className="text-ink-3 hover:text-danger px-2"
              onClick={() => setRascunho(municipais.filter((_, j) => j !== i))}
              aria-label="Remover feriado"
            >
              ✕
            </button>
          </div>
        ))}
        {municipais.length === 0 && (
          <p className="text-[12.5px] text-ink-3">Nenhum feriado municipal lançado para {ano}.</p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<IcPlus width={15} height={15} />}
          onClick={() => setRascunho([...municipais, { data: "", nome: "", origem: "municipal" }])}
        >
          Feriado municipal
        </Button>
        <Button size="sm" disabled={!rascunho} onClick={() => void salvar()}>
          Salvar feriados
        </Button>
      </div>
      </div>
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
  useAvisoDeSaida(form, editando);

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
                {salvando && <CarregandoTela />}
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
            <Field label="Nome da área" obrigatorio>
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
  useAvisoDeSaida(edit);
  const [salvando, setSalvando] = useState(false);
  /** Qual linha está no meio da troca — para travar só o botão dela. */
  const [alterando, setAlterando] = useState<string | null>(null);
  const usuarioAtual = useAuth((st) => st.usuario);
  const podeAtivar = podeAtivarUsuarios(usuarioAtual?.papel);

  const lista = data ?? [];

  /**
   * Liga e desliga o acesso de alguém.
   *
   * A confirmação existe porque inativar derruba a sessão da pessoa na hora —
   * quem está com a tela aberta perde o acesso no comando seguinte, e isso não
   * pode acontecer por um clique errado numa lista.
   */
  async function alternarAcesso(u: Usuario) {
    const ativo = !(u.ativo ?? true);
    if (!ativo && !(await confirmar({
      titulo: `Inativar ${u.nome}?`,
      mensagem:
        "O acesso é cortado imediatamente, inclusive se a pessoa estiver com o sistema aberto. " +
        "O histórico é preservado — inativar não é apagar.",
      confirmarTexto: "Inativar",
      cancelarTexto: "Voltar",
    }))) return;
    setAlterando(u.id);
    try {
      await repo.auth.definirUsuarioAtivo({ id: u.id, ativo });
      toast(ativo ? `${u.nome} voltou a ter acesso.` : `${u.nome} está sem acesso.`, "success");
      reload();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setAlterando(null);
    }
  }

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
            <THead>
              <Th>Nome</Th><Th>E-mail</Th><Th>Telefone</Th>
              <Th align="center">Área</Th><Th align="center">Acesso</Th>
              {podeAtivar && <Th align="center">Ações</Th>}
            </THead>
            <tbody>
              {lista.map((u) => {
                const ativo = u.ativo ?? true;
                const impedimento = motivoParaNaoMudar(
                  { id: usuarioAtual?.id ?? "", papel: usuarioAtual?.papel ?? "Producao" },
                  { id: u.id, papel: u.papel, ativo },
                  quantosPodemAtivar(lista)
                );
                return (
                <Tr key={u.id} onClick={() => setEdit({ ...u })}>
                  <Td className={cx("font-bold", !ativo && "text-ink-3")}>{u.nome}</Td>
                  <Td className={cx("text-[12.5px]", !ativo && "text-ink-3")}>{u.email || "—"}</Td>
                  <Td className="text-[12.5px]">{u.telefone || "—"}</Td>
                  {/* Sem área é o caso do desenvolvedor (papel Admin) — não é uma área, é a ausência dela. */}
                  <Td align="center">
                    {u.areaNome ? <Badge tom="info">{u.areaNome}</Badge> : <span className="text-ink-3">—</span>}
                  </Td>
                  <Td align="center">
                    <Badge tom={ativo ? "success" : "danger"}>{ativo ? "Ativo" : "Inativo"}</Badge>
                  </Td>
                  {podeAtivar && (
                    <Td align="center">
                      {/* O botão some quando a mudança é impossível, e o motivo
                          vira o título — um botão que falha em silêncio faz a
                          pessoa tentar de novo e abrir chamado. */}
                      <button
                        type="button"
                        disabled={!!impedimento || alterando === u.id}
                        title={impedimento ?? (ativo ? "Tira o acesso, preservando o histórico" : "Devolve o acesso")}
                        onClick={(e) => { e.stopPropagation(); void alternarAcesso(u); }}
                        className={cx(
                          "text-[12px] font-bold rounded px-2 py-1 input-focus",
                          impedimento ? "text-ink-3 cursor-not-allowed" : ativo ? "text-danger hover:underline" : "text-success hover:underline"
                        )}
                      >
                        {alterando === u.id ? "…" : ativo ? "Inativar" : "Ativar"}
                      </button>
                    </Td>
                  )}
                </Tr>
                );
              })}
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
            <Field label="Nome" obrigatorio><Input formato="titulo" value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></Field>
            <Field label="E-mail" obrigatorio><Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="nome@polobh.com.br" /></Field>
            <Field label="Telefone"><TelefoneInput value={edit.telefone} onChange={(v) => setEdit({ ...edit, telefone: v })} /></Field>
            <Field label="Área" hint="Define as telas que este usuário enxerga e edita" obrigatorio={edit.papel !== "Admin"}>
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
              {salvando && <CarregandoTela />}
              <Button block onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
              <Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * Para onde vai o chamado do Help Desk (o quinto botão do cabeçalho).
 *
 * Fica em Configurações, e não numa variável de ambiente, porque trocar quem
 * atende o suporte não pode depender de publicar versão nova do aplicativo.
 */
function HelpDeskCard() {
  const { helpdesk, carregado, carregar, gravarHelpDesk } = useConfigApp();
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (carregado) setEmail(helpdesk.email); }, [carregado, helpdesk.email]);

  /** Endereço inválido gravado aqui derruba TODO chamado, calado. */
  async function gravar() {
    const limpo = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpo)) {
      setErro("Informe um e-mail válido — é para cá que vão todos os chamados.");
      return;
    }
    setErro("");
    if (limpo === helpdesk.email) return;
    try {
      await gravarHelpDesk({ email: limpo });
      toast("Endereço do Help Desk atualizado.", "success");
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <Card>
      <CardTitle hint="Quem recebe os chamados abertos pelo botão Help Desk. A resposta volta para quem abriu.">
        Help Desk
      </CardTitle>
      <Field label="E-mail do suporte" obrigatorio>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={gravar}
          placeholder="suporte@exemplo.com.br"
        />
      </Field>
      {erro && <p className="mt-1.5 text-[12.5px] font-semibold text-danger">{erro}</p>}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Back-up                                   */
/* -------------------------------------------------------------------------- */

/**
 * O back-up do sistema — e, antes dele, a explicação de por que ele existe.
 *
 * O texto didático não é enfeite. A pergunta da Pólobh foi "qual a frequência
 * do back-up e como teremos acesso a ele", e responder só com um seletor de
 * frequência deixaria de fora o que importa: o banco de dados JÁ tem back-up
 * próprio, e ele é curto e fica na mesma conta. Sem essa parte, alguém lê
 * "Back-up: semanal" e conclui que está protegido contra coisas contra as quais
 * não está. A tela explica o limite e mostra o que a casa faz para supri-lo.
 *
 * Quem TIRA um back-up é Admin e Direção — mais estreito que esta tela, porque
 * o pacote leva a base inteira, financeiro incluído. O Administrativo entra
 * aqui, lê a explicação e vê o histórico; os botões ficam desligados para ele.
 */
function BackupCard() {
  const papel = useAuth((s) => s.usuario?.papel);
  const podeMexer = podeTirarBackup(papel);

  const [config, setConfig] = useState<ConfigBackup>(CONFIG_BACKUP_PADRAO);
  const [destinatarios, setDestinatarios] = useState("");
  const [carregado, setCarregado] = useState(false);
  const [ocupado, setOcupado] = useState<"" | "baixar" | "enviar">("");

  const historico = useAsync(() => repo.backup.historico(20), [], { oQue: "o histórico de back-up" });

  useEffect(() => {
    let vivo = true;
    repo.config
      .ler<Partial<ConfigBackup>>("backup")
      .then((v) => {
        if (!vivo) return;
        const lido = { ...CONFIG_BACKUP_PADRAO, ...(v ?? {}) };
        setConfig(lido);
        setDestinatarios(lido.destinatarios.join(", "));
        setCarregado(true);
      })
      .catch(() => setCarregado(true));
    return () => { vivo = false; };
  }, []);

  const ultimo = historico.data?.find((b) => b.status !== "erro");
  const situacao = situacaoDoBackup(config.frequencia, ultimo ? new Date(ultimo.criadoEm) : null);

  async function gravar(patch: Partial<ConfigBackup>) {
    const novo = { ...config, ...patch };
    setConfig(novo);
    try {
      await repo.config.gravar("backup", novo);
    } catch (e) {
      toast((e as Error).message, "danger");
    }
  }

  /** Os endereços só gravam quando saem do campo — digitar não pode gravar a cada tecla. */
  async function gravarDestinatarios() {
    const { validos, invalidos } = lerDestinatarios(destinatarios);
    if (invalidos.length) {
      // Recusar tudo é deliberado: gravar só os válidos faria o endereço com
      // erro de digitação sumir, e o back-up passaria meses indo para uma
      // pessoa a menos sem ninguém notar.
      toast(`Endereço inválido: ${invalidos.join(", ")}. Corrija para gravar.`, "danger");
      return;
    }
    setDestinatarios(validos.join(", "));
    if (validos.join() === config.destinatarios.join()) return;
    await gravar({ destinatarios: validos });
    toast(validos.length ? "Destinatários do back-up atualizados." : "Envio por e-mail desligado.", "success");
  }

  async function baixarAgora() {
    setOcupado("baixar");
    try {
      const r = await repo.backup.baixar();
      baixarArquivoBase64(r.nome, r.zipBase64);
      toast(`Back-up gerado (${formatarTamanho(r.tamanho)}).`, "success");
      historico.reload();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setOcupado("");
    }
  }

  async function enviarAgora() {
    if (!config.destinatarios.length && !config.dropbox) {
      toast("Configure ao menos um destino: um e-mail ou o Dropbox.", "danger");
      return;
    }
    setOcupado("enviar");
    try {
      const r = await repo.backup.enviarAgora();
      toast(
        r.erro
          ? `Back-up gerado com ressalva: ${r.erro}`
          : `Back-up enviado (${r.destinos.join(", ")}, ${formatarTamanho(r.tamanho)}).`,
        r.erro ? "danger" : "success",
      );
      historico.reload();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setOcupado("");
    }
  }

  return (
    <div className="space-y-4">
      <ComoFuncionaOBackup />

      <Card>
        <CardTitle hint="Uma cópia dos dados sai do servidor e vai para a mão da Pólobh.">
          Back-up automático
        </CardTitle>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SituacaoDoBackup situacao={situacao} />
          {ultimo && (
            <span className="text-[12.5px] text-ink-2">
              Último: {haQuantoTempo(new Date(ultimo.criadoEm))} · {formatarTamanho(ultimo.tamanhoBytes)}
              {ultimo.destinos.length ? ` · ${ultimo.destinos.join(", ")}` : ""}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <Field label="Com que frequência">
            <Select
              value={config.frequencia}
              disabled={!podeMexer || !carregado}
              onChange={(e) => gravar({ frequencia: e.target.value as Frequencia })}
            >
              {OPCOES_FREQUENCIA.map((o) => (
                <option key={o.valor} value={o.valor}>{o.rotulo}</option>
              ))}
            </Select>
          </Field>
          <p className="-mt-2 text-[12.5px] text-ink-2">
            {OPCOES_FREQUENCIA.find((o) => o.valor === config.frequencia)?.ajuda}
          </p>

          <Field label="Enviar por e-mail para">
            <Textarea
              rows={2}
              value={destinatarios}
              disabled={!podeMexer || !carregado}
              onChange={(e) => setDestinatarios(e.target.value)}
              onBlur={gravarDestinatarios}
              placeholder="direcao@polobh.com.br, ti@polobh.com.br"
            />
          </Field>
          <p className="-mt-2 text-[12.5px] text-ink-2">
            Separe por vírgula. Deixe vazio para não mandar e-mail. Pacotes muito grandes não cabem
            num e-mail — nesse caso a mensagem avisa e o arquivo fica no Dropbox ou no botão abaixo.
          </p>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-ink">Salvar também no Dropbox</span>
              <p className="text-[12.5px] text-ink-2">
                Guarda cada pacote numa pasta da Pólobh. Precisa de uma configuração única, feita
                pelo suporte — se estiver ligado e não configurado, o histórico abaixo acusa.
              </p>
            </div>
            <Toggle
              checked={config.dropbox}
              onChange={(v) => { if (podeMexer && carregado) void gravar({ dropbox: v }); }}
            />
          </div>

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button onClick={baixarAgora} disabled={!podeMexer || !!ocupado}>
              {ocupado === "baixar" ? "Gerando…" : "Baixar agora"}
            </Button>
            <Button variant="secondary" onClick={enviarAgora} disabled={!podeMexer || !!ocupado}>
              {ocupado === "enviar" ? "Enviando…" : "Enviar agora"}
            </Button>
          </div>
          {!podeMexer && (
            <p className="text-[12.5px] text-ink-2">
              Só a Direção e o Administrador tiram um back-up — o pacote leva a base inteira,
              inclusive o financeiro. Você pode acompanhar o histórico aqui.
            </p>
          )}
          <p className="text-[12.5px] text-ink-2">
            Gerar um back-up leva alguns instantes e não interrompe quem estiver usando o sistema.
          </p>
        </div>
      </Card>

      <Card>
        <CardTitle hint="Toda cópia que saiu do servidor fica registrada aqui.">Histórico</CardTitle>
        {!historico.data?.length ? (
          <EmptyState title="Nenhum back-up ainda" hint="Assim que o primeiro for gerado, ele aparece aqui." />
        ) : (
          <Table>
            <THead>
              <Th>Quando</Th>
              <Th>Origem</Th>
              <Th>Destino</Th>
              <Th>Tamanho</Th>
              <Th>Situação</Th>
            </THead>
            <tbody>
              {historico.data.map((b) => (
                <Tr key={b.id}>
                  <Td>
                    {new Date(b.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    <span className="block text-[11.5px] text-ink-2">{b.arquivo}</span>
                  </Td>
                  <Td>{b.origem === "manual" ? "Pedido na tela" : "Automático"}</Td>
                  <Td>{b.destinos.length ? b.destinos.join(", ") : "—"}</Td>
                  <Td>{formatarTamanho(b.tamanhoBytes)}</Td>
                  <Td>
                    <Badge tom={b.status === "concluido" ? "success" : b.status === "parcial" ? "warning" : "danger"}>
                      {b.status === "concluido" ? "Concluído" : b.status === "parcial" ? "Com ressalva" : "Falhou"}
                    </Badge>
                    {b.erro && <span className="block text-[11.5px] text-ink-2">{b.erro}</span>}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function SituacaoDoBackup({ situacao }: { situacao: ReturnType<typeof situacaoDoBackup> }) {
  if (situacao === "desligado") return <Badge tom="neutral">Automático desligado</Badge>;
  if (situacao === "nunca") return <Badge tom="warning">Nenhum back-up gerado ainda</Badge>;
  if (situacao === "atrasado") return <Badge tom="danger">Back-up atrasado</Badge>;
  return <Badge tom="success">Em dia</Badge>;
}

/**
 * A explicação, em português de gente.
 *
 * Fica ACIMA dos controles, e não escondida num "saiba mais", porque é a parte
 * que muda a decisão: quem entende que a cópia do servidor dura pouco e mora na
 * mesma conta escolhe uma frequência diferente de quem não entende.
 */
function ComoFuncionaOBackup() {
  return (
    <Card>
      <CardTitle hint="Leia uma vez. Explica o que o sistema faz sozinho e o que depende de vocês.">
        Como funciona a proteção dos dados
      </CardTitle>
      <div className="space-y-3 text-[13px] leading-relaxed text-ink">
        <p>
          Os dados do sistema ficam num banco de dados na nuvem (o <b>Supabase</b>). Ele faz
          back-up sozinho, todo dia, sem ninguém pedir — e isso resolve o acidente comum:
          alguém apagou um projeto sem querer e quer o de ontem de volta.
        </p>
        <p>
          <b>O que esse back-up de fábrica não resolve</b>, no plano que a Pólobh usa hoje:
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            <b>ele dura pouco.</b> A cópia fica disponível por poucos dias. Um erro descoberto
            dois meses depois já não tem de onde voltar;
          </li>
          <li>
            <b>ele mora na mesma conta.</b> Se o acesso à conta for perdido ou bloqueado, o
            back-up vai junto — é como guardar a chave reserva dentro de casa;
          </li>
          <li>
            <b>ninguém da Pólobh o pega sozinho.</b> Restaurar passa pelo painel técnico.
          </li>
        </ul>
        <p>
          <b>É isso que esta tela supre.</b> O sistema monta, na frequência escolhida, um arquivo
          único (<code>.zip</code>) com tudo — projetos, estimativas, ordens de serviço,
          fornecedores, check-lists, anexos — e o entrega <b>para fora do servidor</b>: no e-mail
          de quem vocês indicarem e/ou numa pasta do Dropbox da Pólobh. Qualquer pessoa da
          Direção também pode baixar um a qualquer momento, sem depender de ninguém.
        </p>
        <p>
          Dentro do arquivo há um <b>LEIA-ME</b> explicando o que tem, o que não tem e como
          restaurar. As planilhas vão em <code>.csv</code>, que abre no Excel — dá para conferir
          os dados sem ajuda técnica.
        </p>
        <div className="rounded-lg border border-line bg-surface-2 p-3">
          <p className="font-semibold">A recomendação, em uma linha</p>
          <p className="mt-1">
            Deixe o automático ligado (semanal já atende), aponte para um e-mail que alguém
            realmente lê, e guarde uma cópia por mês num HD ou pen drive fora da rede. Três
            cópias, dois lugares, uma fora do escritório.
          </p>
        </div>
        <p className="text-ink-2">
          Contratar o plano pago do Supabase somaria back-up diário com retenção maior e
          restauração para um ponto exato no tempo. É uma despesa mensal e uma decisão da
          Direção — o que esta tela faz não depende disso e continua valendo de qualquer forma.
        </p>
      </div>
    </Card>
  );
}
