/**
 * A LISTA DE FORNECEDORES da tela Cadastros (27/11/2026).
 *
 * Mostra o básico — ID, fornecedor, documento, perfil e contato — e uma coluna
 * de ações: o olho abre a ficha para leitura, o lápis o formulário
 * (`FormularioFornecedor`, o mesmo do "+" da EC).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Card, Button, Input, Table, THead, Th, Tr, Td, Badge, EmptyState, AvisoErro, ThOrd, useOrdenacao,
} from "@/components/ui";
import { IcSearch, IcEye, IcEyeOff, IcPencil, IcTrash, IcCheck } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { gerarApelidoFornecedor, textoDoContato } from "@/domain/fornecedor";
import { linhasDosContatos, rotuloIdFornecedor, tipoDoFornecedor } from "@/domain/fornecedorCadastro";
import { onlyDigits } from "@/lib/format";
import { useAuth } from "@/store/auth";
import type { Fornecedor } from "@/data/types";
import { FormularioFornecedor, novoFornecedor } from "./FormularioFornecedor";
import { Bloco, Janela } from "./pecas";
import { ExcluirCadastro } from "./ExcluirCadastro";
import { confirmar } from "@/store/confirm";
import { toast } from "@/store/toast";
import { cx } from "@/lib/format";

/** O que está aberto na janela: a ficha (só leitura) ou o formulário. */
type Aberto = { modo: "ver" | "editar" | "excluir"; fornecedor: Fornecedor } | null;

