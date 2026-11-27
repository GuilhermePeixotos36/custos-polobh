/**
 * AÇÕES EM LOTE NAS LISTAS DE OS (27/11/2026).
 *
 * Duas ações, duas permissões (marcadas no grupo, em Acessos):
 *   · `oss.statusLote` — mudar o status de várias OS de uma vez;
 *   · `oss.excluir`    — excluir OS de verdade, com confirmação.
 * Quem não tem nenhuma das duas não vê caixa de seleção nem barra: a lista
 * fica como sempre foi.
 *
 * A mesma peça serve à lista geral de OS e à aba OS do projeto. Ela entrega a
 * coluna de seleção (cabeçalho e célula) e a barra que aparece com a seleção —
 * a mesma barra do check-list, para o gesto ser um só no app inteiro.
 *
 * As regras (etapa que acompanha o status, itens da EC liberados na exclusão)
 * estão em `domain/loteOs`.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Button, Th, Td } from "@/components/ui";
import { IcTrash } from "@/components/icons";
import { repo } from "@/data";
import { confirmar } from "@/store/confirm";
import { toast } from "@/store/toast";
import { useAuth } from "@/store/auth";
import { usePendencias } from "@/store/pendencias";
import { liberarItensDaOsExcluida, osComStatus } from "@/domain/loteOs";
import { cx } from "@/lib/format";
import type { Os } from "@/data/types";

type StatusDaOs = Os["status"];
const LARGURA = "w-[40px] min-w-[40px] !px-2";
const SETA_LISTA =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236A6E78' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")";

export function useLoteOs(visiveis: Os[], aoConcluir: () => void) {
  const podeStatus = useAuth((s) => s.pode("oss.statusLote"));
  const podeExcluir = useAuth((s) => s.pode("oss.excluir"));
  const podeEmitir = useAuth((s) => s.pode("oss.emitir"));
  const ativo = podeStatus || podeExcluir;
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);

  // Só conta o que está à vista: trocar o filtro não deixa OS escondida marcada.
  const marcadas = useMemo(() => visiveis.filter((o) => selecionadas.has(o.id)), [visiveis, selecionadas]);
  const todasMarcadas = visiveis.length > 0 && marcadas.length === visiveis.length;
  const alternar = (id: string, marcar: boolean) =>
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (marcar) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  const alternarTodas = (marcar: boolean) => setSelecionadas(marcar ? new Set(visiveis.map((o) => o.id)) : new Set());

  const fim = () => {
    setSelecionadas(new Set());
    usePendencias.getState().carregar(true);
    aoConcluir();
  };

  /** Muda o status das marcadas. Cada OS é relida antes de gravar, para não pisar no que outra pessoa salvou. */
  async function mudarStatus(status: StatusDaOs) {
    const alvo = marcadas.filter((o) => o.status !== status);
    if (!alvo.length) {
      toast(`As OS selecionadas já estão como ${status}.`, "info");
      return;
    }
    const n = alvo.length;
    const aviso =
      status === "Emitida"
        ? "Elas passam a Emitida sem passar pelas conferências da emissão (pendências, revisão da Direção), e os itens delas na EC ficam com a OS em OK."
        : status === "Arquivada"
          ? "Elas vão para o arquivo: continuam consultáveis, mas não podem mais ser editadas."
          : "Elas voltam a ficar em andamento. As que estavam emitidas voltam para a etapa do Back-office.";
    if (!(await confirmar({
      titulo: n === 1 ? `Mudar 1 OS para ${status}?` : `Mudar ${n} OS para ${status}?`,
      mensagem: aviso,
      confirmarTexto: `Mudar para ${status}`,
      tom: status === "Arquivada" ? "danger" : "primary",
    }))) return;
    setOcupado(true);
    const agora = new Date().toISOString();
    const falhas: string[] = [];
    let feitas = 0;
    for (const o of alvo) {
      try {
        const atual = await repo.oss.obter(o.id);
        if (!atual) throw new Error("não foi encontrada");
        const nova = osComStatus(atual, status, agora);
        if (nova !== atual) await repo.oss.salvar(nova);
        // Emitir fecha os itens na EC, como o botão "Emitir OS" faz.
        if (status === "Emitida") await repo.oss.fecharItensNaEc(o.id).catch(() => undefined);
        feitas += 1;
      } catch (e) {
        falhas.push(`${o.numero}: ${(e as Error).message}`);
      }
    }
    setOcupado(false);
    if (feitas) toast(`${feitas} OS ${feitas === 1 ? "passou" : "passaram"} para ${status}.`, "success");
    if (falhas.length) toast(`Não foi possível mudar: ${falhas.join("; ")}`, "danger");
    fim();
  }

  /** Exclui as marcadas, de verdade. Os itens da EC que ficam sem OS voltam para "Emitir". */
  async function excluir() {
    if (!marcadas.length) return;
    const n = marcadas.length;
    const emitidas = marcadas.filter((o) => o.status === "Emitida").length;
    const nomes = marcadas.slice(0, 5).map((o) => `• ${o.numero}`).join("\n") + (n > 5 ? `\n… e mais ${n - 5}` : "");
    if (!(await confirmar({
      titulo: n === 1 ? "Excluir esta OS de vez?" : `Excluir ${n} OS de vez?`,
      mensagem:
        `${nomes}\n\nA exclusão é definitiva e NÃO pode ser desfeita: a OS some do sistema, com o faturamento e o credenciamento dela. ` +
        (emitidas ? `${emitidas === 1 ? "Uma delas já foi emitida" : `${emitidas} delas já foram emitidas`}. ` : "") +
        "Os itens da EC que ficarem sem OS voltam para “Emitir”. Para só tirar de cena, use o status Arquivada.",
      confirmarTexto: n === 1 ? "Excluir OS" : `Excluir ${n} OS`,
      cancelarTexto: "Voltar",
      tom: "danger",
    }))) return;
    setOcupado(true);
    const falhas: string[] = [];
    const excluidas: Os[] = [];
    for (const o of marcadas) {
      try {
        await repo.oss.remover(o.id);
        excluidas.push(o);
      } catch (e) {
        falhas.push(`${o.numero}: ${(e as Error).message}`);
      }
    }
    // Devolve à EC os itens que perderam a OS — uma gravação por EC.
    let liberados = 0;
    for (const ecId of new Set(excluidas.map((o) => o.ecId))) {
      try {
        const [ec, restantes] = await Promise.all([repo.ecs.obter(ecId), repo.oss.porEc(ecId)]);
        if (!ec) continue;
        const ids = excluidas.filter((o) => o.ecId === ecId).flatMap((o) => o.ecLinhaIds);
        const r = liberarItensDaOsExcluida(ec.linhas, ids, restantes);
        if (r.liberados) {
          await repo.ecs.salvar({ ...ec, linhas: r.linhas });
          liberados += r.liberados;
        }
      } catch (e) {
        falhas.push(`itens da EC não liberados: ${(e as Error).message}`);
      }
    }
    setOcupado(false);
    if (excluidas.length) {
      toast(
        `${excluidas.length} OS ${excluidas.length === 1 ? "excluída" : "excluídas"}.` +
          (liberados ? ` ${liberados} ${liberados === 1 ? "item da EC voltou" : "itens da EC voltaram"} para “Emitir”.` : ""),
        "success"
      );
    }
    if (falhas.length) toast(`Não foi possível concluir: ${falhas.join("; ")}`, "danger");
    fim();
  }

  const thSelecao: ReactNode = ativo ? (
    <Th className={LARGURA}>
      <input
        type="checkbox"
        checked={todasMarcadas}
        onChange={(e) => alternarTodas(e.target.checked)}
        aria-label="Selecionar todas as OS da lista"
        title="Selecionar todas"
        className="h-4 w-4 accent-[#F2820D] align-middle"
      />
    </Th>
  ) : null;

  const tdSelecao = (o: Os): ReactNode =>
    ativo ? (
      // O clique na caixa não abre a OS: a linha inteira é um link.
      <Td className={LARGURA}>
        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
          <input
            type="checkbox"
            checked={selecionadas.has(o.id)}
            onChange={(e) => alternar(o.id, e.target.checked)}
            aria-label={`Selecionar a OS ${o.numero}`}
            className="h-4 w-4 accent-[#F2820D] align-middle"
          />
        </span>
      </Td>
    ) : null;

  const barra: ReactNode =
    ativo && marcadas.length > 0 ? (
      <div className="flex min-h-[52px] items-center gap-x-4 gap-y-2 flex-wrap border-y border-primary bg-primary-soft px-4 py-2">
        <span className="inline-flex items-center gap-2 text-[13px] font-extrabold text-primary-dark">
          <span className="tabular-nums">
            {marcadas.length} {marcadas.length === 1 ? "selecionada" : "selecionadas"}
          </span>
          <button
            type="button"
            onClick={() => setSelecionadas(new Set())}
            className="rounded px-1 text-[12.5px] font-bold text-ink-2 underline decoration-dotted underline-offset-2 hover:text-ink input-focus"
          >
            limpar
          </button>
        </span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {podeStatus && (
            <span className={cx("inline-flex h-9 items-stretch overflow-hidden rounded-btn border-[1.5px] border-[#D6D9E0] bg-surface focus-within:border-primary", ocupado && "opacity-60")}>
              <span className="flex items-center border-r-[1.5px] border-[#D6D9E0] bg-[#FAFAFB] px-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-3">
                Status
              </span>
              <select
                value=""
                disabled={ocupado}
                onChange={(e) => e.target.value && void mudarStatus(e.target.value as StatusDaOs)}
                aria-label="Mudar o status das OS selecionadas"
                className="h-full cursor-pointer appearance-none bg-transparent bg-no-repeat pl-2.5 pr-8 text-[13px] font-bold text-ink outline-none"
                style={{ backgroundImage: SETA_LISTA, backgroundPosition: "right 10px center" }}
              >
                <option value="">Mudar para…</option>
                <option value="Ativa">Ativa</option>
                {/* Emitir em lote é de quem emite. */}
                {podeEmitir && <option value="Emitida">Emitida</option>}
                <option value="Arquivada">Arquivada</option>
              </select>
            </span>
          )}
          {podeExcluir && (
            <Button size="sm" variant="danger" icon={<IcTrash width={15} height={15} />} disabled={ocupado} onClick={() => void excluir()}>
              Excluir
            </Button>
          )}
        </div>
      </div>
    ) : null;

  return { ativo, thSelecao, tdSelecao, barra };
}
