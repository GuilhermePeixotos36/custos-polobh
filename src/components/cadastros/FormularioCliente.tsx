/**
 * O FORMULÁRIO DO CLIENTE, em janela (27/11/2026).
 *
 * É o mesmo na tela Cadastros e no "+" dos Dados Gerais do projeto: cadastrar
 * um cliente novo sem sair de onde se está. Segue o desenho do formulário de
 * fornecedores — tipo (CNPJ ou CPF) primeiro, lupa da Receita, documento
 * conferido e sem repetição. As regras estão em `domain/clienteCadastro`.
 */
import { useState } from "react";
import { EnderecoCampos } from "@/components/EnderecoCampos";
import { InscricaoMunicipalInput } from "@/components/InscricaoMunicipalInput";
import { Button, Field, Input, TelefoneInput, CarregandoTela } from "@/components/ui";
import { IcSearch } from "@/components/icons";
import { repo } from "@/data";
import { useAvisoDeSaida } from "@/hooks/useAvisoDeSaida";
import { consultarCnpj } from "@/lib/cnpj";
import { useAoCompletarDocumento } from "@/lib/buscaPorDocumento";
import { flags } from "@/lib/flags";
import { rotuloIdFornecedor as rotuloId } from "@/domain/fornecedorCadastro";
import {
  semCamposDeEmpresaDoCliente, tipoDoCliente, validarCadastroCliente,
  type ErrosCadastroCliente, type TipoCliente,
} from "@/domain/clienteCadastro";
import { cx, maskCpfCnpjInput, onlyDigits } from "@/lib/format";
import { toast } from "@/store/toast";
import type { Cliente } from "@/data/types";
import { Bloco, ErroCampo, Janela } from "./pecas";

