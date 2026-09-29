/**
 * O CONTEÚDO do pacote de back-up: o que entra, com que nome e em que formato.
 *
 * Mora fora do `index.ts` pelo mesmo motivo dos textos de e-mail: é a parte que
 * decide o que existe dentro do arquivo, e isso precisa de teste. O módulo não
 * importa nada do Deno de propósito, para a suíte do aplicativo conseguir
 * carregá-lo — ver `src/lib/backup/pacote.test.ts`.
 *
 * O pacote tem DOIS retratos dos mesmos dados, e isso é deliberado:
 *
 *  · `dados/*.json` é a cópia fiel, com tipos preservados. É o que se usa para
 *    RESTAURAR;
 *  · `planilhas/*.csv` é a mesma coisa em planilha, para abrir no Excel sem
 *    precisar de ninguém técnico. É o que se usa para CONFERIR.
 *
 * Só o JSON restaura. O CSV achata jsonb em texto e não volta sozinho — está
 * escrito no LEIA-ME, porque é exatamente o mal-entendido que faria alguém
 * achar que tem back-up quando não tem.
 */

export type Frequencia = "desligado" | "diario" | "semanal" | "mensal";

export interface ConfigBackup {
  frequencia: Frequencia;
  destinatarios: string[];
  dropbox: boolean;
}

export const CONFIG_PADRAO: ConfigBackup = {
  frequencia: "semanal",
  destinatarios: [],
  dropbox: false,
};

/** O que sabemos de uma tabela já lida. */
export interface TabelaCopiada {
  nome: string;
  linhas: Record<string, unknown>[];
}

/* -------------------------------------------------------------------------- */
/*                          quando o automático roda                          */
/* -------------------------------------------------------------------------- */

/**
 * Hoje é dia de back-up?
 *
 * O agendamento bate na função TODO dia; quem decide é isto, lendo a
 * configuração. Assim a Direção troca de semanal para diário na tela, sem que
 * ninguém precise mexer no cron.
 *
 * `ultimo` é a data do último back-up automático que deu certo. A comparação é
 * por DISTÂNCIA, e não por dia da semana: se a função ficou fora do ar na
 * segunda, ela roda na terça, em vez de esperar mais sete dias. Um back-up
 * atrasado é o que se quer; um back-up pulado, não.
 *
 * A folga de 12 horas existe porque o job roda sempre no mesmo horário: sem
 * ela, "faz 7 dias" daria 6 dias e 23 horas e o semanal viraria quinzenal.
 */
export function deveRodarHoje(
  frequencia: Frequencia,
  ultimo: Date | null,
  agora: Date = new Date(),
): boolean {
  if (frequencia === "desligado") return false;
  if (!ultimo) return true;

  const dias = (agora.getTime() - ultimo.getTime()) / 86_400_000;
  const folga = 0.5; // 12 horas
  if (frequencia === "diario") return dias >= 1 - folga;
  if (frequencia === "semanal") return dias >= 7 - folga;
  return dias >= 30 - folga;
}

/* -------------------------------------------------------------------------- */
/*                                  planilha                                  */
/* -------------------------------------------------------------------------- */

/**
 * Uma célula de CSV.
 *
 * Objeto e lista viram JSON dentro da célula: as colunas jsonb do sistema
 * (o contrato da OS, a produção da EC) não têm forma fixa, e espalhá-las em
 * colunas faria cada linha ter um cabeçalho diferente.
 */
function celula(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const texto = typeof valor === "object" ? JSON.stringify(valor) : String(valor);
  // Aspas dobradas e o campo inteiro entre aspas — regra do CSV. Sem isto, um
  // descritivo com ponto-e-vírgula (que é o normal aqui) quebra a linha em duas.
  return `"${texto.replace(/"/g, '""')}"`;
}

/**
 * A planilha de uma tabela.
 *
 * Separador `;` e BOM no começo porque o destino é o Excel em português: com
 * vírgula ele joga a linha inteira numa coluna só, e sem BOM ele lê o UTF-8
 * como se fosse Latin-1 — "Promoções" vira "PromoÃ§Ãµes". Os dois detalhes são
 * a diferença entre um arquivo que a Pólobh abre e um que ela devolve dizendo
 * que veio quebrado.
 */
export function csvDaTabela(linhas: Record<string, unknown>[]): string {
  if (!linhas.length) return "﻿";
  // Nem toda linha do PostgREST traz as mesmas chaves quando há coluna nula;
  // a união de todas garante que nenhuma coluna suma da planilha.
  const colunas = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  const corpo = linhas.map((l) => colunas.map((c) => celula(l[c])).join(";"));
  return `﻿${colunas.join(";")}\n${corpo.join("\n")}\n`;
}

/* -------------------------------------------------------------------------- */
/*                              nomes e tamanhos                              */
/* -------------------------------------------------------------------------- */

