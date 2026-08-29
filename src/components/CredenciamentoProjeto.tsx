/**
 * Credenciamento do projeto — o painel de todos os fornecedores de uma vez.
 *
 * Antes isto morava dentro de cada OS: para credenciar oito fornecedores eram
 * oito telas, oito cliques em "Enviar", e nenhum lugar que dissesse quem já
 * havia respondido. Mas credenciar é tarefa do EVENTO, não de cada contrato —
 * a pergunta real é "quem ainda falta?", e ela não cabia numa OS só.
 *
 * O LINK continua sendo um por OS, e tem de ser: é o `slugCredenciamento` dela
 * que diz ao formulário público qual fornecedor está respondendo (as respostas
 * gravam `os_id`). O que mudou de lugar é o comando, não o dado — aqui se vê a
 * fila inteira e se dispara para todos, cada um recebendo o seu link.
 */
import { useMemo, useState } from "react";
import { Button, Card, CardTitle, Input, Table, THead, Th, Tr, Td, EmptyState, Badge } from "@/components/ui";
import { IcSend, IcLink, IcCheck } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { enviarCredenciamento } from "@/lib/email";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { cx, dataBR, dataHoraBR } from "@/lib/format";
import { filaDeCredenciamento, podeReceberLink, type NaFila } from "@/domain/credenciamento";
import type { Ec, Os } from "@/data/types";

