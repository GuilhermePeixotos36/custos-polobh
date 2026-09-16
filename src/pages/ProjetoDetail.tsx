import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { BarraProjeto } from "@/components/layout/BarraSecao";
import { NAV_PROJETO } from "@/components/layout/nav";
import {
  Card, CardTitle, Button, Field, Input, Label, TelefoneInput, Textarea, Select, Badge,
  Table, THead, Tr, Td, EmptyState, ThOrd, useOrdenacao, tomStatusOs, type Tom,
} from "@/components/ui";
import { IcPlus, IcBack, IcDownload, IcSearch, IcTrash, IcEye, IcEyeOff, IcDoc, IcCopy, IcCalendar, IcPencil } from "@/components/icons";
import { RichTextField } from "@/components/RichTextField";
import { InscricaoMunicipalInput } from "@/components/InscricaoMunicipalInput";
import { TextosJaUsados } from "@/components/TextosJaUsados";
import { TimelineConsolidada, type ItemConsolidado } from "@/components/Timeline";
import { NavegadorPendencias } from "@/components/NavegadorPendencias";
import { ThPendencias, TdPendencias } from "@/components/ColunaPendencias";
import { NotifDot } from "@/components/NotifDot";
import { MoverSetas, moverNaLista } from "@/components/MoverSetas";
import { ListaArrastavel, ItemArrastavel } from "@/components/ListaArrastavel";
import { CronogramaProjetoEditor } from "@/components/CronogramaProjetoEditor";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { useMinhasPendencias, usePendencias } from "@/store/pendencias";
import { useResponsaveis } from "@/hooks/useResponsaveis";
import { useSugestoes } from "@/hooks/useSugestoes";
import { filhosDe, type CampoSugerido } from "@/domain/sugestoes";
import { useAuth } from "@/store/auth";
import { gerarCronogramaExcel, gerarDadosUteisExcel } from "@/lib/excel";
import { cnpjValido, consultarCnpj } from "@/lib/cnpj";
import { numeroEc, tituloEc } from "@/domain/calc";
import { camposObrigatoriosProjeto, compoeTituloProjeto, novoRoteiroExtra, projetoInfoVazio, sincronizarCamposLegados } from "@/domain/projeto";
import { flags } from "@/lib/flags";
import { destacarElemento, idAncoraPendencia, idBlocoRoteiro } from "@/lib/destaque";
import { cx, dataBR, maskCpfCnpjInput, maskDoc, onlyDigits } from "@/lib/format";
import { toast } from "@/store/toast";
import { ChecklistProjeto } from "@/components/ChecklistProjeto";
import { useChecklistProjeto } from "@/hooks/useChecklistProjeto";
import { janelaDoProjeto } from "@/domain/checklist";
import { confirmar } from "@/store/confirm";
import { corrigirRoteirosProjeto } from "@/lib/correcaoOrtografica";
import { eventoEncerradoHaDias, statusProjetoAutomatico } from "@/domain/statusProjeto";
import { RepercutirMudancasModal } from "@/components/RepercutirMudancasModal";
import {
  ecsAtualizaveis,
  mudancasDoEvento,
  ossReemitiveis,
  type MudancaEvento,
  type SnapshotEvento,
} from "@/domain/mudancasEvento";
import { ABAS_COM_CONVERSA } from "@/data/types";
import { nomeCurtoFornecedor } from "@/domain/fornecedor";
import type { AbaComConversa, Cliente, Ec, Observacao, Projeto, ProjetoInfo, StatusOsDoc, StatusProjeto } from "@/data/types";
import { ancoraConversaAba, ancoraProjetoSemEc, pendenciasDaTela, type Pendencia } from "@/domain/pendencias";
import { CardConversa } from "@/components/CardConversa";
import { situacaoEc, ROTULO_SITUACAO_EC, TOM_SITUACAO_EC } from "@/domain/ec";
import { itensDaOs } from "@/domain/os";
import { ThItensOs, TdItensOs } from "@/components/ColunaItensOs";
import { CredenciamentoProjeto } from "@/components/CredenciamentoProjeto";
import { dadosUteisDosFornecedores } from "@/domain/dadosUteis";
import { EnvioCronograma } from "@/components/EnvioCronograma";

const tomStatusProjeto: Record<StatusProjeto, Tom> = {
  Ativo: "success", Arquivado: "neutral",
};

const clienteVazio = (): Cliente => ({
  id: "", apelido: "", nome: "", razaoSocial: "", endereco: "", cnpjCpf: "",
  inscricaoEstadual: "", inscricaoMunicipal: "",
  representante: { nome: "", cargo: "", telefones: "", email: "" },
});
const projetoVazio = (): Projeto => ({
  id: "", nome: "", cliente: clienteVazio(), info: projetoInfoVazio(),
  docsUrl: "", status: "Ativo", criadoEm: "", atualizadoEm: "",
});

type Aba = "dados" | "ec" | "os" | "checklist" | "cronograma" | "credenciamento" | "fornecedores";
/**
 * As abas moram em `layout/nav` porque não são só desta tela: a mesma barra
 * aparece dentro da EC e da OS (o "segundo cabeçalho" — ver `BarraProjeto`).
 * Duas listas discordariam no dia em que uma aba mudasse de nome.
 */
const ABAS = NAV_PROJETO as { key: Aba; label: string }[];

const ROTEIROS_PADRAO = {
  preEvento: { label: "Pré Evento", placeholder: "Descreva o roteiro de pré-evento…" },
  evento: { label: "Evento", placeholder: "Descreva o roteiro do evento…" },
  posEvento: { label: "Pós Evento", placeholder: "Descreva o roteiro de pós-evento…" },
} as const;

