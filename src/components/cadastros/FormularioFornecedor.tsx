/**
 * O FORMULÁRIO DO FORNECEDOR, em janela (27/11/2026).
 *
 * É o mesmo na tela Cadastros e no "+" do item da EC: cadastrar um fornecedor
 * novo sem sair de onde se está. Começa pelo tipo (CNPJ ou CPF), que decide os
 * campos; o documento é conferido e não pode se repetir; os contatos são uma
 * linha por meio de contato. As regras estão em `domain/fornecedorCadastro`.
 */
import { useMemo, useState } from "react";
import { EnderecoCampos } from "@/components/EnderecoCampos";
import { InscricaoMunicipalInput } from "@/components/InscricaoMunicipalInput";
import { Button, Field, Input, TelefoneInput, Select, CarregandoTela } from "@/components/ui";
import { IcSearch, IcTrash, IcPlus } from "@/components/icons";
import { repo } from "@/data";
import { useAvisoDeSaida } from "@/hooks/useAvisoDeSaida";
import { consultarCnpj } from "@/lib/cnpj";
import { useAoCompletarDocumento } from "@/lib/buscaPorDocumento";
import { flags } from "@/lib/flags";
import { comPerfilPeloDocumento, gerarApelidoFornecedor, opcoesPerfilTributario, semVazios } from "@/domain/fornecedor";
import {
  contatosDasLinhas, linhaContatoVazia, linhasDosContatos, rotuloIdFornecedor, semCamposDeEmpresa, tipoDoFornecedor,
  validarCadastroFornecedor,
  type ErrosCadastroFornecedor, type LinhaContato, type TipoContato, type TipoFornecedor,
} from "@/domain/fornecedorCadastro";
import { cx, maskCpfCnpjInput, onlyDigits } from "@/lib/format";
import { toast } from "@/store/toast";
import type { Fornecedor } from "@/data/types";
import { Bloco, ErroCampo, Janela } from "./pecas";

const PERFIL_PF = "Pessoa Física (Recibo Simples)";

/** Fornecedor em branco, para o "Novo fornecedor". */
export const novoFornecedor = (): Fornecedor => ({
  id: "", razaoSocial: "", apelido: "", nomeFantasia: "", cnpj: "", perfilTributario: "", endereco: "",
  inscricaoEstadual: "", inscricaoMunicipal: "",
  dadosBancarios: { tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "" },
  representante: "", telefone: "", email: "", contatos: [],
});

