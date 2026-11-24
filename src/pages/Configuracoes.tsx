import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAvisoDeSaida } from "@/hooks/useAvisoDeSaida";
import { EnderecoCampos } from "@/components/EnderecoCampos";
import { textoDoQueFalta, validarEndereco } from "@/domain/endereco";
import { ChecklistModelosCard } from "@/components/ChecklistModelosCard";
import { ConsumoIaCard } from "@/components/ConsumoIaCard";
import { ContratosModelosCard } from "@/components/ContratosModelosCard";
import { AvisosNoAparelho } from "@/components/AvisosNoAparelho";
import { gravarTestemunhasDaCasa, testemunhasDaCasa } from "@/lib/contratoPdf";
import { TESTEMUNHAS_PADRAO, type TestemunhaFixa } from "@/domain/testemunhasContrato";
import { maskCpfCnpjInput } from "@/lib/format";
import { ManutencaoDevCard } from "@/components/ManutencaoDevCard";
import { PageShell } from "@/components/layout/AppLayout";
import { BarraConfiguracoes, useSecaoConfig } from "@/components/layout/BarraSecao";
import { NAV_CONFIG } from "@/components/layout/nav";
import { Card, CardTitle, Toggle, Badge, Field, Input, Textarea, TelefoneInput, Select, Button, Table, THead, Th, Tr, Td, EmptyState } from "@/components/ui";
import { IcPlus } from "@/components/icons";
import { useAuth } from "@/store/auth";
import { useEmpresas } from "@/store/empresas";
import { useConfigApp } from "@/store/configApp";
import { useAsync } from "@/hooks/useAsync";
import { EsqueletoTabela } from "@/components/padrao/EsqueletoTabela";
import { repo } from "@/data";
import { gravarResponsavelFeriados, lerFeriados, lerResponsavelFeriados, salvarFeriadosMunicipais } from "@/lib/feriados";
import { idAncoraPendencia } from "@/lib/destaque";
import { feriadosVazios, responsavelPadraoDosFeriados, type Feriado } from "@/domain/feriados";
import { toast } from "@/store/toast";
import { cx } from "@/lib/format";
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
import type { Usuario } from "@/data/types";

type AbaConfig = "geral" | "checklist" | "contratos" | "backup" | "ia";

/**
 * A aba vem da URL (`?aba=`), e não de estado solto: a barra de Configurações
 * agora atravessa rotas — Agenda, Fornecedores e Logs são telas próprias que
 * moram nesta mesma barra (ver `BarraConfiguracoes`). Sem a URL mandar, voltar
 * de uma delas cairia sempre em "Geral".
 */
