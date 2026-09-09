/**
 * O card de conversa — o "corredor" de uma tela.
 *
 * Toda tela do sistema tem duas camadas de conversa: a do DETALHE, presa ao
 * item ("este buffet está caro"), e a do CONJUNTO, que fala do documento ou da
 * etapa inteira ("o cliente cortou o coffee break"). A segunda é sempre a mesma
 * coisa — título, contador do que é seu, e a thread — e estava escrita de novo
 * a cada tela que ganhava conversa, com um rótulo ligeiramente diferente em
 * cada uma. Agora é uma peça só: EC, OS e as abas do projeto usam esta, e o
 * rótulo do botão ("Adicionar Observação") é o mesmo em toda parte.
 *
 * Aqui mora só o DESENHO. Quem grava é quem chama, porque as telas gravam de
 * jeitos diferentes de propósito: a EC e as abas do projeto gravam na hora, por
 * caminho próprio (comentar não é editar o documento); a OS acumula no
 * formulário e vai junto do "Salvar".
 */
import type { ReactNode } from "react";
import { Card, CardTitle } from "@/components/ui";
import { ObservacoesThread } from "@/components/ObservacoesPopup";
import { NotifDot } from "@/components/NotifDot";
import type { Observacao } from "@/data/types";

export function CardConversa({
  titulo = "Observações gerais",
  hint = "Conversa da equipe sobre esta etapa. Quem é @mencionado fica com a pendência.",
  ancora,
  observacoes,
  usuarios,
  minhas,
  onChange,
  ancoraDom,
  acao,
}: {
  titulo?: string;
  hint?: string;
  /** Chave da conversa para o sistema de pendências (ver `domain/pendencias`). */
  ancora: string;
  observacoes: Observacao[];
  usuarios: string[];
  /** Quantas pendências desta conversa são de quem está olhando. */
  minhas: number;
  onChange: (observacoes: Observacao[]) => void;
  /** `id` no DOM, para o navegador de pendências rolar até aqui. */
  ancoraDom?: string;
  /** Botão à direita do título, quando a tela tem um. */
  acao?: ReactNode;
}) {
  return (
    <Card>
      <CardTitle hint={hint} action={acao}>
        <span className="inline-flex items-center gap-2">
          {titulo}
          <NotifDot n={minhas} inline title={`${minhas} pendência(s) sua(s) nesta conversa`} />
        </span>
      </CardTitle>
      <div id={ancoraDom}>
        <ObservacoesThread ancora={ancora} observacoes={observacoes} usuarios={usuarios} onChange={onChange} />
      </div>
    </Card>
  );
}