/** `backup-polobh-2026-09-25-0300.zip` — ordena sozinho numa pasta. */
export function nomeDoPacote(quando: Date): string {
  const p = (n: number, casas = 2) => String(n).padStart(casas, "0");
  return (
    `backup-polobh-${quando.getUTCFullYear()}-${p(quando.getUTCMonth() + 1)}-${p(quando.getUTCDate())}` +
    `-${p(quando.getUTCHours())}${p(quando.getUTCMinutes())}.zip`
  );
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* -------------------------------------------------------------------------- */
/*                                  LEIA-ME                                   */
/* -------------------------------------------------------------------------- */

export interface ResumoDoPacote {
  quando: Date;
  tabelas: { nome: string; linhas: number }[];
  anexos: number;
  anexosDeFora: string[];
  origem: "manual" | "automatico";
}

/**
 * O bilhete dentro do pacote.
 *
 * Um back-up é aberto, quase sempre, por alguém com pressa e sem contexto —
 * às vezes anos depois, às vezes por uma pessoa que nunca usou o sistema. Este
 * texto existe para essa pessoa: o que é isto, o que tem dentro, o que NÃO tem
 * dentro, e o que fazer com ele.
 */
export function leiaMe(r: ResumoDoPacote): string {
  const data = r.quando.toISOString().slice(0, 16).replace("T", " ");
  const total = r.tabelas.reduce((s, t) => s + t.linhas, 0);
  const lista = r.tabelas.map((t) => `  · ${t.nome} — ${t.linhas} registro(s)`).join("\n");
  const foraDoPacote = r.anexosDeFora.length
    ? `\nARQUIVOS QUE NÃO COUBERAM NESTE PACOTE (${r.anexosDeFora.length}):\n` +
      r.anexosDeFora.map((a) => `  · ${a}`).join("\n") +
      `\nEles continuam no sistema. Para trazê-los, baixe um back-up pela tela\n` +
      `(Configurações › Back-up › "Baixar agora"), que não tem o limite do e-mail.\n`
    : "";

  return `BACK-UP DO APLICATIVO DE GESTÃO — PÓLOBH PROMOÇÕES
====================================================================

Gerado em: ${data} (UTC)
Origem:    ${r.origem === "manual" ? "pedido por uma pessoa, na tela de Configurações" : "automático (agendamento)"}
Conteúdo:  ${r.tabelas.length} tabela(s), ${total} registro(s), ${r.anexos} arquivo(s) anexo(s)

--------------------------------------------------------------------
O QUE É ESTE ARQUIVO
--------------------------------------------------------------------

É uma cópia completa dos dados do sistema, tirada para FORA do servidor.

Ele existe porque o banco de dados do sistema (Supabase) mantém back-up
próprio, mas dentro da mesma conta e por poucos dias. Isso resolve o
acidente do dia a dia — alguém apagou um projeto sem querer — e não
resolve os dois problemas sérios: perder o acesso à conta, e descobrir
um estrago depois que a cópia do servidor já expirou.

Este pacote é a resposta para esses dois. Guarde-o.

--------------------------------------------------------------------
O QUE TEM DENTRO
--------------------------------------------------------------------

/dados      Uma cópia fiel de cada tabela, em JSON.
            É ESTA a cópia que restaura o sistema. Os arquivos estão na
            ordem certa de restauração (o nome começa com um número):
            restaurar fora de ordem esbarra nas ligações entre tabelas.

/planilhas  Os mesmos dados em CSV, para abrir no Excel e conferir.
            NÃO servem para restaurar: as colunas mais ricas do sistema
            viram texto aqui. Servem para ler, imprimir e auditar.

/anexos     Os arquivos que as pessoas subiram no sistema (anexos de
            tarefas e de chamados), com a mesma organização de pastas.

manifesto.json   A ficha técnica: data, contagem por tabela e a lista de
                 arquivos. Serve para conferir se o pacote veio inteiro.

--------------------------------------------------------------------
O QUE NÃO TEM DENTRO
--------------------------------------------------------------------

  · SENHAS. Nenhuma. As senhas não ficam no sistema nem em forma
    embaralhada — quem guarda é o serviço de autenticação. Numa
    restauração, cada pessoa recebe um convite para criar a sua.

  · Os usuários em si (quem pode entrar). O cadastro de PERFIS está aqui
    (nome, área, permissão), mas recriar o acesso é um passo à parte.

  · O histórico de versões do banco. Este é um retrato de um instante,
    não uma linha do tempo.

--------------------------------------------------------------------
TABELAS NESTE PACOTE
--------------------------------------------------------------------

${lista}
${foraDoPacote}
--------------------------------------------------------------------
COMO GUARDAR
--------------------------------------------------------------------

A regra que funciona é a do 3-2-1: três cópias, em dois lugares
diferentes, sendo uma fora do escritório. Na prática, para a Pólobh:

  1. a do próprio Supabase (automática, já existe);
  2. a pasta do Dropbox/Drive que recebe estes pacotes;
  3. uma cópia por mês num HD ou pen drive que fica fora da rede.

Não apague os pacotes antigos assim que chegar um novo. Um erro de
digitação descoberto três meses depois só tem conserto se existir um
pacote de três meses atrás.

--------------------------------------------------------------------
COMO RESTAURAR
--------------------------------------------------------------------

Restauração é trabalho técnico e não deve ser tentada às pressas.
Chame o suporte do sistema e entregue este arquivo. O caminho é:

  1. criar um banco novo e aplicar a estrutura (as migrações do
     sistema, que ficam no repositório do código);
  2. carregar os arquivos de /dados na ordem numérica dos nomes;
  3. subir /anexos de volta para o armazenamento;
  4. reconvidar os usuários.

====================================================================
Mensagem automática do sistema Pólobh — Gestão de Projetos.
`;
}

/* -------------------------------------------------------------------------- */
/*                                 manifesto                                  */
/* -------------------------------------------------------------------------- */

export function manifesto(r: ResumoDoPacote, arquivos: { nome: string; bytes: number }[]) {
  return {
    sistema: "Aplicativo Gestão Pólobh",
    versaoDoPacote: 1,
    geradoEm: r.quando.toISOString(),
    origem: r.origem,
    tabelas: Object.fromEntries(r.tabelas.map((t) => [t.nome, t.linhas])),
    anexos: r.anexos,
    anexosDeFora: r.anexosDeFora,
    arquivos,
  };
}

/** O nome de `dados/`, com a ordem de restauração na frente. */
export const nomeDeDados = (ordem: number, tabela: string): string =>
  `dados/${String(ordem).padStart(2, "0")}-${tabela}.json`;