export function FormularioCliente({ inicial, todos, onClose, onSalvo }: {
  inicial: Cliente;
  todos: Cliente[];
  onClose: () => void;
  /** Recebe o cliente como ficou gravado (com id e ID de exibição). */
  onSalvo: (salvo: Cliente) => void;
}) {
  const [c, setC] = useState<Cliente>(() => structuredClone(inicial));
  const [tipo, setTipo] = useState<TipoCliente>(() => tipoDoCliente(inicial));
  const [erros, setErros] = useState<ErrosCadastroCliente>({});
  const [aviso, setAviso] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Cadastro aberto e mexido: F5, fechar a aba ou sair da tela pedem confirmação.
  useAvisoDeSaida({ c });

  const upd = (patch: Partial<Cliente>) => setC((atual) => ({ ...atual, ...patch }));
  const updRep = (patch: Partial<Cliente["representante"]>) =>
    setC((atual) => ({ ...atual, representante: { ...atual.representante, ...patch } }));
  const semErro = (campo: keyof ErrosCadastroCliente) => setErros((e) => ({ ...e, [campo]: undefined }));
  const repetido = todos.find((o) => o.id !== c.id && onlyDigits(o.cnpjCpf) && onlyDigits(o.cnpjCpf) === onlyDigits(c.cnpjCpf));

  /** Trocar o tipo troca o formulário: o documento do outro tipo não serve, e inscrição é de empresa. */
  function trocarTipo(novo: TipoCliente) {
    if (novo === tipo) return;
    setTipo(novo);
    setErros({});
    setAviso("");
    setC((atual) => (novo === "CPF" ? { ...semCamposDeEmpresaDoCliente(atual), cnpjCpf: "" } : { ...atual, cnpjCpf: "" }));
  }

  /** Só os dígitos do tipo escolhido: no CPF não cabe um 12º dígito que o transformaria em CNPJ. */
  const mudarDocumento = (valor: string) => {
    semErro("documento");
    upd({ cnpjCpf: maskCpfCnpjInput(onlyDigits(valor).slice(0, tipo === "CPF" ? 11 : 14)) });
  };

  /** A lupa do CNPJ: busca na Receita e preenche o que veio, sem apagar o que já foi digitado. */
  async function consultar() {
    const doc = onlyDigits(c.cnpjCpf);
    setAviso("");
    if (doc.length !== 14) {
      setErros((e) => ({ ...e, documento: "Digite o CNPJ completo para consultar." }));
      return;
    }
    setConsultando(true);
    try {
      const d = await consultarCnpj(c.cnpjCpf);
      // A resposta que chega depois de o documento mudar é descartada.
      setC((atual) =>
        onlyDigits(atual.cnpjCpf) === doc
          ? {
              ...atual,
              nome: atual.nome || d.nomeFantasia || d.razaoSocial,
              razaoSocial: d.razaoSocial || atual.razaoSocial,
              endereco: d.endereco || atual.endereco,
              inscricaoEstadual: d.inscricaoEstadual || atual.inscricaoEstadual || "Isenta",
              inscricaoMunicipal: d.inscricaoMunicipal || atual.inscricaoMunicipal,
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
  useAoCompletarDocumento(c.cnpjCpf, true, (doc) => {
    if (todos.some((o) => o.id !== c.id && onlyDigits(o.cnpjCpf) === doc)) return; // o aviso de duplicado já está na tela
    if (tipo === "CNPJ" && doc.length === 14 && flags.consultaCnpj) void consultar();
  }, c.id || "novo");

  async function salvar() {
    const encontrados = validarCadastroCliente(c, tipo, todos);
    setErros(encontrados);
    const primeiro = Object.values(encontrados).find(Boolean);
    if (primeiro) {
      toast(primeiro, "danger");
      return;
    }
    setSalvando(true);
    try {
      const salvo = await repo.clientes.salvar(tipo === "CPF" ? semCamposDeEmpresaDoCliente(c) : c);
      toast(c.id ? "Cliente salvo." : "Cliente cadastrado.", "success");
      onSalvo(salvo);
    } catch (e) {
      toast(`Não foi possível salvar: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  }

  const erroDocumento = erros.documento ?? (repetido ? `Este ${tipo} já está cadastrado: ${repetido.nome || repetido.razaoSocial}.` : undefined);

  return (
    <Janela
      titulo={c.id ? "Editar cliente" : "Novo cliente"}
      subtitulo={c.id ? <>ID {rotuloId(c.codigo)}</> : "O ID é gerado ao salvar."}
      onClose={onClose}
      rodape={
        <>
          <Button variant="secondary" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={salvando}>{salvando ? "Salvando…" : c.id ? "Salvar" : "Cadastrar cliente"}</Button>
        </>
      }
    >
      {salvando && <CarregandoTela />}
      <div className="space-y-6">
        <Bloco titulo="Identificação">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* O TIPO vem primeiro: é ele que decide os campos do resto do formulário. */}
            <Field label="Tipo de cliente" obrigatorio>
              <div role="radiogroup" aria-label="Tipo de cliente" className="inline-flex h-11 w-full rounded-btn border-[1.5px] border-[#BFC4CE] bg-surface p-1">
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
                  value={c.cnpjCpf}
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

            <Field label="Cliente (nome)" obrigatorio>
              <Input erro={!!erros.nome} formato="titulo" value={c.nome} onChange={(e) => { upd({ nome: e.target.value }); semErro("nome"); }} />
              <ErroCampo texto={erros.nome} />
            </Field>
            <Field label="Apelido" obrigatorio hint="(abre o nome dos projetos e das OS)">
              <Input erro={!!erros.apelido} value={c.apelido} onChange={(e) => { upd({ apelido: e.target.value }); semErro("apelido"); }} placeholder="Ex.: BM" />
              <ErroCampo texto={erros.apelido} />
            </Field>

            <Field label={tipo === "CPF" ? "Nome completo" : "Razão social"} className="sm:col-span-2">
              <Input formato={tipo === "CPF" ? "titulo" : "titulo-empresa"} value={c.razaoSocial} onChange={(e) => upd({ razaoSocial: e.target.value })} />
            </Field>

            {tipo === "CNPJ" && (
              <>
                <Field label="Inscrição estadual">
                  <Input value={c.inscricaoEstadual} onChange={(e) => upd({ inscricaoEstadual: e.target.value })} placeholder="Número ou “Isenta”" />
                </Field>
                <Field label="Inscrição municipal" hint="(a lupa copia o CNPJ)">
                  <InscricaoMunicipalInput value={c.inscricaoMunicipal} onChange={(v) => upd({ inscricaoMunicipal: v })} cnpj={c.cnpjCpf} compacto />
                </Field>
              </>
            )}
          </div>
          {aviso && <div className="mt-3 text-[12.5px] text-info bg-info-soft rounded-btn px-3 py-2">{aviso}</div>}
        </Bloco>

        <Bloco titulo="Endereço">
          <EnderecoCampos value={c.endereco} mostrarErros={!!erros.endereco} onChange={(endereco) => { upd({ endereco }); semErro("endereco"); }} />
          <ErroCampo texto={erros.endereco} />
        </Bloco>

        <Bloco titulo="Representante">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome"><Input formato="titulo" value={c.representante.nome} onChange={(e) => updRep({ nome: e.target.value })} /></Field>
            <Field label="Cargo"><Input formato="titulo" value={c.representante.cargo} onChange={(e) => updRep({ cargo: e.target.value })} /></Field>
            <Field label="Telefone"><TelefoneInput value={c.representante.telefones} onChange={(v) => updRep({ telefones: v })} /></Field>
            <Field label="E-mail">
              <Input type="email" erro={!!erros.representante} value={c.representante.email} onChange={(e) => { updRep({ email: e.target.value }); semErro("representante"); }} placeholder="nome@empresa.com.br" />
            </Field>
          </div>
          <ErroCampo texto={erros.representante} />
        </Bloco>
      </div>
    </Janela>
  );
}
