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

/**
 * O TÍTULO e o TEXTO são os mesmos em toda etapa do sistema (pedido de
 * 15/09/2026). Cada tela passava a sua variação — "Observações — EC",
 * "Observações gerais", um texto diferente em cada uma —, e o que era a mesma
 * ferramenta parecia cinco coisas diferentes. Agora quem chama não escolhe:
 * as duas linhas abaixo valem para EC, OS, check-list, cronograma,
 * credenciamento, fornecedores e dados gerais.
 */
export const TITULO_CONVERSA = "Observações";
export const TEXTO_CONVERSA =
  "Neste campo a equipe da Pólobh registra suas observações e pendências sobre esta etapa do trabalho.";

export function CardConversa({
  titulo = TITULO_CONVERSA,
  hint = TEXTO_CONVERSA,
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
      {/* A garantia de que isto é interno fica em letra miúda, mas fica: é o
          que faz a equipe escrever à vontade. Saía junto com os textos antigos
          de cada tela, e sem ela a conversa vira documento aos olhos de quem
          escreve. */}
      <p className="-mt-1 mb-1 text-[11.5px] text-ink-3">
        Não sai em documento, e-mail nem planilha — quem é @mencionado fica com a pendência.
      </p>
      <div id={ancoraDom}>
        <ObservacoesThread ancora={ancora} observacoes={observacoes} usuarios={usuarios} onChange={onChange} />
      </div>
    </Card>
  );
}
