import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/layout/AppLayout";
import {
  Card, CardTitle, Button, Field, Input, Label, TelefoneInput, Textarea, Select, Badge,
  Table, THead, Tr, Td, EmptyState, ThOrd, useOrdenacao, tomStatusOs, type Tom,
} from "@/components/ui";
import { IcPlus, IcBack, IcDownload, IcSearch, IcTrash, IcEye, IcEyeOff, IcDoc, IcCopy, IcCalendar } from "@/components/icons";
import { RichTextField } from "@/components/RichTextField";
import { TimelineConsolidada, type ItemConsolidado } from "@/components/Timeline";
import { NotifDot } from "@/components/NotifDot";
import { NavegadorPendencias } from "@/components/NavegadorPendencias";
import { ThPendencias, TdPendencias } from "@/components/ColunaPendencias";
import { MoverSetas, moverNaLista } from "@/components/MoverSetas";
import { ListaArrastavel, ItemArrastavel } from "@/components/ListaArrastavel";
import { CronogramaProjetoEditor } from "@/components/CronogramaProjetoEditor";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { useMinhasPendencias } from "@/store/pendencias";
import { useResponsaveis } from "@/hooks/useResponsaveis";
import { useSugestoes } from "@/hooks/useSugestoes";
import { filhosDe, type CampoSugerido } from "@/domain/sugestoes";
import { useAuth } from "@/store/auth";
import { gerarCronogramaExcel } from "@/lib/excel";
import { cnpjValido, consultarCnpj } from "@/lib/cnpj";
import { numeroEc, tituloEc } from "@/domain/calc";
import { camposObrigatoriosProjeto, compoeTituloProjeto, novoRoteiroExtra, projetoInfoVazio, sincronizarCamposLegados } from "@/domain/projeto";
import { flags } from "@/lib/flags";
import { destacarElemento, idBlocoRoteiro } from "@/lib/destaque";
import { cx, dataBR, maskCpfCnpjInput, maskDoc, onlyDigits } from "@/lib/format";
import { toast } from "@/store/toast";
import { ChecklistProjeto } from "@/components/ChecklistProjeto";
import { useChecklistProjeto } from "@/hooks/useChecklistProjeto";
import { janelaDoProjeto } from "@/domain/checklist";
import { confirmar } from "@/store/confirm";
import { corrigirRoteirosProjeto } from "@/lib/correcaoOrtografica";
import { statusProjetoAutomatico } from "@/domain/statusProjeto";
import type { Cliente, Ec, EcLinha, Projeto, ProjetoInfo, StatusProjeto } from "@/data/types";
import { rotaDaPendencia, type Pendencia } from "@/domain/pendencias";
import { situacaoEc, ROTULO_SITUACAO_EC, TOM_SITUACAO_EC } from "@/domain/ec";
import { itensDaOs } from "@/domain/os";
import { ThItensOs, TdItensOs } from "@/components/ColunaItensOs";