export function ProjetoDetail() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const novo = id === "novo";
  const abaParam = params.get("aba");
  const abaInicial: Aba = ABAS.some((a) => a.key === abaParam) ? (abaParam as Aba) : "dados";
  const { porAba, porOs, porEc, itens: minhasPendencias } = useMinhasPendencias();
  const podeEditarProjeto = useAuth((s) => s.pode("projetos.editar"));
  const podeEditarChecklist = useAuth((s) => s.pode("checklists.editar"));
  // Criar/importar EC grava uma EC nova — o banco recusa quem não tem o recurso,
  // então o botão não pode existir para quem só consulta (era erro cru na cara).
  const podeEditarEc = useAuth((s) => s.pode("ecs.editar"));

  const { data: existente, loading } = useAsync(() => (novo ? Promise.resolve(undefined) : repo.projetos.obter(id)), [id]);
  const { data: ecsAll } = useAsync(() => repo.ecs.listar(), []);
  const { data: ossAll } = useAsync(() => repo.oss.listar(), []);
  const { data: clientesAll } = useAsync(() => repo.clientes.listar(), []);
  // Usuários elegíveis a Produtor Responsável — critério vem da área (ver useResponsaveis).
  const { data: usuariosAll } = useAsync(() => repo.auth.usuarios(), []);
  const produtoresResponsaveis = useResponsaveis(usuariosAll);
  // O que a casa já usou nestes campos, em outros projetos — ver `domain/sugestoes`.
  const sugestoes = useSugestoes();
  /** Nomes de todos os usuários — @menções e escolha de responsável no check-list. */
  const nomesUsuarios = useMemo(() => (usuariosAll ?? []).map((u) => u.nome).filter(Boolean), [usuariosAll]);
  // Lista completa (com e-mail real) — só carrega para quem tem permissão de configurações;
  // se não tiver (ex.: Produção), falha em silêncio e o e-mail continua manual.
  const { data: usuariosCompletosData } = useAsync(() => repo.auth.usuariosCompletos().catch(() => null), []);
  // Só serve para achar o e-mail de quem já foi escolhido acima — sem filtro próprio.
  const produtoresCompletos = usuariosCompletosData ?? null;

  const [p, setP] = useState<Projeto>(projetoVazio());
  /** "Foto" do projeto como ele está salvo — serve para saber se há algo a salvar. */
  const [baseline, setBaseline] = useState("");
  const [aba, setAba] = useState<Aba>(abaInicial);

  /**
   * Grava a conversa de uma aba — otimista, e por caminho próprio.
   *
   * Otimista porque a conversa não pode ficar esperando o servidor; por caminho
   * próprio (`salvarConversa`) porque comentar não é editar o projeto: não
   * passa pela permissão de edição e não marca a tela como alterada, então uma
   * mensagem não obriga ninguém a salvar o cadastro do evento.
   */
  async function gravarConversa(daAba: AbaComConversa, observacoes: Observacao[]) {
    const anteriores = p.conversas?.[daAba] ?? [];
    setP((atual) => ({ ...atual, conversas: { ...atual.conversas, [daAba]: observacoes } }));
    try {
      const salvas = await repo.projetos.salvarConversa(id, daAba, observacoes);
      setP((atual) => ({ ...atual, conversas: { ...atual.conversas, [daAba]: salvas } }));
      // A bolinha de quem ficou com a vez acende (ou apaga) na hora.
      usePendencias.getState().carregar(true);
    } catch (e) {
      setP((atual) => ({ ...atual, conversas: { ...atual.conversas, [daAba]: anteriores } }));
      toast(`Não foi possível salvar a observação: ${(e as Error).message}`, "danger");
    }
  }
  /**
   * O sininho pode pedir OUTRA subguia do projeto que já está aberto — aí só a
   * URL muda, o componente não remonta e a aba ficaria na anterior.
   */
  useEffect(() => {
    if (abaParam && ABAS.some((a) => a.key === abaParam)) setAba(abaParam as Aba);
  }, [abaParam]);
  const [salvando, setSalvando] = useState(false);
  /**
   * Modo de edição dos Dados Gerais.
   *
   * A tela abre em LEITURA. O evento muda o tempo todo — troca de local, de
   * número de participantes, de data —, e os campos precisam ser editáveis;
   * mas deixá-los sempre abertos fazia de cada consulta um risco de alteração
   * sem querer num dado que alimenta EC e OS. Projeto novo já nasce em edição:
   * ali o ato é criar.
   */
  const [editando, setEditando] = useState(novo);
  /** Diferenças a repercutir em EC/OS depois de salvar (ver RepercutirMudancasModal). */
  const [repercussao, setRepercussao] = useState<{ mudancas: MudancaEvento[]; atual: SnapshotEvento } | null>(null);
  const [filtroEc, setFiltroEc] = useState<"todas" | "ativas" | "arquivadas">("todas");
  /** Mesmo filtro da EC, agora também na lista de OSs do projeto (15/09/2026). */
  const [filtroOs, setFiltroOs] = useState<"todas" | StatusOsDoc>("todas");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjMsg, setCnpjMsg] = useState("");
  const [cnpjFoco, setCnpjFoco] = useState(false);
  const [nomeClienteFoco, setNomeClienteFoco] = useState(false);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const ultimoCnpjAutopreenchido = useRef("");
  const ultimoCnpjConsultado = useRef("");
  // Importar EC de outro projeto (copia itens/valores para este projeto como rascunho).
  const [importOpen, setImportOpen] = useState(false);
  const [impProjetoId, setImpProjetoId] = useState("");
  const [impEcId, setImpEcId] = useState("");
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    if (novo) {
      setP(projetoVazio());
      setBaseline("");
      return;
    }
    if (!existente) return;
    const carregado = structuredClone(existente);
    setP(carregado);
    setBaseline(JSON.stringify(carregado));
    // Projeto já salvo: o CNPJ que veio do banco não pode disparar o
    // autopreenchimento nem a consulta à Receita. Marcá-lo como "já tratado"
    // evita que só abrir o projeto reescreva os dados do cliente (e faça o
    // formulário nascer alterado, com o botão Salvar aceso à toa).
    const digitos = onlyDigits(carregado.cliente.cnpjCpf);
    ultimoCnpjAutopreenchido.current = digitos;
    ultimoCnpjConsultado.current = digitos;
  }, [existente, novo]);

  const ecsDoProjeto = useMemo(
    () =>
      (ecsAll ?? [])
        .filter((e) => e.projetoId === id)
        .sort((a, b) => Number(b.ativa) - Number(a.ativa) || b.versao - a.versao),
    [ecsAll, id]
  );
  const ecsFiltradas = useMemo(
    () => ecsDoProjeto.filter((ec) => filtroEc === "todas" || (filtroEc === "ativas" ? ec.ativa : !ec.ativa)),
    [ecsDoProjeto, filtroEc]
  );

  const ecIds = useMemo(() => new Set(ecsDoProjeto.map((e) => e.id)), [ecsDoProjeto]);
  const ossDoProjeto = useMemo(() => (ossAll ?? []).filter((o) => ecIds.has(o.ecId)), [ossAll, ecIds]);
  const ossFiltradas = useMemo(
    () => ossDoProjeto.filter((os) => filtroOs === "todas" || os.status === filtroOs),
    [ossDoProjeto, filtroOs]
  );
  /**
   * Itens da EC que cada OS consolida — o conteúdo da caixinha do "olhinho" na
   * lista de OSs. Calculado uma vez para todas, e não por linha: a busca é na
   * lista inteira de ECs.
   */
  const itensPorOs = useMemo(() => {
    const mapa: Record<string, ReturnType<typeof itensDaOs>> = {};
    for (const o of ossDoProjeto) mapa[o.id] = itensDaOs(o, ecsAll ?? []);
    return mapa;
  }, [ossDoProjeto, ecsAll]);
  const statusExibido = useMemo(() => statusProjetoAutomatico(p, ecsDoProjeto), [p, ecsDoProjeto]);
  /** Dias desde o fim do evento — alimenta o lembrete de arquivar (ver abaixo). */
  const diasDesdeOEvento = useMemo(() => eventoEncerradoHaDias(p), [p]);
  /**
   * Projetos de origem da importação, derivados das ECs existentes.
   *
   * O PRÓPRIO projeto entra na lista, em primeiro lugar: reaproveitar uma versão
   * arquivada da própria EC — voltar para uma estrutura de custos anterior sem
   * reativá-la por cima da EC ativa — era o caso que a tela não deixava fazer.
   *
   * O rótulo traz APENAS o nome do projeto: o nome do cliente já está embutido
   * no título e só poluía a lista.
   */
  const projetosOrigem = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of ecsAll ?? []) {
      if (!e.projetoId || e.projetoId === id) continue;
      if (!map.has(e.projetoId)) map.set(e.projetoId, e.projeto?.titulo || e.numero);
    }
    const outros = [...map]
      .map(([projetoId, rotulo]) => ({ projetoId, rotulo }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
    const temProprias = (ecsAll ?? []).some((e) => e.projetoId === id);
    return temProprias
      ? [{ projetoId: id, rotulo: "Este projeto (versões anteriores)" }, ...outros]
      : outros;
  }, [ecsAll, id]);
  const ecsOrigem = useMemo(
    () => (ecsAll ?? []).filter((e) => e.projetoId === impProjetoId).sort((a, b) => Number(b.ativa) - Number(a.ativa) || b.versao - a.versao),
    [ecsAll, impProjetoId]
  );

  const etapas = useMemo<ItemConsolidado[]>(
    // NOME FANTASIA, não razão social (15/09/2026): o cronograma é lido no dia
    // da montagem, e "Sonora" identifica o fornecedor melhor do que
    // "Sonora Áudio e Iluminação Ltda" — que ainda estoura a coluna.
    () => ossDoProjeto.flatMap((o) => o.cronograma.map((c) => ({ ...c, fornecedor: nomeCurtoFornecedor(o.fornecedor) || "Fornecedor" }))),
    [ossDoProjeto]
  );
  /**
   * Folha de Dados Úteis: quem está no projeto, o que entrega e como se fala
   * com ele. Antes esta aba mostrava razão social, CNPJ e e-mail — sem
   * telefone, sem nome de gente e sem dizer o que o fornecedor faz ali, que é
   * exatamente o que se procura no dia da montagem.
   */
  const fornecedores = useMemo(
    () => dadosUteisDosFornecedores(ossDoProjeto, ecsAll ?? []),
    [ossDoProjeto, ecsAll]
  );

  // Ordenação de todas as listagens desta tela — mesmo mecanismo da lista de Projetos.
  const ecsOrdenadas = useOrdenacao(
    ecsFiltradas,
    {
      pendencias: (e) => porEc[e.id] ?? 0,
      titulo: (e) => tituloEc(e),
      // Booleano em vez do rótulo: ordenado por texto, "Arquivada" viria antes de
      // "Ativa". Como booleano, a EC ativa é sempre a primeira.
      status: (e) => e.ativa,
    },
    // Padrão = ativa no topo; dentro do mesmo status, a ordenação estável preserva
    // a da lista de origem (versão mais nova primeiro).
    { col: "status", dir: "asc" }
  );
  const ossOrdenadas = useOrdenacao(
    ossFiltradas,
    {
      pendencias: (o) => porOs[o.id] ?? 0,
      numero: (o) => o.numero,
      fornecedor: (o) => nomeCurtoFornecedor(o.fornecedor),
      status: (o) => o.status,
    },
    { col: "numero", dir: "asc" }
  );
  const fornecedoresOrdenados = useOrdenacao(
    fornecedores,
    {
      fornecedor: (f) => f.fornecedor,
      itens: (f) => f.itens.join(", "),
      contato: (f) => f.contato,
      telefone: (f) => f.telefone,
      email: (f) => f.email,
    },
    { col: "fornecedor", dir: "asc" }
  );

  // Linhas do cronograma (uma por etapa da OS, com Data e Horário próprios).
  // Se ainda não houver etapas cadastradas nas OSs, cai para as contratações da EC.
  const linhasCronograma = useMemo(() => {
    const doOs = etapas
      .filter((e) => e.data || e.horario || e.etapa || e.atividades)
      .map((e) => ({
        // `iso` só existe para ordenar: a data formatada ("DD MM AA") não é ordenável.
        iso: e.data || "",
        data: dataBR(e.data),
        horario: e.horario || "",
        fornecedor: e.fornecedor || "",
        descritivo: [e.etapa, e.atividades].filter(Boolean).join(" — "),
        produtor: "",
      }));
    if (doOs.length) {
      return doOs
        .sort((a, b) => a.iso.localeCompare(b.iso) || a.horario.localeCompare(b.horario))
        .map(({ iso: _iso, ...linha }) => linha);
    }
    // Fallback: contratações da EC (sem data/horário — a equipe preenche).
    const ecLinhas = ecsDoProjeto.filter((e) => e.status !== "Cancelada").flatMap((e) => e.linhas);
    const comForn = ecLinhas.filter((l) => l.fornecedorRazao.trim());
    const base = comForn.length ? comForn : ecLinhas.filter((l) => l.item || l.descricao);
    return base.map((l) => ({
      data: "",
      horario: "",
      fornecedor: l.fornecedorRazao,
      descritivo: [l.item, l.descricao].filter(Boolean).join(" — "),
      produtor: "",
    }));
  }, [etapas, ecsDoProjeto]);

  async function baixarCronograma() {
    const info = p.info;
    const data = info.preEvento && info.posEvento
      ? `${dataBR(info.preEvento)} a ${dataBR(info.posEvento)}`
      : dataBR(info.evento);
    try {
      await gerarCronogramaExcel({
        cliente: p.cliente.nome,
        titulo: info.titulo,
        modalidade: info.modalidade,
        data,
        horario: info.horario,
        local: info.local,
        enderecoLocal: info.enderecoLocal,
        itens: linhasCronograma,
        nomeArquivo: `Cronograma - ${p.nome || info.titulo || "Projeto"}`,
      });
      toast("Cronograma exportado para Excel.", "success");
    } catch (e) {
      toast(`Erro ao gerar o cronograma: ${(e as Error).message}`, "danger");
    }
  }

  async function baixarDadosUteis() {
    const info = p.info;
    try {
      await gerarDadosUteisExcel({
        cliente: p.cliente.nome,
        titulo: info.titulo,
        evento: dataBR(info.evento),
        local: [info.local, info.enderecoLocal].filter(Boolean).join(" — "),
        fornecedores,
        nomeArquivo: `Dados Uteis - ${p.nome || info.titulo || "Projeto"}`,
      });
      toast("Dados Úteis exportados para Excel.", "success");
    } catch (e) {
      toast(`Erro ao gerar a planilha: ${(e as Error).message}`, "danger");
    }
  }

  const updCli = (patch: Partial<Cliente>) => setP((x) => ({ ...x, cliente: { ...x.cliente, ...patch } }));

  /**
   * Aplica o cadastro central do cliente (razão social, endereço, documentos,
   * representante) — e SÓ isso.
   *
   * O apelido não vem junto de propósito: ele é decisão de quem cria o projeto,
   * e herdá-lo do cadastro fazia todo projeto novo do mesmo cliente nascer com
   * o apelido de um projeto antigo. O campo continua oferecendo os apelidos já
   * usados como sugestão — a pessoa escolhe, o sistema não escolhe por ela.
   */
  function aplicarClienteCadastrado(cliente: Cliente) {
    setP((atual) => ({ ...atual, cliente }));
    setCnpjFoco(false);
    setNomeClienteFoco(false);
    setCnpjMsg("");
  }

  // Autocomplete de cliente pelo CNPJ/CPF: sugere cadastros já arquivados cujo
  // número começa com o que foi digitado (ex.: digitar "0" já filtra os que começam com 0).
  const cnpjDigitado = onlyDigits(p.cliente.cnpjCpf);
  const sugestoesCliente = useMemo(() => {
    if (!cnpjDigitado) return [];
    return (clientesAll ?? [])
      .filter((c) => {
        const d = onlyDigits(c.cnpjCpf);
        return d.startsWith(cnpjDigitado) && d !== cnpjDigitado;
      })
      .slice(0, 8);
  }, [clientesAll, cnpjDigitado]);

  const sugestoesClientePorNome = useMemo(() => {
    const busca = p.cliente.nome.trim().toLocaleLowerCase("pt-BR");
    if (busca.length < 2) return [];
    return (clientesAll ?? [])
      .filter((c) => c.id !== p.cliente.id)
      .filter((c) => [c.nome, c.razaoSocial, c.apelido].some((valor) => valor.toLocaleLowerCase("pt-BR").includes(busca)))
      .slice(0, 8);
  }, [clientesAll, p.cliente.id, p.cliente.nome]);

  function selecionarClienteArquivado(c: Cliente) {
    aplicarClienteCadastrado(c);
  }

  // Ao informar um CNPJ/CPF já cadastrado, completa imediatamente todos os
  // dados do cliente e o apelido. Não reaplica enquanto o mesmo documento não mudar.
  useEffect(() => {
    if (!cnpjDigitado) {
      ultimoCnpjAutopreenchido.current = "";
      return;
    }
    if (ultimoCnpjAutopreenchido.current === cnpjDigitado) return;
    const cliente = (clientesAll ?? []).find((c) => onlyDigits(c.cnpjCpf) === cnpjDigitado);
    if (!cliente) return;
    ultimoCnpjAutopreenchido.current = cnpjDigitado;
    aplicarClienteCadastrado(cliente);
  }, [cnpjDigitado, clientesAll]);

  // Sem cadastro prévio, um CNPJ válido consulta os dados fiscais automaticamente.
  // CPF permanece manual, pois a fonte pública integrada é exclusiva para CNPJ.
  useEffect(() => {
    if (cnpjDigitado.length !== 14 || !cnpjValido(cnpjDigitado)) return;
    if ((clientesAll ?? []).some((c) => onlyDigits(c.cnpjCpf) === cnpjDigitado)) return;
    if (ultimoCnpjConsultado.current === cnpjDigitado) return;
    ultimoCnpjConsultado.current = cnpjDigitado;
    void consultarCnpjCliente(p.cliente.cnpjCpf);
  }, [cnpjDigitado, clientesAll]);
  const updInfo = (patch: Partial<ProjetoInfo>) => setP((x) => ({ ...x, info: { ...x.info, ...patch }, nome: patch.titulo ?? x.nome }));
  const updTituloParte = (patch: Partial<Pick<ProjetoInfo, "clienteAbreviado" | "nomeProjeto" | "anoProjeto">>) => {
    const clienteAbreviado = patch.clienteAbreviado ?? p.info.clienteAbreviado;
    const nomeProjeto = patch.nomeProjeto ?? p.info.nomeProjeto;
    const anoProjeto = patch.anoProjeto ?? p.info.anoProjeto;
    updInfo({ ...patch, titulo: compoeTituloProjeto(clienteAbreviado, nomeProjeto, anoProjeto) });
  };
  /**
   * Campos do projeto que são FILHOS de outro campo (ver `domain/sugestoes`).
   * Só campos de texto entram aqui — é o que o vínculo sabe preencher.
   */
  type CampoFilhoInfo = "enderecoLocal" | "telefoneProdutora" | "emailProdutora";
  const CAMPO_FILHO: Partial<Record<CampoSugerido, CampoFilhoInfo>> = {
    enderecoLocal: "enderecoLocal",
    telefoneProdutora: "telefoneProdutora",
    emailProdutora: "emailProdutora",
  };

  /**
   * Muda um campo PAI e traz junto o que a casa já usou com aquele valor.
   *
   * Escolher "Teatro Sesiminas" no Local preenche o Endereço do Local com o
   * endereço que veio junto nos projetos anteriores. A regra de sobrescrita é
   * conservadora: só preenche o filho VAZIO ou aquele que tinha vindo do
   * vínculo anterior (trocar de local troca o endereço). O que a pessoa digitou
   * à mão nunca é sobrescrito.
   */
  const comVinculo = (
    pai: CampoSugerido,
    valorAnterior: string,
    valorNovo: string,
    patch: Partial<ProjetoInfo>
  ) => {
    const antes = filhosDe(sugestoes, pai, valorAnterior);
    const agora = filhosDe(sugestoes, pai, valorNovo);
    const herdado: Partial<Pick<ProjetoInfo, CampoFilhoInfo>> = {};
    for (const [chave, valorFilho] of Object.entries(agora)) {
      const campo = CAMPO_FILHO[chave as CampoSugerido];
      if (!campo) continue;
      const atual = String(p.info[campo] ?? "");
      const veioDoVinculo = !!antes[chave as CampoSugerido] && atual === antes[chave as CampoSugerido];
      if (!atual || veioDoVinculo) herdado[campo] = valorFilho;
    }
    updInfo({ ...patch, ...herdado });
  };

  /** Mesma ideia para o representante do cliente (telefone e e-mail dele). */
  const escolherRepresentante = (nome: string) => {
    const antes = filhosDe(sugestoes, "representante", p.cliente.representante.nome);
    const agora = filhosDe(sugestoes, "representante", nome);
    const rep = { ...p.cliente.representante, nome };
    const manter = (atual: string, anterior?: string) => !atual || (!!anterior && atual === anterior);
    if (agora.representanteTelefone && manter(rep.telefones, antes.representanteTelefone)) {
      rep.telefones = agora.representanteTelefone;
    }
    if (agora.representanteEmail && manter(rep.email, antes.representanteEmail)) {
      rep.email = agora.representanteEmail;
    }
    updCli({ representante: rep });
  };

  /**
   * Produtor(a) responsável: telefone e e-mail vêm do CADASTRO quando existe e,
   * quando não existe, do que a casa já usou com essa pessoa em outros projetos.
   *
   * O e-mail só vem do cadastro para quem tem permissão de configurações (a
   * lista completa); sem ela, o histórico cobre o campo em vez de deixá-lo
   * vazio. Como nos demais vínculos, nada sobrescreve o que foi digitado à mão.
   */
  const escolherProdutora = (nome: string) => {
    const antes = filhosDe(sugestoes, "produtoraResponsavel", p.info.produtoraResponsavel);
    const agora = filhosDe(sugestoes, "produtoraResponsavel", nome);
    const leve = produtoresResponsaveis.find((u) => u.nome === nome);
    const completo = produtoresCompletos?.find((u) => u.nome === nome);
    const manter = (atual: string, anterior?: string) => !atual || (!!anterior && atual === anterior);
    const doHistorico = (campo: "telefoneProdutora" | "emailProdutora", atual: string) =>
      agora[campo] && manter(atual, antes[campo]) ? agora[campo] : atual;
    updInfo({
      produtoraResponsavel: nome,
      telefoneProdutora: leve?.telefone || doHistorico("telefoneProdutora", p.info.telefoneProdutora),
      emailProdutora: completo?.email || doHistorico("emailProdutora", p.info.emailProdutora),
    });
  };

  const moverRoteiro =(id: string, direcao: -1 | 1) =>
    updInfo({ roteiroOrdem: moverNaLista(p.info.roteiroOrdem, p.info.roteiroOrdem.indexOf(id), direcao) });
  const toggleRoteiroOculto = (secao: keyof ProjetoInfo["roteiros"]) =>
    updInfo({
      roteirosOcultos: p.info.roteirosOcultos.includes(secao)
        ? p.info.roteirosOcultos.filter((s) => s !== secao)
        : [...p.info.roteirosOcultos, secao],
    });

  async function consultarCnpjCliente(documento = p.cliente.cnpjCpf) {
    setCnpjMsg("");
    setCnpjLoading(true);
    try {
      const d = await consultarCnpj(documento);
      setP((atual) => {
        if (onlyDigits(atual.cliente.cnpjCpf) !== onlyDigits(documento)) return atual;
        return {
          ...atual,
          cliente: {
            ...atual.cliente,
            nome: atual.cliente.nome || d.nomeFantasia || d.razaoSocial,
            razaoSocial: d.razaoSocial,
            endereco: d.endereco,
            inscricaoEstadual: d.inscricaoEstadual || atual.cliente.inscricaoEstadual,
            inscricaoMunicipal: d.inscricaoMunicipal || atual.cliente.inscricaoMunicipal,
          },
        };
      });
      const preenchidas = [d.inscricaoEstadual && "IE", d.inscricaoMunicipal && "IM"].filter(Boolean).join(" e ");
      setCnpjMsg(preenchidas
        ? `Dados cadastrais e ${preenchidas} preenchidos automaticamente.`
        : "Dados cadastrais preenchidos. IE/IM não foram encontradas nas fontes integradas e permanecem editáveis.");
    } catch (e) {
      setCnpjMsg((e as Error).message);
    } finally {
      setCnpjLoading(false);
    }
  }

  /** Arquiva os dados do cliente no cadastro central (deduplicado por CNPJ/CPF) para reaproveitar em projetos futuros. */
  async function arquivarCliente(cliente: Cliente): Promise<Cliente> {
    const digitos = onlyDigits(cliente.cnpjCpf);
    if (!digitos) return cliente;
    const existenteArquivado = (clientesAll ?? []).find((c) => onlyDigits(c.cnpjCpf) === digitos);
    try {
      return await repo.clientes.salvar({ ...cliente, id: existenteArquivado?.id || "" });
    } catch (erro) {
      throw new Error(`Não foi possível arquivar os dados do cliente: ${(erro as Error).message}`);
    }
  }

  /**
   * O que esta aba cobra — o mesmo conjunto que o badge do título da subguia
   * conta, e que a pílula flutuante percorre. Inclui o que se resolve dentro de
   * uma EC ou de uma OS: aqui a pílula pisca a LINHA da listagem (a âncora já
   * vem trocada por `pendenciasDaTela`), e é de lá que se abre a tela para
   * responder. Também vira o badge de cada tarefa do check-list.
   */
  const pendenciasDaTelaAtual = useMemo(
    () => pendenciasDaTela(minhasPendencias, { projetoId: id, aba }),
    [minhasPendencias, id, aba]
  );
  /**
   * "Projeto sem estimativa" é o único número da subguia EC que não tem linha na
   * lista — ainda não existe EC nenhuma. Ele acende ao lado do título do card,
   * onde ficam os comandos de criar a primeira: assim o total do título continua
   * sendo a soma de coisas visíveis nesta tela.
   */
  const pendenciaSemEc = useMemo(
    () => pendenciasDaTelaAtual.filter((x) => x.tipo === "projeto.semEc").length,
    [pendenciasDaTelaAtual]
  );

  const camposObrigatoriosFaltando = () => camposObrigatoriosProjeto(p.info, p.cliente);

  // Derivado a cada render: assim que um campo apontado é corrigido, o destaque
  // vermelho some sozinho — não precisa tentar salvar de novo para "limpar".
  const faltandoAtual = camposObrigatoriosFaltando();
  const chavesComErro = new Set(tentouSalvar ? faltandoAtual.map((f) => f.chave) : []);

  // Projeto já salvo e sem edição nenhuma não tem o que salvar: o botão fica
  // apagado. Em projeto novo ele segue ativo — ali o ato é criar, não atualizar.
  const alterado = novo || (baseline !== "" && JSON.stringify(p) !== baseline);

  // Check-list do projeto. Depende de `alterado`: a lista é gerada a partir do
  // que está SALVO, nunca do que ainda está sendo digitado no formulário.
  const checklistProjeto = useChecklistProjeto(novo ? undefined : p, podeEditarChecklist, !alterado);

  /** Sai da edição jogando fora o que foi digitado — volta ao que está salvo. */
  function cancelarEdicao() {
    if (baseline) setP(JSON.parse(baseline));
    setTentouSalvar(false);
    setEditando(false);
  }

  async function salvar() {
    const faltando = camposObrigatoriosFaltando();
    if (faltando.length) {
      setTentouSalvar(true);
      toast(`Preencha os campos obrigatórios: ${faltando.map((f) => f.label).join(", ")}.`, "danger");
      return;
    }
    setSalvando(true);
    try {
      // Foto de como o evento estava ANTES de salvar — é contra ela que se
      // decide o que precisa (ou não) ser repercutido em EC e OS.
      const anterior: Projeto | null = baseline ? JSON.parse(baseline) : null;
      const revisao = await corrigirRoteirosProjeto(p.info.roteiros, p.info.roteirosExtras);
      const info = sincronizarCamposLegados({ ...p.info, roteiros: revisao.roteiros, roteirosExtras: revisao.roteirosExtras });
      const cliente = await arquivarCliente({ ...p.cliente, apelido: info.clienteAbreviado });
      const salvo = await repo.projetos.salvar({ ...p, cliente, info, nome: info.titulo || p.nome || "Projeto" });
      setP(salvo);
      // Nova referência do "já salvo" — o botão volta a ficar apagado na hora.
      setBaseline(JSON.stringify(salvo));
      setEditando(false);
      toast(revisao.revisaoCompleta
        ? "Projeto salvo e roteiros revisados automaticamente."
        : "Projeto salvo. A correção básica foi aplicada; a revisão por IA está indisponível no momento.", "success");

      /*
       * Mudou algo que a EC ou a OS imprimem, e o projeto já tem documento
       * emitido? Nada muda sozinho — mas quem salvou precisa poder decidir na
       * hora, enquanto sabe o que mudou e por quê.
       */
      const atual: SnapshotEvento = { info: salvo.info, cliente: salvo.cliente };
      const mudancas = anterior ? mudancasDoEvento({ info: anterior.info, cliente: anterior.cliente }, atual) : [];
      const temDocumento = ecsAtualizaveis(ecsDoProjeto).length > 0 || ossReemitiveis(ossDoProjeto).length > 0;
      if (mudancas.length && temDocumento) setRepercussao({ mudancas, atual });

      navigate(`/projetos/${salvo.id}`);
    } catch (e) {
      toast(`Erro ao salvar: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <PageShell title="Carregando…">{null}</PageShell>;
  if (!novo && !existente) return <PageShell title="Projeto não encontrado">{null}</PageShell>;

  /** Arquiva o projeto e toda a sua cadeia documental (ECs e OSs). */
  async function arquivarProjeto() {
    const ecsParaArquivar = ecsDoProjeto.filter((e) => e.status !== "Arquivada");
    const ossParaArquivar = ossDoProjeto.filter((o) => o.status !== "Arquivada");
    if (!(await confirmar({
      titulo: "Arquivar este projeto?",
      mensagem: `Serão arquivadas ${ecsParaArquivar.length} EC(s) e ${ossParaArquivar.length} OS(s) vinculada(s). Todas as pendências do projeto serão encerradas.`,
      confirmarTexto: "Arquivar projeto",
    }))) return;
    try {
      await repo.projetos.arquivarDocumentos(id);
      toast("Projeto, ECs e OSs arquivados.", "success");
      navigate(0);
    } catch (e) {
      toast(`Não foi possível arquivar: ${(e as Error).message}`, "danger");
    }
  }

  /**
   * GERA UMA NOVA VERSÃO da EC deste projeto, com a estrutura vinda de outra.
   *
   * É a mesma coisa que "Gerar nova versão" — numeração seguinte, entra no ar, a
   * anterior vai para o arquivo, e leva a marca de "cancela e substitui todas as
   * anteriores" —, mudando só DE ONDE vem o conteúdo: em vez de copiar a EC
   * atual, copia uma que já existe. A origem pode ser deste projeto ou de outro,
   * estar no ar ou arquivada, e nunca é tocada.
   *
   * A versão nova entra no ar também porque a EC tem dois estados (ver
   * `domain/ec`): o que não está no ar não se edita, e importar para depois não
   * poder mexer não serviria para nada. A anterior volta por "Tornar EC ativa"
   * quando se quiser — nada se perde, só muda qual delas vale agora.
   *
   * A CÓPIA DAS LINHAS acontece dentro do banco (`repo.ecs.importar`), e isso
   * não é detalhe: lida daqui, a EC de origem vem com os valores mascarados para
   * quem não enxerga o financeiro, e a importação gravava zero por cima do custo
   * de cada item, sem avisar. A versão e o número também saem de lá, sob trava.
   */
  async function importarEc() {
    const origem = (ecsAll ?? []).find((e) => e.id === impEcId);
    if (!origem) { toast("Selecione a EC de origem.", "warning"); return; }
    setImportando(true);
    try {
      const agora = new Date().toISOString();
      // Só o CABEÇALHO: cliente e dados do evento são os do projeto de destino.
      // As linhas o banco copia da origem — daqui elas viriam sem os valores.
      const nova: Ec = {
        ...origem,
        id: "",
        projetoId: id,
        clienteId: p.cliente.id,
        cliente: p.cliente,
        projeto: p.info,
        status: "Ativa",
        ativa: true,
        // "V01" é só a base: o banco troca pelo número da versão que couber aqui.
        numero: numeroEc(p.cliente.nome || "Cliente", p.info.titulo || "Projeto", 1),
        slugPublico: "",
        // Como em "Gerar nova versão": esta versão cancela e substitui as anteriores.
        canceladaSubstituida: true,
        criadoEm: agora,
        atualizadoEm: agora,
        linhas: [],
      };
      const salvo = await repo.ecs.importar(origem.id, nova);
      toast(
        `Nova versão V${String(salvo.versao).padStart(2, "0")} criada a partir de "${tituloEc(origem)}" (cancela e substitui). A anterior foi para o arquivo.`,
        "success"
      );
      setImportOpen(false);
      navigate(`/estimativas/${salvo.id}/editar`);
    } catch (e) {
      const erro = (e as Error).message;
      // O banco recusa a gravação para quem não edita EC — sem tradução, isso
      // chegava como "Sem permissão" solto, sem dizer permissão de quê.
      toast(
        erro.includes("Sem permissão")
          ? "Seu perfil pode consultar ECs, mas não criar. Peça a alguém da Direção ou da Produção."
          : `Não foi possível importar: ${erro}`,
        "danger"
      );
    } finally {
      setImportando(false);
    }
  }

  return (
    <PageShell
      title={novo ? "Novo projeto" : p.nome || "Projeto"}
      titleAdornment={!novo ? <Badge tom={tomStatusProjeto[statusExibido]}>{statusExibido}</Badge> : undefined}
      // Grudam junto com o título (ver PageShell): o projeto é uma tela longa, e
      // era preciso voltar ao topo só para salvar.
      acoes={
        <>
          <button onClick={() => navigate("/projetos")} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink font-semibold">
            <IcBack width={16} height={16} /> Voltar
          </button>
          {(aba === "dados" || novo) && podeEditarProjeto && (
            <div className="flex gap-2">
              {!novo && statusExibido !== "Arquivado" && !editando && (
                <Button variant="secondary" size="sm" onClick={arquivarProjeto}>Arquivar projeto</Button>
              )}
              {!editando ? (
                <Button size="sm" icon={<IcPencil width={15} height={15} />} onClick={() => setEditando(true)}>
                  Editar dados gerais
                </Button>
              ) : (
                <>
                  {!novo && (
                    <Button variant="secondary" size="sm" onClick={cancelarEdicao} disabled={salvando}>
                      Cancelar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={salvar}
                    disabled={salvando || !alterado}
                    title={alterado ? "Salvar as alterações do projeto" : "Nenhuma alteração para salvar"}
                  >
                    {salvando ? "Salvando…" : "Salvar projeto"}
                  </Button>
                </>
              )}
            </div>
          )}
        </>
      }
      // Grudam com o cabeçalho: em projeto longo (check-list inteiro, lista de
      // itens), trocar de aba não pode obrigar a voltar ao topo.
      subabas={
        <BarraProjeto
          projetoId={id}
          atual={aba}
          // Projeto ainda não salvo: só Dados Gerais faz sentido — as demais
          // dependem de um id que ainda não existe.
          desabilitadasExceto={novo ? "dados" : undefined}
          pendencias={Object.fromEntries(ABAS.map((a) => [a.key, porAba[`${id}:${a.key}`] ?? 0]))}
          // Aqui a troca é por dentro: a tela já está no projeto, e trocar de
          // aba não deve recarregar nada.
          onAba={(a) => setAba(a as Aba)}
        />
      }
    >
      {/* A CONVERSA DA ABA — o corredor da etapa, no topo dela.
          Quais abas têm uma está em `ABAS_COM_CONVERSA`, e a lista mudou em
          15/09/2026: Dados Gerais e Check-list entraram (o recado da etapa ia
          parar no campo de texto mais próximo), EC e OS saíram (ali a conversa
          mora DENTRO do documento — no corredor da listagem era uma terceira
          caixa de texto para o mesmo assunto). */}
      {!novo && (ABAS_COM_CONVERSA as readonly string[]).includes(aba) && (
        <div className="mb-4">
          <CardConversa
            ancora={ancoraConversaAba(id, aba)}
            ancoraDom={idAncoraPendencia(ancoraConversaAba(id, aba))}
            observacoes={p.conversas?.[aba as AbaComConversa] ?? []}
            usuarios={nomesUsuarios}
            minhas={minhasPendencias.filter((x) => x.tipo === "projeto.conversa" && x.projetoId === id && x.aba === aba).length}
            onChange={(observacoes) => gravarConversa(aba as AbaComConversa, observacoes)}
          />
        </div>
      )}

      {/* O LEMBRETE QUE SUBSTITUI O "CONCLUÍDO" (15/09/2026).
          O selo saiu porque encerrava as pendências sozinho na virada da data
          do evento — e é justamente aí que sobram nota, acerto e pagamento. Só
          que sem ele o projeto ficaria ativo para sempre. Então o sistema
          lembra, e quem decide é quem sabe se ainda falta alguma coisa. */}
      {!novo && aba === "dados" && diasDesdeOEvento !== null && diasDesdeOEvento >= 7 && statusExibido === "Ativo" && podeEditarProjeto && (
        <div className="mb-4 flex items-center gap-3 flex-wrap rounded-card border border-warning/40 bg-warning-soft px-4 py-3 text-[13px] text-ink">
          <span>
            O evento terminou há <b>{diasDesdeOEvento} dias</b> e o projeto continua ativo — ele segue cobrando
            pendências da equipe. Se não há mais nota, acerto ou pagamento em aberto, arquive-o.
          </span>
          <Button size="sm" variant="secondary" className="ml-auto" onClick={arquivarProjeto}>
            Arquivar projeto
          </Button>
        </div>
      )}

      {aba === "dados" && (
        /*
         * `fieldset disabled` trava de uma vez todos os campos da aba — input,
         * select, textarea e botão herdam sozinhos, sem cada um precisar saber
         * do modo leitura. O que não herda (o rich-text, que é contentEditable)
         * recebe `somenteLeitura` na mão.
         */
        <fieldset
          disabled={!editando}
          className={cx("space-y-4 min-w-0", !editando && "[&_button:disabled]:opacity-50 [&_button:disabled]:cursor-default")}
        >
          {!editando && podeEditarProjeto && (
            <div className="flex items-center gap-2 rounded-card border border-border-soft bg-[#FBFBFC] px-4 py-2.5 text-[12.5px] text-ink-2">
              <IcEye width={15} height={15} className="shrink-0 text-ink-3" />
              {/* Só "Modo leitura" (15/09/2026): a explicação de três linhas
                  dizia, toda vez, o que o botão ao lado já diz — e o que
                  acontece com EC e OS emitidas agora é dito na hora certa, no
                  alerta que aparece ao salvar. */}
              <span>Modo leitura</span>
            </div>
          )}
          <Card data-tour="projeto-cliente">
              <CardTitle action={
                <Button variant="soft" size="sm" icon={<IcSearch width={15} height={15} />} onClick={() => consultarCnpjCliente()} disabled={cnpjLoading || !flags.consultaCnpj}>
                  {cnpjLoading ? "Consultando…" : "Consultar CNPJ"}
                </Button>
              }>Cliente</CardTitle>
              {cnpjMsg && <div className="mb-3 text-[12.5px] text-info bg-info-soft rounded-btn px-3 py-2">{cnpjMsg}</div>}
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="CNPJ/CPF">
                  <div className="relative">
                    <Input
                      value={p.cliente.cnpjCpf}
                      inputMode="numeric"
                      autoComplete="off"
                      erro={chavesComErro.has("cnpjCpf")}
                      onChange={(e) => updCli({ cnpjCpf: maskCpfCnpjInput(e.target.value) })}
                      onFocus={() => setCnpjFoco(true)}
                      onBlur={() => setTimeout(() => setCnpjFoco(false), 150)}
                      placeholder="00.000.000/0000-00"
                    />
                    {cnpjFoco && sugestoesCliente.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-btn border border-border-soft bg-surface shadow-lg">
                        {sugestoesCliente.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-3.5 py-2 text-sm hover:bg-bg border-b border-border-soft last:border-b-0"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selecionarClienteArquivado(c)}
                          >
                            <div className="font-bold text-ink">{maskDoc(c.cnpjCpf)}</div>
                            <div className="text-ink-2 text-[12.5px]">{c.nome || c.razaoSocial}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>
                <Field label="Cliente (nome)">
                  <div className="relative">
                    <Input
                      formato="titulo"
                      erro={chavesComErro.has("clienteNome")}
                      value={p.cliente.nome}
                      onChange={(e) => updCli({ nome: e.target.value })}
                      onFocus={() => setNomeClienteFoco(true)}
                      onBlur={() => setTimeout(() => setNomeClienteFoco(false), 150)}
                      autoComplete="off"
                    />
                    {nomeClienteFoco && sugestoesClientePorNome.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-btn border border-border-soft bg-surface shadow-lg">
                        {sugestoesClientePorNome.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-3.5 py-2 text-sm hover:bg-bg border-b border-border-soft last:border-b-0"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selecionarClienteArquivado(c)}
                          >
                            <div className="font-bold text-ink">{c.nome || c.razaoSocial}</div>
                            <div className="text-ink-2 text-[12.5px]">{[c.apelido, maskDoc(c.cnpjCpf)].filter(Boolean).join(" · ")}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>
                <Field label="Razão Social" className="sm:col-span-2"><Input formato="titulo-empresa" sugestoes={sugestoes.valores.clienteRazaoSocial} value={p.cliente.razaoSocial} onChange={(e) => updCli({ razaoSocial: e.target.value })} /></Field>
                <Field label="Endereço" className="sm:col-span-2"><Input formato="titulo" sugestoes={sugestoes.valores.clienteEndereco} value={p.cliente.endereco} onChange={(e) => updCli({ endereco: e.target.value })} /></Field>
                <Field label="Inscrição Estadual"><Input value={p.cliente.inscricaoEstadual} onChange={(e) => updCli({ inscricaoEstadual: e.target.value })} /></Field>
                <Field label="Inscrição Municipal">
                  <InscricaoMunicipalInput
                    value={p.cliente.inscricaoMunicipal}
                    onChange={(inscricaoMunicipal) => updCli({ inscricaoMunicipal })}
                  />
                </Field>
                <Field label="Representante">
                  <Input
                    formato="titulo"
                    sugestoes={sugestoes.valores.representante}
                    value={p.cliente.representante.nome}
                    onChange={(e) => escolherRepresentante(e.target.value)}
                  />
                </Field>
                <Field label="Telefone do representante"><TelefoneInput value={p.cliente.representante.telefones} onChange={(v) => updCli({ representante: { ...p.cliente.representante, telefones: v } })} /></Field>
                <Field label="E-mail do representante"><Input type="email" sugestoes={sugestoes.valores.representanteEmail} value={p.cliente.representante.email} onChange={(e) => updCli({ representante: { ...p.cliente.representante, email: e.target.value } })} /></Field>
              </div>
          </Card>

          <Card>
            <CardTitle>Informações do projeto</CardTitle>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Cliente (apelido)"><Input erro={chavesComErro.has("clienteAbreviado")} sugestoes={sugestoes.valores.clienteApelido} value={p.info.clienteAbreviado} onChange={(e) => updTituloParte({ clienteAbreviado: e.target.value })} placeholder="Ex.: ACME" /></Field>
              <Field label="Nome do projeto"><Input formato="titulo" erro={chavesComErro.has("nomeProjeto")} sugestoes={sugestoes.valores.nomeProjeto} value={p.info.nomeProjeto} onChange={(e) => updTituloParte({ nomeProjeto: e.target.value })} /></Field>
              <Field label="Ano"><Input erro={chavesComErro.has("anoProjeto")} sugestoes={sugestoes.valores.anoProjeto} value={p.info.anoProjeto} inputMode="numeric" onChange={(e) => updTituloParte({ anoProjeto: onlyDigits(e.target.value).slice(0, 4) })} placeholder="2026" /></Field>
              <Field label="Modalidade">
                <Select erro={chavesComErro.has("modalidade")} value={p.info.modalidade} onChange={(e) => updInfo({ modalidade: e.target.value as ProjetoInfo["modalidade"] })}>
                  <option value="">Selecione</option>
                  <option value="Cultural">Cultural</option>
                  <option value="Corporativo">Corporativo</option>
                </Select>
              </Field>
              <Field label="Local">
                <Input
                  formato="titulo"
                  erro={chavesComErro.has("local")}
                  sugestoes={sugestoes.valores.local}
                  value={p.info.local}
                  onChange={(e) => comVinculo("local", p.info.local, e.target.value, { local: e.target.value })}
                />
              </Field>
              <Field label="Endereço do local"><Input formato="titulo" sugestoes={sugestoes.valores.enderecoLocal} value={p.info.enderecoLocal} onChange={(e) => updInfo({ enderecoLocal: e.target.value })} /></Field>
              <Field label="Nº de participantes"><Input type="number" value={p.info.participantes ?? ""} onChange={(e) => updInfo({ participantes: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Produtor Responsável">
                <Select
                  value={p.info.produtoraResponsavel}
                  onChange={(e) => escolherProdutora(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {produtoresResponsaveis.map((u) => (
                    <option key={u.id} value={u.nome}>{u.nome}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Telefone do(a) Produtor(a) Responsável"><TelefoneInput value={p.info.telefoneProdutora} onChange={(v) => updInfo({ telefoneProdutora: v })} /></Field>
              <Field label="E-mail do(a) Produtor(a) Responsável"><Input type="email" sugestoes={sugestoes.valores.emailProdutora} value={p.info.emailProdutora} onChange={(e) => updInfo({ emailProdutora: e.target.value })} /></Field>
              {p.info.modalidade === "Cultural" && (
                <Field label="Incentivos Fiscais" className="sm:col-span-2 lg:col-span-3">
                  <Textarea value={p.info.incentivosFiscais} onChange={(e) => updInfo({ incentivosFiscais: e.target.value })} />
                  <TextosJaUsados valor={p.info.incentivosFiscais} opcoes={sugestoes.valores.incentivosFiscais} onEscolher={(incentivosFiscais) => updInfo({ incentivosFiscais })} />
                </Field>
              )}
            </div>
          </Card>

          <Card>
            <CardTitle hint="Cada bloco pode ter uma ou mais datas, com horários de início e fim. Arraste pela alça para reordenar blocos e datas (inclusive movendo uma data para outro bloco); as setas movem a data uma posição por vez dentro do bloco.">
              Cronograma
            </CardTitle>
            <CronogramaProjetoEditor
              info={p.info}
              onChange={updInfo}
              eventoComErro={chavesComErro.has("cronogramaEvento")}
            />
          </Card>

          <Card>
            <CardTitle
              hint="Os textos aceitam parágrafos, negrito e listas. A revisão ortográfica é aplicada ao salvar."
              action={
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  icon={<IcPlus width={15} height={15} />}
                  onClick={() => {
                    const item = novoRoteiroExtra();
                    updInfo({ roteirosExtras: [...p.info.roteirosExtras, item], roteiroOrdem: [...p.info.roteiroOrdem, item.id] });
                    // O bloco novo entra no fim: leva a rolagem até ele e pisca 2x.
                    destacarElemento(idBlocoRoteiro(item.id));
                  }}
                >
                  Adicionar item
                </Button>
              }
            >Roteiro</CardTitle>
            <ListaArrastavel
              ids={p.info.roteiroOrdem}
              onReordenar={(ordem) => updInfo({ roteiroOrdem: ordem })}
              className="space-y-4"
            >
              {p.info.roteiroOrdem.flatMap((id) => {
                const chave = id in ROTEIROS_PADRAO ? id as keyof typeof ROTEIROS_PADRAO : undefined;
                const extra = chave ? undefined : p.info.roteirosExtras.find((item) => item.id === id);
                if (!chave && !extra) return [];
                const indice = p.info.roteiroOrdem.indexOf(id);
                const label = chave ? ROTEIROS_PADRAO[chave].label : extra!.titulo;
                const placeholder = chave ? ROTEIROS_PADRAO[chave].placeholder : "Descreva esta etapa do roteiro…";
                const oculto = chave ? p.info.roteirosOcultos.includes(chave) : false;
                return (
                  <ItemArrastavel key={id} id={id} domId={idBlocoRoteiro(id)} className="rounded-btn border border-border-soft p-3 sm:p-4">
                    {(alca) => (
                      <>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {alca}
                            {/* Setas movem uma posição por vez; o arraste serve para saltos maiores. */}
                            <MoverSetas
                              orientacao="horizontal"
                              rotulo={`a etapa ${label}`}
                              podeSubir={indice > 0}
                              podeDescer={indice < p.info.roteiroOrdem.length - 1}
                              onSubir={() => moverRoteiro(id, -1)}
                              onDescer={() => moverRoteiro(id, 1)}
                            />
                            {chave ? <Label>{label}</Label> : <Input formato="titulo" sugestoes={sugestoes.valores.tituloRoteiro} value={extra!.titulo} onChange={(e) => updInfo({ roteirosExtras: p.info.roteirosExtras.map((item) => item.id === id ? { ...item, titulo: e.target.value } : item) })} placeholder="Título da etapa" />}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {chave ? (
                              <Button
                                type="button"
                                variant="text"
                                size="sm"
                                aria-label={oculto ? `Reexibir ${label}` : `Ocultar ${label}`}
                                title={oculto ? "Reexibir seção" : "Ocultar seção"}
                                icon={oculto ? <IcEye width={15} height={15} /> : <IcEyeOff width={15} height={15} />}
                                onClick={() => toggleRoteiroOculto(chave)}
                              />
                            ) : (
                              <Button type="button" variant="text" size="sm" aria-label={`Excluir ${label}`} title="Excluir item" icon={<IcTrash width={15} height={15} />} onClick={() => updInfo({ roteirosExtras: p.info.roteirosExtras.filter((item) => item.id !== id), roteiroOrdem: p.info.roteiroOrdem.filter((itemId) => itemId !== id) })} />
                            )}
                          </div>
                        </div>
                        {!oculto && (
                          <RichTextField
                            somenteLeitura={!editando}
                            className="[&_[contenteditable]]:min-h-[220px]"
                            value={chave ? p.info.roteiros[chave] : extra!.conteudo}
                            onChange={(v) => chave
                              ? updInfo({ roteiros: { ...p.info.roteiros, [chave]: v } })
                              : updInfo({ roteirosExtras: p.info.roteirosExtras.map((item) => item.id === id ? { ...item, conteudo: v } : item) })}
                            placeholder={placeholder}
                          />
                        )}
                      </>
                    )}
                  </ItemArrastavel>
                );
              })}
            </ListaArrastavel>
          </Card>
        </fieldset>
      )}

      {aba === "ec" && (
        <Card padded={false}>
          <div
            id={idAncoraPendencia(ancoraProjetoSemEc(id))}
            className="p-5 flex items-center justify-between gap-3 flex-wrap"
          >
            <CardTitle hint="Estimativas de custo deste projeto (incluindo versões)">
              <span className="inline-flex items-center gap-2">
                Estimativas (EC)
                <NotifDot inline n={pendenciaSemEc} title="Este projeto ainda não tem estimativa" />
              </span>
            </CardTitle>
            {podeEditarEc && (
              <div data-tour="acoes-ec" className="flex items-center gap-2">
                <Button
                  size="sm"
                  icon={<IcPlus width={16} height={16} />}
                  title={p.info.modalidade ? `Usa o modelo ${p.info.modalidade} (definido em Dados Gerais)` : "Defina a Modalidade em Dados Gerais para carregar um modelo automaticamente"}
                  onClick={() => navigate(`/estimativas/nova?projeto=${id}${p.info.modalidade ? `&template=${p.info.modalidade}` : ""}`)}
                >
                  Nova EC
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<IcDoc width={16} height={16} />}
                  onClick={() => navigate(`/estimativas/nova?projeto=${id}`)}
                >
                  EC em branco
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<IcCopy width={16} height={16} />}
                  title="Gera a próxima versão da EC deste projeto com os itens e valores de outra — deste projeto ou de outro, inclusive arquivada"
                  onClick={() => { setImpProjetoId(""); setImpEcId(""); setImportOpen(true); }}
                >
                  Importar EC
                </Button>
              </div>
            )}
          </div>
          <div className="px-5 pb-4 flex items-center gap-1 border-b border-border-soft" role="group" aria-label="Filtrar estimativas">
            {([
              ["todas", "Todas"],
              // Sempre uma só: a estimativa que vale hoje (ver `domain/ec`).
              ["ativas", "Ativa"],
              // Todo o resto do projeto — versões anteriores e o que foi tirado
              // do ar. É deste arquivo que se importa de volta.
              ["arquivadas", "Arquivadas"],
            ] as const).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={filtroEc === valor}
                onClick={() => setFiltroEc(valor)}
                className={cx(
                  "h-8 rounded-pill px-3 text-[12.5px] font-bold transition-colors",
                  filtroEc === valor ? "bg-primary-soft text-primary-dark" : "text-ink-2 hover:bg-[#F1F2F5] hover:text-ink"
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {ecsDoProjeto.length === 0 ? (
            <div className="p-6"><EmptyState title="Nenhuma EC" hint="Crie a primeira EC deste projeto." /></div>
          ) : ecsFiltradas.length === 0 ? (
            <div className="p-6"><EmptyState title="Nenhuma EC neste filtro" hint="Selecione outro filtro para visualizar as demais estimativas." /></div>
          ) : (
            <Table>
              <THead>
                {/* Pendências em coluna própria, alinhadas à esquerda do título da EC. */}
                <ThPendencias col="pendencias" ordem={ecsOrdenadas.ordem} onSort={ecsOrdenadas.ordenarPor} />
                <ThOrd col="titulo" ordem={ecsOrdenadas.ordem} onSort={ecsOrdenadas.ordenarPor}>Título da EC</ThOrd>
                <ThOrd col="status" align="center" ordem={ecsOrdenadas.ordem} onSort={ecsOrdenadas.ordenarPor}>Status</ThOrd>
              </THead>
              <tbody>
                {ecsOrdenadas.ordenados.map((e) => (
                  // O `id` é o endereço da linha para o navegador de pendências:
                  // na subguia EC a pílula pisca a linha, e o detalhe (comentário,
                  // campo a emitir) fica para a tela da EC.
                  <Tr key={e.id} id={idAncoraPendencia(e.id)} onClick={() => navigate(`/estimativas/${e.id}`)}>
                    <TdPendencias n={porEc[e.id] ?? 0} title="Ações pendentes suas nesta EC" />
                    {/* Versão e data já vêm no próprio título ("EC – … (03) em 10 08 26"). */}
                    <Td className={cx("font-bold", e.ativa ? "text-primary-dark" : "text-ink")}>{tituloEc(e)}</Td>
                    {/* Dois estados, e só: no ar ou no arquivo (ver `domain/ec`). */}
                    <Td align="center">
                      <Badge tom={TOM_SITUACAO_EC[situacaoEc(e)]}>{ROTULO_SITUACAO_EC[situacaoEc(e)]}</Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setImportOpen(false)}>
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <Card>
              <CardTitle hint="Gera uma NOVA VERSÃO da EC deste projeto com a estrutura de QUALQUER outra — deste projeto ou de outro, no ar ou arquivada. É o mesmo que 'Gerar nova versão', mudando só de onde vem o conteúdo: numeração seguinte, entra no ar e a anterior vai para o arquivo (de onde volta quando você quiser). A EC de origem não é alterada.">
                Importar EC
              </CardTitle>
              <div className="mt-4 grid gap-4">
                <Field label="Projeto de origem">
                  <Select value={impProjetoId} onChange={(e) => { setImpProjetoId(e.target.value); setImpEcId(""); }}>
                    <option value="">Selecione…</option>
                    {projetosOrigem.map((o) => (
                      <option key={o.projetoId} value={o.projetoId}>{o.rotulo}</option>
                    ))}
                  </Select>
                </Field>
                {/* Sem filtro nenhum: a arquivada é justamente a mais copiada —
                    é a que já deu certo uma vez. O selo ao lado do nome diz de
                    onde se está copiando. */}
                <Field label="EC de origem" hint="a que está no ar ou qualquer uma do arquivo">
                  <Select value={impEcId} onChange={(e) => setImpEcId(e.target.value)} disabled={!impProjetoId}>
                    <option value="">Selecione…</option>
                    {ecsOrigem.map((e) => (
                      <option key={e.id} value={e.id}>{tituloEc(e)} — {ROTULO_SITUACAO_EC[situacaoEc(e)]}</option>
                    ))}
                  </Select>
                  {!!impProjetoId && ecsOrigem.length === 0 && (
                    <p className="text-[12px] text-ink-3 mt-1.5">Este projeto não tem nenhuma EC para copiar.</p>
                  )}
                </Field>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setImportOpen(false)}>Cancelar</Button>
                <Button size="sm" onClick={importarEc} disabled={!impEcId || importando}>
                  {importando ? "Importando…" : "Importar EC"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {aba === "os" && (
        <Card padded={false}>
          <div className="p-5"><CardTitle hint="Ordens de serviço geradas a partir das ECs deste projeto">Ordens de Serviço</CardTitle></div>
          {/* Os mesmos filtros da lista de ECs (15/09/2026): a lista de OSs de um
              projeto cresce a cada versão reemitida, e o que se procura quase
              sempre é "as que ainda não saíram" ou "a que foi cancelada". */}
          <div className="px-5 pb-4 flex items-center gap-1 flex-wrap border-b border-border-soft" role="group" aria-label="Filtrar ordens de serviço">
            {([
              ["todas", "Todas"],
              ["Rascunho", "Rascunho"],
              ["Emitida", "Emitida"],
              ["Cancelada", "Cancelada"],
              ["Arquivada", "Arquivada"],
            ] as const).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={filtroOs === valor}
                onClick={() => setFiltroOs(valor)}
                className={cx(
                  "h-8 rounded-pill px-3 text-[12.5px] font-bold transition-colors",
                  filtroOs === valor ? "bg-primary-soft text-primary-dark" : "text-ink-2 hover:bg-[#F1F2F5] hover:text-ink"
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {ossDoProjeto.length === 0 ? (
            <div className="p-6"><EmptyState title="Nenhuma OS" hint="Gere OSs a partir das ECs do projeto." /></div>
          ) : ossFiltradas.length === 0 ? (
            <div className="p-6"><EmptyState title="Nenhuma OS neste filtro" hint="Selecione outro filtro para ver as demais ordens de serviço." /></div>
          ) : (
            <Table>
              <THead>
                <ThPendencias col="pendencias" ordem={ossOrdenadas.ordem} onSort={ossOrdenadas.ordenarPor} />
                <ThOrd col="numero" ordem={ossOrdenadas.ordem} onSort={ossOrdenadas.ordenarPor}>OS</ThOrd>
                {/* Sem rótulo: é o atalho para ver os itens, não uma coluna de dado. */}
                <ThItensOs />
                <ThOrd col="fornecedor" ordem={ossOrdenadas.ordem} onSort={ossOrdenadas.ordenarPor}>Fornecedor</ThOrd>
                <ThOrd col="status" align="center" ordem={ossOrdenadas.ordem} onSort={ossOrdenadas.ordenarPor}>Status</ThOrd>
              </THead>
              <tbody>
                {ossOrdenadas.ordenados.map((o) => (
                  <Tr key={o.id} id={idAncoraPendencia(o.id)} onClick={() => navigate(`/ordens/${o.id}`)}>
                    <TdPendencias n={porOs[o.id] ?? 0} title="Ações pendentes suas nesta OS" />
                    <Td className="font-bold">{o.numero}</Td>
                    <TdItensOs itens={itensPorOs[o.id] ?? []} />
                    <Td>{nomeCurtoFornecedor(o.fornecedor) || "—"}</Td>
                    <Td align="center"><Badge tom={tomStatusOs[o.status]}>{o.status}</Badge></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {aba === "checklist" && (
        <ChecklistPainel
          estado={checklistProjeto}
          projeto={p}
          podeEditar={podeEditarChecklist}
          usuarios={nomesUsuarios}
          pendencias={pendenciasDaTelaAtual}
        />
      )}

      {aba === "cronograma" && (
        <div className="space-y-4">
        <Card>
          <CardTitle
            hint="Linha do tempo consolidada. Baixe o Excel no modelo Pólobh (cabeçalho automático da EC; datas/horários/produtor em branco para a equipe)."
            action={
              <Button size="sm" variant="secondary" icon={<IcDownload width={16} height={16} />} onClick={baixarCronograma}>
                Baixar Excel
              </Button>
            }
          >
            Cronograma consolidado
          </CardTitle>
          <TimelineConsolidada itens={etapas} />
        </Card>

        {/* O mesmo painel da tela de Cronogramas: quem recebe o seu cronograma
            por e-mail, marcado a marcado ou de uma vez. */}
        <EnvioCronograma oss={ossDoProjeto} ecs={ecsAll ?? []} />
        </div>
      )}

      {/* Pílula flutuante: o que se resolve NESTA aba, uma de cada vez.
          Fora das LISTAGENS de EC e de OS (15/09/2026): ali ela não resolvia
          nada — as pendências daquelas linhas se resolvem dentro do documento,
          e a pílula só sabia fazer a linha piscar. O badge vermelho de cada
          linha continua, e é ele que leva à EC/OS certa. */}
      {!novo && aba !== "ec" && aba !== "os" && <NavegadorPendencias pendencias={pendenciasDaTelaAtual} />}

      {/* O projeto já foi salvo; aqui se decide o que fazer com o que já saiu. */}
      {repercussao && (
        <RepercutirMudancasModal
          mudancas={repercussao.mudancas}
          atual={repercussao.atual}
          ecs={ecsDoProjeto}
          oss={ossDoProjeto}
          onFechar={() => setRepercussao(null)}
          onConcluido={() => {
            setRepercussao(null);
            // Recarrega a tela: EC e OS mudaram de número, versão e status.
            navigate(0);
          }}
        />
      )}

      {aba === "credenciamento" && (
        <CredenciamentoProjeto oss={ossDoProjeto} ecs={ecsAll ?? []} />
      )}

      {aba === "fornecedores" && (
        <Card padded={false}>
          <div className="p-5">
            <CardTitle
              hint="Quem está no projeto, o que entrega e como se fala com ele — a folha que vai na prancheta no dia da montagem"
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<IcDownload width={16} height={16} />}
                  disabled={!fornecedores.length}
                  onClick={baixarDadosUteis}
                >
                  Baixar Excel
                </Button>
              }
            >
              Dados Úteis
            </CardTitle>
          </div>
          {fornecedores.length === 0 ? (
            <div className="p-6"><EmptyState title="Nenhum fornecedor" hint="Aparecem aqui os fornecedores das OSs do projeto." /></div>
          ) : (
            <Table>
              <THead>
                <ThOrd col="fornecedor" ordem={fornecedoresOrdenados.ordem} onSort={fornecedoresOrdenados.ordenarPor}>Nome Fantasia</ThOrd>
                <ThOrd col="itens" ordem={fornecedoresOrdenados.ordem} onSort={fornecedoresOrdenados.ordenarPor}>Itens da EC</ThOrd>
                <ThOrd col="contato" ordem={fornecedoresOrdenados.ordem} onSort={fornecedoresOrdenados.ordenarPor}>Nome</ThOrd>
                <ThOrd col="telefone" ordem={fornecedoresOrdenados.ordem} onSort={fornecedoresOrdenados.ordenarPor}>Telefone</ThOrd>
                <ThOrd col="email" ordem={fornecedoresOrdenados.ordem} onSort={fornecedoresOrdenados.ordenarPor}>E-mail</ThOrd>
              </THead>
              <tbody>
                {fornecedoresOrdenados.ordenados.map((f, i) => (
                  <Tr key={i}>
                    <Td className="font-bold text-ink">{f.fornecedor}</Td>
                    {/* Um item por linha: a lista corrida vira um bloco de texto
                        que ninguém bate com o olho. */}
                    <Td className="text-[12.5px]">
                      {f.itens.length ? f.itens.map((it) => <div key={it}>{it}</div>) : "—"}
                    </Td>
                    <Td className="text-[12.5px]">{f.contato || "—"}</Td>
                    <Td className="text-[12.5px] whitespace-nowrap">{f.telefone || "—"}</Td>
                    <Td className="text-[12.5px]">{f.email || "—"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </PageShell>
  );
}

/* ------------------------------ CHECK-LIST -------------------------------- */

/**
 * Aba de check-list: os avisos de estado (modalidade em falta, prazos
 * desatualizados, modalidade trocada) e a lista em si.
 */
function ChecklistPainel({
  estado,
  projeto,
  podeEditar,
  usuarios,
  pendencias,
}: {
  estado: ReturnType<typeof useChecklistProjeto>;
  projeto: Projeto;
  podeEditar: boolean;
  usuarios: string[];
  /** Pendências do usuário nesta aba — viram o badge de cada tarefa. */
  pendencias: Pendencia[];
}) {
  const [confirmarRegenerar, setConfirmarRegenerar] = useState(false);
  // Quantas pendências do usuário cada tarefa tem — o badge do item, o da aba e
  // o navegador passam a contar a mesma coisa.
  const pendenciasPorItem = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const p of pendencias) {
      if (p.checklistItemId) mapa[p.checklistItemId] = (mapa[p.checklistItemId] ?? 0) + 1;
    }
    return mapa;
  }, [pendencias]);

  if (!projeto.id) {
    return <EmptyState title="Salve o projeto primeiro" hint="O check-list é criado assim que o projeto existe." />;
  }
  if (!projeto.info.modalidade) {
    return (
      <EmptyState
        title="Defina a modalidade do projeto"
        hint="O check-list é gerado a partir da lista padrão de projetos Corporativos ou Culturais. Escolha a modalidade em Dados Gerais."
      />
    );
  }
  if (estado.carregando) {
    return <div className="text-center text-ink-3 text-sm py-8">Carregando o check-list…</div>;
  }
  if (!estado.modelo) {
    return (
      <EmptyState
        title={`Sem lista padrão para projetos ${projeto.info.modalidade}`}
        hint="Cadastre a lista em Configurações → Check-list para o sistema poder gerar as tarefas."
      />
    );
  }
  if (!estado.checklist) {
    return (
      <EmptyState
        title="Check-list ainda não criado"
        hint={
          podeEditar
            ? "A lista é gerada automaticamente ao abrir o projeto. Recarregue a página se ela não aparecer."
            : "Você não tem permissão para criar o check-list deste projeto."
        }
      />
    );
  }

  // Projeto sem nenhuma data: as tarefas nascem sem prazo e a tela precisa
  // dizer por quê — senão parece defeito do check-list, e não campo em branco
  // lá em Dados Gerais.
  const janela = janelaDoProjeto(projeto);
  const semPrazo = estado.checklist.itens.filter((i) => !i.dataLimite).length;

  return (
    <div className="space-y-3">
      {semPrazo > 0 && !janela.evento && (
        <Card>
          <div className="flex items-center gap-3 flex-wrap">
            <IcCalendar width={18} height={18} className="text-ink-3" />
            <span className="text-[13px] font-bold text-ink">
              {semPrazo} {semPrazo === 1 ? "tarefa está" : "tarefas estão"} sem prazo porque o projeto ainda não tem datas.
            </span>
            <span className="text-[12px] font-bold text-ink-3">
              Preencha Pré-evento, Evento e Pós-evento em Dados Gerais — os prazos são calculados a partir delas.
            </span>
          </div>
        </Card>
      )}

      {/* As datas do projeto mudaram: o recálculo é oferecido, nunca imposto. */}
      {podeEditar && estado.prazosDesatualizados > 0 && (
        <Card>
          <div className="flex items-center gap-3 flex-wrap">
            <IcCalendar width={18} height={18} className="text-primary" />
            <span className="text-[13px] font-bold text-ink">
              As datas do projeto mudaram — {estado.prazosDesatualizados}{" "}
              {estado.prazosDesatualizados === 1 ? "tarefa teria" : "tarefas teriam"} outro prazo.
            </span>
            <span className="text-[12px] font-bold text-ink-3">
              Datas ajustadas à mão e tarefas concluídas não são tocadas.
            </span>
            <Button size="sm" className="ml-auto" onClick={() => void estado.aplicarRecalculo()}>
              Recalcular prazos
            </Button>
          </div>
        </Card>
      )}

      {/* Trocaram a modalidade do projeto depois da lista criada. */}
      {podeEditar && estado.modalidadeDivergente && (
        <Card>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[13px] font-bold text-ink">
              Este check-list foi gerado no modelo <b>{estado.checklist.modalidade}</b>, mas o projeto agora é{" "}
              <b>{projeto.info.modalidade}</b>.
            </span>
            {confirmarRegenerar ? (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[12px] font-bold text-danger">
                  Refazer apaga status, prazos ajustados e observações. Confirma?
                </span>
                <Button size="sm" variant="danger" onClick={() => void estado.regenerar()}>
                  Refazer
                </Button>
                <Button size="sm" variant="text" onClick={() => setConfirmarRegenerar(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setConfirmarRegenerar(true)}>
                Refazer no modelo certo
              </Button>
            )}
          </div>
        </Card>
      )}

      <ChecklistProjeto
        checklist={estado.checklist}
        usuarios={usuarios}
        podeEditar={podeEditar}
        onSalvarItem={(item) => void estado.salvarItem(item)}
        onCriarItem={(base) => estado.criarItem(base)}
        onRemoverItem={(item) => void estado.removerItem(item)}
        onSincronizar={() => void estado.sincronizar()}
        itensNovosNoModelo={estado.itensNovosNoModelo}
        pendenciasPorItem={pendenciasPorItem}
      />
    </div>
  );
}
