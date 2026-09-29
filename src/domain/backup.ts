/**
 * O back-up, do lado da tela: quem pode tirar, com que frequência, e se o
 * último está velho demais.
 *
 * A decisão de SE hoje é dia de rodar mora do outro lado, na Edge Function
 * (`supabase/functions/backup/pacote.ts`), porque é lá que ela é tomada. Aqui a
 * pergunta é outra e mais útil para quem olha: "o que existe hoje me protege?".
 * Um sistema que diz "back-up: semanal" e está há 40 dias sem gerar um é pior
 * do que um que não promete nada — por isso a tela calcula o atraso em vez de
 * repetir a configuração.
 */

export type Frequencia = "desligado" | "diario" | "semanal" | "mensal";

export interface ConfigBackup {
  frequencia: Frequencia;
  destinatarios: string[];
  dropbox: boolean;
}

export const CONFIG_BACKUP_PADRAO: ConfigBackup = {
  frequencia: "semanal",
  destinatarios: [],
  dropbox: false,
};

/** Quem tira uma cópia da base inteira. Mais estreito que Configurações. */
export const PAPEIS_QUE_TIRAM_BACKUP = ["Admin", "Direcao"] as const;

export const podeTirarBackup = (papel: string | undefined): boolean =>
  PAPEIS_QUE_TIRAM_BACKUP.includes(papel as (typeof PAPEIS_QUE_TIRAM_BACKUP)[number]);

/** De quantos em quantos dias cada frequência gera um pacote. */
export const DIAS_DA_FREQUENCIA: Record<Frequencia, number> = {
  desligado: 0,
  diario: 1,
  semanal: 7,
  mensal: 30,
};

export const OPCOES_FREQUENCIA: { valor: Frequencia; rotulo: string; ajuda: string }[] = [
  {
    valor: "desligado",
    rotulo: "Desligado",
    ajuda: "Nenhum back-up automático. A cópia só sai quando alguém clicar.",
  },
  {
    valor: "diario",
    rotulo: "Todo dia",
    ajuda: "Uma cópia por dia, de madrugada. Indicado quando se lança muita coisa por semana.",
  },
  {
    valor: "semanal",
    rotulo: "Toda semana",
    ajuda: "Uma cópia por semana. É o padrão, e atende bem o ritmo da casa.",
  },
  {
    valor: "mensal",
    rotulo: "Todo mês",
    ajuda: "Uma cópia por mês. O mínimo aceitável — um mês de trabalho é muito para se perder.",
  },
];

export const rotuloFrequencia = (f: Frequencia): string =>
  OPCOES_FREQUENCIA.find((o) => o.valor === f)?.rotulo ?? f;

/* -------------------------------------------------------------------------- */
/*                          o último back-up está bom?                        */
/* -------------------------------------------------------------------------- */

export type Situacao = "desligado" | "nunca" | "em dia" | "atrasado";

/**
 * Como está a proteção hoje.
 *
 * "Atrasado" começa em DOBRO do intervalo, não no intervalo: o job roda de
 * madrugada, e marcar de vermelho um back-up semanal com 7 dias e 3 horas faria
 * a tela gritar toda semana por nada. Quem grita sempre não é ouvido quando
 * precisa.
 */
export function situacaoDoBackup(
  frequencia: Frequencia,
  ultimo: Date | null,
  agora: Date = new Date(),
): Situacao {
  if (frequencia === "desligado") return "desligado";
  if (!ultimo) return "nunca";
  const dias = (agora.getTime() - ultimo.getTime()) / 86_400_000;
  return dias > DIAS_DA_FREQUENCIA[frequencia] * 2 ? "atrasado" : "em dia";
}

/** "hoje", "ontem", "há 3 dias" — o jeito como a pessoa pensa em datas. */
export function haQuantoTempo(quando: Date, agora: Date = new Date()): string {
  const dias = Math.floor((agora.getTime() - quando.getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
}

/* -------------------------------------------------------------------------- */
/*                              os destinatários                              */
/* -------------------------------------------------------------------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Lê a caixa de destinatários, que aceita vírgula, ponto-e-vírgula ou uma linha
 * por endereço — porque é assim que as pessoas colam uma lista.
 *
 * Os inválidos voltam SEPARADOS, em vez de serem descartados em silêncio: um
 * endereço com erro de digitação some da lista e o back-up passa meses indo
 * para uma pessoa a menos sem ninguém notar.
 */
export function lerDestinatarios(texto: string): { validos: string[]; invalidos: string[] } {
  const pedacos = (texto ?? "")
    .split(/[\s,;]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const validos: string[] = [];
  const invalidos: string[] = [];
  for (const p of pedacos) {
    if (EMAIL_RE.test(p)) {
      if (!validos.includes(p)) validos.push(p);
    } else if (!invalidos.includes(p)) {
      invalidos.push(p);
    }
  }
  return { validos, invalidos };
}

/**
 * Tamanho em bytes, legível.
 *
 * Há uma gêmea em `supabase/functions/backup/pacote.ts` — mesmo arranjo dos
 * textos de e-mail: uma roda em Deno, outra no navegador. Se mudar o formato,
 * mude nas duas.
 */
export function formatarTamanho(bytes: number | null | undefined): string {
  const n = bytes ?? 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
