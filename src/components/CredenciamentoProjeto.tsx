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
 * gravam `os_id`). Aqui se vê a fila inteira, e cada fornecedor recebe o seu
 * link pelo WhatsApp ou copiado — não há e-mail a fornecedor (23/11/2026).
 *
 * E a folha da PORTARIA: O que os fornecedores mandaram só existia na tela,
 *    um bloco por fornecedor; no dia do evento isso é uma lista impressa,
 *    conferida nome a nome (ver `lib/excel/credenciamento`).
 *
 * DENTRO DO PAINEL DA ABA (24/11/2026): eram quatro cartões empilhados — a fila,
 * o formulário, o prazo e as respostas —, cada um com a sua moldura dentro da
 * moldura da aba. Agora são seções separadas por um fio, e o formulário e o prazo
 * (as duas coisas que se ajustam UMA vez para o evento inteiro) ficam lado a lado
 * numa seção só, "Configuração do envio".
 */
import { useMemo, useState } from "react";
import {
  Button, Input, Table, THead, Th, Tr, Td, EmptyState, Badge,
} from "@/components/ui";
import { SecaoPainel } from "@/components/padrao/SecaoPainel";
import { IcLink, IcCheck, IcDownload } from "@/components/icons";
import { repo } from "@/data";
import { CAMPOS_CREDENCIAMENTO, camposDoCredenciamento, type CampoCredenciamento } from "@/domain/credenciamentoCampos";
import { useAsync } from "@/hooks/useAsync";
import { textoWhatsAppCredenciamento } from "@/lib/email/templates";
import { gerarCredenciamentoExcel } from "@/lib/excel";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { cx, dataBR, dataHoraBR } from "@/lib/format";
import { idAncoraPendencia } from "@/lib/destaque";
import {
  credenciadosDaFila,
  filaDeCredenciamento,
  type NaFila,
} from "@/domain/credenciamento";
import type { CredenciamentoResposta, Ec, Os } from "@/data/types";

export function CredenciamentoProjeto({ oss, ecs }: { oss: Os[]; ecs: Ec[] }) {
  const [copiado, setCopiado] = useState("");
  const [prazoLote, setPrazoLote] = useState("");
  /** Quem já respondeu — uma consulta só para a fila inteira. */
  const { data: responderam } = useAsync(() => repo.oss.osComCredenciamento(), []);

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

  /** WhatsApp: abre a conversa com o texto padrão e o link já escritos (envio manual). */
  function abrirWhatsApp(f: NaFila) {
    if (!f.ec || !f.link || !f.whatsapp) return;
    window.open(`https://wa.me/${f.whatsapp}?text=${encodeURIComponent(textoWhatsAppCredenciamento(f.os, f.ec))}`, "_blank", "noopener,noreferrer");
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
      <SecaoPainel titulo="Credenciamento dos Fornecedores">
        <EmptyState
          title="Nenhuma OS neste projeto"
          hint="O credenciamento é enviado por OS — cada fornecedor recebe o link da OS dele. Emita as OSs na aba EC."
        />
      </SecaoPainel>
    );
  }

  return (
    <div>
      <SecaoPainel
        sangrado
        titulo="Credenciamento dos Fornecedores"
        descricao="Cada fornecedor recebe o link da OS dele, pelo WhatsApp ou copiado — é ele que identifica quem está respondendo"
        acoes={
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<IcDownload width={15} height={15} />}
                  onClick={baixarPlanilha}
                  title="Lista de acesso para a portaria: equipe, veículos e quem ainda não respondeu"
                >
                  Baixar Excel
                </Button>
        }
      >

        <Table>
          <THead>
            <Th>Fornecedor</Th>
            <Th>OS</Th>
            <Th>Prazo</Th>
            <Th>Situação</Th>
            <Th align="right">Ações</Th>
          </THead>
          <tbody>
            {fila.map((f) => (
              // O `id` é o endereço da linha para o navegador de pendências: o
              // credenciamento sem resposta é cobrado NESTA tela (é daqui que se
              // reenvia o link), e a pílula precisa achar o fornecedor exato.
              <Tr key={f.os.id} id={idAncoraPendencia(f.os.id)}>
                <Td className="font-bold text-ink">{f.fornecedor}</Td>
                <Td className="text-xs text-ink-2">{f.os.numero}</Td>
                <Td className="text-xs">{dataBR(f.os.credenciamento?.prazoLimite) || "—"}</Td>
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
      </SecaoPainel>

      <SecaoPainel
        titulo="Configuração do envio"
        descricao="Vale para todas as OSs do projeto: o formulário e o prazo são os mesmos para todos os fornecedores do evento."
      >
      <div className="grid gap-6 md:grid-cols-2">
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
      </div>
      </SecaoPainel>

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
    <div>
      <CabecalhoSubbloco titulo="Formulário de credenciamento" descricao="O que o fornecedor preenche neste evento — o nome é sempre pedido" />
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {CAMPOS_CREDENCIAMENTO.map(({ campo, rotulo, dica }) => (
          <label key={campo} className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={escolhidos.includes(campo)}
              onChange={() => alternar(campo)}
              className="h-4 w-4 accent-brand"
            />
            {rotulo}
            {dica && <span className="text-2xs text-muted-foreground">({dica})</span>}
          </label>
        ))}
      </div>
      <div className="mt-3">
        <Button variant="secondary" size="sm" disabled={!mudou} onClick={() => void onAplicar(escolhidos)}>
          Aplicar às {quantas} OS(s)
        </Button>
      </div>
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
    <div>
      <CabecalhoSubbloco titulo="Prazo limite do credenciamento" descricao="Vai como Prazo para envio na mensagem ao fornecedor — costuma ser o mesmo para o evento inteiro" />
      <div className="flex items-end gap-2 flex-wrap">
        <Input type="date" className="max-w-48" value={prazo} onChange={(e) => onPrazo(e.target.value)} />
        <Button variant="secondary" size="sm" disabled={!prazo} onClick={onAplicar}>
          Aplicar às {quantas} OS(s)
        </Button>
      </div>
    </div>
  );
}

/** Título de um bloco DENTRO de uma seção — um degrau abaixo do `CabecalhoSecao`. */
function CabecalhoSubbloco({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
    </div>
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
    <SecaoPainel titulo="Credenciamentos recebidos" descricao="Enviado pelos fornecedores pelo formulário público">
      <div className="space-y-3">
        {comResposta.map((f) => (
          <div key={f.os.id} className={cx("rounded-md border border-border bg-muted/40 p-3")}>
            <div className="text-xs font-bold text-foreground mb-1.5">{f.fornecedor}</div>
            {(respostas?.get(f.os.id) ?? []).map((c) => (
              <div key={c.id} className="mb-2 last:mb-0">
                <div className="text-2xs text-ink-3 mb-1">Enviado em {dataHoraBR(c.enviadoEm)}</div>
                {c.equipe.length > 0 && (
                  <div className="text-xs text-ink mb-1">
                    <b>Equipe:</b>{" "}
                    {c.equipe.map((p) => `${p.nome}${p.funcao ? ` (${p.funcao})` : ""}${p.cpf ? ` — ${p.cpf}` : ""}`).join("; ")}
                  </div>
                )}
                {c.veiculos.length > 0 && (
                  <div className="text-xs text-ink">
                    <b>Veículos:</b> {c.veiculos.map((v) => `${v.modelo}${v.placa ? ` — ${v.placa}` : ""}`).join("; ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </SecaoPainel>
  );
}