export function CredenciamentoProjeto({ oss, ecs }: { oss: Os[]; ecs: Ec[] }) {
  const [enviando, setEnviando] = useState("");
  const [copiado, setCopiado] = useState("");
  const [prazoLote, setPrazoLote] = useState("");
  /** Quem já respondeu — uma consulta só para a fila inteira. */
  const { data: responderam, reload: recarregar } = useAsync(() => repo.oss.osComCredenciamento(), []);

  const fila = useMemo(() => filaDeCredenciamento(oss, ecs, responderam ?? []), [oss, ecs, responderam]);
  const pendentes = fila.filter(podeReceberLink);

  async function enviar(f: NaFila): Promise<boolean> {
    if (!f.ec || !f.link || !f.email) return false;
    const r = await enviarCredenciamento(f.os, f.ec);
    return r.ok;
  }

  async function enviarUm(f: NaFila) {
    if (!(await confirmar({
      titulo: `Enviar credenciamento para ${f.fornecedor}?`,
      mensagem: `Será enviado um e-mail com o link do formulário para ${f.email}.`,
      confirmarTexto: "Enviar",
    }))) return;
    setEnviando(f.os.id);
    try {
      const ok = await enviar(f);
      toast(ok ? `Link enviado para ${f.email}.` : "Não foi possível enviar.", ok ? "success" : "warning");
    } finally {
      setEnviando("");
      recarregar();
    }
  }

  async function enviarTodos() {
    if (!pendentes.length) return;
    if (!(await confirmar({
      titulo: `Enviar credenciamento a ${pendentes.length} fornecedor(es)?`,
      mensagem: "Cada um recebe um e-mail com o SEU link. Quem já respondeu e quem está sem e-mail cadastrado ficam de fora.",
      confirmarTexto: "Enviar a todos",
    }))) return;
    setEnviando("todos");
    try {
      const resultados = await Promise.all(pendentes.map(enviar));
      const ok = resultados.filter(Boolean).length;
      toast(
        ok === resultados.length
          ? `Link enviado a ${ok} fornecedor(es).`
          : `${ok} de ${resultados.length} enviados — os demais falharam.`,
        ok === resultados.length ? "success" : "warning"
      );
    } finally {
      setEnviando("");
      recarregar();
    }
  }

  if (!fila.length) {
    return (
      <Card>
        <CardTitle>Credenciamento</CardTitle>
        <EmptyState
          title="Nenhuma OS neste projeto"
          hint="O credenciamento é enviado por OS — cada fornecedor recebe o link da OS dele. Emita as OSs na aba EC."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card padded={false}>
        <div className="p-5 pb-3">
          <CardTitle
            hint="Cada fornecedor recebe o link da OS dele — é ele que identifica quem está respondendo"
            action={
              <Button
                size="sm"
                icon={<IcSend width={15} height={15} />}
                onClick={enviarTodos}
                disabled={!pendentes.length || !!enviando}
                title={pendentes.length ? `${pendentes.length} fornecedor(es) na fila` : "Ninguém pendente: todos responderam ou estão sem e-mail"}
              >
                {enviando === "todos" ? "Enviando…" : `Enviar a todos (${pendentes.length})`}
              </Button>
            }
          >
            Credenciamento dos Fornecedores
          </CardTitle>
        </div>

        <Table>
          <THead>
            <Th>Fornecedor</Th>
            <Th>OS</Th>
            <Th>E-mail</Th>
            <Th>Prazo</Th>
            <Th>Situação</Th>
            <Th align="right">Ações</Th>
          </THead>
          <tbody>
            {fila.map((f) => (
              <Tr key={f.os.id}>
                <Td className="font-bold text-ink">{f.fornecedor}</Td>
                <Td className="text-[12.5px] text-ink-2">{f.os.numero}</Td>
                <Td className="text-[12.5px]">
                  {f.email || <span className="text-danger font-semibold">sem e-mail no cadastro</span>}
                </Td>
                <Td className="text-[12.5px]">{dataBR(f.os.credenciamento?.prazoLimite) || "—"}</Td>
                <Td>
                  {f.respondeu ? (
                    <Badge tom="success">Respondido</Badge>
                  ) : !f.link ? (
                    <Badge tom="neutral">Salve a OS</Badge>
                  ) : (
                    <Badge tom="warning">Aguardando</Badge>
                  )}
                </Td>
                <Td align="right">
                  <div className="inline-flex gap-1.5">
                    <Button
                      variant="text"
                      size="sm"
                      title={f.link ? "Copiar o link deste fornecedor" : "A OS ainda não foi salva"}
                      aria-label={`Copiar link de ${f.fornecedor}`}
                      disabled={!f.link}
                      icon={copiado === f.os.id ? <IcCheck width={15} height={15} /> : <IcLink width={15} height={15} />}
                      onClick={() => {
                        navigator.clipboard?.writeText(f.link);
                        setCopiado(f.os.id);
                        setTimeout(() => setCopiado(""), 1800);
                      }}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!f.link || !f.email || !!enviando}
                      title={!f.email ? "Fornecedor sem e-mail cadastrado" : "Enviar só para este fornecedor"}
                      onClick={() => enviarUm(f)}
                    >
                      {enviando === f.os.id ? "Enviando…" : "Enviar"}
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <PrazoEmLote
        prazo={prazoLote}
        onPrazo={setPrazoLote}
        quantas={fila.length}
        onAplicar={async () => {
          if (!prazoLote) return;
          if (!(await confirmar({
            titulo: "Aplicar o prazo a todas as OSs?",
            mensagem: `O prazo-limite de ${dataBR(prazoLote)} substitui o que estiver em cada uma das ${fila.length} OS(s) deste projeto.`,
            confirmarTexto: "Aplicar",
          }))) return;
          try {
            await Promise.all(
              fila.map((f) =>
                repo.oss.salvar({ ...f.os, credenciamento: { ...f.os.credenciamento, prazoLimite: prazoLote } })
              )
            );
            toast("Prazo aplicado. Recarregue para ver nas OSs.", "success");
          } catch (e) {
            toast(`Não foi possível aplicar: ${(e as Error).message}`, "danger");
          }
        }}
      />

      <RespostasRecebidas oss={fila.filter((f) => f.respondeu).map((f) => f.os)} />
    </div>
  );
}

/**
 * O prazo é a mesma data para o evento inteiro — pedir de novo em cada OS era
 * repetir oito vezes a mesma informação.
 */
function PrazoEmLote({
  prazo,
  onPrazo,
  quantas,
  onAplicar,
}: {
  prazo: string;
  onPrazo: (v: string) => void;
  quantas: number;
  onAplicar: () => void;
}) {
  return (
    <Card>
      <CardTitle hint="O prazo costuma ser o mesmo para o evento inteiro">Prazo-limite de todas as OSs</CardTitle>
      <div className="flex items-end gap-2 flex-wrap">
        <Input type="date" className="max-w-[12rem]" value={prazo} onChange={(e) => onPrazo(e.target.value)} />
        <Button variant="secondary" size="sm" disabled={!prazo} onClick={onAplicar}>
          Aplicar às {quantas} OS(s)
        </Button>
      </div>
    </Card>
  );
}

/** O que os fornecedores já mandaram — equipe e veículos, por OS. */
function RespostasRecebidas({ oss }: { oss: Os[] }) {
  if (!oss.length) return null;
  return (
    <Card padded={false}>
      <div className="p-5 pb-2">
        <CardTitle hint="Enviado pelos fornecedores pelo formulário público">Credenciamentos recebidos</CardTitle>
      </div>
      <div className="px-5 pb-5 space-y-3">
        {oss.map((os) => (
          <RespostasDaOs key={os.id} os={os} />
        ))}
      </div>
    </Card>
  );
}

function RespostasDaOs({ os }: { os: Os }) {
  const { data } = useAsync(() => repo.oss.credenciamentos(os.id), [os.id]);
  const respostas = data ?? [];
  if (!respostas.length) return null;
  const nome = os.fornecedor.apelido || os.fornecedor.nomeFantasia || os.fornecedor.razaoSocial || "Fornecedor";
  return (
    <div className={cx("rounded-btn border border-border-soft bg-[#FAFAFB] p-3")}>
      <div className="text-[12.5px] font-bold text-ink mb-1.5">{nome}</div>
      {respostas.map((c) => (
        <div key={c.id} className="mb-2 last:mb-0">
          <div className="text-[11.5px] text-ink-3 mb-1">Enviado em {dataHoraBR(c.enviadoEm)}</div>
          {c.equipe.length > 0 && (
            <div className="text-[12.5px] text-ink mb-1">
              <b>Equipe:</b>{" "}
              {c.equipe.map((p) => `${p.nome}${p.funcao ? ` (${p.funcao})` : ""}${p.cpf ? ` — ${p.cpf}` : ""}`).join("; ")}
            </div>
          )}
          {c.veiculos.length > 0 && (
            <div className="text-[12.5px] text-ink">
              <b>Veículos:</b> {c.veiculos.map((v) => `${v.modelo}${v.placa ? ` — ${v.placa}` : ""}`).join("; ")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