export function FormularioFornecedor({ inicial, todos, onClose, onSalvo }: {
  inicial: Fornecedor;
  todos: Fornecedor[];
  onClose: () => void;
  /** Recebe o fornecedor como ficou gravado (com id e ID de exibição). */
  onSalvo: (salvo: Fornecedor) => void;
}) {
  const [f, setF] = useState<Fornecedor>(() => structuredClone(inicial));
  const [tipo, setTipo] = useState<TipoFornecedor>(() => tipoDoFornecedor(inicial));
  // Sempre há pelo menos uma linha de contato na tela, pronta para preencher.
  const [linhas, setLinhas] = useState<LinhaContato[]>(() => {
    const l = linhasDosContatos(inicial.contatos);
    return l.length ? l : [linhaContatoVazia()];
  });
  const [erros, setErros] = useState<ErrosCadastroFornecedor>({});
  const [aviso, setAviso] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Cadastro aberto e mexido: F5, fechar a aba ou sair da tela pedem confirmação.
  useAvisoDeSaida({ f, linhas });

  const upd = (patch: Partial<Fornecedor>) => setF((atual) => ({ ...atual, ...patch }));
  const apelidoAutomatico = useMemo(() => gerarApelidoFornecedor(f.nomeFantasia, f.razaoSocial), [f.nomeFantasia, f.razaoSocial]);
  const repetido = todos.find((o) => o.id !== f.id && onlyDigits(o.cnpj) && onlyDigits(o.cnpj) === onlyDigits(f.cnpj));

  /** Trocar o tipo troca o formulário: o documento do outro tipo não serve, e dado de empresa não é de pessoa. */
  function trocarTipo(novo: TipoFornecedor) {
    if (novo === tipo) return;
    setTipo(novo);
    setErros({});
    setAviso("");
    setF((atual) =>
      novo === "CPF"
        ? { ...semCamposDeEmpresa(atual), cnpj: "", perfilTributario: PERFIL_PF }
        : { ...atual, cnpj: "", perfilTributario: atual.perfilTributario === PERFIL_PF ? "" : atual.perfilTributario }
    );
  }

  /** Só os dígitos do tipo escolhido: no CPF não cabe um 12º dígito que o transformaria em CNPJ. */
  const mudarDocumento = (valor: string) => {
    const limite = tipo === "CPF" ? 11 : 14;
    const mascarado = maskCpfCnpjInput(onlyDigits(valor).slice(0, limite));
    setErros((e) => ({ ...e, documento: undefined }));
    setF((atual) => comPerfilPeloDocumento({ ...atual, cnpj: mascarado }));
  };

  /** A lupa do CNPJ: busca na Receita e preenche o que veio, sem apagar o que já foi digitado. */
  async function consultar() {
    const doc = onlyDigits(f.cnpj);
    setAviso("");
    if (doc.length !== 14) {
      setErros((e) => ({ ...e, documento: "Digite o CNPJ completo para consultar." }));
      return;
    }
    setConsultando(true);
    try {
      const d = await consultarCnpj(f.cnpj);
      // A resposta que chega depois de o documento mudar é descartada.
      setF((atual) =>
        onlyDigits(atual.cnpj) === doc
          ? {
              ...atual,
              ...semVazios({
                razaoSocial: d.razaoSocial, nomeFantasia: d.nomeFantasia, endereco: d.endereco,
                perfilTributario: d.perfilTributario, email: d.email, telefone: d.telefone,
              }),
              ...(d.cnaes?.length ? { cnaes: d.cnaes } : {}),
              inscricaoEstadual: d.inscricaoEstadual || atual.inscricaoEstadual || "Isenta",
            }
          : atual
      );
      setAviso("Dados preenchidos pela consulta do CNPJ. Confira e complete o que faltar.");
    } catch (e) {
      setErros((er) => ({ ...er, documento: (e as Error).message }));
    } finally {
      setConsultando(false);
    }
  }

  // CNPJ novo digitado por inteiro: os dados da Receita entram sozinhos (a lupa busca de novo).
  useAoCompletarDocumento(f.cnpj, true, (doc) => {
    if (todos.some((o) => o.id !== f.id && onlyDigits(o.cnpj) === doc)) return; // o aviso de duplicado já está na tela
    if (tipo === "CNPJ" && doc.length === 14 && flags.consultaCnpj) void consultar();
  }, f.id || "novo");

  /* contatos */
  const mudarLinha = (i: number, patch: Partial<LinhaContato>) =>
    setLinhas((atuais) => atuais.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const adicionarDepois = (i: number) =>
    setLinhas((atuais) => [...atuais.slice(0, i + 1), linhaContatoVazia(), ...atuais.slice(i + 1)]);
  const removerLinha = (i: number) =>
    setLinhas((atuais) => (atuais.length === 1 ? [linhaContatoVazia()] : atuais.filter((_, j) => j !== i)));

  async function salvar() {
    const encontrados = validarCadastroFornecedor(f, tipo, linhas, todos);
    setErros(encontrados);
    const primeiro = Object.values(encontrados).find(Boolean);
    if (primeiro) {
      toast(primeiro, "danger");
      return;
    }
    setSalvando(true);
    try {
      const pronto = { ...(tipo === "CPF" ? semCamposDeEmpresa(f) : f), contatos: contatosDasLinhas(linhas) };
      const salvo = await repo.fornecedores.salvar(pronto);
      toast(f.id ? "Fornecedor salvo." : "Fornecedor cadastrado.", "success");
      onSalvo(salvo);
    } catch (e) {
      toast(`Não foi possível salvar: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  }

  const erroDocumento = erros.documento ?? (repetido ? `Este ${tipo} já está cadastrado: ${repetido.nomeFantasia || repetido.razaoSocial}.` : undefined);

  return (
    <Janela
      titulo={f.id ? "Editar fornecedor" : "Novo fornecedor"}
      subtitulo={f.id ? <>ID {rotuloIdFornecedor(f.codigo)}</> : "O ID é gerado ao salvar."}
      onClose={onClose}
      rodape={
        <>
          <Button variant="secondary" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={salvando}>{salvando ? "Salvando…" : f.id ? "Salvar" : "Cadastrar fornecedor"}</Button>
        </>
      }
    >
      {salvando && <CarregandoTela />}
      <div className="space-y-6">
        <Bloco titulo="Identificação">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* O TIPO vem primeiro: é ele que decide os campos do resto do formulário. */}
            <Field label="Tipo de fornecedor" obrigatorio>
              <div role="radiogroup" aria-label="Tipo de fornecedor" className="inline-flex h-11 w-full rounded-btn border-[1.5px] border-[#BFC4CE] bg-surface p-1">
                {(["CNPJ", "CPF"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={tipo === t}
                    onClick={() => trocarTipo(t)}
                    className={cx(
                      "flex-1 rounded-[8px] text-[13px] font-bold transition-colors input-focus",
                      tipo === t ? "bg-primary-soft text-primary-dark" : "text-ink-2 hover:bg-[#F1F2F5]"
                    )}
                  >
                    {t === "CNPJ" ? "Empresa (CNPJ)" : "Pessoa física (CPF)"}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={tipo} obrigatorio>
              <div className="flex gap-2">
                <Input
                  erro={!!erroDocumento}
                  value={f.cnpj}
                  onChange={(e) => mudarDocumento(e.target.value)}
                  inputMode="numeric"
                  placeholder={tipo === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
                  aria-label={tipo}
                />
                {tipo === "CNPJ" && (
                  <button
                    type="button"
                    onClick={() => void consultar()}
                    disabled={!flags.consultaCnpj || consultando}
                    title={flags.consultaCnpj ? "Buscar os dados deste CNPJ na Receita" : "Consulta de CNPJ desligada neste ambiente"}
                    aria-label="Buscar os dados do CNPJ na Receita"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-btn border-[1.5px] border-[#D6D9E0] bg-surface text-ink-2 hover:border-primary hover:bg-primary-soft hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-50 input-focus"
                  >
                    <IcSearch width={17} height={17} className={consultando ? "animate-pulse" : undefined} />
                  </button>
                )}
              </div>
              <ErroCampo texto={erroDocumento} />
            </Field>

            <Field label={tipo === "CPF" ? "Nome completo" : "Razão social"} obrigatorio className={tipo === "CPF" ? "sm:col-span-2" : undefined}>
              <Input erro={!!erros.nome} formato={tipo === "CPF" ? "titulo" : "titulo-empresa"} value={f.razaoSocial} onChange={(e) => { upd({ razaoSocial: e.target.value }); setErros((er) => ({ ...er, nome: undefined })); }} />
              <ErroCampo texto={erros.nome} />
            </Field>
            {tipo === "CNPJ" && (
              <Field label="Nome fantasia">
                <Input formato="titulo" value={f.nomeFantasia ?? ""} onChange={(e) => upd({ nomeFantasia: e.target.value })} />
              </Field>
            )}

            <Field label="Apelido" hint="(entra no título do contrato)">
              <Input formato="titulo" value={f.apelido ?? ""} onChange={(e) => upd({ apelido: e.target.value })} placeholder={apelidoAutomatico || "gerado a partir do nome"} />
              <p className="text-[12px] text-ink-3 mt-1">
                {apelidoAutomatico ? <>Em branco, o sistema usa <b>{apelidoAutomatico}</b>.</> : "Em branco, sai do nome do fornecedor."}
              </p>
            </Field>
            <Field label="Perfil tributário">
              {tipo === "CPF" ? (
                <Input value={PERFIL_PF} disabled />
              ) : (
                <Select value={f.perfilTributario} onChange={(e) => upd({ perfilTributario: e.target.value })}>
                  <option value="">Selecione…</option>
                  {opcoesPerfilTributario(f.perfilTributario).filter((p) => p !== PERFIL_PF).map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              )}
            </Field>

            {tipo === "CNPJ" && (
              <>
                <Field label="Inscrição estadual">
                  <Input value={f.inscricaoEstadual} onChange={(e) => upd({ inscricaoEstadual: e.target.value })} placeholder="Número ou “Isenta”" />
                </Field>
                <Field label="Inscrição municipal" hint="(a lupa copia o CNPJ)">
                  <InscricaoMunicipalInput value={f.inscricaoMunicipal} onChange={(v) => upd({ inscricaoMunicipal: v })} cnpj={f.cnpj} compacto />
                </Field>
              </>
            )}
          </div>
          {aviso && <div className="mt-3 text-[12.5px] text-info bg-info-soft rounded-btn px-3 py-2">{aviso}</div>}
          {tipo === "CNPJ" && (f.cnaes?.length ?? 0) > 0 && (
            <div className="mt-3">
              <span className="block mb-1.5 text-[12.5px] font-bold text-ink">CNAEs <span className="text-ink-3 font-medium">(do CNPJ)</span></span>
              <div className="flex flex-wrap gap-1.5">
                {f.cnaes!.map((c, i) => <span key={i} className="text-[11px] bg-[#F0F1F4] text-ink-2 rounded-pill px-2 py-1">{c}</span>)}
              </div>
            </div>
          )}
        </Bloco>

        <Bloco titulo="Endereço">
          <EnderecoCampos value={f.endereco} mostrarErros={!!erros.endereco} onChange={(endereco) => { upd({ endereco }); setErros((er) => ({ ...er, endereco: undefined })); }} />
          <ErroCampo texto={erros.endereco} />
        </Bloco>

        <Bloco titulo="Contato geral">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Telefone"><TelefoneInput value={f.telefone} onChange={(v) => upd({ telefone: v })} /></Field>
            <Field label="E-mail"><Input type="email" value={f.email} onChange={(e) => upd({ email: e.target.value })} placeholder="contato@empresa.com.br" /></Field>
          </div>
        </Bloco>

        {/* CONTATOS: uma linha por meio de contato — nome, tipo e valor. O "+"
            fica na própria linha e abre outra logo abaixo. */}
        <Bloco titulo="Contatos (pessoas do fornecedor)">
          <div className="space-y-2">
            <div className="hidden sm:grid grid-cols-[minmax(0,1.1fr)_9rem_minmax(0,1.3fr)_auto] gap-2 text-[11.5px] font-bold text-ink-2">
              <span>Nome</span><span>Tipo</span><span>Contato</span><span className="w-[84px]" />
            </div>
            {linhas.map((l, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.1fr)_9rem_minmax(0,1.3fr)_auto] gap-2 items-start">
                <Input formato="titulo" value={l.nome} onChange={(e) => mudarLinha(i, { nome: e.target.value })} placeholder="Nome da pessoa" aria-label={`Nome do contato ${i + 1}`} />
                <Select value={l.tipo} onChange={(e) => mudarLinha(i, { tipo: e.target.value as TipoContato, valor: "" })} aria-label={`Tipo do contato ${i + 1}`}>
                  <option value="telefone">Telefone</option>
                  <option value="email">E-mail</option>
                </Select>
                {l.tipo === "telefone" ? (
                  <TelefoneInput value={l.valor} onChange={(v) => mudarLinha(i, { valor: v })} />
                ) : (
                  <Input type="email" value={l.valor} onChange={(e) => mudarLinha(i, { valor: e.target.value })} placeholder="nome@empresa.com.br" aria-label={`E-mail do contato ${i + 1}`} />
                )}
                <div className="flex gap-1">
                  <button type="button" onClick={() => adicionarDepois(i)} title="Adicionar outro contato" aria-label="Adicionar outro contato"
                    className="inline-flex h-11 w-10 items-center justify-center rounded-btn border-[1.5px] border-[#D6D9E0] bg-surface text-ink-2 hover:border-primary hover:bg-primary-soft hover:text-primary-dark input-focus">
                    <IcPlus width={16} height={16} />
                  </button>
                  <button type="button" onClick={() => removerLinha(i)} title="Remover este contato" aria-label={`Remover o contato ${i + 1}`}
                    className="inline-flex h-11 w-10 items-center justify-center rounded-btn text-ink-3 hover:bg-danger-soft hover:text-danger input-focus">
                    <IcTrash width={15} height={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <ErroCampo texto={erros.contatos} />
        </Bloco>
      </div>
    </Janela>
  );
}
