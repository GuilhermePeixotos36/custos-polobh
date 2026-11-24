/**
 * O CADASTRO DO FORNECEDOR — um formulário só, aberto em popup (24/11/2026).
 *
 * É o mesmo componente na tela /fornecedores (novo ou clique na linha), no "+"
 * ao lado da caixa combinada da EC e no "Abrir cadastro" do bloco do
 * fornecedor na OS. Antes eram três caminhos — o cartão da tela, o "Validar"
 * da linha da EC e os campos digitáveis da OS —, cada um gravando o cadastro
 * do seu jeito; era por eles que nasciam os fornecedores repetidos e com o
 * nome escrito de outra forma.
 *
 * As regras moram em `domain/cadastroFornecedor`; aqui fica o que é de tela:
 * o CPF/CNPJ primeiro, a consulta que dispara sozinha, o documento que já
 * existe abrindo o cadastro dele (em vez de criar outro), os campos da Receita
 * só leitura e os da casa livres.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, Plus, RefreshCw, Trash2, Truck } from "lucide-react";

import { JanelaModal, Presenca } from "@/components/padrao/JanelaModal";
import { CabecalhoJanela } from "@/components/padrao/CabecalhoJanela";
import { AvisoEmLinha } from "@/components/padrao/AvisoEmLinha";
import { Selo } from "@/components/padrao/Selo";
import { Button, Field, Input, Select, TelefoneInput } from "@/components/ui";
import { EnderecoCampos } from "@/components/EnderecoCampos";
import { InscricaoMunicipalInput } from "@/components/InscricaoMunicipalInput";
import { repo } from "@/data";
import type { ContatoFornecedor, Fornecedor } from "@/data/types";
import {
  aplicarConsulta, camposDaCasaLiberados, camposTravados, opcoesPerfilNoCadastro, tipoDocumento,
  type CampoAutomatico,
} from "@/domain/cadastroFornecedor";
import { textoDoQueFalta, validarEndereco } from "@/domain/endereco";
import { comPerfilPeloDocumento, gerarApelidoFornecedor } from "@/domain/fornecedor";
import { consultarCnpj } from "@/lib/cnpj";
import { flags } from "@/lib/flags";
import { maskCpfCnpjInput, maskDoc, onlyDigits } from "@/lib/format";
import { sairSeConfirmar } from "@/lib/guardaDeSaida";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";

type Props = {
  /** O fornecedor a abrir (do banco, ou em branco com o documento já digitado). `null` = fechado. */
  fornecedor: Fornecedor | null;
  /** O cadastro já carregado pela tela: é onde se procura o documento repetido antes de ir ao banco. */
  cadastro?: readonly Fornecedor[];
  onFechar: () => void;
  /** Gravou (ou escolheu um já existente sem mudar nada): a janela fecha e quem abriu recebe o fornecedor. */
  onSalvo: (f: Fornecedor) => void;
  /** Texto do botão principal no cadastro novo ("Cadastrar e usar" no "+" da EC). */
  textoNovo?: string;
  /**
   * Aberto para ESCOLHER um fornecedor (o "+" da EC e da OS): o cadastro existente
   * que aparecer pelo documento pode ser usado como está, mesmo por quem não tem
   * permissão de editar cadastros.
   */
  escolher?: boolean;
};

export function JanelaCadastroFornecedor({ fornecedor, ...resto }: Props) {
  return (
    <Presenca valor={fornecedor}>
      {(f) => <FormularioCadastroFornecedor key={f.id || `novo-${onlyDigits(f.cnpj)}`} inicial={f} {...resto} />}
    </Presenca>
  );
}

/** Campo travado: o valor como texto, com o cadeado dizendo por quê. */
function CampoLeitura({ valor, className }: { valor: string; className?: string }) {
  return (
    <div
      className={cn("flex min-h-9 items-start gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground", className)}
      title="Vem da consulta do CNPJ e não se edita à mão"
    >
      <span className="min-w-0 flex-1 whitespace-pre-wrap">{valor || "—"}</span>
      <Lock aria-label="Só leitura" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </div>
  );
}