const tomStatusProjeto: Record<StatusProjeto, Tom> = {
  Ativo: "success", Arquivado: "neutral", Concluido: "info", Cancelado: "danger",
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

type Aba = "dados" | "ec" | "os" | "checklist" | "cronograma" | "fornecedores";
// O check-list vem logo depois de Dados Gerais: é a aba de acompanhamento diário
// do projeto, consultada muito mais vezes que EC e OS (pedido de 25/08/2026).
const ABAS: { key: Aba; label: string }[] = [
  { key: "dados", label: "Dados Gerais" },
  { key: "checklist", label: "Check-list" },
  { key: "ec", label: "EC" },
  { key: "os", label: "OS" },
  { key: "cronograma", label: "Cronograma" },
  { key: "fornecedores", label: "Fornecedores" },
];

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
   * O sininho pode pedir OUTRA subguia do projeto que já está aberto — aí só a
   * URL muda, o componente não remonta e a aba ficaria na anterior.
   */
  useEffect(() => {
    if (abaParam && ABAS.some((a) => a.key === abaParam)) setAba(abaParam as Aba);
  }, [abaParam]);
  const [salvando, setSalvando] = useState(false);
  const [filtroEc, setFiltroEc] = useState<"todas" | "ativas" | "arquivadas">("todas");
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
    () => ossDoProjeto.flatMap((o) => o.cronograma.map((c) => ({ ...c, fornecedor: o.fornecedor.razaoSocial || "Fornecedor" }))),
    [ossDoProjeto]
  );
  const fornecedores = useMemo(() => {
    const m = new Map<string, { razao: string; cnpj: string; email: string }>();
    for (const o of ossDoProjeto) {
      const f = o.fornecedor;
      const chave = f.cnpj || f.razaoSocial;
      if (chave && !m.has(chave)) m.set(chave, { razao: f.razaoSocial, cnpj: f.cnpj, email: f.email });
    }
    return [...m.values()];
  }, [ossDoProjeto]);

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
    ossDoProjeto,
    {
      pendencias: (o) => porOs[o.id] ?? 0,
      numero: (o) => o.numero,
      fornecedor: (o) => o.fornecedor.razaoSocial,
      status: (o) => o.status,
    },
    { col: "numero", dir: "asc" }
  );
  const fornecedoresOrdenados = useOrdenacao(
    fornecedores,
    { razao: (f) => f.razao, cnpj: (f) => f.cnpj, email: (f) => f.email },
    { col: "razao", dir: "asc" }
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
   * Pendências da ABA aberta — exatamente o número do badge vermelho dela. O
   * navegador flutuante e o badge saem da mesma lista, então tudo o que é
   * contado pode ser encontrado.
   */
  const pendenciasDaAba = useMemo(
    () => minhasPendencias.filter((x) => x.projetoId === id && x.aba === aba),
    [minhasPendencias, id, aba]
  );

  /**
   * A pendência de uma EC ou de uma OS mora na tela dela, não aqui: o salto vira
   * navegação — para o mesmo lugar que o sininho do topo abre (`rotaDaPendencia`).
   * O alvo já ficou guardado em `focoPendencia`, e a tela de destino abre a
   * observação certa assim que carregar. O que já mora nesta tela (check-list,
   * cronograma) não navega: só rola até o item.
   */
  const saltarParaPendencia = (pendencia: Pendencia) => {
    const rota = rotaDaPendencia(pendencia);
    if (!rota.startsWith(`/projetos/${id}`)) navigate(rota);
  };

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

  async function salvar() {
    const faltando = camposObrigatoriosFaltando();
    if (faltando.length) {
      setTentouSalvar(true);
      toast(`Preencha os campos obrigatórios: ${faltando.map((f) => f.label).join(", ")}.`, "danger");
      return;
    }
    setSalvando(true);
    try {
      const revisao = await corrigirRoteirosProjeto(p.info.roteiros, p.info.roteirosExtras);
      const info = sincronizarCamposLegados({ ...p.info, roteiros: revisao.roteiros, roteirosExtras: revisao.roteirosExtras });
      const cliente = await arquivarCliente({ ...p.cliente, apelido: info.clienteAbreviado });
      const salvo = await repo.projetos.salvar({ ...p, cliente, info, nome: info.titulo || p.nome || "Projeto" });
      setP(salvo);
      // Nova referência do "já salvo" — o botão volta a ficar apagado na hora.
      setBaseline(JSON.stringify(salvo));
      toast(revisao.revisaoCompleta
        ? "Projeto salvo e roteiros revisados automaticamente."
        : "Projeto salvo. A correção básica foi aplicada; a revisão por IA está indisponível no momento.", "success");
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
   * Traz os itens de outra EC para este projeto como um RASCUNHO novo.
   *
   * Serve tanto para copiar de outro projeto quanto para retomar uma versão
   * arquivada deste mesmo projeto — em nenhum dos dois casos a EC de origem é
   * tocada, e a EC ativa daqui continua ativa (a cópia entra como rascunho).
   */
  async function importarEc() {
    const origem = (ecsAll ?? []).find((e) => e.id === impEcId);
    if (!origem) { toast("Selecione a EC de origem.", "warning"); return; }
    setImportando(true);
    try {
      const irmas = (ecsAll ?? []).filter((e) => e.projetoId === id);
      const versao = irmas.length ? Math.max(...irmas.map((e) => e.versao)) + 1 : 1;
      const agora = new Date().toISOString();
      // Copia a estrutura de custos, mas zera pendências/status para começar limpo no novo projeto.
      const linhas: EcLinha[] = origem.linhas.map((l) => ({
        ...l,
        id: "",
        observacao: "",
        observacoes: [],
        valorGasto: 0,
        statusAprovacao: "Pendente",
        statusOs: "Pendente",
        contratoStatus: "Pendente",
      }));
      const nova: Ec = {
        ...origem,
        id: "",
        projetoId: id,
        clienteId: p.cliente.id,
        cliente: p.cliente,
        projeto: p.info,
        versao,
        status: "Rascunho",
        ativa: false,
        numero: numeroEc(p.cliente.nome || "Cliente", p.info.titulo || "Projeto", versao),
        slugPublico: "",
        canceladaSubstituida: false,
        criadoEm: agora,
        atualizadoEm: agora,
        linhas,
      };
      const salvo = await repo.ecs.salvar(nova);
      toast(`EC importada de "${tituloEc(origem)}" como rascunho (V${String(versao).padStart(2, "0")}).`, "success");
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
              {!novo && statusExibido !== "Arquivado" && (
                <Button variant="secondary" size="sm" onClick={arquivarProjeto}>Arquivar projeto</Button>
              )}
              <Button
                size="sm"
                onClick={salvar}
                disabled={salvando || !alterado}
                title={alterado ? "Salvar as alterações do projeto" : "Nenhuma alteração para salvar"}
              >
                {salvando ? "Salvando…" : "Salvar projeto"}
              </Button>
            </div>
          )}
        </>
      }
    >
      {/* Subguias */}
      <div className="flex gap-1 border-b border-border mb-5 overflow-x-auto">
        {ABAS.map((a) => {
          const bloqueada = novo && a.key !== "dados";
          return (
            <button
              key={a.key}
              disabled={bloqueada}
              onClick={() => setAba(a.key)}
              className={cx(
                "px-4 h-10 text-[13.5px] font-bold whitespace-nowrap border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5",
                bloqueada ? "text-ink-3/40 cursor-not-allowed border-transparent"
                  : aba === a.key ? "text-primary-dark border-primary" : "text-ink-2 hover:text-ink border-transparent"
              )}
            >
              {a.label}
              <NotifDot inline n={novo ? 0 : porAba[`${id}:${a.key}`] ?? 0} title="Ações pendentes nesta etapa" />
            </button>
          );
        })}
      </div>

      {aba === "dados" && (
        <div className="space-y-4">
          <Card>
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
                <Field label="Razão Social" className="sm:col-span-2"><Input formato="titulo-empresa" value={p.cliente.razaoSocial} onChange={(e) => updCli({ razaoSocial: e.target.value })} /></Field>
                <Field label="Endereço" className="sm:col-span-2"><Input formato="titulo" value={p.cliente.endereco} onChange={(e) => updCli({ endereco: e.target.value })} /></Field>
                <Field label="Inscrição Estadual"><Input value={p.cliente.inscricaoEstadual} onChange={(e) => updCli({ inscricaoEstadual: e.target.value })} /></Field>
                <Field label="Inscrição Municipal">
                  <div className="flex gap-2">
                    <Input value={p.cliente.inscricaoMunicipal} onChange={(e) => updCli({ inscricaoMunicipal: e.target.value })} />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      title="Consultar Inscrição Municipal no portal da Prefeitura de Belo Horizonte"
                      aria-label="Consultar Inscrição Municipal na Prefeitura de Belo Horizonte"
                      icon={<IcSearch width={15} height={15} />}
                      onClick={() => window.open("https://mobiliarioonline.pbh.gov.br/mobiliario-cadastro-publico/f/t/emiteficwebsel", "_blank", "noopener,noreferrer")}
                    >
                      Consultar na PBH
                    </Button>
                  </div>
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
              <Field label="Ano"><Input erro={chavesComErro.has("anoProjeto")} value={p.info.anoProjeto} inputMode="numeric" onChange={(e) => updTituloParte({ anoProjeto: onlyDigits(e.target.value).slice(0, 4) })} placeholder="2026" /></Field>
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
                <Field label="Incentivos Fiscais" className="sm:col-span-2 lg:col-span-3"><Textarea value={p.info.incentivosFiscais} onChange={(e) => updInfo({ incentivosFiscais: e.target.value })} /></Field>
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
                            {chave ? <Label>{label}</Label> : <Input formato="titulo" value={extra!.titulo} onChange={(e) => updInfo({ roteirosExtras: p.info.roteirosExtras.map((item) => item.id === id ? { ...item, titulo: e.target.value } : item) })} placeholder="Título da etapa" />}
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
        </div>
      )}

      {aba === "ec" && (
        <Card padded={false}>
          <div className="p-5 flex items-center justify-between gap-3 flex-wrap">
            <CardTitle hint="Estimativas de custo deste projeto (incluindo versões)">Estimativas (EC)</CardTitle>
            {podeEditarEc && (
              <div className="flex items-center gap-2">
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
                  title="Copia os itens e valores de outra EC — deste projeto ou de outro, ativa ou arquivada"
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
              ["ativas", "Ativas"],
              // Não é só "arquivadas": aqui caem também os rascunhos importados,
              // que não são a versão ativa e continuam editáveis.
              ["arquivadas", "Demais versões"],
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
                  <Tr key={e.id} onClick={() => navigate(`/estimativas/${e.id}`)}>
                    <TdPendencias n={porEc[e.id] ?? 0} title="Ações pendentes nesta EC" />
                    {/* Versão e data já vêm no próprio título ("EC – … (03) em 10 08 26"). */}
                    <Td className={cx("font-bold", e.ativa ? "text-primary-dark" : "text-ink")}>{tituloEc(e)}</Td>
                    {/* Rascunho não-ativo (a EC recém-importada) é "Rascunho", e não
                        "Arquivada" — a leitura é uma só, em `domain/ec`. */}
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
              <CardTitle hint="Copia os itens e valores de uma EC — deste projeto ou de outro, ativa ou arquivada — para cá, como um novo rascunho. A EC de origem não é alterada.">
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
                <Field label="EC de origem" hint="ativas e arquivadas">
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
          {ossDoProjeto.length === 0 ? (
            <div className="p-6"><EmptyState title="Nenhuma OS" hint="Gere OSs a partir das ECs do projeto." /></div>
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
                  <Tr key={o.id} onClick={() => navigate(`/ordens/${o.id}`)}>
                    <TdPendencias n={porOs[o.id] ?? 0} title="Esta OS tem ação pendente" />
                    <Td className="font-bold">{o.numero}</Td>
                    <TdItensOs itens={itensPorOs[o.id] ?? []} />
                    <Td>{o.fornecedor.razaoSocial || "—"}</Td>
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
          pendencias={pendenciasDaAba}
        />
      )}

      {aba === "cronograma" && (
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
      )}

      {/* Pílula flutuante: as pendências da aba aberta, uma a uma. */}
      {!novo && <NavegadorPendencias pendencias={pendenciasDaAba} aoSaltar={saltarParaPendencia} />}

      {aba === "fornecedores" && (
        <Card padded={false}>
          <div className="p-5"><CardTitle hint="Fornecedores presentes nas OSs deste projeto">Fornecedores do projeto</CardTitle></div>
          {fornecedores.length === 0 ? (
            <div className="p-6"><EmptyState title="Nenhum fornecedor" hint="Aparecem aqui os fornecedores das OSs do projeto." /></div>
          ) : (
            <Table>
              <THead>
                <ThOrd col="razao" ordem={fornecedoresOrdenados.ordem} onSort={fornecedoresOrdenados.ordenarPor}>Fornecedor</ThOrd>
                <ThOrd col="cnpj" ordem={fornecedoresOrdenados.ordem} onSort={fornecedoresOrdenados.ordenarPor}>CNPJ</ThOrd>
                <ThOrd col="email" ordem={fornecedoresOrdenados.ordem} onSort={fornecedoresOrdenados.ordenarPor}>Contato</ThOrd>
              </THead>
              <tbody>
                {fornecedoresOrdenados.ordenados.map((f, i) => (
                  <Tr key={i}>
                    <Td className="font-bold text-ink">{f.razao || "—"}</Td>
                    <Td className="text-[12.5px]">{f.cnpj || "—"}</Td>
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
        onCriarItem={() => estado.criarItem()}
        onRemoverItem={(item) => void estado.removerItem(item)}
        onSincronizar={() => void estado.sincronizar()}
        itensNovosNoModelo={estado.itensNovosNoModelo}
        pendenciasPorItem={pendenciasPorItem}
      />
    </div>
  );
}
