import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { comDadosAtuaisDoProjeto } from "@/lib/projetoAoVivo";
import { ExcelEcMenu } from "@/components/ExcelEcMenu";
import { gerarNovaVersaoEc } from "@/lib/novaVersaoEc";
import { LegendaProjeto } from "@/components/layout/LegendaProjeto";
import { PageShell } from "@/components/layout/AppLayout";
import { BarraProjeto } from "@/components/layout/BarraSecao";
import {
  Card,
  CardTitle,
  Badge,
  Button,
  CarregandoTela,
  Table,
  THead,
  Tr,
  Td,
  EmptyState,
  Eyebrow,
  ThOrd,
  useOrdenacao,
  tomStatusOs,
} from "@/components/ui";
import { IcBack, IcChevron, IcCopy, IcPencil, IcEye } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import type { ItemEmissaoOs } from "@/domain/calc";
import { analisarEmissaoOs, calcularTotais, agruparPorFornecedor, descritivoConsolidado, gastoPorLinhaViaOSs, numeroOs, versaoOs, rotuloTaxa, tituloEc, ROTULO_HONORARIOS_PADRAO, ROTULO_ENCARGOS_PADRAO } from "@/domain/calc";
import { RentabilidadeItens } from "@/components/RentabilidadeItens";
import { EcSubGuias, type SubGuiaEc } from "@/components/EcSubGuias";
import { NavegadorPendencias } from "@/components/NavegadorPendencias";
import { ObservacoesGeraisEc } from "@/components/ObservacoesGeraisEc";
import { pendenciasDaTela } from "@/domain/pendencias";
import { destacarElemento, idAncoraPendencia } from "@/lib/destaque";
import { documentoFiscalDaContratacao, itemDaLinhaEc, valorDaContratacao } from "@/domain/contratacaoOs";
import { planoDeEmissao } from "@/domain/emissaoOs";
import { comPerfilPeloDocumento } from "@/domain/fornecedor";
import { ecEditavel, situacaoEc, ROTULO_SITUACAO_EC, TOM_SITUACAO_EC } from "@/domain/ec";
import { useMinhasPendencias } from "@/store/pendencias";
import { EcItemLeitura } from "@/components/EcItemLeitura";
import { MoverSetas } from "@/components/MoverSetas";
import { infoDasDivisoes } from "@/domain/divisaoEc";
import { SeletorEmMassa } from "@/components/EcGrupos";
import { aplicarMudancaDeStatus, OPCOES_STATUS_OS, type MudancaDeStatus } from "@/domain/statusEc";
import { brl, dataBR } from "@/lib/format";
import { gerarRentabilidadeExcel } from "@/lib/excel";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { cx } from "@/lib/format";
import type { Ec, EcLinha, Fornecedor, Observacao, Os, StatusOs } from "@/data/types";

/** Agrupa as linhas por grupo preservando a ordem de aparição (visão de leitura). */
function agruparLinhas(linhas: EcLinha[]): { nome: string; itens: EcLinha[] }[] {
  const ordem: string[] = [];
  const map = new Map<string, EcLinha[]>();
  for (const l of linhas) {
    const g = l.grupo || "GERAL";
    if (!map.has(g)) { map.set(g, []); ordem.push(g); }
    map.get(g)!.push(l);
  }
  return ordem.map((nome) => ({ nome, itens: map.get(nome)! }));
}

