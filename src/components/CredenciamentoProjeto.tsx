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
 *
 * Duas coisas o disparo em lote não resolvia sozinho, e agora resolve:
 *  · MARCAR quem recebe. "A todos" alcança quem falta; marcar na lista serve
 *    para o resto — reenviar a um fornecedor que preencheu errado, cobrar só
 *    os três que faltam do palco.
 *  · a folha da PORTARIA. O que os fornecedores mandaram só existia na tela,
 *    um bloco por fornecedor; no dia do evento isso é uma lista impressa,
 *    conferida nome a nome (ver `lib/excel/credenciamento`).
 */
import { useMemo, useState } from "react";
import {
  Button, Card, CardTitle, Input, Table, THead, Th, Tr, Td, EmptyState, Badge,
  AvisoHomologacaoEmail,
} from "@/components/ui";
import { IcSend, IcLink, IcCheck, IcDownload } from "@/components/icons";
import { repo } from "@/data";
import { CAMPOS_CREDENCIAMENTO, camposDoCredenciamento, type CampoCredenciamento } from "@/domain/credenciamentoCampos";
import { useAsync } from "@/hooks/useAsync";
import { enviarCredenciamento, resumoDoEnvio } from "@/lib/email";
import { textoWhatsAppCredenciamento } from "@/lib/email/templates";
import { gerarCredenciamentoExcel } from "@/lib/excel";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { cx, dataBR, dataHoraBR } from "@/lib/format";
import { idAncoraPendencia } from "@/lib/destaque";
import {
  credenciadosDaFila,
  filaDeCredenciamento,
  podeEnviar,
  podeReceberLink,
  type NaFila,
} from "@/domain/credenciamento";
import type { CredenciamentoResposta, Ec, Os } from "@/data/types";

