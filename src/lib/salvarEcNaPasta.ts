/**
 * "SALVAR NA PASTA" DA EC (06/11/2026, pedido da Carol e da Marisa).
 *
 * Até aqui três coisas aconteciam no "Salvar" comum: a pergunta da revisão por
 * IA, a versão nova (se a EC já tivesse sido baixada) e a cópia para o Dropbox.
 * Como baixar também marcava a EC como baixada, cada salvamento virava uma
 * versão — a EC da Carol foi da v3 à v8 num dia.
 *
 * Agora o "Salvar" só grava. Este botão é o momento em que a EC SAI para a
 * pasta do projeto:
 *
 *  1. oferece a revisão por IA dos textos da EC;
 *  2. se esta versão ainda não foi para a pasta, ela vai como está (a v01 de
 *     uma EC nova, por exemplo);
 *  3. se já foi e mudou desde então, nasce a versão seguinte (v02, v03…), com
 *     o número atualizado no app, e é ELA que vai para a pasta;
 *  4. se já foi e não mudou, avisa que a pasta já tem esta versão.
 *
 * Nada é substituído: cada versão é um arquivo próprio, com o número no nome.
 */
import { repo } from "@/data";
import type { Ec } from "@/data/types";
import { numeroEc, rotuloNumeroEc } from "@/domain/calc";
import { aplicarNaEc, camposDaEc } from "@/domain/revisaoTexto";
import { avisarFalhaRevisao, pendentesDeRevisao, revisarPendentes } from "@/lib/revisaoInterativa";
import { confirmar } from "@/store/confirm";
import { toast } from "@/store/toast";
import { supabase } from "@/lib/supabaseClient";

const dd = (n: number) => String(n).padStart(2, "0");

/** O projeto tem link de pasta em Dados Gerais? */
async function temPasta(projetoId: string | undefined): Promise<boolean> {
  if (!projetoId) return false;
  const { data } = await supabase.from("projetos").select("docs_url").eq("id", projetoId).maybeSingle();
  return /^https?:\/\//i.test((data?.docs_url ?? "").trim());
}

/** A EC mudou depois da última ida à pasta? */
export function mudouDesdeAPasta(atualizadoEm: string | undefined, baixadaEm: string | null | undefined): boolean {
  if (!baixadaEm) return true;
  if (!atualizadoEm) return false;
  return new Date(atualizadoEm).getTime() > new Date(baixadaEm).getTime();
}

/**
 * Leva a EC GRAVADA para a pasta. Quem chama salva antes o que estiver em
 * edição. `jaRevisados` evita revisar de novo o que passou pelo "Revisar"
 * nesta sessão. Devolve a EC que ficou na pasta (pode ser a versão nova), ou
 * null se nada foi feito.
 */
