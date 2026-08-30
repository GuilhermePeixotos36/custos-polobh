/**
 * Envio dos cronogramas aos fornecedores.
 *
 * O texto e o cronograma de cada um já eram montados pelo sistema; faltava o
 * comando para disparar sem abrir OS por OS. Na véspera de um evento com dez
 * fornecedores, "uma de cada vez" quer dizer "não vai ser feito".
 *
 * Mesmo desenho do painel de credenciamento, e de propósito: marcar quem
 * recebe, ou mandar a todos os que têm cronograma. Cada um recebe o SEU —
 * o e-mail é montado a partir da OS dele.
 */
import { useMemo, useState } from "react";
import {
  Button, Card, CardTitle, Table, THead, Th, Tr, Td, EmptyState, Badge,
  AvisoHomologacaoEmail, MOTIVO_DISPARO_DESLIGADO,
} from "@/components/ui";
import { flags } from "@/lib/flags";
import { IcSend } from "@/components/icons";
import { enviarLembreteCronograma, resumoDoEnvio } from "@/lib/email";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { cx } from "@/lib/format";
import {
  filaDeCronograma,
  podeEnviarCronograma,
  temCronogramaParaEnviar,
  type NaFilaCronograma,
} from "@/domain/envioCronograma";
import type { Ec, Os } from "@/data/types";

export function EnvioCronograma({ oss, ecs }: { oss: Os[]; ecs: Ec[] }) {
  const [enviando, setEnviando] = useState("");
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());

  const fila = useMemo(() => filaDeCronograma(oss, ecs), [oss, ecs]);
  /** Quem o botão vai alcançar: o que estiver marcado, ou todos com cronograma. */
  const alvos = marcados.size
    ? fila.filter((f) => marcados.has(f.os.id) && podeEnviarCronograma(f))
    : fila.filter(temCronogramaParaEnviar);
  const marcaveis = fila.filter(podeEnviarCronograma);
  const todosMarcados = marcaveis.length > 0 && marcaveis.every((f) => marcados.has(f.os.id));

  async function enviar(f: NaFilaCronograma) {
    if (!f.ec || !f.email) return { ok: false, simulado: true, destinatarios: [] };
    return enviarLembreteCronograma(f.os, f.ec);
  }

  async function enviarUm(f: NaFilaCronograma) {
    if (!(await confirmar({
      titulo: `Enviar o cronograma para ${f.fornecedor}?`,
      mensagem: `Vai um e-mail para ${f.email} com as etapas da ${f.os.numero}.`,
      confirmarTexto: "Enviar",
    }))) return;
    setEnviando(f.os.id);
    try {
      const r = await enviar(f);
      toast(resumoDoEnvio(r), r.ok && !r.desviado ? "success" : "warning");
    } finally {
      setEnviando("");
    }
  }

  async function enviarLote() {
    if (!alvos.length) return;
    const marcou = marcados.size > 0;
    if (!(await confirmar({
      titulo: `Enviar o cronograma a ${alvos.length} fornecedor(es)?`,
      mensagem: marcou
        ? "Cada marcado recebe o cronograma da OS dele — inclusive quem ainda está com as etapas em branco."
        : "Cada um recebe o cronograma da OS dele. Fica de fora quem está sem e-mail e quem ainda não tem etapas.",
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
            ? `${ok} cronograma(s) foram para a caixa de TESTE, não para os fornecedores — o sistema está em homologação.`
            : `Cronograma enviado a ${ok} fornecedor(es).`,
        ok === resultados.length && !desviados ? "success" : "warning"
      );
      if (ok) setMarcados(new Set());
    } finally {
      setEnviando("");
    }
  }

  if (!fila.length) {
    return (
      <Card>
        <CardTitle>Envio dos cronogramas</CardTitle>
        <EmptyState
          title="Nenhuma OS neste projeto"
          hint="O cronograma enviado é o da OS de cada fornecedor. Emita as OSs na aba EC."
        />
      </Card>
    );
  }

  return (
    <Card padded={false}>
      <div className="p-5 pb-3">
        <CardTitle
          hint="Cada fornecedor recebe o cronograma da OS dele — texto padrão da Pólobh com as etapas, datas e horários"
          action={
            <Button
              size="sm"
              icon={<IcSend width={15} height={15} />}
              onClick={enviarLote}
              disabled={!alvos.length || !!enviando || !flags.disparoFornecedor}
              title={
                !flags.disparoFornecedor
                  ? MOTIVO_DISPARO_DESLIGADO
                  : marcados.size
                  ? `${alvos.length} marcado(s) com e-mail cadastrado`
                  : alvos.length
                    ? `${alvos.length} fornecedor(es) com cronograma montado`
                    : "Ninguém com cronograma e e-mail — monte as etapas nas OSs"
              }
            >
              {enviando === "lote"
                ? "Enviando…"
                : marcados.size
                  ? `Enviar aos marcados (${alvos.length})`
                  : `Enviar a todos (${alvos.length})`}
            </Button>
          }
        >
          Envio dos cronogramas
        </CardTitle>
        <AvisoHomologacaoEmail />
      </div>

      <Table>
        <THead>
          <Th className="w-10">
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 accent-[#F2820D] cursor-pointer"
              checked={todosMarcados}
              ref={(el) => {
                if (el) el.indeterminate = marcados.size > 0 && !todosMarcados;
              }}
              disabled={!marcaveis.length}
              onChange={(e) => setMarcados(e.target.checked ? new Set(marcaveis.map((f) => f.os.id)) : new Set())}
              aria-label="Marcar todos os fornecedores"
              title="Marcar todos os que têm e-mail cadastrado"
            />
          </Th>
          <Th>Fornecedor</Th>
          <Th>OS</Th>
          <Th>E-mail</Th>
          <Th>Cronograma</Th>
          <Th align="right">Ações</Th>
        </THead>
        <tbody>
          {fila.map((f) => (
            <Tr key={f.os.id} className={cx(marcados.has(f.os.id) && "bg-primary-soft")}>
              <Td>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-[#F2820D] cursor-pointer"
                  checked={marcados.has(f.os.id)}
                  disabled={!podeEnviarCronograma(f)}
                  onChange={() =>
                    setMarcados((atuais) => {
                      const novo = new Set(atuais);
                      if (!novo.delete(f.os.id)) novo.add(f.os.id);
                      return novo;
                    })
                  }
                  aria-label={`Marcar ${f.fornecedor}`}
                  title={podeEnviarCronograma(f) ? "Marcar para o envio em lote" : "Fornecedor sem e-mail cadastrado"}
                />
              </Td>
              <Td className="font-bold text-ink">{f.fornecedor}</Td>
              <Td className="text-[12.5px] text-ink-2">{f.os.numero}</Td>
              <Td className="text-[12.5px]">
                {f.email || <span className="text-danger font-semibold">sem e-mail no cadastro</span>}
              </Td>
              <Td>
                {f.etapas ? (
                  <Badge tom="success">{f.etapas} etapa(s)</Badge>
                ) : (
                  <Badge tom="neutral">sem etapas</Badge>
                )}
              </Td>
              <Td align="right">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!podeEnviarCronograma(f) || !!enviando || !flags.disparoFornecedor}
                  title={
                    !flags.disparoFornecedor
                      ? MOTIVO_DISPARO_DESLIGADO
                      : f.email
                        ? "Enviar só para este fornecedor"
                        : "Fornecedor sem e-mail cadastrado"
                  }
                  onClick={() => enviarUm(f)}
                >
                  {enviando === f.os.id ? "Enviando…" : "Enviar"}
                </Button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