export function CredenciamentoProjeto({ oss, ecs }: { oss: Os[]; ecs: Ec[] }) {
  const [enviando, setEnviando] = useState("");
  const [copiado, setCopiado] = useState("");
  const [prazoLote, setPrazoLote] = useState("");
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  /** Quem já respondeu — uma consulta só para a fila inteira. */
  const { data: responderam, reload: recarregar } = useAsync(() => repo.oss.osComCredenciamento(), []);

  const fila = useMemo(() => filaDeCredenciamento(oss, ecs, responderam ?? []), [oss, ecs, responderam]);

  /**
   * As respostas de todos de uma vez, e não uma consulta por bloco na tela: a
   * planilha da portaria precisa da fila inteira, e carregar duas vezes a mesma
   * coisa faria a folha e a tela poderem discordar.
   */
  const idsComResposta = (responderam ?? []).join(",");
  const { data: respostas } = useAsync(async () => {
    const ids = (responderam ?? []).filter((id) => oss.some((o) => o.id === id));
    const pares = await Promise.all(ids.map(async (id) => [id, await repo.oss.credenciamentos(id)] as const));
    return new Map<string, CredenciamentoResposta[]>(pares);
  }, [idsComResposta, oss]);

  /** Quem o botão vai alcançar: o que estiver marcado, ou os que faltam. */
  const alvos = marcados.size
    ? fila.filter((f) => marcados.has(f.os.id) && podeEnviar(f))
    : fila.filter(podeReceberLink);
  const marcaveis = fila.filter(podeEnviar);

  function alternar(id: string) {
    setMarcados((atuais) => {
      const novo = new Set(atuais);
      if (!novo.delete(id)) novo.add(id);
      return novo;
    });
  }

  async function enviar(f: NaFila) {
    if (!f.ec || !f.link || !f.email) return { ok: false, simulado: true, destinatarios: [] };
    return enviarCredenciamento(f.os, f.ec);
  }

  /** WhatsApp: abre a conversa com o texto padrão e o link já escritos (envio manual). */
  function abrirWhatsApp(f: NaFila) {
    if (!f.ec || !f.link || !f.whatsapp) return;
    window.open(`https://wa.me/${f.whatsapp}?text=${encodeURIComponent(textoWhatsAppCredenciamento(f.os, f.ec))}`, "_blank", "noopener,noreferrer");
  }

  async function enviarUm(f: NaFila) {
    if (!(await confirmar({
      titulo: `Enviar credenciamento para ${f.fornecedor}?`,
      mensagem: `Será enviado um e-mail com o link do formulário para ${f.email}.`,
      confirmarTexto: "Enviar",
    }))) return;
    setEnviando(f.os.id);
    try {
      const r = await enviar(f);
      toast(resumoDoEnvio(r), r.ok && !r.desviado ? "success" : "warning");
    } finally {
      setEnviando("");
      recarregar();
    }
  }

  async function enviarLote() {
    if (!alvos.length) return;
    const marcou = marcados.size > 0;
    if (!(await confirmar({
      titulo: `Enviar credenciamento a ${alvos.length} fornecedor(es)?`,
      mensagem: marcou
        ? "Cada um dos marcados recebe um e-mail com o SEU link — inclusive quem já respondeu, caso precise refazer."
        : "Cada um recebe um e-mail com o SEU link. Quem já respondeu e quem está sem e-mail cadastrado ficam de fora.",
      confirmarTexto: marcou ? "Enviar aos marcados" : "Enviar a todos",
    }))) return;
    setEnviando("lote");
    try {
      const resultados = await Promise.all(alvos.map(enviar));
      const ok = resultados.filter((r) => r.ok).length;
      const desviados = resultados.filter((r) => r.desviado).length;
      toast(
        ok < resultados.length
          ? `${ok} de ${resultados.length} enviados — os demais falharam.`
          : desviados
            ? `${ok} mensagem(ns) foram para a caixa de TESTE, não para os fornecedores — o sistema está em homologação.`
            : `Link enviado a ${ok} fornecedor(es).`,
        ok === resultados.length && !desviados ? "success" : "warning"
      );
      if (ok) setMarcados(new Set());
    } finally {
      setEnviando("");
      recarregar();
    }
  }

  async function baixarPlanilha() {
    const projeto = fila.find((f) => f.ec)?.ec;
    const { equipe, veiculos, semResposta } = credenciadosDaFila(fila, respostas ?? new Map());
    try {
      await gerarCredenciamentoExcel({
        cliente: projeto?.cliente.nome ?? "",
        titulo: projeto?.projeto.titulo ?? "",
        evento: dataBR(projeto?.projeto.evento ?? ""),
        local: [projeto?.projeto.local, projeto?.projeto.enderecoLocal].filter(Boolean).join(" — "),
        equipe,
        veiculos,
        semResposta,
        nomeArquivo: `Credenciamento - ${projeto?.projeto.titulo || "Projeto"}`,
      });
      toast("Credenciamento exportado para Excel.", "success");
    } catch (e) {
      toast(`Erro ao gerar a planilha: ${(e as Error).message}`, "danger");
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

  const todosMarcados = marcaveis.length > 0 && marcaveis.every((f) => marcados.has(f.os.id));

  return (
    <div className="space-y-4">
      <Card padded={false}>
        <div className="p-5 pb-3">
          <CardTitle
            hint="Cada fornecedor recebe o link da OS dele — é ele que identifica quem está respondendo"
            action={
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<IcDownload width={15} height={15} />}
                  onClick={baixarPlanilha}
                  title="Lista de acesso para a portaria: equipe, veículos e quem ainda não respondeu"
                >
                  Baixar Excel
                </Button>
                <Button
                  size="sm"
                  icon={<IcSend width={15} height={15} />}
                  onClick={enviarLote}
                  disabled={!alvos.length || !!enviando}
                  title={
                    marcados.size
                      ? `${alvos.length} marcado(s) com e-mail e OS salva`
                      : alvos.length
                        ? `${alvos.length} fornecedor(es) ainda sem resposta`
                        : "Ninguém pendente: todos responderam ou estão sem e-mail"
                  }
                >
                  {enviando === "lote"
                    ? "Enviando…"
                    : marcados.size
                      ? `Enviar aos marcados (${alvos.length})`
                      : `Enviar a todos (${alvos.length})`}
                </Button>
              </div>
            }
          >
            Credenciamento dos Fornecedores
          </CardTitle>
          <AvisoHomologacaoEmail />
        </div>

        <Table>
          <THead>
            <Th className="w-10">
              {/* Marca de uma vez todos os que o e-mail alcança. */}
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-primary cursor-pointer"
                checked={todosMarcados}
                ref={(el) => {
                  if (el) el.indeterminate = marcados.size > 0 && !todosMarcados;
                }}
                disabled={!marcaveis.length}
                onChange={(e) => setMarcados(e.target.checked ? new Set(marcaveis.map((f) => f.os.id)) : new Set())}
                aria-label="Marcar todos os fornecedores"
                title="Marcar todos os que podem receber o link"
              />
            </Th>
            <Th>Fornecedor</Th>
            <Th>OS</Th>
            <Th>E-mail</Th>
            <Th>Prazo</Th>
            <Th>Situação</Th>
            <Th align="right">Ações</Th>
          </THead>
          <tbody>
            {fila.map((f) => (
              // O `id` é o endereço da linha para o navegador de pendências: o
              // credenciamento sem resposta é cobrado NESTA tela (é daqui que se
              // reenvia o link), e a pílula precisa achar o fornecedor exato.
              <Tr
                key={f.os.id}
                id={idAncoraPendencia(f.os.id)}
                className={cx(marcados.has(f.os.id) && "bg-primary-soft")}
              >
                <Td>
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-primary cursor-pointer"
                    checked={marcados.has(f.os.id)}
                    disabled={!podeEnviar(f)}
                    onChange={() => alternar(f.os.id)}
                    aria-label={`Marcar ${f.fornecedor}`}
                    title={podeEnviar(f) ? "Marcar para o envio em lote" : "Sem e-mail ou OS ainda não salva"}
                  />
                </Td>
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
                  <div className="inline-flex gap-1.5 whitespace-nowrap">
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
                      {enviando === f.os.id ? "Enviando…" : "E-mail"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!f.link || !f.whatsapp}
                      title={f.whatsapp ? "Abre o WhatsApp com o texto padrão e o link" : "Fornecedor sem telefone cadastrado"}
                      onClick={() => abrirWhatsApp(f)}
                    >
                      WhatsApp
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* O QUE PEDIR neste credenciamento (15/09/2026) — a escolha vale para o
          projeto inteiro, como o prazo: o formulário é o mesmo para todos os
          fornecedores do evento. */}
      <CamposDoFormulario
        campos={camposDoCredenciamento(fila[0]?.os.credenciamento?.campos)}
        quantas={fila.length}
        onAplicar={async (campos) => {
          try {
            await Promise.all(
              fila.map((f) =>
                repo.oss.salvar({ ...f.os, credenciamento: { ...f.os.credenciamento, campos } })
              )
            );
            toast("Formulário atualizado para todas as OSs.", "success");
          } catch (e) {
            toast(`Não foi possível aplicar: ${(e as Error).message}`, "danger");
          }
        }}
      />

      <PrazoEmLote
        prazo={prazoLote || fila[0]?.os.credenciamento?.prazoLimite || ""}
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

      <RespostasRecebidas fila={fila} respostas={respostas} />
    </div>
  );
}

/**
 * Quais dados o fornecedor preenche — escolhidos a cada credenciamento.
 *
 * O formulário público era fixo (nome, CPF, função, veículo e placa) e a lista
 * da Pólobh é maior: RG, endereço, telefone, aniversário. Mas pedir tudo sempre
 * é atrito para quem preenche pelo celular e dado sensível guardado à toa — daí
 * a escolha ser por evento, e não uma configuração da casa.
 *
 * O NOME não entra na lista: é sempre pedido, porque sem ele a linha da planilha
 * não identifica ninguém.
 */
function CamposDoFormulario({
  campos,
  quantas,
  onAplicar,
}: {
  campos: CampoCredenciamento[];
  quantas: number;
  onAplicar: (campos: CampoCredenciamento[]) => Promise<void>;
}) {
  const [escolhidos, setEscolhidos] = useState<CampoCredenciamento[]>(campos);
  const alternar = (campo: CampoCredenciamento) =>
    setEscolhidos((atual) => (atual.includes(campo) ? atual.filter((c) => c !== campo) : [...atual, campo]));
  const mudou = escolhidos.join("|") !== campos.join("|");

  return (
    <Card>
      <CardTitle hint="O que o fornecedor preenche neste evento — o nome é sempre pedido">
        Formulário de credenciamento
      </CardTitle>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {CAMPOS_CREDENCIAMENTO.map(({ campo, rotulo, dica }) => (
          <label key={campo} className="flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={escolhidos.includes(campo)}
              onChange={() => alternar(campo)}
              className="h-4 w-4 accent-(--cor-primaria,#F2820D)"
            />
            {rotulo}
            {dica && <span className="text-[11.5px] text-ink-3">({dica})</span>}
          </label>
        ))}
      </div>
      <div className="mt-3">
        <Button variant="secondary" size="sm" disabled={!mudou} onClick={() => void onAplicar(escolhidos)}>
          Aplicar às {quantas} OS(s)
        </Button>
      </div>
    </Card>
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
      <CardTitle hint="Vai como Prazo para envio na mensagem ao fornecedor — costuma ser o mesmo para o evento inteiro">Prazo limite do credenciamento</CardTitle>
      <div className="flex items-end gap-2 flex-wrap">
        <Input type="date" className="max-w-48" value={prazo} onChange={(e) => onPrazo(e.target.value)} />
        <Button variant="secondary" size="sm" disabled={!prazo} onClick={onAplicar}>
          Aplicar às {quantas} OS(s)
        </Button>
      </div>
    </Card>
  );
}

/** O que os fornecedores já mandaram — equipe e veículos, por fornecedor. */
function RespostasRecebidas({
  fila,
  respostas,
}: {
  fila: NaFila[];
  respostas: Map<string, CredenciamentoResposta[]> | undefined;
}) {
  const comResposta = fila.filter((f) => (respostas?.get(f.os.id)?.length ?? 0) > 0);
  if (!comResposta.length) return null;
  return (
    <Card padded={false}>
      <div className="p-5 pb-2">
        <CardTitle hint="Enviado pelos fornecedores pelo formulário público">Credenciamentos recebidos</CardTitle>
      </div>
      <div className="px-5 pb-5 space-y-3">
        {comResposta.map((f) => (
          <div key={f.os.id} className={cx("rounded-btn border border-border-soft bg-[#FAFAFB] p-3")}>
            <div className="text-[12.5px] font-bold text-ink mb-1.5">{f.fornecedor}</div>
            {(respostas?.get(f.os.id) ?? []).map((c) => (
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
        ))}
      </div>
    </Card>
  );
}
