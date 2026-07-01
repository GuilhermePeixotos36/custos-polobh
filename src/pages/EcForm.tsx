import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import {
  Card,
  CardTitle,
  Button,
  Field,
  Input,
  Textarea,
  Select,
  NumberInput,
  Eyebrow,
} from "@/components/ui";
import { IcPlus, IcTrash, IcDownload, IcSearch, IcChevron } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import {
  calcularTotais,
  numeroEc,
  producaoPadrao,
} from "@/domain/calc";
import { itensDoTemplate } from "@/domain/ecTemplates";
import { gerarEcExcel } from "@/lib/excel";
import { consultarCnpj } from "@/lib/cnpj";
import { useAuth } from "@/store/auth";
import { RentabilidadeItens } from "@/components/RentabilidadeItens";
import { flags } from "@/lib/flags";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { brl, maskCpfCnpjInput } from "@/lib/format";
import type {
  Cliente,
  Ec,
  EcLinha,
  ProjetoInfo,
  StatusAprovacao,
  StatusOs,
} from "@/data/types";

const novaLinha = (ordem: number): EcLinha => ({
  id: `nl-${Date.now()}-${ordem}-${Math.random().toString(36).slice(2, 6)}`,
  grupo: "GERAL",
  item: "",
  descricao: "",
  valorPolobh: 0,
  valorCliente: 0,
  valorGasto: 0,
  statusAprovacao: "Pendente",
  fornecedorRazao: "",
  fornecedorCnpj: "",
  faturaNf: "",
  codigoServico: "",
  pedidoCompra: "",
  statusOs: "Pendente",
  contrato: "",
  observacao: "",
  ordem,
});

const clienteVazio = (): Cliente => ({
  id: "",
  nome: "",
  razaoSocial: "",
  endereco: "",
  cnpjCpf: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  representante: { nome: "", cargo: "", telefones: "", email: "" },
});

const projetoVazio = (): ProjetoInfo => ({
  titulo: "",
  local: "",
  enderecoLocal: "",
  participantes: null,
  produtoraResponsavel: "",
  telefoneProdutora: "",
  emailProdutora: "",
  preEvento: "",
  evento: "",
  posEvento: "",
  horario: "",
  roteiro: "",
  incentivosFiscais: "",
});

