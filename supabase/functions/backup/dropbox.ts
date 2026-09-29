/**
 * Sobe o pacote de back-up para uma pasta do Dropbox da Pólobh.
 *
 * POR QUE REFRESH TOKEN, E NÃO O TOKEN QUE O PAINEL MOSTRA
 *
 * O Dropbox oferece, na tela de criar o aplicativo, um "generated access token"
 * que funciona na hora. Ele dura QUATRO HORAS. Um back-up automático apoiado
 * nesse token pararia de subir na mesma tarde, em silêncio — e ninguém repara
 * que um back-up parou até precisar dele. Por isso aqui é o fluxo de refresh
 * token, que não expira: a cada envio, troca-se o refresh por um access token
 * novo, e sobe-se com ele.
 *
 * Segredos (no Supabase, em Edge Functions › Secrets):
 *   DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN
 *   DROPBOX_PASTA      (opcional — padrão "/Back-up Sistema Pólobh")
 *
 * Como obter os três: ver o README, seção "Back-up".
 */

export interface ResultadoDropbox {
  ok: boolean;
  caminho?: string;
  erro?: string;
}

export function dropboxConfigurado(): boolean {
  return Boolean(
    Deno.env.get("DROPBOX_APP_KEY") &&
      Deno.env.get("DROPBOX_APP_SECRET") &&
      Deno.env.get("DROPBOX_REFRESH_TOKEN"),
  );
}

async function tokenDeAcesso(): Promise<string> {
  const chave = Deno.env.get("DROPBOX_APP_KEY")!;
  const segredo = Deno.env.get("DROPBOX_APP_SECRET")!;
  const refresh = Deno.env.get("DROPBOX_REFRESH_TOKEN")!;

  const resp = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${chave}:${segredo}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
  });
  if (!resp.ok) throw new Error(`Dropbox recusou a credencial (${resp.status}): ${await resp.text()}`);
  const { access_token } = (await resp.json()) as { access_token?: string };
  if (!access_token) throw new Error("Dropbox não devolveu o token de acesso.");
  return access_token;
}

/**
 * Sobe o pacote. `autorename` ligado: se por qualquer motivo dois back-ups
 * saírem com o mesmo nome, o Dropbox guarda os dois em vez de sobrescrever —
 * num back-up, perder o arquivo antigo é pior do que ter um nome feio.
 */
export async function subirParaDropbox(nome: string, dados: Uint8Array): Promise<ResultadoDropbox> {
  if (!dropboxConfigurado()) {
    return { ok: false, erro: "Dropbox não configurado (faltam os segredos DROPBOX_*)." };
  }
  try {
    const token = await tokenDeAcesso();
    const pasta = (Deno.env.get("DROPBOX_PASTA") ?? "/Back-up Sistema Pólobh").replace(/\/+$/, "");
    const caminho = `${pasta}/${nome}`;

    const resp = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // O cabeçalho só aceita ASCII: o JSON vai com os acentos escapados.
        "Dropbox-API-Arg": JSON.stringify({ path: caminho, mode: "add", autorename: true, mute: true })
          .replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`),
        "Content-Type": "application/octet-stream",
      },
      body: dados,
    });
    if (!resp.ok) return { ok: false, erro: `Dropbox ${resp.status}: ${await resp.text()}` };
    const { path_display } = (await resp.json()) as { path_display?: string };
    return { ok: true, caminho: path_display ?? caminho };
  } catch (e) {
    return { ok: false, erro: String((e as Error).message) };
  }
}
