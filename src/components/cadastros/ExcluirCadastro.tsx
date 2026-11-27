/**
 * EXCLUIR UM REGISTRO DO CADASTRO (27/11/2026) — fornecedor ou cliente.
 *
 * A janela primeiro diz ONDE o registro é usado. Daí são dois caminhos:
 *
 *   · sem uso nenhum — é só confirmar: o registro sai do cadastro;
 *   · em uso — a pessoa escolhe o REGISTRO QUE FICA no lugar dele. Os documentos
 *     ATIVOS (itens de EC ativa, OS ativa, projeto ativo) passam para esse
 *     registro; o que já foi emitido ou arquivado é histórico e fica como saiu.
 *     Só depois o registro é apagado. É como se desfaz uma duplicidade.
 *
 * Quem só quer tirar o registro de cena, sem mexer em documento nenhum, usa
 * "Inativar": é a saída oferecida aqui mesmo quando o registro está em uso.
 */
import { useEffect, useMemo, useState } from "react";
import { Button, Select } from "@/components/ui";
import { IcTrash } from "@/components/icons";
import { toast } from "@/store/toast";
import type { ResultadoExclusaoCadastro, UsoDoCadastro } from "@/data/types";
import { Bloco, Janela } from "./pecas";

export interface OpcaoDeDestino {
  id: string;
  rotulo: string;
}

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

/** O uso em frases curtas: o total e, entre parênteses, o que está ativo (é o que a unificação move). */
function linhasDoUso(uso: UsoDoCadastro): string[] {
  const linhas: string[] = [];
  const com = (total: number | undefined, ativos: number | undefined, um: string, muitos: string, ativoUm: string, ativoMuitos: string) => {
    if (!total) return;
    linhas.push(`${plural(total, um, muitos)} (${ativos ? plural(ativos, ativoUm, ativoMuitos) : "nenhum ativo"})`);
  };
  com(uso.projetos, uso.projetosAtivos, "projeto", "projetos", "ativo", "ativos");
  com(uso.ecs, uso.ecsAtivas, "EC", "ECs", "ativa", "ativas");
  com(uso.itensEc, uso.itensEcAtivos, "item de EC", "itens de EC", "em EC ativa", "em ECs ativas");
  com(uso.oss, uso.ossAtivas, "OS", "OS", "ativa", "ativas");
  return linhas;
}

export function ExcluirCadastro({
  oQue,
  nome,
  carregarUso,
  destinos,
  excluir,
  onClose,
  onExcluido,
  onInativar,
}: {
  /** "fornecedor" ou "cliente" — entra nos textos. */
  oQue: "fornecedor" | "cliente";
  nome: string;
  carregarUso: () => Promise<UsoDoCadastro>;
  /** Os outros registros ATIVOS do cadastro: os candidatos a ficar no lugar. */
  destinos: OpcaoDeDestino[];
  excluir: (destinoId?: string) => Promise<ResultadoExclusaoCadastro>;
  onClose: () => void;
  onExcluido: () => void;
  /** Oferecido quando o registro está em uso: tirar de cena sem mexer em documento. */
  onInativar?: () => void;
}) {
  const [uso, setUso] = useState<UsoDoCadastro | null>(null);
  const [erro, setErro] = useState("");
  const [destino, setDestino] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    carregarUso()
      .then((u) => vivo && setUso(u))
      .catch((e) => vivo && setErro((e as Error).message));
    return () => {
      vivo = false;
    };
    // Carrega uma vez, ao abrir a janela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const linhas = useMemo(() => (uso ? linhasDoUso(uso) : []), [uso]);
  const emUso = linhas.length > 0;

  async function confirmar() {
    setOcupado(true);
    try {
      const r = await excluir(emUso ? destino : undefined);
      const movidos = [
        r.projetos && plural(r.projetos, "projeto", "projetos"),
        r.ecs && plural(r.ecs, "EC", "ECs"),
        r.itensEc && plural(r.itensEc, "item de EC", "itens de EC"),
        r.oss && plural(r.oss, "OS", "OS"),
      ].filter(Boolean);
      toast(
        emUso
          ? `${nome} foi excluído. ${movidos.length ? `Passaram para o registro que ficou: ${movidos.join(", ")}.` : "Não havia documento ativo para transferir."}`
          : `${nome} foi excluído do cadastro.`,
        "success"
      );
      onExcluido();
    } catch (e) {
      toast(`Não foi possível excluir: ${(e as Error).message}`, "danger");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Janela
      titulo={`Excluir ${oQue}`}
      subtitulo={nome}
      onClose={onClose}
      rodape={
        <>
          <Button variant="secondary" onClick={onClose} disabled={ocupado}>Cancelar</Button>
          {emUso && onInativar && (
            <Button variant="secondary" onClick={onInativar} disabled={ocupado}>Só inativar</Button>
          )}
          <Button
            variant="danger"
            icon={<IcTrash width={15} height={15} />}
            onClick={() => void confirmar()}
            disabled={ocupado || !uso || (emUso && !destino)}
          >
            {ocupado ? "Excluindo…" : emUso ? "Transferir e excluir" : `Excluir ${oQue}`}
          </Button>
        </>
      }
    >
      {erro ? (
        <p className="text-[13px] font-semibold text-danger" role="alert">Não foi possível conferir onde este registro é usado: {erro}</p>
      ) : !uso ? (
        <p className="text-sm text-ink-3">Conferindo onde este registro é usado…</p>
      ) : !emUso ? (
        <p className="text-[13.5px] text-ink">
          Este {oQue} não aparece em nenhum projeto, EC ou OS. A exclusão é definitiva e não pode ser desfeita.
        </p>
      ) : (
        <div className="space-y-5">
          <Bloco titulo="Onde este registro é usado">
            <ul className="space-y-1 text-[13.5px] text-ink">
              {linhas.map((l) => <li key={l}>• {l}</li>)}
            </ul>
          </Bloco>
          <Bloco titulo="Registro que fica no lugar dele">
            <Select value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Registro que fica no lugar do excluído">
              <option value="">Selecione…</option>
              {destinos.map((d) => <option key={d.id} value={d.id}>{d.rotulo}</option>)}
            </Select>
            <p className="mt-2 text-[12.5px] text-ink-2">
              Os documentos <b>ativos</b> passam para o registro escolhido. O que já foi emitido ou arquivado continua com os
              dados de quando saiu. A exclusão é definitiva e não pode ser desfeita.
            </p>
            {destinos.length === 0 && (
              <p className="mt-2 text-[12.5px] font-semibold text-warning">
                Não há outro registro ativo para receber os documentos. Cadastre o registro correto antes, ou use “Só inativar”.
              </p>
            )}
          </Bloco>
        </div>
      )}
    </Janela>
  );
}
