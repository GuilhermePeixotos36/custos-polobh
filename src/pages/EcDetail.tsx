import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LegendaProjeto } from "@/components/layout/LegendaProjeto";
import { PageShell } from "@/components/layout/AppLayout";
import { BarraProjeto } from "@/components/layout/BarraSecao";
import {
  Card,
  CardTitle,
  Badge,
  Button,
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
import { IcBack, IcDownload, IcChevron, IcCopy, IcPencil, IcEye } from "@/components/icons";
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
import { itemDaLinhaEc } from "@/domain/contratacaoOs";
import { ecEditavel, situacaoEc, ROTULO_SITUACAO_EC, TOM_SITUACAO_EC } from "@/domain/ec";
import { useMinhasPendencias } from "@/store/pendencias";
import { EcItemLeitura } from "@/components/EcItemLeitura";
import { brl, dataBR } from "@/lib/format";
import { gerarEcExcel, gerarRentabilidadeExcel } from "@/lib/excel";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { cx } from "@/lib/format";
import type { Ec, EcLinha, Fornecedor, Observacao, Os } from "@/data/types";

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
  const { data: ec, loading } = useAsync(() => repo.ecs.obter(id), [id]);
  const { data: oss } = useAsync(() => repo.oss.porEc(id), [id]);
  const { itens: minhasPendencias } = useMinhasPendencias();
  // Usuários do sistema — para exibir/atribuir observações dos itens.
  const { data: usuariosData } = useAsync(() => repo.auth.usuarios(), []);
  const usuarios = (usuariosData ?? []).map((u) => u.nome).filter(Boolean);
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  /** Itens que ficaram fora da emissão, com o que falta em cada um. */
  const [bloqueados, setBloqueados] = useState<ItemEmissaoOs[]>([]);
  const [subaba, setSubaba] = useState<SubGuiaEc>("ec");
  const [emitindo, setEmitindo] = useState(false);

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
      valor: (o) => o.orcamento.valorEc,
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
  /** Arquivar uma EC sem pôr outra no lugar deixa o projeto sem estimativa: é da Direção. */
  const podeArquivarEc = podeEditar && (papel === "Admin" || papel === "Direcao");
  // Administrativo (financeiro) só precisa da Descrição Financeira; os demais papéis
  // (Admin, Direção, Produção) veem a Descrição Completa também.
  const veDescricaoCompleta = papel !== "Administrativo";
  // A EC vive dentro do projeto: voltar/breadcrumb apontam para a subguia EC do projeto.
  const voltarUrl = ec.projetoId ? `/projetos/${ec.projetoId}?aba=ec` : "/projetos";

  const gruposLinha = agruparLinhas(ec.linhas);
  // Quem entra e quem está travado na emissão de OS — alimenta o rótulo do botão.
  const emissao = analisarEmissaoOs(ec.linhas);
  const toggleGrupo = (n: string) =>
    setRecolhidos((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });

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
    const { prontos, bloqueados: travados } = analisarEmissaoOs(ec!.linhas);
    if (!prontos.length && !travados.length) {
      toast("Nenhuma linha com status 'Emitir' ou 'Emitir Nova Versão'.", "info");
      return;
    }
    setBloqueados(travados);
    if (travados.length) apontarBloqueados(travados);
    if (!prontos.length) return;
    if (!(await confirmar({
      titulo: `Emitir OS de ${prontos.length} item(ns)?`,
      mensagem: [
        "Será criada uma OS por fornecedor cujos itens já tenham sido aprovados. " +
        "Ao solicitar a emissão de uma nova versão de OS previamente emitida, a anterior será " +
        "automaticamente arquivada. Atenção para os dados a serem inseridos manualmente nas OS's.",
        travados.length ? `\n\n${travados.length} item(ns) marcado(s) para emitir ficam de fora por dados incompletos — a lista fica na tela.` : "",
      ].join(""),
      confirmarTexto: "Emitir OS",
    }))) return;

    setEmitindo(true);
    try {
      const grupos = agruparPorFornecedor(prontos);
      const idsEmitidos = new Set<string>();
      let criadas = 0;
      for (const g of grupos) {
        const idsG = new Set(g.linhas.map((l) => l.id));
        const temReversao = g.linhas.some((l) => l.statusOs === "Emitir Nova Versão");
        // "Emitir Nova Versão": arquiva as OSs anteriores que cobrem estes itens.
        if (temReversao) {
          for (const o of oss ?? []) {
            if (o.status === "Cancelada") continue;
            if (o.ecLinhaIds.some((lid) => idsG.has(lid))) {
              await repo.oss.salvar({ ...o, status: "Cancelada" });
            }
          }
        }
        const seq = await repo.oss.proximaSeq(ec!.id);
        const fornCadastro = g.fornecedorCnpj ? await repo.fornecedores.porCnpj(g.fornecedorCnpj) : undefined;
        // Qual versão desta OS: conta as que já existem para este fornecedor
        // nesta EC, inclusive as que acabaram de ser arquivadas acima.
        const versao = versaoOs(oss ?? [], ec!.id, g.fornecedorCnpj, g.fornecedorRazao);
        await repo.oss.salvar(montarOsEmissao(ec!, g.linhas, seq, versao, fornCadastro));
        criadas += 1;
        g.linhas.forEach((l) => idsEmitidos.add(l.id));
      }
      // Linhas emitidas deixam de estar pendentes — passam a "OK".
      const linhas = ec!.linhas.map((l) => (idsEmitidos.has(l.id) ? { ...l, statusOs: "OK" as const } : l));
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
        <div className="flex gap-2 text-[12px] font-bold text-ink-2">
          <button onClick={() => setRecolhidos(new Set())} className="hover:text-ink">Expandir</button>
          <span className="text-border">|</span>
          <button onClick={() => setRecolhidos(new Set(gruposLinha.map((g) => g.nome)))} className="hover:text-ink">Retrair</button>
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

      <div className="p-3 space-y-2">
        {gruposLinha.map((g) => {
          const aberto = !recolhidos.has(g.nome);
          const subtotal = g.itens.reduce((s, l) => s + l.valorPolobh + l.valorCliente, 0);
          return (
            <div key={g.nome} className="rounded-card border border-border overflow-hidden">
              {/* Cabeçalho do grupo — mais encorpado que o fundo quase branco de antes,
                  para o olho encontrar onde um grupo termina e o outro começa. */}
              <div className={cx("flex items-center gap-2 px-3 py-2.5 bg-[#F1F2F5]", aberto && "border-b border-border")}>
                <button onClick={() => toggleGrupo(g.nome)} className="text-ink-2 hover:text-ink shrink-0" aria-expanded={aberto} aria-label={`${aberto ? "Retrair" : "Expandir"} ${g.nome}`}>
                  <IcChevron width={18} height={18} className={cx("transition-transform", aberto && "rotate-90")} />
                </button>
                <button onClick={() => toggleGrupo(g.nome)} className="font-display font-bold text-ink text-[14px] text-left flex-1 uppercase tracking-[0.02em]">
                  {g.nome}
                </button>
                <span className="shrink-0 text-[11px] font-bold text-ink-3 bg-white rounded-pill px-2 py-0.5">
                  {g.itens.length} {g.itens.length === 1 ? "item" : "itens"}
                </span>
                {verFinanceiro && subtotal > 0 && (
                  <span className="shrink-0 text-[13px] font-display font-bold text-ink">{brl(subtotal)}</span>
                )}
              </div>

              {/* Itens do grupo */}
              {aberto && (
                <div className="divide-y divide-border-soft">
                  {g.itens.map((l) => (
                    <EcItemLeitura
                      key={l.id}
                      linha={l}
                      verFinanceiro={verFinanceiro}
                      veDescricaoCompleta={veDescricaoCompleta}
                      usuarios={usuarios}
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
            {verFinanceiro && <ThOrd col="valor" align="right" ordem={ossOrdenadas.ordem} onSort={ossOrdenadas.ordenarPor}>Valor EC</ThOrd>}
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
                {verFinanceiro && <Td align="right" className="font-display font-bold">{brl(o.orcamento.valorEc)}</Td>}
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
      legenda={<LegendaProjeto info={ec.projeto} />}
      // Grudam junto com o título (ver PageShell): a EC é longa, e as ações
      // sumiam de vista assim que se rolava a lista de itens.
      acoes={
        <>
          <button onClick={() => navigate(voltarUrl)} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink font-semibold">
            <IcBack width={16} height={16} /> Voltar ao projeto
          </button>
          <div className="flex gap-2 flex-wrap">
          {/* A ORDEM é a do check-list de 15/09: Editar · Gerar nova versão ·
              Arquivar · Excel · PDF · Emitir OS. Ela segue o dia de trabalho —
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
                if (!(await confirmar({
                  titulo: "Gerar a próxima versão desta EC?",
                  mensagem: "Alerta: ao gerar uma nova versão da EC, a versão atual será arquivada automaticamente.",
                  confirmarTexto: "Gerar nova versão",
                }))) return;
                const n = await repo.ecs.novaVersao(ec.id);
                toast(`Nova versão V${String(n.versao).padStart(2, "0")} criada (cancela e substitui).`, "success");
                navigate(`/estimativas/${n.id}/editar`);
              }}>
              Gerar Nova Versão EC
            </Button>
          )}
          {/* ARQUIVAR EC continua existindo, e agora só para a Direção
              (15/09/2026). A Pólobh perguntou para que ele serve, já que uma EC
              em projeto ativo não sai do ar sem substituta e projeto arquivado
              arquiva tudo sozinho. Serve para o caso que sobra: o evento que o
              cliente cancelou, em que a estimativa sai do ar e NÃO há outra para
              pôr no lugar. É raro e é grave — o projeto fica sem estimativa
              valendo —, então deixou de ser um botão ao alcance de todo mundo. */}
          {podeArquivarEc && ec.ativa && (
            <Button variant="secondary" size="sm"
              onClick={async () => {
                if (!(await confirmar({
                  titulo: "Arquivar esta EC?",
                  mensagem: `A EC ${ec.numero} sai do ar e vai para o arquivo do projeto. Ela continua consultável, pode ser importada e volta ao ar por "Tornar EC ativa". O projeto fica sem estimativa valendo até você ativar outra.`,
                  confirmarTexto: "Arquivar EC",
                  cancelarTexto: "Voltar",
                }))) return;
                await repo.ecs.salvar({ ...ec, status: "Arquivada", ativa: false });
                toast("EC arquivada.", "success");
                navigate(voltarUrl);
              }}>
              Arquivar EC
            </Button>
          )}
          <ExcelMenu ec={ec} />
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
          {/* A conversa da equipe vem antes da lista de custos: é a pauta de onde
              cada um tira o que é seu e vai tratar dentro do item. */}
          <ObservacoesGeraisEc ecId={ec.id} observacoes={ec.observacoes ?? []} usuarios={usuarios} />
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
  return {
    id: "", razaoSocial: razao, nomeFantasia: "", cnpj, perfilTributario: "", endereco: "",
    inscricaoEstadual: "", inscricaoMunicipal: "",
    dadosBancarios: { tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "" },
    representante: "", telefone: "", email: "",
  };
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
  const valorEc = linhas.reduce((s, l) => s + l.valorPolobh + l.valorCliente, 0);
  const g = agruparPorFornecedor(linhas)[0];
  const fornecedor = fornCadastro ?? fornecedorVazioEc(g?.fornecedorRazao ?? "", g?.fornecedorCnpj ?? "");
  return {
    id: "",
    numero: numeroOs(ecAtual, fornecedor, versao, agora),
    slugCredenciamento: "",
    seq,
    ecId: ecAtual.id,
    ecNumero: ecAtual.numero,
    ecLinhaIds: linhas.map((l) => l.id),
    // A contratação nasce com o que a EC levantou: valores, "não se aplica" e
    // BV de cada item. Na OS eles seguem editáveis — é aqui que se fecha.
    itens: linhas.map(itemDaLinhaEc),
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
    orcamento: { valorEc, valorComBvNf: valorEc, valorSemBvComNf: valorEc, valorSemBvSemNf: valorEc, parcelas: [{ descricao: "Pagamento único", valor: valorEc }], documentoFiscal: "" },
    financeiro: { tomador: "", descritivoNf: "", cnae: "", codigoServico: "", valorUnitario: valorEc, valorTotal: valorEc, descontoNegociado: 0, valorAPagar: valorEc, bvPercentual: 0, bvValor: 0, bvJustificativa: "", acertoFinanceiro: "" },
    contrato: { contratante: "", descritivoServicos: "", informacoesComplementares: "", valorUnitario: valorEc, valorTotal: valorEc, descontoNegociado: 0, valorAPagar: valorEc, dataContrato: "", rubrica: "" },
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

/** Botão "Excel" único com um menu para escolher o modelo (Financeiro ou Completa). */
function ExcelMenu({ ec }: { ec: Ec }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="relative">
      <Button variant="secondary" size="sm" icon={<IcDownload width={16} height={16} />} onClick={() => setAberto((v) => !v)}>
        <span className="inline-flex items-center gap-1">
          EC Excel <IcChevron width={13} height={13} className={cx("transition-transform", aberto && "rotate-90")} />
        </span>
      </Button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute left-0 mt-1 z-50 w-44 rounded-btn border border-border bg-white shadow-2xl py-1">
            <button
              className="w-full text-left px-3 py-2 text-[13px] font-semibold text-ink hover:bg-[#FAFAFB]"
              onClick={() => { gerarEcExcel(ec, { modelo: "financeiro" }); setAberto(false); }}
            >
              Financeiro
            </button>
            <button
              className="w-full text-left px-3 py-2 text-[13px] font-semibold text-ink hover:bg-[#FAFAFB]"
              onClick={() => { gerarEcExcel(ec, { modelo: "completa" }); setAberto(false); }}
            >
              Completa
            </button>
          </div>
        </>
      )}
    </div>
  );
}