export function EcDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const pode = useAuth((s) => s.pode);
  const papel = useAuth((s) => s.usuario?.papel);
  const { data: ec, loading, reload: recarregarEc } = useAsync(() => repo.ecs.obter(id), [id]);
  const { data: oss } = useAsync(() => repo.oss.porEc(id), [id]);
  const { itens: minhasPendencias } = useMinhasPendencias();
  // Usuários do sistema — para exibir/atribuir observações dos itens.
  const { data: usuariosData } = useAsync(() => repo.auth.usuarios(), []);
  const usuarios = (usuariosData ?? []).map((u) => u.nome).filter(Boolean);
  // Como na edição, os grupos abrem RECOLHIDOS: a EC é longa e o olho procura o grupo.
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  // Itens marcados: a emissão de OS passa a valer só para eles (sem marcação, vale a EC toda).
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const alternarSelecao = (ids: string[], marcar: boolean) =>
    setSelecionados((atual) => {
      const novo = new Set(atual);
      for (const id of ids) (marcar ? novo.add(id) : novo.delete(id));
      return novo;
    });
  /** Itens que ficaram fora da emissão, com o que falta em cada um. */
  const [bloqueados, setBloqueados] = useState<ItemEmissaoOs[]>([]);
  const [subaba, setSubaba] = useState<SubGuiaEc>("ec");
  const [emitindo, setEmitindo] = useState(false);
  /** "Salvar na pasta" em andamento: o passo que está acontecendo. */
  const [enviandoPasta, setEnviandoPasta] = useState<string | null>(null);

  const t = useMemo(
    () => (ec ? calcularTotais(ec.linhas, ec.producao, ec.honorarios, ec.encargos) : null),
    [ec]
  );
  const gastoPorLinha = useMemo(
    () => (ec ? gastoPorLinhaViaOSs(ec.linhas, oss ?? []) : {}),
    [ec, oss]
  );
  const ossOrdenadas = useOrdenacao(
    useMemo(() => oss ?? [], [oss]),
    {
      numero: (o) => o.numero,
      fornecedor: (o) => o.fornecedor.razaoSocial,
      itens: (o) => o.ecLinhaIds.length,
      valor: (o) => valorDaContratacao(o.itens ?? []),
      status: (o) => o.status,
    },
    { col: "numero", dir: "asc" }
  );

  if (loading) return <PageShell title="Carregando…">{null}</PageShell>;
  if (!ec) return <PageShell title="EC não encontrada">{null}</PageShell>;

  const verFinanceiro = pode("financeiro");
  /** A margem tem dono próprio desde 15/09/2026 — ver `PERMISSOES_ESPECIAIS`. */
  const verRentabilidade = pode("rentabilidade");
  const podeEditar = pode("ecs.editar");
  /**
   * Mudar status (aprovar, pedir OS/contrato) não é editar a EC: vale para quem
   * edita a EC e para quem monta a OS, e só enquanto a EC está no ar.
   */
  // O banco só aceita gravar EC de Administrador, Direção e Produção.
  const podeMudarStatus = (pode("ecs.editar") || pode("oss.editar")) && ec.ativa && papel !== "Administrativo";
  // Administrativo (financeiro) só precisa da Descrição Financeira; os demais papéis
  // (Admin, Direção, Produção) veem a Descrição Completa também.
  const veDescricaoCompleta = papel !== "Administrativo";
  // A EC vive dentro do projeto: voltar/breadcrumb apontam para a subguia EC do projeto.
  const voltarUrl = ec.projetoId ? `/projetos/${ec.projetoId}?aba=ec` : "/projetos";

  // Item oculto some da tela (e do grupo), igual à edição.
  const gruposLinha = agruparLinhas(ec.linhas.filter((l) => !l.oculto));
  const divisoes = infoDasDivisoes(ec.linhas);
  // Quem entra e quem está travado na emissão de OS — alimenta o rótulo do botão.
  const linhasDaEmissao = selecionados.size ? ec.linhas.filter((l) => selecionados.has(l.id)) : ec.linhas;
  const emissao = analisarEmissaoOs(linhasDaEmissao, verFinanceiro);
  const linhasMarcadas = ec.linhas.filter((l) => selecionados.has(l.id));
  const toggleGrupo = (n: string) =>
    setExpandidos((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });

  /** Observações são editáveis mesmo na tela de leitura — persiste na hora. */
  /**
   * Salva as observações de uma linha relendo a EC antes de gravar.
   *
   * Comentar é a ação mais concorrente do app (o recurso existe justamente para
   * uma pessoa deixar pendência para outra), então aqui não basta a trava
   * otimista: seria conflito o tempo todo. Relemos a versão atual e mesclamos
   * por id — o que outra pessoa comentou nesse intervalo é preservado, e o que
   * este usuário apagou continua apagado.
   */
  async function salvarObservacoes(linhaId: string, observacoes: Observacao[]) {
    try {
      const antes = ec!.linhas.find((l) => l.id === linhaId)?.observacoes ?? [];
      const removidos = new Set(
        antes.filter((a) => !observacoes.some((o) => o.id === a.id)).map((a) => a.id)
      );

      const atual = await repo.ecs.obter(ec!.id);
      if (!atual) throw new Error("EC não encontrada.");

      const base = (atual.linhas.find((l) => l.id === linhaId)?.observacoes ?? []).filter(
        (o) => !removidos.has(o.id)
      );
      const mescladas = [...base];
      for (const o of observacoes) {
        const i = mescladas.findIndex((m) => m.id === o.id);
        if (i >= 0) mescladas[i] = o;
        else mescladas.push(o);
      }

      const linhas = atual.linhas.map((l) => (l.id === linhaId ? { ...l, observacoes: mescladas } : l));
      await repo.ecs.salvar({ ...atual, linhas });
      navigate(0);
    } catch (e) {
      toast(`Não foi possível salvar a observação: ${(e as Error).message}`, "danger");
    }
  }

  /**
   * Muda só Aprovação, OS e Contrato de um ou vários itens — direto da
   * visualização, sem abrir a edição. Relê a EC antes de gravar (como as
   * observações), para não pisar no que outra pessoa mexeu nesse intervalo:
   * só os três campos dos itens escolhidos são tocados.
   */
  async function mudarStatus(ids: string[], mudanca: MudancaDeStatus, limparSelecao = false) {
    try {
      const atual = await repo.ecs.obter(ec!.id);
      if (!atual) throw new Error("EC não encontrada.");
      await repo.ecs.salvar({ ...atual, linhas: aplicarMudancaDeStatus(atual.linhas, ids, mudanca) });
      if (limparSelecao) setSelecionados(new Set());
      recarregarEc();
    } catch (e) {
      toast(`Não foi possível mudar o status: ${(e as Error).message}`, "danger");
    }
  }

  /**
   * Traz esta EC de volta ao ar — o caminho de volta do arquivo.
   *
   * É uma troca simples, e reversível: esta passa a ser a estimativa do projeto
   * e a que estava valendo vai para o arquivo, de onde volta pelo mesmo botão.
   * Antes, reativar uma arquivada DUPLICAVA a EC numa versão nova; com dois
   * estados isso virou repetição de "Gerar nova versão" — e enchia a lista de
   * versões só para poder editar. Quem quer preservar a atual e mexer numa
   * cópia continua tendo "Gerar nova versão" e "Importar EC".
   */
  async function tornarAtiva() {
    if (!(await confirmar({
      titulo: "Tornar esta EC a ativa do projeto?",
      mensagem: "Ela passa a ser a estimativa que vale. A que está no ar hoje vai para o arquivo — e volta por aqui quando você quiser.",
      confirmarTexto: "Tornar ativa",
    }))) return;
    await repo.ecs.definirAtiva(ec!.id);
    toast("EC definida como ativa.", "success");
    navigate(0);
  }

  /**
   * Emite as OSs das linhas marcadas como "Emitir"/"Emitir Nova Versão":
   * valida os obrigatórios, agrupa por fornecedor e cria uma OS (rascunho) por fornecedor.
   * Linhas "Emitir Nova Versão" arquivam a OS anterior que as cobre e geram uma OS nova.
   */
  /**
   * Leva a tela até os itens que travaram a emissão e os faz piscar em vermelho.
   *
   * A lista de faltas por escrito não bastava: numa EC com dezenas de itens, a
   * pessoa lia "falta o CNPJ em Acessibilidade" e ainda tinha de caçar o item na
   * rolagem. Só o primeiro leva a câmera; os demais piscam onde estão.
   */
  const apontarBloqueados = (itens: ItemEmissaoOs[]) => {
    itens.forEach((b, i) =>
      destacarElemento(idAncoraPendencia(b.linha.id), "pendencia", { rolar: i === 0 })
    );
  };

  async function emitirOs() {
    setBloqueados([]);
    // Só entram itens aprovados, com fornecedor identificado e marcados para
    // emitir; o resto é devolvido com o motivo exato de estar travado.
    const { prontos, bloqueados: travados } = analisarEmissaoOs(selecionados.size ? ec!.linhas.filter((l) => selecionados.has(l.id)) : ec!.linhas, verFinanceiro);
    if (!prontos.length && !travados.length) {
      toast("Nenhuma linha com status 'Emitir' ou 'Emitir Nova Versão'.", "info");
      return;
    }
    setBloqueados(travados);
    if (travados.length) apontarBloqueados(travados);
    if (!prontos.length) return;
    // Uma OS por fornecedor; o item que já estava numa OS viva leva a anterior
    // ao arquivo (ver `planoDeEmissao`). A confirmação diz exatamente isso.
    const plano = planoDeEmissao(prontos, oss ?? []);
    const nomeItem = (l: EcLinha) => l.item?.trim() || l.descricao?.trim() || "(item sem nome)";
    const listaOss = plano.grupos
      .map((g, i) => `${i + 1}. ${g.fornecedorRazao?.trim() || g.fornecedorCnpj || "(fornecedor sem nome)"}: ${g.linhas.map(nomeItem).join(", ")}`)
      .join("\n");
    if (!(await confirmar({
      titulo: plano.grupos.length === 1 ? "Emitir 1 OS?" : `Emitir ${plano.grupos.length} OSs — uma por fornecedor?`,
      mensagem: [
        listaOss,
        plano.arquivar.length
          ? `\n\nSubstituídas (vão para o arquivo): ${plano.arquivar.map((o) => o.numero).join("; ")}.`
          : "",
        plano.liberar.length
          ? ` ${plano.liberar.length} item(ns) dessas OSs que não estão nesta emissão voltam para "Emitir".`
          : "",
        "\n\nAtenção para os dados a serem inseridos manualmente nas OSs.",
        travados.length ? `\n\n${travados.length} item(ns) marcado(s) para emitir ficam de fora por dados incompletos — a lista fica na tela.` : "",
      ].join(""),
      confirmarTexto: plano.grupos.length === 1 ? "Emitir OS" : `Emitir ${plano.grupos.length} OSs`,
    }))) return;

    setEmitindo(true);
    try {
      const idsEmitidos = new Set<string>();
      const idsLiberados = new Set(plano.liberar);
      let criadas = 0;
      // A OS nova nasce com os dados gerais de HOJE do projeto, não os da EC antiga.
      const ecViva = await comDadosAtuaisDoProjeto(ec!);
      // Substituída por uma nova versão: ARQUIVADA (Cancelada é decisão de
      // gente — o negócio caiu).
      for (const o of plano.arquivar) await repo.oss.salvar({ ...o, status: "Arquivada" });
      for (const g of plano.grupos) {
        const seq = await repo.oss.proximaSeq(ec!.id);
        const fornCadastro = g.fornecedorCnpj ? await repo.fornecedores.porCnpj(g.fornecedorCnpj) : undefined;
        // Qual versão desta OS: conta as que já existem para este fornecedor
        // nesta EC, inclusive as que acabaram de ser arquivadas acima.
        const versao = versaoOs(oss ?? [], ec!.id, g.fornecedorCnpj, g.fornecedorRazao);
        await repo.oss.salvar(montarOsEmissao(ecViva, g.linhas, seq, versao, fornCadastro));
        criadas += 1;
        g.linhas.forEach((l) => idsEmitidos.add(l.id));
      }
      // Linhas emitidas deixam de estar pendentes — passam a "OK".
      // Os que perderam a OS (arquivada) sem entrar nesta emissão voltam a "Emitir".
      const linhas = ec!.linhas.map((l) =>
        idsEmitidos.has(l.id)
          ? { ...l, statusOs: "OK" as const }
          : idsLiberados.has(l.id)
            ? { ...l, statusOs: "Emitir" as const }
            : l
      );
      await repo.ecs.salvar({ ...ec!, linhas });
      toast(`${criadas} OS(s) emitida(s). Complete os dados fiscais de cada uma.`, "success");
      navigate(0);
    } catch (e) {
      toast(`Erro ao emitir OS: ${(e as Error).message}`, "danger");
    } finally {
      setEmitindo(false);
    }
  }

  const estimativaCard = (
    <Card padded={false}>
      <div className="p-5 flex items-center justify-between gap-3 border-b border-border-soft flex-wrap">
        <CardTitle hint="Mesma organização por grupos da criação.">
          Estimativa de custos
        </CardTitle>
        <div className="flex items-center gap-2 text-[12px] font-bold text-ink-2">
          <button onClick={() => setExpandidos(new Set(gruposLinha.map((g) => g.nome)))} className="hover:text-ink">Expandir</button>
          <span className="text-border">|</span>
          <button onClick={() => setExpandidos(new Set())} className="hover:text-ink">Retrair</button>
        </div>
      </div>
      {bloqueados.length > 0 && (
        <div className="mx-5 mt-3 text-[13px] text-danger bg-danger-soft rounded-btn px-3 py-2">
          <p className="font-bold">{bloqueados.length} item(ns) fora da emissão — falta preencher:</p>
          <ul className="mt-1 space-y-0.5">
            {bloqueados.map((b) => (
              <li key={b.linha.id}>
                {/* Clicar no item da lista leva de volta a ele — a EC é longa e
                    o destaque do clique em "Emitir OS" já passou. */}
                <button
                  type="button"
                  onClick={() => apontarBloqueados([b])}
                  className="text-left hover:underline"
                  title="Ir para o item"
                >
                  • <b>{b.linha.item || "(item sem nome)"}</b>: {b.faltas.join(", ")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selecionados.size > 0 && (
        <div className="sticky top-[calc(var(--altura-topnav)+var(--altura-cabecalho)+8px)] z-10 mx-3 mt-3 space-y-1.5 rounded-btn border border-primary bg-primary-soft px-3 py-2 shadow-card">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[13px] font-extrabold text-primary-dark">
              {selecionados.size} {selecionados.size === 1 ? "item selecionado" : "itens selecionados"}
            </span>
            {podeMudarStatus && (
              <>
                <Button
                  size="sm"
                  disabled={!linhasMarcadas.some((l) => l.statusAprovacao === "Pendente")}
                  onClick={() => mudarStatus([...selecionados], { aprovacao: "OK" }, true)}
                  title="Marca a Aprovação como OK e, nos itens com OS ainda Pendente, muda a OS para Emitir"
                >
                  Aprovar e liberar OS ({linhasMarcadas.filter((l) => l.statusAprovacao === "Pendente").length})
                </Button>
                {linhasMarcadas.some((l) => l.statusAprovacao === "OK") && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => mudarStatus([...selecionados], { aprovacao: "Pendente" }, true)}
                    title="Volta a Aprovação para Pendente e desfaz a OS que ficou em Emitir (não mexe em OS já emitida)"
                  >
                    Reverter para Pendente ({linhasMarcadas.filter((l) => l.statusAprovacao === "OK").length})
                  </Button>
                )}
              </>
            )}
            <button type="button" onClick={() => setSelecionados(new Set())} className="ml-auto text-[12.5px] font-bold text-ink-2 hover:text-ink">
              Limpar seleção
            </button>
          </div>
          {podeMudarStatus && (
            <div className="flex items-center gap-2 flex-wrap border-t border-primary/20 pt-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-primary-dark/80">Alterar em massa</span>
              <SeletorEmMassa rotulo="Aprovação" opcoes={["Pendente", "OK"]} onEscolher={(v) => mudarStatus([...selecionados], { aprovacao: v as "Pendente" | "OK" }, true)} />
              <SeletorEmMassa rotulo="OS" opcoes={OPCOES_STATUS_OS} onEscolher={(v) => mudarStatus([...selecionados], { os: v as StatusOs }, true)} />
              <SeletorEmMassa rotulo="Contrato" opcoes={OPCOES_STATUS_OS} onEscolher={(v) => mudarStatus([...selecionados], { contrato: v as StatusOs }, true)} />
            </div>
          )}
          <div className="text-[12px] font-bold text-ink-2">A emissão de OS vale só para os itens selecionados.</div>
        </div>
      )}

      <div className="p-3 space-y-2">
        {gruposLinha.map((g) => {
          const aberto = expandidos.has(g.nome);
          const subtotal = g.itens.reduce((s, l) => s + l.valorPolobh + l.valorCliente, 0);
          return (
            <div key={g.nome} className="rounded-card border border-border bg-white">
              {/* Cabeçalho do grupo — o mesmo da edição: seleção, setas (apagadas
                  aqui), seta de recolher, nome, contagem e subtotal. */}
              <div className={cx("flex items-center gap-2 px-3 py-3 flex-wrap", aberto && "border-b border-border-soft")}>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-[#F2820D] cursor-pointer"
                  checked={g.itens.every((l) => selecionados.has(l.id))}
                  ref={(el) => {
                    const marcados = g.itens.filter((l) => selecionados.has(l.id)).length;
                    if (el) el.indeterminate = marcados > 0 && marcados < g.itens.length;
                  }}
                  onChange={(e) => alternarSelecao(g.itens.map((l) => l.id), e.target.checked)}
                  aria-label={`Selecionar todos os itens de ${g.nome}`}
                  title="Selecionar todos os itens deste grupo"
                />
                <MoverSetas
                  className="hidden sm:flex"
                  rotulo={`o grupo ${g.nome}`}
                  podeSubir={false}
                  podeDescer={false}
                  motivoBloqueio="Para reordenar, edite a EC"
                  onSubir={() => {}}
                  onDescer={() => {}}
                />
                <button onClick={() => toggleGrupo(g.nome)} className="shrink-0 text-ink-2 hover:text-ink" aria-expanded={aberto} aria-label={`${aberto ? "Retrair" : "Expandir"} ${g.nome}`}>
                  <IcChevron width={20} height={20} className={cx("transition-transform duration-200", aberto && "rotate-90")} />
                </button>
                <button onClick={() => toggleGrupo(g.nome)} className="text-[15px] font-bold uppercase text-ink text-left min-w-0 flex-1 break-words sm:flex-none sm:truncate">
                  {g.nome}
                </button>
                <span className="shrink-0 text-[12px] font-bold text-ink-3 bg-[#F0F1F4] rounded-pill px-2.5 py-1">
                  {g.itens.length} {g.itens.length === 1 ? "item" : "itens"}
                </span>
                {verFinanceiro && subtotal > 0 && (
                  <span className="shrink-0 text-[14px] font-display font-bold text-ink-2">{brl(subtotal)}</span>
                )}
              </div>

              {aberto && (
                <div className="p-3 space-y-2.5">
                  {g.itens.map((l) => (
                    <EcItemLeitura
                      key={l.id}
                      linha={l}
                      verFinanceiro={verFinanceiro}
                      veDescricaoCompleta={veDescricaoCompleta}
                      usuarios={usuarios}
                      selecionado={selecionados.has(l.id)}
                      onSelecionar={() => alternarSelecao([l.id], !selecionados.has(l.id))}
                      editavelStatus={podeMudarStatus}
                      onStatus={(m) => mudarStatus([l.id], m)}
                      divisao={divisoes.get(l.id)}
                      onObservacoes={(obs) => salvarObservacoes(l.id, obs)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );

  const ossCard = (
    <Card padded={false}>
      <div className="p-5"><CardTitle>Ordens de Serviço vinculadas</CardTitle></div>
      {(oss ?? []).length === 0 ? (
        <EmptyState title="Nenhuma OS gerada" hint="Marque itens como 'Emitir' e use o botão Emitir OS, no topo da EC." />
      ) : (
        <Table>
          <THead>
            <ThOrd col="numero" ordem={ossOrdenadas.ordem} onSort={ossOrdenadas.ordenarPor}>OS</ThOrd>
            <ThOrd col="fornecedor" ordem={ossOrdenadas.ordem} onSort={ossOrdenadas.ordenarPor}>Fornecedor</ThOrd>
            <ThOrd col="itens" align="center" ordem={ossOrdenadas.ordem} onSort={ossOrdenadas.ordenarPor}>Itens</ThOrd>
            {verFinanceiro && <ThOrd col="valor" align="right" ordem={ossOrdenadas.ordem} onSort={ossOrdenadas.ordenarPor}>Valor OS</ThOrd>}
            <ThOrd col="status" align="center" ordem={ossOrdenadas.ordem} onSort={ossOrdenadas.ordenarPor}>Status</ThOrd>
          </THead>
          <tbody>
            {ossOrdenadas.ordenados.map((o) => (
              <Tr key={o.id} onClick={() => navigate(`/ordens/${o.id}`)}>
                <Td className="font-bold">{o.numero}</Td>
                <Td>{o.fornecedor.razaoSocial}</Td>
                <Td align="center">
                  <Badge tom={o.ecLinhaIds.length > 1 ? "info" : "neutral"}>
                    {o.ecLinhaIds.length > 1 ? `${o.ecLinhaIds.length} consolidados` : "1 item"}
                  </Badge>
                </Td>
                {verFinanceiro && <Td align="right" className="font-display font-bold">{valorDaContratacao(o.itens ?? []) ? brl(valorDaContratacao(o.itens ?? [])) : "a definir"}</Td>}
                <Td align="center"><Badge tom={tomStatusOs[o.status]}>{o.status}</Badge></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );

  const rentabilidadeCard = (
    <Card padded={false}>
      <div className="p-5"><CardTitle>Rentabilidade por item</CardTitle></div>
      {/* Em leitura os custos internos não se lançam: eles mudam a EC, e a EC
          só muda na edição — ver o botão "Editar EC". */}
      <RentabilidadeItens
        ec={ec}
        gastoPorLinha={gastoPorLinha}
        onExportar={() => void gerarRentabilidadeExcel(ec, gastoPorLinha)}
        onImprimir={() => navigate(`/estimativas/${ec.id}/imprimir?rentabilidade=1`)}
      />
    </Card>
  );

  const subTotalCliente = t ? Math.round((t.somaCliente + t.honorariosCliente) * 100) / 100 : 0;
  const totaisCard = t ? (
    <Card padded={false}>
      <div className="p-5 pb-3"><CardTitle>Resumo dos Custos</CardTitle></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-t border-border">
          <thead>
            <tr className="text-left bg-[#FAFAFB] border-b border-border">
              <th className="px-4 py-2 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Descrição</th>
              <th className="px-4 py-2 text-right text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Pólobh</th>
              <th className="px-4 py-2 text-right text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Cliente</th>
            </tr>
          </thead>
          <tbody>
            <LinhaResumo desc="Soma dos fornecedores" polobh={t.somaFornecedores} cliente={t.somaCliente} />
            <LinhaResumo
              desc={`${ec.honorariosRotulo || ROTULO_HONORARIOS_PADRAO} (${rotuloTaxa(ec.honorarios, t.honorariosMinimoAplicado)})`}
              polobh={t.honorariosPolobh}
              cliente={t.honorariosCliente}
            />
            <tr className="border-b border-border-soft">
              <td className="px-4 py-2.5 font-semibold text-ink">{ec.encargosRotulo || ROTULO_ENCARGOS_PADRAO} ({rotuloTaxa(ec.encargos)})</td>
              <td className="px-4 py-2.5 text-right font-display font-bold text-ink whitespace-nowrap">{brl(t.encargos)}</td>
              <td className="px-4 py-2.5 text-right text-ink-3">—</td>
            </tr>
            <LinhaResumo desc="Sub-total" polobh={t.subTotalPolobh} cliente={subTotalCliente} strong />
            <tr className="bg-primary-soft">
              <td className="px-4 py-3 font-bold text-ink">Valor Total Bruto (Custo Total do Projeto)</td>
              <td className="px-4 py-3 text-right font-display font-bold text-primary-dark whitespace-nowrap" colSpan={2}>{brl(t.valorTotalBruto)}</td>
            </tr>
            <tr>
              <td className="px-4 pt-3 pb-1 text-[11.5px] font-bold italic text-ink-3" colSpan={3}>Sendo:</td>
            </tr>
            <LinhaResumo desc="Faturamento Pólobh — NF Pólobh × Cliente" polobh={t.faturamentoPolobh} colSpanValor />
            <LinhaResumo desc="Faturamento Terceiros — NF's Terceiros × Cliente" polobh={t.faturamentoTerceiros} colSpanValor />
          </tbody>
        </table>
      </div>
    </Card>
  ) : null;

  // Dois estados, e só (ver `domain/ec`): ou esta é a estimativa que vale no
  // projeto, ou ela está no arquivo.
  const situacao = situacaoEc(ec);
  const statusBadge = <Badge tom={TOM_SITUACAO_EC[situacao]}>{ROTULO_SITUACAO_EC[situacao]}</Badge>;

  return (
    <PageShell
      title={tituloEc(ec)}
      titleAdornment={statusBadge}
      legenda={<LegendaProjeto info={ec.projeto} projetoId={ec.projetoId} />}
      // Grudam junto com o título (ver PageShell): a EC é longa, e as ações
      // sumiam de vista assim que se rolava a lista de itens.
      acoes={
        <>
          <button onClick={() => navigate(voltarUrl)} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink font-semibold">
            <IcBack width={16} height={16} /> Voltar ao projeto
          </button>
          <div className="flex gap-2 flex-wrap">
          {/* A ORDEM é a do check-list de 15/09: Editar · Gerar nova versão ·
              Excel · PDF · Emitir OS. Ela segue o dia de trabalho —
              primeiro o que se faz com a estimativa, depois o que se tira dela,
              por último o que ela gera. */}
          {podeEditar && ecEditavel(ec) && (
            <Button size="sm" icon={<IcPencil width={16} height={16} />} onClick={() => navigate(`/estimativas/${ec.id}/editar`)}>
              Editar EC
            </Button>
          )}
          {podeEditar && (
            <Button variant="secondary" size="sm" icon={<IcCopy width={16} height={16} />}
              onClick={async () => {
                const nova = await gerarNovaVersaoEc(ec);
                if (nova) navigate(`/estimativas/${nova.id}/editar`);
              }}>
              Gerar Nova Versão EC
            </Button>
          )}
          {/* SALVAR NA PASTA (06/11/2026) — ver `lib/salvarEcNaPasta`. */}
          {podeEditar && ecEditavel(ec) && (
            <Button
              variant="secondary"
              size="sm"
              disabled={!!enviandoPasta}
              title="Revisa os textos e envia o Excel da EC para a pasta Dropbox do projeto. Se a versão da pasta já mudou, cria a versão seguinte."
              onClick={async () => {
                setEnviandoPasta("Conferindo…");
                try {
                  const { salvarEcNaPasta } = await import("@/lib/salvarEcNaPasta");
                  const final = await salvarEcNaPasta(ec, { aoAndar: setEnviandoPasta });
                  if (final && final.id !== ec.id) navigate(`/estimativas/${final.id}`);
                  else if (final) recarregarEc();
                } finally {
                  setEnviandoPasta(null);
                }
              }}
            >
              Salvar na pasta
            </Button>
          )}
          {enviandoPasta && <CarregandoTela texto={enviandoPasta} />}
          <ExcelEcMenu ec={ec} />
          <Button variant="secondary" size="sm" icon={<IcEye width={16} height={16} />} onClick={() => navigate(`/estimativas/${ec.id}/imprimir`)}>
            EC PDF
          </Button>
          {pode("oss.editar") && ec.ativa && (emissao.prontos.length > 0 || emissao.bloqueados.length > 0) && (
            <Button
              data-tour="emitir-os"
              variant="primary"
              size="sm"
              onClick={emitirOs}
              disabled={emitindo}
              title={
                emissao.bloqueados.length
                  ? `${emissao.prontos.length} item(ns) prontos · ${emissao.bloqueados.length} com dados incompletos`
                  : "Itens aprovados, com fornecedor identificado e marcados para emitir"
              }
            >
              {emitindo ? "Emitindo…" : `Emitir OS(s)${emissao.prontos.length ? ` (${emissao.prontos.length})` : ""}`}
            </Button>
          )}
          {podeEditar && !ec.ativa && (
            <Button variant="primary" size="sm" onClick={tornarAtiva}>
              Tornar EC ativa
            </Button>
          )}
          </div>
        </>
      }
      // Grudam com o cabeçalho: trocar de subaba no meio da lista de itens não
      // pode obrigar a voltar ao topo.
      // Duas barras: a de cima é o SEGUNDO CABEÇALHO do projeto — a mesma em
      // todas as páginas internas dele, para quem entra numa EC continuar
      // sabendo de onde veio. A de baixo são as vistas deste documento.
      subabas={
        <>
          {ec.projetoId && <BarraProjeto projetoId={ec.projetoId} atual="ec" />}
          {verFinanceiro && <EcSubGuias atual={subaba} onChange={setSubaba} temResumo temRentabilidade={verRentabilidade} />}
        </>
      }
    >
      {/* A conversa da equipe fica no ALTO de todas as vistas da EC — custos,
          resumo e rentabilidade (29/09/2026): é a pauta de onde cada um tira o
          que é seu, e é uma conversa só, então as pendências dela contam uma vez.
          Fora dos blocos de cada aba de propósito: ao trocar de aba o card não é
          recriado, e o que acabou de ser dito não some. */}
      <div className="mb-4">
        <ObservacoesGeraisEc ecId={ec.id} observacoes={ec.observacoes ?? []} usuarios={usuarios} />
      </div>

      {verFinanceiro && subaba === "resumo" && (
        <div className="space-y-4">{totaisCard}</div>
      )}
      {verRentabilidade && subaba === "rentabilidade" && (
        <div className="space-y-4">{rentabilidadeCard}</div>
      )}

      {subaba === "ec" && (
        <div className="space-y-4">
          {/* Pílula flutuante que salta entre as pendências DESTA EC. O que a EC
              contabiliza mas mora na OS (observação, cronograma) fica de fora:
              lá é outra tela, e o salto não teria volta. */}
          <NavegadorPendencias pendencias={pendenciasDaTela(minhasPendencias, { ecId: ec.id })} />
          {estimativaCard}
          {ossCard}

          {/* Cliente/Projeto só em EC avulsa; dentro de um projeto ficam em "Dados Gerais". */}
          {!ec.projetoId && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <Eyebrow>Cliente</Eyebrow>
                <div className="mt-2 space-y-1.5 text-sm">
                  <p className="font-bold text-ink">{ec.cliente.razaoSocial}</p>
                  <p className="text-ink-2">{ec.cliente.cnpjCpf}</p>
                  <p className="text-ink-2">{ec.cliente.endereco}</p>
                  <p className="text-ink-2">{ec.cliente.representante.nome} · {ec.cliente.representante.email}</p>
                </div>
              </Card>
              <Card>
                <Eyebrow>Projeto</Eyebrow>
                <div className="mt-2 space-y-1.5 text-sm">
                  <p className="text-ink-2"><b className="text-ink">Local:</b> {ec.projeto.local}</p>
                  <p className="text-ink-2"><b className="text-ink">Participantes:</b> {ec.projeto.participantes}</p>
                  <p className="text-ink-2"><b className="text-ink">Evento:</b> {dataBR(ec.projeto.evento)} · {ec.projeto.horario}</p>
                  <p className="text-ink-2"><b className="text-ink">Responsável:</b> {ec.responsavel}</p>
                </div>
              </Card>
            </div>
          )}

          {/* Totais (Resumo dos Custos) permanece como último bloco da guia geral da EC */}
          {verFinanceiro && totaisCard}
        </div>
      )}
    </PageShell>
  );
}

function fornecedorVazioEc(razao: string, cnpj: string): Fornecedor {
  return comPerfilPeloDocumento<Fornecedor>({
    id: "", razaoSocial: razao, nomeFantasia: "", cnpj, perfilTributario: "", endereco: "",
    inscricaoEstadual: "", inscricaoMunicipal: "",
    dadosBancarios: { tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "" },
    representante: "", telefone: "", email: "",
  });
}

/** Constrói a OS (rascunho) consolidando as linhas de um fornecedor — espelha a criação do OsForm. */
function montarOsEmissao(
  ecAtual: Ec,
  linhas: EcLinha[],
  seq: number,
  versao: number,
  fornCadastro?: Fornecedor
): Os {
  const agora = new Date().toISOString();
  // `valorEc` fica gravado (preço ao cliente, para a rentabilidade); a OS nasce
  // valendo o que se paga ao FORNECEDOR (ver `valorDaContratacao`).
  const valorEc = linhas.reduce((s, l) => s + l.valorPolobh + l.valorCliente, 0);
  const itens = linhas.map(itemDaLinhaEc);
  const valorOs = valorDaContratacao(itens);
  const g = agruparPorFornecedor(linhas)[0];
  const fornecedor = fornCadastro ?? fornecedorVazioEc(g?.fornecedorRazao ?? "", g?.fornecedorCnpj ?? "");
  return {
    id: "",
    numero: numeroOs(ecAtual, fornecedor, versao, agora, linhas.map((l) => l.id)),
    slugCredenciamento: "",
    seq,
    ecId: ecAtual.id,
    ecNumero: ecAtual.numero,
    ecLinhaIds: linhas.map((l) => l.id),
    // A contratação nasce com o que a EC levantou: valores, "não se aplica" e
    // BV de cada item. Na OS eles seguem editáveis — é aqui que se fecha.
    itens,
    status: "Rascunho",
    fornecedor,
    // Foto dos dados gerais do evento na emissão — ver `Os.projeto`.
    projeto: ecAtual.projeto,
    cliente: ecAtual.cliente,
    modalidade: "",
    descritivo: descritivoConsolidado(linhas),
    entrega: "",
    cronograma: [{ etapa: "Evento", data: ecAtual.projeto.evento, horario: ecAtual.projeto.horario, atividades: "" }],
    logistica: { transporteMaterial: "", transporteEquipe: "", hospedagem: "", alimentacao: "", estacionamentoCarga: "", estacionamentoEquipe: "", uniformizacao: "" },
    infraestrutura: { energia: "", internet: "", pontosEletricos: "", estruturas: "", servicosApoio: "", artLaudos: "" },
    observacoesGerais: "",
    observacoes: [],
    // Sem link montado à mão: ele nasce do token que o banco gera ao salvar.
    credenciamento: { prazoLimite: "", linkFormulario: "" },
    orcamento: { valorEc, valorComBvNf: valorOs, valorSemBvComNf: valorOs, valorSemBvSemNf: valorOs, parcelas: [{ descricao: "Pagamento único", valor: valorOs }], documentoFiscal: documentoFiscalDaContratacao(itens) },
    financeiro: { tomador: "", descritivoNf: "", cnae: "", codigoServico: "", valorUnitario: valorOs, valorTotal: valorOs, descontoNegociado: 0, valorAPagar: valorOs, bvPercentual: 0, bvValor: 0, bvJustificativa: "", acertoFinanceiro: "" },
    contrato: { contratante: "", descritivoServicos: "", informacoesComplementares: "", valorUnitario: valorOs, valorTotal: valorOs, descontoNegociado: 0, valorAPagar: valorOs, dataContrato: "", rubrica: "" },
    criadoEm: agora,
    atualizadoEm: agora,
  };
}


/** Linha da tabela "Resumo dos Custos" — mesmo desenho da versão editável (EcForm), em modo leitura. */
function LinhaResumo({
  desc,
  polobh,
  cliente,
  strong,
  colSpanValor,
}: {
  desc: string;
  polobh: number;
  cliente?: number;
  strong?: boolean;
  colSpanValor?: boolean;
}) {
  return (
    <tr className="border-b border-border-soft">
      <td className={cx("px-4 py-2.5", strong ? "font-bold text-ink" : "font-semibold text-ink")}>{desc}</td>
      {colSpanValor ? (
        <td className="px-4 py-2.5 text-right whitespace-nowrap font-display font-bold text-ink" colSpan={2}>{brl(polobh)}</td>
      ) : (
        <>
          <td className="px-4 py-2.5 text-right whitespace-nowrap font-display font-bold text-ink">{brl(polobh)}</td>
          <td className="px-4 py-2.5 text-right whitespace-nowrap font-display font-bold text-ink">{cliente === undefined ? "" : brl(cliente)}</td>
        </>
      )}
    </tr>
  );
}
