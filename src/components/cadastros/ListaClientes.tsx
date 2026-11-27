/**
 * A LISTA DE CLIENTES da tela Cadastros (27/11/2026) — a mesma forma da lista de
 * fornecedores: ID, cliente, documento, apelido e representante, com o olho
 * (ficha) e o lápis (formulário) na coluna de ações.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Card, Button, Input, Table, THead, Th, Tr, Td, Badge, EmptyState, AvisoErro, ThOrd, useOrdenacao,
} from "@/components/ui";
import { IcSearch, IcEye, IcEyeOff, IcPencil, IcTrash, IcCheck } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { rotuloIdFornecedor as rotuloId } from "@/domain/fornecedorCadastro";
import { novoCliente, tipoDoCliente } from "@/domain/clienteCadastro";
import { onlyDigits } from "@/lib/format";
import { useAuth } from "@/store/auth";
import type { Cliente } from "@/data/types";
import { FormularioCliente } from "./FormularioCliente";
import { Bloco, Janela } from "./pecas";
import { ExcluirCadastro } from "./ExcluirCadastro";
import { confirmar } from "@/store/confirm";
import { toast } from "@/store/toast";
import { cx } from "@/lib/format";

/** O que está aberto na janela: a ficha (só leitura) ou o formulário. */
type Aberto = { modo: "ver" | "editar" | "excluir"; cliente: Cliente } | null;