export async function salvarEcNaPasta(
  ec: Ec,
  opts: { jaRevisados?: Map<string, string>; aoAndar?: (texto: string) => void } = {},
): Promise<Ec | null> {
  const andar = opts.aoAndar ?? (() => {});
  if (!(await temPasta(ec.projetoId))) {
    toast("Este projeto ainda não tem o link da pasta Dropbox em Dados Gerais. Informe o link e tente de novo.", "warning");
    return null;
  }

  andar("Conferindo a versão…");
  const baixadaEm = await repo.ecs.baixadaEm(ec.id);
  const precisaVersaoNova = !!baixadaEm && mudouDesdeAPasta(ec.atualizadoEm, baixadaEm);
  const proxima = ec.versao + 1;

  if (baixadaEm && !precisaVersaoNova) {
    // Nada mudou: confere que o arquivo está lá (o servidor não duplica).
    andar("Conferindo a pasta…");
    const { salvarEcNaPasta: enviar } = await import("@/lib/excel");
    const r = await enviar(ec);
    if (r.status === "erro") toast(`Não foi possível salvar no Dropbox do projeto: ${r.erro}`, "danger");
    else toast(`A versão (${dd(ec.versao)}) já está na pasta do projeto, sem alterações desde então.`, "info");
    return r.status === "erro" ? null : ec;
  }

  // 1. A revisão por IA, oferecida — o texto que vai para a pasta é o que sai da casa.
  const pendentes = pendentesDeRevisao(camposDaEc(ec.linhas), [], opts.jaRevisados ?? new Map());
  const querRevisao = pendentes.length > 0 && (await confirmar({
    titulo: "Revisar os textos antes de salvar na pasta?",
    mensagem:
      `${pendentes.length === 1 ? "1 texto da EC ainda não foi revisado" : `${pendentes.length} textos da EC ainda não foram revisados`}. ` +
      "Quer que o sistema corrija a ortografia antes de a EC ir para a pasta do projeto?" +
      (precisaVersaoNova ? ` As alterações vão para a pasta como a versão ${dd(proxima)}; a ${dd(ec.versao)} continua lá como estava.` : ""),
    confirmarTexto: "Revisar e salvar na pasta",
    cancelarTexto: "Salvar na pasta sem revisar",
  }));

  try {
    let linhas = ec.linhas;
    if (querRevisao) {
      andar("Revisando os textos…");
      const { textos, falhou } = await revisarPendentes(pendentes);
      linhas = aplicarNaEc(linhas, textos);
      if (falhou) await avisarFalhaRevisao();
    }
    const revisou = querRevisao && JSON.stringify(linhas) !== JSON.stringify(ec.linhas);

    // 2/3. A versão que vai para a pasta.
    let alvo: Ec = { ...ec, linhas };
    if (precisaVersaoNova) {
      andar(`Criando a versão ${dd(proxima)}…`);
      const { ec: nova, mapa } = await repo.ecs.novaVersaoComMapa(ec.id);
      alvo = {
        ...alvo,
        id: nova.id,
        versao: nova.versao,
        numero: numeroEc(alvo.cliente.nome || "Cliente", alvo.projeto.titulo || "Projeto", nova.versao),
        status: nova.status,
        ativa: nova.ativa,
        canceladaSubstituida: nova.canceladaSubstituida,
        criadoEm: nova.criadoEm,
        atualizadoEm: nova.atualizadoEm,
        baixadaEm: null,
        // Cada linha segue sendo "a mesma" na versão nova: é o que preserva os
        // valores que quem salva não enxerga.
        linhas: alvo.linhas.map((l) => ({ ...l, id: mapa[l.id] ?? l.id })),
      };
    }
    let salva = alvo;
    if (precisaVersaoNova || revisou) {
      andar("Salvando…");
      salva = await repo.ecs.salvar({ ...alvo, responsavel: alvo.responsavel || alvo.projeto.produtoraResponsavel });
    }

    // 4. A pasta.
    andar("Enviando para a pasta do projeto…");
    const { salvarEcNaPasta: enviar } = await import("@/lib/excel");
    const r = await enviar(salva);
    if (r.status === "erro") {
      toast(
        `A EC foi salva${precisaVersaoNova ? ` como versão ${dd(salva.versao)}` : ""}, mas não chegou ao Dropbox: ${r.erro}. Tente "Salvar na pasta" de novo.`,
        "danger",
      );
    } else if (r.status === "sem-pasta") {
      toast("Este projeto não tem o link da pasta Dropbox em Dados Gerais.", "warning");
    } else {
      toast(
        precisaVersaoNova
          ? `Versão (${dd(salva.versao)}) criada e salva na pasta do projeto, nas planilhas Completa e Financeiro. A (${dd(ec.versao)}) continua na pasta como estava.`
          : `EC ${rotuloNumeroEc(salva.numero)} salva na pasta do projeto, nas planilhas Completa e Financeiro.`,
        "success",
      );
    }
    return salva;
  } catch (e) {
    toast(`Não foi possível salvar na pasta: ${(e as Error).message}`, "danger");
    return null;
  }
}