function FormularioCadastroFornecedor({ inicial, cadastro = [], onFechar, onSalvo, textoNovo = "Cadastrar", escolher = false }: Omit<Props, "fornecedor"> & { inicial: Fornecedor }) {
  const podeEditar = useAuth((s) => s.pode("fornecedores.editar"));
  const [f, setF] = useState<Fornecedor>(() => comPerfilPeloDocumento(structuredClone(inicial)));
  /** A foto para saber se há alteração — troca quando um cadastro existente é carregado no lugar. */
  const [base, setBase] = useState(() => JSON.stringify(comPerfilPeloDocumento(inicial)));
  /** Os automáticos travados, calculados quando o fornecedor CHEGA (do banco ou da consulta), não a cada tecla. */
  const [travados, setTravados] = useState<Set<CampoAutomatico>>(() => camposTravados(inicial));
  const [consultando, setConsultando] = useState(false);
  const [aviso, setAviso] = useState<{ tom: "info" | "erro" | "sucesso" | "atencao"; texto: string } | null>(null);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const novo = !f.id;
  // Cadastro NOVO pode ser criado por quem está montando a EC (era assim com o
  // "Validar" da linha); mexer em cadastro existente pede a permissão da tela.
  const podeSalvar = novo || podeEditar;
  const sujo = JSON.stringify(f) !== base;
  const tipo = tipoDocumento(f.cnpj);
  const liberado = camposDaCasaLiberados(f) && !consultando && podeSalvar;
  const ehCpf = tipo === "cpf";
  const apelidoAutomatico = useMemo(() => gerarApelidoFornecedor(f.nomeFantasia, f.razaoSocial), [f.nomeFantasia, f.razaoSocial]);

  /** O documento já tratado — a busca roda uma vez por documento. Cadastro aberto do banco começa "tratado". */
  const tratado = useRef(inicial.id ? onlyDigits(inicial.cnpj) : "");
  /** A resposta que chega depois de o documento mudar é descartada. */
  const docAtual = useRef(onlyDigits(f.cnpj));
  docAtual.current = onlyDigits(f.cnpj);
  /** O formulário como está agora — para a resposta da consulta partir dele, e não de uma foto velha. */
  const fAtual = useRef(f);
  fAtual.current = f;
  /** Qual consulta é a vigente: a que chega depois de outra ter começado é descartada. */
  const consultaVigente = useRef(0);

  /** Carrega um fornecedor no formulário como ponto de partida (sem alteração pendente). */
  function carregar(novoF: Fornecedor) {
    const limpo = comPerfilPeloDocumento(novoF);
    setF(limpo);
    setBase(JSON.stringify(limpo));
    setTravados(camposTravados(limpo));
  }

  async function consultar(digitos: string, atualizar = false) {
    if (!flags.consultaCnpj) {
      setAviso({ tom: "info", texto: "A consulta de CNPJ está desligada: preencha os dados abaixo." });
      setTravados(camposTravados({ ...f, cnpj: maskDoc(digitos) }));
      return;
    }
    const minha = ++consultaVigente.current;
    const vigente = () => consultaVigente.current === minha && docAtual.current === digitos;
    setConsultando(true);
    setAviso({ tom: "info", texto: "Consultando o CNPJ…" });
    try {
      const d = await consultarCnpj(digitos);
      if (!vigente()) return;
      // Os campos ficam travados durante a consulta (fieldset), então o que
      // está na tela agora é o ponto de partida certo.
      const preenchido = aplicarConsulta(fAtual.current, d);
      setF(preenchido);
      setTravados(camposTravados(preenchido));
      setAviso({
        tom: "sucesso",
        texto: atualizar
          ? "Dados atualizados pela consulta do CNPJ. Salve para gravar."
          : "Dados preenchidos pela consulta do CNPJ. Os que vieram de lá ficam só leitura.",
      });
    } catch (e) {
      if (!vigente()) return;
      // Plano B da consulta (ver lib/cnpj): fora do ar, o que veio vazio fica
      // livre para preencher — o CNPJ continua amarrando o cadastro.
      setAviso({ tom: "erro", texto: `${(e as Error).message} Os campos vazios ficam livres para preencher.` });
    } finally {
      if (consultaVigente.current === minha) setConsultando(false);
    }
  }

  /**
   * Documento completo no cadastro novo: já existe? Abre o dele (19/11/2026: um
   * fornecedor por CPF/CNPJ). Não existe e é CNPJ? Consulta. CPF não tem fonte
   * pública: os campos abrem para preencher.
   */
  useEffect(() => {
    const digitos = onlyDigits(f.cnpj);
    if (f.id || (tipo !== "cnpj" && tipo !== "cpf") || tratado.current === digitos) return;
    tratado.current = digitos;
    let vivo = true;
    void (async () => {
      const local = cadastro.find((x) => onlyDigits(x.cnpj) === digitos);
      const existente = local ?? (await repo.fornecedores.porCnpj(digitos).catch(() => undefined));
      if (!vivo || docAtual.current !== digitos) return;
      if (existente) {
        carregar(structuredClone(existente));
        setAviso({
          tom: "atencao",
          texto: `Este ${tipo === "cpf" ? "CPF" : "CNPJ"} já está cadastrado. Abrimos o cadastro existente em vez de criar outro.`,
        });
        return;
      }
      if (tipo === "cnpj") void consultar(digitos);
      else setAviso({ tom: "info", texto: "Pessoa física não tem consulta pública: preencha os dados abaixo." });
    })();
    return () => { vivo = false; };
    // `consultar` e `cadastro` ficam fora: o gatilho é o documento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.cnpj, f.id, tipo]);

  function mudarDocumento(valor: string) {
    const doc = maskCpfCnpjInput(valor);
    // Outro documento = outro fornecedor: o que a consulta anterior trouxe não
    // pode ficar no cadastro deste. Os campos da casa digitados ficam.
    if (onlyDigits(doc) === onlyDigits(f.cnpj)) {
      upd({ cnpj: doc });
      return;
    }
    const limpo: Fornecedor = {
      ...f, cnpj: doc, razaoSocial: "", nomeFantasia: "", endereco: "", cnaes: [],
      inscricaoEstadual: "", perfilTributario: "",
    };
    setF(limpo);
    setAviso(null);
    // Consulta em andamento do documento anterior deixa de valer, e o documento
    // que voltar a ficar completo é buscado de novo (os campos acabaram de ser limpos).
    consultaVigente.current++;
    tratado.current = "";
    setConsultando(false);
    setTravados(camposTravados(limpo));
  }

  const upd = (patch: Partial<Fornecedor>) => setF((atual) => ({ ...atual, ...patch }));
  const trav = (c: CampoAutomatico) => travados.has(c);

  /* ------------------------------ contatos ------------------------------ */
  // A agenda é editada no lugar (ver o histórico em Fornecedores, 2026): o
  // botão só acrescenta um bloco em branco; blocos vazios somem ao salvar.
  function addContato() {
    upd({ contatos: [...(f.contatos ?? []), { nome: "" }] });
    window.setTimeout(() => {
      const campos = document.querySelectorAll<HTMLInputElement>("[data-contato-nome]");
      campos[campos.length - 1]?.focus();
    }, 0);
  }
  function mudarContato(i: number, patch: Partial<ContatoFornecedor>) {
    const lista = [...(f.contatos ?? [])];
    lista[i] = { ...lista[i], ...patch };
    upd({ contatos: lista });
  }
  const removerContato = (i: number) => upd({ contatos: (f.contatos ?? []).filter((_, j) => j !== i) });

  /* ------------------------------- salvar ------------------------------- */
  async function salvar() {
    if (tipo === "invalido") {
      toast("CNPJ inválido — confira os números digitados.", "danger");
      return;
    }
    if (tipo !== "cnpj" && tipo !== "cpf") {
      toast("Informe primeiro um CPF ou CNPJ válido.", "warning");
      return;
    }
    // Já existe e nada mudou: quem abriu pelo "+" só quer usar este fornecedor.
    if (!sujo && f.id) {
      onSalvo(f);
      return;
    }
    if (!f.razaoSocial.trim()) {
      setTentouSalvar(true);
      toast(ehCpf ? "Informe o nome da pessoa." : "A razão social não veio da consulta: preencha-a.", "warning");
      return;
    }
    // O endereço é obrigatório e completo (Marisa, 13/11/2026): sem ele o
    // contrato sai com a qualificação do fornecedor pela metade.
    const end = validarEndereco(f.endereco);
    if (!end.completo) {
      setTentouSalvar(true);
      toast(`Endereço incompleto. ${textoDoQueFalta(end.faltando)}`, "danger");
      return;
    }
    setSalvando(true);
    try {
      const salvo = await repo.fornecedores.salvar({ ...f, cnpj: maskDoc(f.cnpj) });
      toast(novo ? "Fornecedor cadastrado." : "Cadastro do fornecedor salvo.", "success");
      onSalvo(salvo);
    } catch (e) {
      toast(`Não foi possível salvar: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  }

  const fechar = () => void sairSeConfirmar(sujo, onFechar, { novo });
  const enderecoTravado = trav("endereco");
  const opcoesPerfil = opcoesPerfilNoCadastro(f.perfilTributario, trav("perfilTributario"));
  const titulo = novo ? "Novo fornecedor" : f.nomeFantasia || f.razaoSocial || "Fornecedor";

  return (
    <JanelaModal onFechar={onFechar} sujo={sujo} novo={novo} fecharNoVeu={false} rotulo={titulo} alinhar="topo" className="my-6 w-full max-w-2xl overflow-hidden bg-card">
      <CabecalhoJanela
        titulo={titulo}
        subtitulo={novo ? "Comece pelo CPF ou CNPJ: os dados da Receita entram sozinhos." : maskDoc(f.cnpj)}
        icone={Truck}
        onFechar={onFechar}
        fecharDesabilitado={salvando}
      />

      <div className="space-y-5 p-5">
        {/* 1. O DOCUMENTO — a primeira informação. Cadastro existente não troca de
            documento: outro CNPJ é outro fornecedor. */}
        <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Field label="CPF ou CNPJ" obrigatorio>
            {novo && podeSalvar ? (
              <Input
                autoFocus
                value={f.cnpj}
                onChange={(e) => mudarDocumento(e.target.value)}
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                erro={tipo === "invalido" || (tentouSalvar && tipo === "incompleto")}
                aria-describedby="doc-ajuda"
              />
            ) : (
              <CampoLeitura valor={maskDoc(f.cnpj)} />
            )}
          </Field>
          {tipo === "cnpj" && podeSalvar && (
            <Button
              variant="secondary"
              icon={<RefreshCw className={cn("h-4 w-4", consultando && "animate-spin")} />}
              onClick={() => void consultar(onlyDigits(f.cnpj), true)}
              disabled={consultando || !flags.consultaCnpj}
              title="Consultar o CNPJ de novo e atualizar os dados da Receita"
            >
              {consultando ? "Consultando…" : "Atualizar pela Receita"}
            </Button>
          )}
        </div>
        <p id="doc-ajuda" className="-mt-3 text-2xs text-muted-foreground">
          {tipo === "invalido"
            ? <span className="font-semibold text-destructive">CNPJ inválido — confira os números digitados.</span>
            : ehCpf
              ? "Pessoa física: sem consulta pública, os dados são preenchidos à mão."
              : tipo === "cnpj"
                ? "Com o CNPJ, razão social, nome fantasia, endereço, CNAEs, inscrição estadual e perfil vêm da consulta e ficam só leitura."
                : onlyDigits(f.cnpj).length === 11
                  ? "Esse CPF não confere. Se for CNPJ, continue digitando."
                  : "Digite o documento para liberar o resto do cadastro."}
        </p>

        {aviso && <AvisoEmLinha tom={aviso.tom}>{aviso.texto}</AvisoEmLinha>}
        {!podeSalvar && <AvisoEmLinha tom="info">Você pode consultar este cadastro, mas não alterá-lo.</AvisoEmLinha>}

        {/* `fieldset disabled` trava de uma vez os campos (inclusive endereço e
            telefone, que são compostos) enquanto não há documento válido. */}
        <fieldset disabled={!liberado} className="space-y-5 disabled:opacity-60">
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {ehCpf ? "Dados da pessoa" : "Dados da Receita"}
              {!ehCpf && travados.size > 0 && <Selo tom="cinza">só leitura</Selo>}
            </h3>
            <Field label={ehCpf ? "Nome completo" : "Razão social"} obrigatorio>
              {trav("razaoSocial")
                ? <CampoLeitura valor={f.razaoSocial} />
                : <Input formato="titulo-empresa" value={f.razaoSocial} erro={tentouSalvar && !f.razaoSocial.trim()} onChange={(e) => upd({ razaoSocial: e.target.value })} />}
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome fantasia">
                {trav("nomeFantasia")
                  ? <CampoLeitura valor={f.nomeFantasia ?? ""} />
                  : <Input formato="titulo" value={f.nomeFantasia ?? ""} onChange={(e) => upd({ nomeFantasia: e.target.value })} />}
              </Field>
              <Field label="Perfil tributário">
                {opcoesPerfil === null ? (
                  <CampoLeitura valor={f.perfilTributario} />
                ) : (
                  <Select value={f.perfilTributario} onChange={(e) => upd({ perfilTributario: e.target.value })}>
                    {!trav("perfilTributario") && <option value="">Selecione…</option>}
                    {opcoesPerfil.map((p) => <option key={p}>{p}</option>)}
                  </Select>
                )}
              </Field>
            </div>
            {trav("perfilTributario") && opcoesPerfil !== null && (
              <p className="-mt-1 text-2xs text-muted-foreground">
                A consulta pública não distingue Lucro Presumido de Lucro Real: confirme qual dos dois, se souber.
              </p>
            )}
            <Field label="Inscrição estadual">
              {trav("inscricaoEstadual")
                ? <CampoLeitura valor={f.inscricaoEstadual} />
                : <Input value={f.inscricaoEstadual} onChange={(e) => upd({ inscricaoEstadual: e.target.value })} />}
            </Field>
            <Field label="Endereço" obrigatorio>
              {enderecoTravado
                ? <CampoLeitura valor={f.endereco} />
                : <EnderecoCampos value={f.endereco} mostrarErros={tentouSalvar} onChange={(endereco) => upd({ endereco })} />}
            </Field>
            {(f.cnaes?.length ?? 0) > 0 && (
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">CNAEs</span>
                <div className="flex flex-wrap gap-1.5">
                  {f.cnaes!.map((c) => <Selo key={c} tom="cinza" className="whitespace-normal">{c}</Selo>)}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Dados da casa</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* O apelido é GERADO a partir do nome (ver domain/fornecedor) e entra
                  no título das OSs; o campo é a saída para quando não agradar. */}
              <Field label="Apelido" hint="(entra no título das OSs)">
                <Input formato="titulo" value={f.apelido ?? ""} onChange={(e) => upd({ apelido: e.target.value })} placeholder={apelidoAutomatico || "gerado a partir do nome"} />
              </Field>
              {/* A IM não vem em fonte pública: é manual, com o atalho para o portal da PBH. */}
              <Field label="Inscrição municipal">
                <InscricaoMunicipalInput value={f.inscricaoMunicipal} onChange={(inscricaoMunicipal) => upd({ inscricaoMunicipal })} />
              </Field>
            </div>
            <Field label="Representante" hint="(quem assina pelo fornecedor)">
              <Input formato="titulo" value={f.representante} onChange={(e) => upd({ representante: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Telefone" hint="(vai na OS)"><TelefoneInput value={f.telefone} onChange={(telefone) => upd({ telefone })} /></Field>
              <Field label="E-mail" hint="(vai na OS)"><Input type="email" value={f.email} onChange={(e) => upd({ email: e.target.value })} /></Field>
            </div>

            {/* A AGENDA do fornecedor: as pessoas de lá dentro, uma a uma. */}
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Contatos (pessoas do fornecedor)</span>
                <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={addContato}>Adicionar</Button>
              </div>
              {(f.contatos ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum contato ainda. Os informados nas ECs entram aqui sozinhos, e você pode acrescentar outros com <b>Adicionar</b>.
                </p>
              ) : (
                <div className="space-y-2">
                  {(f.contatos ?? []).map((c, i) => (
                    <div key={i} className="rounded-md border border-border bg-muted/40 p-2.5">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-2xs font-semibold text-muted-foreground">Contato {i + 1}</span>
                        <button
                          type="button"
                          onClick={() => removerContato(i)}
                          className="shrink-0 rounded-sm p-1 text-muted-foreground hover:text-destructive"
                          title="Remover contato"
                          aria-label={`Remover o contato ${i + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Nome">
                          <Input data-contato-nome formato="titulo" value={c.nome ?? ""} onChange={(e) => mudarContato(i, { nome: e.target.value })} />
                        </Field>
                        <Field label="Cargo / função">
                          <Input placeholder="Produção, Financeiro…" value={c.funcao ?? ""} onChange={(e) => mudarContato(i, { funcao: e.target.value })} />
                        </Field>
                        <Field label="Telefone" className="col-span-2">
                          <TelefoneInput value={c.telefone ?? ""} onChange={(v) => mudarContato(i, { telefone: v })} />
                        </Field>
                        <Field label="E-mail" className="col-span-2">
                          <Input type="email" value={c.email ?? ""} onChange={(e) => mudarContato(i, { email: e.target.value })} />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </fieldset>
      </div>

      <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
        <Button variant="secondary" onClick={fechar} disabled={salvando}>{podeSalvar ? "Cancelar" : "Fechar"}</Button>
        {podeSalvar ? (
          <Button onClick={() => void salvar()} disabled={salvando || consultando || (tipo !== "cnpj" && tipo !== "cpf")}>
            {salvando ? "Salvando…" : novo ? textoNovo : sujo ? "Salvar" : escolher ? "Usar este fornecedor" : "Salvar"}
          </Button>
        ) : escolher && f.id ? (
          <Button onClick={() => onSalvo(f)}>Usar este fornecedor</Button>
        ) : null}
      </div>
    </JanelaModal>
  );
}