export function EcForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const editando = Boolean(id);
  const { data: existente } = useAsync(() => (id ? repo.ecs.obter(id) : Promise.resolve(undefined)), [id]);

  const verFinanceiro = useAuth((s) => s.pode("financeiro"));
  const [ec, setEc] = useState<Ec | null>(null);
  const [baseline, setBaseline] = useState("");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjMsg, setCnpjMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  // inicia o formulário e registra a "foto" base para detectar alterações
  const iniciar = (e: Ec) => {
    setEc(e);
    setBaseline(JSON.stringify(e));
  };

  useEffect(() => {
    if (editando) {
      if (existente) iniciar(structuredClone(existente));
    } else if (!ec) {
      const agora = new Date().toISOString();
      const projetoId = params.get("projeto") ?? "";
      const template = (params.get("template") ?? "") as Ec["template"];
      // Pré-preenche as linhas com o modelo escolhido (Corporativo/Cultural).
      const itensTpl = itensDoTemplate(template);
      const linhasIniciais: EcLinha[] = itensTpl.length
        ? itensTpl.map((it, i) => ({
            ...novaLinha(i),
            grupo: it.grupo,
            item: it.item,
            descricao: it.descricao,
          }))
        : [novaLinha(0)];
      const montar = (cliente: Cliente, projeto: ReturnType<typeof projetoVazio>) =>
        iniciar({
          id: "",
          numero: numeroEc(cliente.nome || "Novo Cliente", projeto.titulo || "Novo Projeto", 1),
          slugPublico: "",
          projetoId,
          template,
          versao: 1,
          status: "Rascunho",
          clienteId: "",
          cliente,
          projeto,
          linhas: linhasIniciais,
          producao: producaoPadrao(),
          responsavel: projeto.produtoraResponsavel || "",
          validadeDias: 30,
          criadoEm: agora,
          atualizadoEm: agora,
        });
      // Nova EC dentro de um Projeto: herda Cliente + infos do projeto.
      if (projetoId) {
        repo.projetos.obter(projetoId).then((pr) =>
          montar(pr?.cliente ?? clienteVazio(), pr?.info ?? projetoVazio())
        );
      } else {
        montar(clienteVazio(), projetoVazio());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existente, editando]);

  const t = useMemo(
    () => (ec ? calcularTotais(ec.linhas, ec.producao) : null),
    [ec]
  );

  const sujo = !!ec && baseline !== "" && JSON.stringify(ec) !== baseline;
  const guard = useUnsavedGuard(sujo);

  if (!ec || !t) {
    return <PageShell breadcrumb={<Crumb>EC</Crumb>} title="Carregando…">{null}</PageShell>;
  }

  const upd = (patch: Partial<Ec>) => setEc((e) => (e ? { ...e, ...patch } : e));
  const updCli = (patch: Partial<Cliente>) =>
    setEc((e) => (e ? { ...e, cliente: { ...e.cliente, ...patch } } : e));
  const updProj = (patch: Partial<ProjetoInfo>) =>
    setEc((e) => (e ? { ...e, projeto: { ...e.projeto, ...patch } } : e));
  const updLinha = (lid: string, patch: Partial<EcLinha>) =>
    setEc((e) =>
      e ? { ...e, linhas: e.linhas.map((l) => (l.id === lid ? { ...l, ...patch } : l)) } : e
    );

  const numero = numeroEc(ec.cliente.nome || "Cliente", ec.projeto.titulo || "Projeto", ec.versao);
  const temProjeto = Boolean(ec.projetoId);

  async function consultar() {
    setCnpjMsg("");
    setCnpjLoading(true);
    try {
      const d = await consultarCnpj(ec!.cliente.cnpjCpf);
      updCli({
        nome: d.nomeFantasia || d.razaoSocial,
        razaoSocial: d.razaoSocial,
        endereco: d.endereco,
      });
      setCnpjMsg("Dados preenchidos pela BrasilAPI.");
    } catch (e) {
      setCnpjMsg((e as Error).message);
    } finally {
      setCnpjLoading(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    try {
      const salvo = await repo.ecs.salvar({
        ...ec!,
        numero,
        responsavel: ec!.responsavel || ec!.projeto.produtoraResponsavel,
      });
      toast("Estimativa salva.", "success");
      guard.liberar();
      navigate(`/estimativas/${salvo.id}`);
    } catch (e) {
      toast(`Erro ao salvar: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <PageShell
      breadcrumb={
        <>
          <button onClick={() => navigate("/estimativas")} className="hover:text-ink">Estimativas</button>
          <IcChevron width={14} height={14} />
          <Crumb>{editando ? "Editar EC" : "Nova EC"}</Crumb>
        </>
      }
      title={editando ? "Editar Estimativa" : "Nova Estimativa"}
      topAction={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<IcDownload width={16} height={16} />} onClick={() => gerarEcExcel({ ...ec, numero })}>
            Gerar Excel
          </Button>
          <Button size="sm" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      }
    >
      {/* Banner numeração */}
      <div className="mb-5 rounded-card bg-black text-white px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <Eyebrow><span className="text-white/50">Numeração automática</span></Eyebrow>
          <div className="font-display font-bold text-lg tracking-tight mt-1">{numero}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-[13px]">Versão</span>
          <span className="font-display font-bold text-amber text-lg">V{String(ec.versao).padStart(2, "0")}</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Cliente e Projeto só aparecem em EC avulsa; dentro de um Projeto os dados
            ficam na aba "Dados Gerais" e não são reeditados aqui. */}
        {!temProjeto && (
        <>
        {/* Cliente */}
        <Card>
          <CardTitle action={
            <Button variant="soft" size="sm" icon={<IcSearch width={15} height={15} />} onClick={consultar} disabled={cnpjLoading || !flags.consultaCnpj}>
              {cnpjLoading ? "Consultando…" : "Consultar CNPJ"}
            </Button>
          }>Cliente</CardTitle>
          {cnpjMsg && <div className="mb-3 text-[12.5px] text-info bg-info-soft rounded-btn px-3 py-2">{cnpjMsg}</div>}
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="CNPJ/CPF"><Input value={ec.cliente.cnpjCpf} onChange={(e) => updCli({ cnpjCpf: maskCpfCnpjInput(e.target.value) })} inputMode="numeric" placeholder="00.000.000/0000-00" /></Field>
            <Field label="Cliente (nome)"><Input value={ec.cliente.nome} onChange={(e) => updCli({ nome: e.target.value })} /></Field>
            <Field label="Razão Social" className="md:col-span-2"><Input value={ec.cliente.razaoSocial} onChange={(e) => updCli({ razaoSocial: e.target.value })} /></Field>
            <Field label="Endereço" className="md:col-span-2"><Input value={ec.cliente.endereco} onChange={(e) => updCli({ endereco: e.target.value })} /></Field>
            <Field label="Inscrição Estadual"><Input value={ec.cliente.inscricaoEstadual} onChange={(e) => updCli({ inscricaoEstadual: e.target.value })} /></Field>
            <Field label="Inscrição Municipal"><Input value={ec.cliente.inscricaoMunicipal} onChange={(e) => updCli({ inscricaoMunicipal: e.target.value })} /></Field>
            <Field label="Representante"><Input value={ec.cliente.representante.nome} onChange={(e) => updCli({ representante: { ...ec.cliente.representante, nome: e.target.value } })} /></Field>
            <Field label="E-mail do representante"><Input value={ec.cliente.representante.email} onChange={(e) => updCli({ representante: { ...ec.cliente.representante, email: e.target.value } })} /></Field>
          </div>
        </Card>

        {/* Projeto */}
        <Card>
          <CardTitle>Projeto</CardTitle>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Título do evento" className="md:col-span-2"><Input value={ec.projeto.titulo} onChange={(e) => updProj({ titulo: e.target.value })} /></Field>
            <Field label="Local"><Input value={ec.projeto.local} onChange={(e) => updProj({ local: e.target.value })} /></Field>
            <Field label="Endereço do local"><Input value={ec.projeto.enderecoLocal} onChange={(e) => updProj({ enderecoLocal: e.target.value })} /></Field>
            <Field label="Nº de participantes"><Input type="number" value={ec.projeto.participantes ?? ""} onChange={(e) => updProj({ participantes: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Produtora responsável"><Input value={ec.projeto.produtoraResponsavel} onChange={(e) => updProj({ produtoraResponsavel: e.target.value })} /></Field>
            <Field label="Pré-evento"><Input type="date" value={ec.projeto.preEvento} onChange={(e) => updProj({ preEvento: e.target.value })} /></Field>
            <Field label="Evento"><Input type="date" value={ec.projeto.evento} onChange={(e) => updProj({ evento: e.target.value })} /></Field>
            <Field label="Pós-evento"><Input type="date" value={ec.projeto.posEvento} onChange={(e) => updProj({ posEvento: e.target.value })} /></Field>
            <Field label="Horário"><Input value={ec.projeto.horario} onChange={(e) => updProj({ horario: e.target.value })} placeholder="08h às 18h" /></Field>
            <Field label="Roteiro" className="md:col-span-2"><Textarea value={ec.projeto.roteiro} onChange={(e) => updProj({ roteiro: e.target.value })} /></Field>
          </div>
        </Card>
        </>
        )}

        {/* Tabela de custos */}
        <Card padded={false}>
          <div className="p-5 flex items-center justify-between">
            <CardTitle hint="Agrupe por GRUPO. Totais recalculam ao vivo.">Estimativa de custos</CardTitle>
            <Button variant="secondary" size="sm" icon={<IcPlus width={16} height={16} />}
              onClick={() => upd({ linhas: [...ec.linhas, novaLinha(ec.linhas.length)] })}>
              Adicionar linha
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-y border-border bg-[#FAFAFB]">
                  {["Grupo", "Item", "Descrição", "Fornecedor", "Pólobh", "Cliente", "Aprov.", "OS", "Contrato", ""].map((h) => (
                    <th key={h} className="px-3 py-2 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ec.linhas.map((l) => (
                  <tr key={l.id} className="border-b border-border-soft align-top">
                    <td className="px-2 py-2 w-28"><Input className="!h-9 !px-2 !text-[12.5px]" value={l.grupo} onChange={(e) => updLinha(l.id, { grupo: e.target.value })} /></td>
                    <td className="px-2 py-2 w-32"><Input className="!h-9 !px-2 !text-[12.5px]" value={l.item} onChange={(e) => updLinha(l.id, { item: e.target.value })} /></td>
                    <td className="px-2 py-2 min-w-[220px]"><Textarea className="!min-h-9 !py-1.5 !px-2 !text-[12.5px]" rows={1} value={l.descricao} onChange={(e) => updLinha(l.id, { descricao: e.target.value })} /></td>
                    <td className="px-2 py-2 min-w-[160px]">
                      <Input className="!h-9 !px-2 !text-[12.5px]" placeholder="Razão social" value={l.fornecedorRazao} onChange={(e) => updLinha(l.id, { fornecedorRazao: e.target.value })} />
                      <Input className="!h-8 !px-2 !text-[12px] mt-1" placeholder="CNPJ" value={l.fornecedorCnpj} onChange={(e) => updLinha(l.id, { fornecedorCnpj: e.target.value })} />
                    </td>
                    <td className="px-2 py-2 w-28"><NumberInput className="!h-9 !px-2 !text-[12.5px]" value={l.valorPolobh} onValue={(v) => updLinha(l.id, { valorPolobh: v })} /></td>
                    <td className="px-2 py-2 w-28"><NumberInput className="!h-9 !px-2 !text-[12.5px]" value={l.valorCliente} onValue={(v) => updLinha(l.id, { valorCliente: v })} /></td>
                    <td className="px-2 py-2 w-28">
                      <Select className="!h-9 !px-2 !text-[12px]" value={l.statusAprovacao} onChange={(e) => updLinha(l.id, { statusAprovacao: e.target.value as StatusAprovacao })}>
                        <option>Pendente</option><option>OK</option>
                      </Select>
                    </td>
                    <td className="px-2 py-2 w-28">
                      <Select className="!h-9 !px-2 !text-[12px]" value={l.statusOs} onChange={(e) => updLinha(l.id, { statusOs: e.target.value as StatusOs })}>
                        <option>Pendente</option><option>Emitir</option><option>OK</option>
                      </Select>
                    </td>
                    <td className="px-2 py-2 w-32"><Input className="!h-9 !px-2 !text-[12.5px]" placeholder="Nº/ref." value={l.contrato} onChange={(e) => updLinha(l.id, { contrato: e.target.value })} /></td>
                    <td className="px-2 py-2">
                      <button
                        onClick={async () => {
                          const temConteudo = l.item || l.descricao || l.valorPolobh || l.valorCliente || l.fornecedorRazao;
                          if (temConteudo && !(await confirmar({
                            titulo: "Remover esta linha de custo?",
                            mensagem: l.item || l.descricao || "Esta linha será excluída da estimativa.",
                            confirmarTexto: "Remover",
                            tom: "danger",
                          }))) return;
                          upd({ linhas: ec.linhas.filter((x) => x.id !== l.id) });
                        }}
                        className="text-ink-3 hover:text-danger p-1.5"
                        title="Remover"
                      >
                        <IcTrash width={16} height={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Produção + Totais */}
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
          <Card>
            <CardTitle hint="Valores padrão editáveis. Informe as quantidades.">Produção</CardTitle>
            <ProducaoEditor ec={ec} setEc={setEc} />
          </Card>
          <Card>
            <CardTitle>Totais ao vivo</CardTitle>
            <dl className="space-y-2 text-sm">
              <LinhaTotal label="Soma fornecedores" v={brl(t.somaFornecedores)} />
              <LinhaTotal label="Honorários Pólobh (15%)" v={brl(t.honorariosPolobh)} />
              <LinhaTotal label="Encargos (16,33%)" v={brl(t.encargos)} />
              <LinhaTotal label="Sub-total Pólobh" v={brl(t.subTotalPolobh)} strong />
              <LinhaTotal label="Faturamento terceiros" v={brl(t.faturamentoTerceiros)} />
              <LinhaTotal label="Honorários cliente (15%)" v={brl(t.honorariosCliente)} />
              <div className="flex items-center justify-between bg-primary-soft rounded-btn px-3 py-2.5 mt-2">
                <span className="font-bold text-ink">Valor total bruto</span>
                <span className="font-display font-bold text-primary-dark">{brl(t.valorTotalBruto)}</span>
              </div>
            </dl>
          </Card>
        </div>

        {/* Rentabilidade por item (restrito ao financeiro) */}
        {verFinanceiro && (
          <Card padded={false}>
            <div className="p-5">
              <CardTitle hint="Lance o valor gasto em cada item; a rentabilidade (A−B)/A é calculada automaticamente.">
                Rentabilidade por item
              </CardTitle>
            </div>
            <RentabilidadeItens linhas={ec.linhas} onGasto={(id, v) => updLinha(id, { valorGasto: v })} />
          </Card>
        )}
      </div>
    </PageShell>
  );
}

function LinhaTotal({ label, v, strong }: { label: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-2">{label}</span>
      <span className={strong ? "font-display font-bold text-ink" : "font-semibold text-ink"}>{v}</span>
    </div>
  );
}

function ProducaoEditor({ ec, setEc }: { ec: Ec; setEc: React.Dispatch<React.SetStateAction<Ec | null>> }) {
  const p = ec.producao;
  const updP = (patch: Partial<typeof p>) =>
    setEc((e) => (e ? { ...e, producao: { ...e.producao, ...patch } } : e));

  const linhas: { nome: string; valorKey: keyof typeof p; qtdKey: keyof typeof p }[] = [
    { nome: "Despesas operacionais", valorKey: "despesasOperacionais", qtdKey: "qtdDespesas" },
    { nome: "Equipe — diária BH", valorKey: "equipeBH", qtdKey: "qtdEquipeBH" },
    { nome: "Equipe — diária Viagem", valorKey: "equipeViagem", qtdKey: "qtdEquipeViagem" },
    { nome: "Transporte BH /dia", valorKey: "transporteBH", qtdKey: "qtdTransporteBH" },
    { nome: "Transporte Viagem /dia", valorKey: "transporteViagem", qtdKey: "qtdTransporteViagem" },
    { nome: "Alimentação BH /dia", valorKey: "alimentacaoBH", qtdKey: "qtdAlimentacaoBH" },
    { nome: "Alimentação Viagem", valorKey: "alimentacaoViagem", qtdKey: "qtdAlimentacaoViagem" },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_90px_70px_90px] gap-2 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3 px-1">
        <span>Item</span><span className="text-right">Valor</span><span className="text-right">Qtd</span><span className="text-right">Subtotal</span>
      </div>
      {linhas.map((row) => {
        const valor = p[row.valorKey] as number;
        const qtd = p[row.qtdKey] as number;
        return (
          <div key={row.nome} className="grid grid-cols-[1fr_90px_70px_90px] gap-2 items-center">
            <span className="text-[12.5px] text-ink">{row.nome}</span>
            <NumberInput className="!h-9 !px-2 !text-[12.5px]" value={valor} onValue={(v) => updP({ [row.valorKey]: v } as Partial<typeof p>)} />
            <NumberInput className="!h-9 !px-2 !text-[12.5px]" value={qtd} onValue={(v) => updP({ [row.qtdKey]: v } as Partial<typeof p>)} />
            <span className="text-right text-[12.5px] font-display font-bold text-ink">{brl(valor * qtd)}</span>
          </div>
        );
      })}
    </div>
  );
}