export function Configuracoes() {
  const pode = useAuth((s) => s.pode);
  const pedida = useSecaoConfig() as AbaConfig | "areas" | "usuarios";
  // A rota abre para quem tem `configuracoes` OU só a lista padrão do check-list
  // (a Coordenação). Quem não pode ver a seção pedida na URL cai na primeira que
  // pode — sem isto, abrir ?aba=usuarios à mão mostraria a seção inteira.
  const permitidas = NAV_CONFIG.filter((s) => s.rota.startsWith("/configuracoes") && (!s.recurso || pode(s.recurso) || !!s.ou?.some(pode)));
  const aba = (permitidas.some((s) => s.key === pedida) ? pedida : permitidas[0]?.key ?? "geral") as AbaConfig;
  const [retencao, setRetencao] = useState(24);
  const navigate = useNavigate();
  // As antigas abas de áreas e usuários moram agora em /acessos (link antigo continua levando lá).
  const mudouParaAcessos = pedida === "areas" || pedida === "usuarios";
  useEffect(() => {
    if (mudouParaAcessos) navigate(pedida === "areas" ? "/acessos?aba=grupos" : "/acessos?aba=usuarios", { replace: true });
  }, [mudouParaAcessos, pedida, navigate]);
  const [arquivamentoAuto, setArquivamentoAuto] = useState(true);

  return (
    <PageShell
      title="Configurações"
      subtitle="Empresas de emissão, check-list, contratos, back-up e consumo de IA."
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
                <label className="text-xs font-bold text-ink">Prazo de arquivamento: <span className="text-brand-forte">{retencao} meses</span></label>
                <input type="range" min={6} max={48} step={6} value={retencao} onChange={(e) => setRetencao(Number(e.target.value))} className="w-full accent-primary mt-2" />
              </div>
              <p className="text-xs text-ink-2">Ao concluir um projeto, os dados são arquivados (não apagados) e seguem disponíveis para consulta e duplicação.</p>
            </div>
          </Card>

          {/* Só o desenvolvedor (papel Admin) enxerga — para os demais não renderiza nada. */}
          <ManutencaoDevCard />
        </div>
      )}

      {aba === "checklist" && <ChecklistModelosCard />}

      {aba === "contratos" && <ContratosModelosCard />}
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
    // O endereço da empresa, quando há, tem de estar completo (Marisa,
    // 13/11/2026): ele vai direto para a qualificação do contrato. Empresa sem
    // endereço nenhum (a MF, ainda sem dados) não é bloqueada.
    const empresa = empresas.find((x) => x.id === id);
    if (empresa?.endereco.trim()) {
      const end = validarEndereco(empresa.endereco);
      if (!end.completo) {
        toast(`Endereço de ${empresa.nome} incompleto — não foi salvo. ${textoDoQueFalta(end.faltando)}`, "danger");
        return;
      }
    }
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
        // Esqueleto na mesma grade dos cartões (24/11/2026), no lugar do "Carregando…".
        <div role="status" aria-label="Carregando as empresas…" className="esqueleto-lista grid md:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} aria-hidden className="rounded-card border border-border p-4 space-y-3">
              <div className="esqueleto h-4 w-1/2" />
              <div className="esqueleto h-3 w-3/4" />
              <div className="esqueleto h-3 w-2/3" />
            </div>
          ))}
        </div>
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
                <h4 className="font-bold text-sm text-ink">{e.nome}</h4>
                {e.padrao ? (
                  <Badge tom="success">Padrão p/ emissão</Badge>
                ) : (
                  <button
                    onClick={async () => { await definirPadrao(e.id); toast(`${e.nome} definida como padrão.`, "success"); }}
                    className="text-xs font-bold text-brand-forte hover:underline"
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
                  <EnderecoCampos value={e.endereco} onChange={(endereco) => editar(e.id, { endereco })} onBlur={() => salvar(e.id)} />
                </Field>
                <Field label="Inscrição Municipal">
                  <Input value={e.inscricaoMunicipal} onChange={(ev) => editar(e.id, { inscricaoMunicipal: ev.target.value })} onBlur={() => salvar(e.id)} />
                </Field>
                <Field label="Telefone (entra no contrato, na qualificação do Contratante)">
                  <TelefoneInput value={e.telefone ?? ""} onChange={(v) => editar(e.id, { telefone: v })} />
                  <button type="button" className="mt-1 text-2xs font-bold text-brand-forte hover:underline" onClick={() => salvar(e.id)}>
                    Salvar telefone
                  </button>
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-2 mt-3">
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
      <Field label="Quem recebe o lembrete de janeiro" className="max-w-88 mb-3">
        <Select value={responsavel} onChange={(e) => void trocarResponsavel(e.target.value)}>
          <option value="">Ninguém</option>
          {ativos.map((u) => (
            <option key={u.id} value={u.nome}>{u.nome}</option>
          ))}
        </Select>
      </Field>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Field label="Ano" className="max-w-32">
          <Input
            type="number"
            value={ano}
            onChange={(e) => { setAno(Number(e.target.value) || anoAtual); setRascunho(null); }}
          />
        </Field>
        <span className="text-xs text-ink-3 self-end pb-2">
          {loading ? "Carregando…" : `${nacionais.length} feriado(s) nacional(is) já no sistema`}
        </span>
      </div>

      <div className="space-y-2">
        {municipais.map((f, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <Input
              type="date"
              className="max-w-44"
              value={f.data}
              onChange={(e) => mudar(i, { data: e.target.value })}
              aria-label="Data do feriado"
            />
            <Input
              className="flex-1 min-w-56"
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
          <p className="text-xs text-ink-3">Nenhum feriado municipal lançado para {ano}.</p>
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

/* ------------------------- Áreas e Usuários (mudaram) ----------------------- */

// As abas "Áreas e permissões" e "Usuários" MUDARAM para a tela /acessos (padrão de Acessos LSPRO,
// 24/11/2026): a área virou grupo de permissão e o cadastro de usuários foi junto. Quem chega por
// `?aba=areas` ou `?aba=usuarios` (link antigo, favorito) é levado para lá — ver `Configuracoes`.

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
      {erro && <p className="mt-1.5 text-xs font-semibold text-danger">{erro}</p>}
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
            <span className="text-xs text-ink-2">
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
          <p className="-mt-2 text-xs text-ink-2">
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
          <p className="-mt-2 text-xs text-ink-2">
            Separe por vírgula. Deixe vazio para não mandar e-mail. Pacotes muito grandes não cabem
            num e-mail — nesse caso a mensagem avisa e o arquivo fica no Dropbox ou no botão abaixo.
          </p>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-ink">Salvar também no Dropbox</span>
              <p className="text-xs text-ink-2">
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
            <p className="text-xs text-ink-2">
              Só a Direção e o Administrador tiram um back-up — o pacote leva a base inteira,
              inclusive o financeiro. Você pode acompanhar o histórico aqui.
            </p>
          )}
          <p className="text-xs text-ink-2">
            Gerar um back-up leva alguns instantes e não interrompe quem estiver usando o sistema.
          </p>
        </div>
      </Card>

      <Card>
        <CardTitle hint="Toda cópia que saiu do servidor fica registrada aqui.">Histórico</CardTitle>
        {historico.loading && !historico.data ? (
          <EsqueletoTabela colunas={["Quando", "Origem", "Destino", "Tamanho", "Situação"]} linhas={3} rotulo="Carregando o histórico de back-up…" />
        ) : !historico.data?.length ? (
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
                    <span className="block text-2xs text-ink-2">{b.arquivo}</span>
                  </Td>
                  <Td>{b.origem === "manual" ? "Pedido na tela" : "Automático"}</Td>
                  <Td>{b.destinos.length ? b.destinos.join(", ") : "—"}</Td>
                  <Td>{formatarTamanho(b.tamanhoBytes)}</Td>
                  <Td>
                    <Badge tom={b.status === "concluido" ? "success" : b.status === "parcial" ? "warning" : "danger"}>
                      {b.status === "concluido" ? "Concluído" : b.status === "parcial" ? "Com ressalva" : "Falhou"}
                    </Badge>
                    {b.erro && <span className="block text-2xs text-ink-2">{b.erro}</span>}
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
      <div className="space-y-3 text-sm leading-relaxed text-ink">
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