export function ListaClientes({ pedidoNovo }: { /** Muda a cada clique em "Novo cliente" na barra da tela. */ pedidoNovo: number }) {
  const podeEditar = useAuth((s) => s.pode("fornecedores.editar"));
  const { data, loading, error, reload } = useAsync(() => repo.clientes.listar(), [], { oQue: "os clientes" });
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<Aberto>(null);
  useEffect(() => {
    if (pedidoNovo) setAberto({ modo: "editar", cliente: novoCliente() });
  }, [pedidoNovo]);

  /**
   * INATIVAR / REATIVAR (27/11/2026). O inativo continua no cadastro e em tudo o
   * que já foi feito com ele; só deixa de ser sugerido no preenchimento.
   */
  async function definirAtivo(alvo: Cliente, ativo: boolean) {
    const nome = alvo.nome || alvo.razaoSocial || "o cliente";
    if (!ativo && !(await confirmar({
      titulo: `Inativar ${nome}?`,
      mensagem: "O registro continua no cadastro e nos documentos já feitos, mas deixa de ser sugerido no preenchimento. Dá para reativar depois.",
      confirmarTexto: "Inativar",
    }))) return;
    try {
      await repo.clientes.definirAtivo(alvo.id, ativo);
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
    return (data ?? []).filter((c) =>
      [rotuloId(c.codigo), c.apelido, c.nome, c.razaoSocial, c.cnpjCpf, onlyDigits(c.cnpjCpf), c.representante.nome, c.representante.email, c.representante.telefones]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [data, busca]);

  const { ordem, ordenarPor, ordenados: lista } = useOrdenacao(
    filtrados,
    {
      id: (c) => c.codigo ?? 0,
      cliente: (c) => c.nome || c.razaoSocial,
      documento: (c) => onlyDigits(c.cnpjCpf),
      apelido: (c) => c.apelido,
      representante: (c) => c.representante.nome,
    },
    { col: "cliente", dir: "asc" },
    "cadastros.clientes"
  );

  return (
    <>
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"><IcSearch width={16} height={16} /></span>
              <Input className="pl-9" placeholder="Buscar por ID, nome, apelido, CNPJ/CPF ou representante" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <span className="text-[12px] text-ink-3">{lista.length} cliente(s)</span>
          </div>
        </Card>

        <Card padded={false}>
          {error ? <AvisoErro erro={error} oQue="os clientes" onTentarDeNovo={reload} /> : loading ? <div className="p-8 text-ink-3 text-sm">Carregando…</div> : lista.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title={busca.trim() ? "Nenhum cliente com essa busca" : "Nenhum cliente cadastrado"}
                hint={busca.trim() ? "Confira o que foi digitado ou limpe a busca." : podeEditar ? "Use “Novo cliente” para cadastrar o primeiro." : undefined}
              />
            </div>
          ) : (
            <Table>
              <THead>
                <ThOrd col="id" ordem={ordem} onSort={ordenarPor}>ID</ThOrd>
                <ThOrd col="cliente" ordem={ordem} onSort={ordenarPor}>Cliente</ThOrd>
                <ThOrd col="documento" ordem={ordem} onSort={ordenarPor}>CNPJ / CPF</ThOrd>
                <ThOrd col="apelido" ordem={ordem} onSort={ordenarPor}>Apelido</ThOrd>
                <ThOrd col="representante" ordem={ordem} onSort={ordenarPor}>Representante</ThOrd>
                <Th align="right">Ações</Th>
              </THead>
              <tbody>
                {lista.map((c) => (
                  <Tr key={c.id} className={cx(c.ativo === false && "opacity-60")}>
                    <Td className="text-[12.5px] font-bold text-ink-2 tabular-nums">{rotuloId(c.codigo)}</Td>
                    <Td>
                      <div className="font-bold text-ink">
                        {c.nome || c.razaoSocial || "(sem nome)"}
                        {c.ativo === false && <span className="ml-2 align-middle"><Badge tom="arquivado">Inativo</Badge></span>}
                      </div>
                      {c.nome && c.razaoSocial && c.nome !== c.razaoSocial && <div className="text-[12px] text-ink-2">{c.razaoSocial}</div>}
                    </Td>
                    <Td className="text-[12.5px] tabular-nums whitespace-nowrap">
                      {c.cnpjCpf || "—"}
                      <span className="ml-2 align-middle"><Badge tom="neutral">{tipoDoCliente(c)}</Badge></span>
                    </Td>
                    <Td className="text-[12.5px] font-bold text-ink-2">{c.apelido || "—"}</Td>
                    <Td className="text-[12.5px]">
                      <div>{c.representante.nome || "—"}</div>
                      {(c.representante.email || c.representante.telefones) && (
                        <div className="text-[11px] text-ink-3">{c.representante.email || c.representante.telefones}</div>
                      )}
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" title="Visualizar" aria-label={`Visualizar ${c.nome}`}
                          className="rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5] hover:text-ink" onClick={() => setAberto({ modo: "ver", cliente: c })}>
                          <IcEye width={16} height={16} />
                        </button>
                        {podeEditar && (
                          <>
                            <button type="button" title="Editar" aria-label={`Editar ${c.nome}`}
                              className="rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5] hover:text-ink" onClick={() => setAberto({ modo: "editar", cliente: c })}>
                              <IcPencil width={16} height={16} />
                            </button>
                            {c.ativo === false ? (
                              <button type="button" title="Reativar" aria-label={`Reativar ${c.nome}`}
                                className="rounded-btn p-1.5 text-ink-3 hover:bg-success-soft hover:text-success" onClick={() => void definirAtivo(c, true)}>
                                <IcCheck width={16} height={16} />
                              </button>
                            ) : (
                              <button type="button" title="Inativar" aria-label={`Inativar ${c.nome}`}
                                className="rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5] hover:text-ink" onClick={() => void definirAtivo(c, false)}>
                                <IcEyeOff width={16} height={16} />
                              </button>
                            )}
                            <button type="button" title="Excluir" aria-label={`Excluir ${c.nome}`}
                              className="rounded-btn p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger" onClick={() => setAberto({ modo: "excluir", cliente: c })}>
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
        <FichaCliente
          cliente={aberto.cliente}
          onClose={() => setAberto(null)}
          onEditar={podeEditar ? () => setAberto({ modo: "editar", cliente: aberto.cliente }) : undefined}
        />
      )}
      {aberto?.modo === "excluir" && (
        <ExcluirCadastro
          oQue="cliente"
          nome={aberto.cliente.nome || aberto.cliente.razaoSocial || "Cliente"}
          carregarUso={() => repo.clientes.uso(aberto.cliente.id)}
          // Quem pode ficar no lugar: os outros clientes ATIVOS.
          destinos={(data ?? [])
            .filter((o) => o.id !== aberto.cliente.id && o.ativo !== false)
            .map((o) => ({ id: o.id, rotulo: `${rotuloId(o.codigo)} · ${o.nome || o.razaoSocial} · ${o.cnpjCpf || "sem documento"}` }))}
          excluir={(destinoId) => repo.clientes.excluir(aberto.cliente.id, destinoId)}
          onClose={() => setAberto(null)}
          onExcluido={() => { setAberto(null); reload(); }}
          onInativar={aberto.cliente.ativo === false ? undefined : () => void definirAtivo(aberto.cliente, false)}
        />
      )}
      {aberto?.modo === "editar" && (
        <FormularioCliente
          // A chave reinicia o formulário ao trocar de cliente (ou de "novo" para um existente).
          key={aberto.cliente.id || "novo"}
          inicial={aberto.cliente}
          todos={data ?? []}
          onClose={() => setAberto(null)}
          onSalvo={() => { setAberto(null); reload(); }}
        />
      )}
    </>
  );
}

function FichaCliente({ cliente: c, onClose, onEditar }: { cliente: Cliente; onClose: () => void; onEditar?: () => void }) {
  const tipo = tipoDoCliente(c);
  const Dado = ({ rotulo, valor }: { rotulo: string; valor?: string }) => (
    <div>
      <dt className="text-[11.5px] font-bold text-ink-3">{rotulo}</dt>
      <dd className="text-[13.5px] text-ink break-words">{valor?.trim() || "—"}</dd>
    </div>
  );
  return (
    <Janela
      titulo={c.nome || c.razaoSocial || "Cliente"}
      subtitulo={<>ID {rotuloId(c.codigo)} · {tipo === "CPF" ? "Pessoa física" : "Empresa"}</>}
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
            <Dado rotulo={tipo} valor={c.cnpjCpf} />
            <Dado rotulo="Apelido" valor={c.apelido} />
            <Dado rotulo={tipo === "CPF" ? "Nome completo" : "Razão social"} valor={c.razaoSocial} />
            {tipo === "CNPJ" && <Dado rotulo="Inscrição estadual" valor={c.inscricaoEstadual} />}
            {tipo === "CNPJ" && <Dado rotulo="Inscrição municipal" valor={c.inscricaoMunicipal} />}
          </dl>
        </Bloco>
        <Bloco titulo="Endereço">
          <dl><Dado rotulo="Endereço completo" valor={c.endereco} /></dl>
        </Bloco>
        <Bloco titulo="Representante">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Dado rotulo="Nome" valor={c.representante.nome} />
            <Dado rotulo="Cargo" valor={c.representante.cargo} />
            <Dado rotulo="Telefone" valor={c.representante.telefones} />
            <Dado rotulo="E-mail" valor={c.representante.email} />
          </dl>
        </Bloco>
      </div>
    </Janela>
  );
}
