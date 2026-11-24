/**
 * Envio dos cronogramas aos fornecedores.
 *
 * Cada fornecedor recebe o cronograma da OS DELE pelo WhatsApp, com o texto
 * padrão da Pólobh já escrito — o envio é de quem aperta "enviar" no
 * aplicativo. Não há e-mail a fornecedor (23/11/2026): o sistema não manda a
 * OS, nem o cronograma, por e-mail.
 */
import { useMemo } from "react";
import {
  Button, Card, CardTitle, Table, THead, Th, Tr, Td, EmptyState, Badge,
} from "@/components/ui";
import { textoWhatsAppCronograma } from "@/lib/email/templates";
import { idAncoraPendencia } from "@/lib/destaque";
import { ancoraCronogramaOs } from "@/domain/pendencias";
import { useNavigate } from "react-router-dom";
import { filaDeCronograma, type NaFilaCronograma } from "@/domain/envioCronograma";
import type { Ec, Os } from "@/data/types";

export function EnvioCronograma({ oss, ecs }: { oss: Os[]; ecs: Ec[] }) {
  const navigate = useNavigate();
  const fila = useMemo(() => filaDeCronograma(oss, ecs), [oss, ecs]);

  /**
   * WhatsApp (29/09/2026): abre a conversa com o texto padrão já escrito — o
   * envio é de quem aperta "enviar" no aplicativo. Não há disparo automático:
   * isso exigiria a API oficial do WhatsApp Business, contratada à parte.
   */
  function abrirWhatsApp(f: NaFilaCronograma) {
    if (!f.ec || !f.whatsapp) return;
    const url = `https://wa.me/${f.whatsapp}?text=${encodeURIComponent(textoWhatsAppCronograma(f.os, f.ec))}`;
    window.open(url, "_blank", "noopener,noreferrer");
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
        <CardTitle hint="Cada fornecedor recebe pelo WhatsApp o cronograma da OS dele — texto padrão da Pólobh com as etapas, datas e horários">
          Envio dos cronogramas
        </CardTitle>
      </div>

      <Table>
        <THead>
          <Th>Fornecedor</Th>
          <Th>OS</Th>
          <Th>Cronograma</Th>
          <Th align="right">Ações</Th>
        </THead>
        <tbody>
          {fila.map((f) => (
            <Tr key={f.os.id} id={idAncoraPendencia(ancoraCronogramaOs(f.os.id))}>
              <Td className="font-bold text-ink">{f.fornecedor}</Td>
              <Td className="text-xs text-ink-2">{f.os.numero}</Td>
              <Td>
                {f.etapas ? (
                  <Badge tom="success">{f.etapas} etapa(s)</Badge>
                ) : (
                  <Badge tom="neutral">sem etapas</Badge>
                )}
              </Td>
              <Td align="right">
                <div className="flex justify-end gap-1.5 whitespace-nowrap">
                  <Button variant="text" size="sm" onClick={() => navigate(`/ordens/${f.os.id}`)} title="Abrir a OS para preencher as etapas">
                    Abrir OS
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!f.ec || !f.whatsapp}
                    title={f.whatsapp ? "Abre o WhatsApp com o texto padrão pronto" : "Fornecedor sem telefone cadastrado"}
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
  );
}