export function ListaFornecedores({ pedidoNovo }: { /** Muda a cada clique em "Novo fornecedor" na barra da tela. */ pedidoNovo: number }) {
  const podeEditar = useAuth((s) => s.pode("fornecedores.editar"));
  const { data, loading, error, reload } = useAsync(() => repo.fornecedores.listar(), [], { oQue: "os fornecedores" });
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<Aberto>(null);
  useEffect(() => {
    if (pedidoNovo) setAberto({ modo: "editar", fornecedor: novoFornecedor() });
  }, [pedidoNovo]);

  /**
   * INATIVAR / REATIVAR (27/11/2026). O inativo continua no cadastro e em tudo o
   * que já foi feito com ele; só deixa de ser sugerido no preenchimento.
   */
  async function definirAtivo(alvo: Fornecedor, ativo: boolean) {
    const nome = alvo.nomeFantasia || alvo.razaoSocial || "o fornecedor";
    if (!ativo && !(await confirmar({
      titulo: `Inativar ${nome}?`,
      mensagem: "O registro continua no cadastro e nos documentos já feitos, mas deixa de ser sugerido no preenchimento. Dá para reativar depois.",
      confirmarTexto: "Inativar",
    }))) return;
    try {
      await repo.fornecedores.definirAtivo(alvo.id, ativo);
      toast(ativo ? `${nome} foi reativado.` : `${nome} foi inativado.`, "success");
      setAberto(null);
      reload();
    } catch (e) {
      toast(`Não foi possível ${ativo ? "reativar" : "inativar"}: ${(e as Error).message}`, "danger");
    }
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return data ?? [];
    // A busca cobre o que a tela mostra — inclusive o ID e os contatos.
    return (data ?? []).filter((f) =>
      [rotuloIdFornecedor(f.codigo), f.apelido, f.nomeFantasia, f.razaoSocial, f.cnpj, onlyDigits(f.cnpj), f.perfilTributario,
       f.email, f.telefone, ...(f.contatos ?? []).map(textoDoContato)]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [data, busca]);

  const { ordem, ordenarPor, ordenados: lista } = useOrdenacao(
    filtrados,
    {
      id: (f) => f.codigo ?? 0,
      fornecedor: (f) => f.nomeFantasia || f.razaoSocial,
      documento: (f) => onlyDigits(f.cnpj),
      perfil: (f) => f.perfilTributario,
      contato: (f) => f.email || f.telefone,
    },
    { col: "fornecedor", dir: "asc" },
    "cadastros.fornecedores"
  );

  return (
    <>
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"><IcSearch width={16} height={16} /></span>
              <Input className="pl-9" placeholder="Buscar por ID, nome, CNPJ/CPF ou contato" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <span className="text-[12px] text-ink-3">{lista.length} fornecedor(es)</span>
          </div>
        </Card>

        <Card padded={false}>
          {error ? <AvisoErro erro={error} oQue="os fornecedores" onTentarDeNovo={reload} /> : loading ? <div className="p-8 text-ink-3 text-sm">Carregando…</div> : lista.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title={busca.trim() ? "Nenhum fornecedor com essa busca" : "Nenhum fornecedor cadastrado"}
                hint={busca.trim() ? "Confira o que foi digitado ou limpe a busca." : podeEditar ? "Use “Novo fornecedor” para cadastrar o primeiro." : undefined}
              />
            </div>
          ) : (
            <Table>
              <THead>
                <ThOrd col="id" ordem={ordem} onSort={ordenarPor}>ID</ThOrd>
                <ThOrd col="fornecedor" ordem={ordem} onSort={ordenarPor}>Fornecedor</ThOrd>
                <ThOrd col="documento" ordem={ordem} onSort={ordenarPor}>CNPJ / CPF</ThOrd>
                <ThOrd col="perfil" ordem={ordem} onSort={ordenarPor}>Perfil</ThOrd>
                <ThOrd col="contato" ordem={ordem} onSort={ordenarPor}>Contato</ThOrd>
                <Th align="right">Ações</Th>
              </THead>
              <tbody>
                {lista.map((f) => (
                  <Tr key={f.id} className={cx(f.ativo === false && "opacity-60")}>
                    <Td className="text-[12.5px] font-bold text-ink-2 tabular-nums">{rotuloIdFornecedor(f.codigo)}</Td>
                    <Td>
                      <div className="font-bold text-ink">
                        {f.nomeFantasia || f.razaoSocial || "(sem nome)"}
                        {f.ativo === false && <span className="ml-2 align-middle"><Badge tom="arquivado">Inativo</Badge></span>}
                      </div>
                      {f.nomeFantasia && f.razaoSocial && f.nomeFantasia !== f.razaoSocial && (
                        <div className="text-[12px] text-ink-2">{f.razaoSocial}</div>
                      )}
                    </Td>
                    <Td className="text-[12.5px] tabular-nums whitespace-nowrap">
                      {f.cnpj || "—"}
                      <span className="ml-2 align-middle"><Badge tom="neutral">{tipoDoFornecedor(f)}</Badge></span>
                    </Td>
                    <Td className="text-[12.5px] text-ink-2">{f.perfilTributario || "—"}</Td>
                    <Td className="text-[12.5px]">
                      <div>{f.email || f.telefone || "—"}</div>
                      {(f.contatos?.length ?? 0) > 0 && (
                        <div className="text-[11px] text-ink-3">
                          {f.contatos![0].nome || "contato sem nome"}
                          {f.contatos!.length > 1 && ` +${f.contatos!.length - 1}`}
                        </div>
                      )}
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" title="Visualizar" aria-label={`Visualizar ${f.razaoSocial}`}
                          className="rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5] hover:text-ink" onClick={() => setAberto({ modo: "ver", fornecedor: f })}>
                          <IcEye width={16} height={16} />
                        </button>
                        {podeEditar && (
                          <>
                            <button type="button" title="Editar" aria-label={`Editar ${f.razaoSocial}`}
                              className="rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5] hover:text-ink" onClick={() => setAberto({ modo: "editar", fornecedor: f })}>
                              <IcPencil width={16} height={16} />
                            </button>
                            {f.ativo === false ? (
                              <button type="button" title="Reativar" aria-label={`Reativar ${f.razaoSocial}`}
                                className="rounded-btn p-1.5 text-ink-3 hover:bg-success-soft hover:text-success" onClick={() => void definirAtivo(f, true)}>
                                <IcCheck width={16} height={16} />
                              </button>
                            ) : (
                              <button type="button" title="Inativar" aria-label={`Inativar ${f.razaoSocial}`}
                                className="rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5] hover:text-ink" onClick={() => void definirAtivo(f, false)}>
                                <IcEyeOff width={16} height={16} />
                              </button>
                            )}
                            <button type="button" title="Excluir" aria-label={`Excluir ${f.razaoSocial}`}
                              className="rounded-btn p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger" onClick={() => setAberto({ modo: "excluir", fornecedor: f })}>
                              <IcTrash width={16} height={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      {aberto?.modo === "ver" && (
        <FichaFornecedor
          fornecedor={aberto.fornecedor}
          onClose={() => setAberto(null)}
          onEditar={podeEditar ? () => setAberto({ modo: "editar", fornecedor: aberto.fornecedor }) : undefined}
        />
      )}
      {aberto?.modo === "excluir" && (
        <ExcluirCadastro
          oQue="fornecedor"
          nome={aberto.fornecedor.nomeFantasia || aberto.fornecedor.razaoSocial || "Fornecedor"}
          carregarUso={() => repo.fornecedores.uso(aberto.fornecedor.id)}
          // Quem pode ficar no lugar: os outros fornecedores ATIVOS.
          destinos={(data ?? [])
            .filter((o) => o.id !== aberto.fornecedor.id && o.ativo !== false)
            .map((o) => ({ id: o.id, rotulo: `${rotuloIdFornecedor(o.codigo)} · ${o.nomeFantasia || o.razaoSocial} · ${o.cnpj || "sem documento"}` }))}
          excluir={(destinoId) => repo.fornecedores.excluir(aberto.fornecedor.id, destinoId)}
          onClose={() => setAberto(null)}
          onExcluido={() => { setAberto(null); reload(); }}
          onInativar={aberto.fornecedor.ativo === false ? undefined : () => void definirAtivo(aberto.fornecedor, false)}
        />
      )}
      {aberto?.modo === "editar" && (
        <FormularioFornecedor
          // A chave reinicia o formulário ao trocar de fornecedor (ou de "novo" para um existente).
          key={aberto.fornecedor.id || "novo"}
          inicial={aberto.fornecedor}
          todos={data ?? []}
          onClose={() => setAberto(null)}
          onSalvo={() => { setAberto(null); reload(); }}
        />
      )}
    </>
  );
}

/* ---------------------------------- ficha --------------------------------- */

function FichaFornecedor({ fornecedor: f, onClose, onEditar }: { fornecedor: Fornecedor; onClose: () => void; onEditar?: () => void }) {
  const tipo = tipoDoFornecedor(f);
  const linhas = linhasDosContatos(f.contatos);
  const Dado = ({ rotulo, valor, largo }: { rotulo: string; valor?: string; largo?: boolean }) => (
    <div className={largo ? "sm:col-span-2" : undefined}>
      <dt className="text-[11.5px] font-bold text-ink-3">{rotulo}</dt>
      <dd className="text-[13.5px] text-ink break-words">{valor?.trim() || "—"}</dd>
    </div>
  );
  return (
    <Janela
      titulo={f.nomeFantasia || f.razaoSocial || "Fornecedor"}
      subtitulo={<>ID {rotuloIdFornecedor(f.codigo)} · {tipo === "CPF" ? "Pessoa física" : "Empresa"}</>}
      onClose={onClose}
      rodape={
        <>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
          {onEditar && <Button icon={<IcPencil width={15} height={15} />} onClick={onEditar}>Editar</Button>}
        </>
      }
    >
      <div className="space-y-6">
        <Bloco titulo="Identificação">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Dado rotulo={tipo} valor={f.cnpj} />
            <Dado rotulo={tipo === "CPF" ? "Nome completo" : "Razão social"} valor={f.razaoSocial} />
            {tipo === "CNPJ" && <Dado rotulo="Nome fantasia" valor={f.nomeFantasia} />}
            <Dado rotulo="Apelido (título do contrato)" valor={f.apelido || gerarApelidoFornecedor(f.nomeFantasia, f.razaoSocial)} />
            <Dado rotulo="Perfil tributário" valor={f.perfilTributario} />
            {tipo === "CNPJ" && <Dado rotulo="Inscrição estadual" valor={f.inscricaoEstadual} />}
            {tipo === "CNPJ" && <Dado rotulo="Inscrição municipal" valor={f.inscricaoMunicipal} />}
          </dl>
        </Bloco>
        <Bloco titulo="Endereço">
          <dl><Dado rotulo="Endereço completo" valor={f.endereco} /></dl>
        </Bloco>
        <Bloco titulo="Contato">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Dado rotulo="Telefone" valor={f.telefone} />
            <Dado rotulo="E-mail" valor={f.email} />
          </dl>
          {linhas.length > 0 && (
            <ul className="mt-3 divide-y divide-border-soft rounded-btn border border-border-soft">
              {linhas.map((l, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-[13px]">
                  <span className="font-bold text-ink">{l.nome || "Sem nome"}</span>
                  {l.funcao && <span className="text-ink-3">{l.funcao}</span>}
                  <span className="ml-auto text-ink-2">{l.tipo === "email" ? "E-mail" : "Telefone"}: <span className="text-ink">{l.valor || "—"}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
        {tipo === "CNPJ" && (f.cnaes?.length ?? 0) > 0 && (
          <Bloco titulo="CNAEs">
            <div className="flex flex-wrap gap-1.5">
              {f.cnaes!.map((c, i) => <span key={i} className="text-[11px] bg-[#F0F1F4] text-ink-2 rounded-pill px-2 py-1">{c}</span>)}
            </div>
          </Bloco>
        )}
      </div>
    </Janela>
  );
}

