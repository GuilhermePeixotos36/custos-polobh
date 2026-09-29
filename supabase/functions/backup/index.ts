import { autorizar, respostaAutorizacao, type Papel } from "../_shared/auth.ts";
import { enviarPeloBrevo } from "../_shared/brevo.ts";
import { subirParaDropbox, dropboxConfigurado } from "./dropbox.ts";
import { montarZip, type ArquivoZip } from "./zip.ts";
import {
  CONFIG_PADRAO,
  csvDaTabela,
  deveRodarHoje,
  formatarTamanho,
  leiaMe,
  manifesto,
  nomeDeDados,
  nomeDoPacote,
  type ConfigBackup,
} from "./pacote.ts";

/**
 * Edge Function: backup — a cópia dos dados que sai do servidor.
 *
 * O Supabase guarda back-up próprio, e o plano gratuito guarda por poucos dias,
 * dentro da mesma conta. Isso cobre o acidente do dia a dia e não cobre perder
 * a conta nem descobrir um estrago tarde demais. Esta função é o que supre a
 * diferença: monta um .zip com tudo e o coloca na mão da Pólobh — por e-mail,
 * numa pasta do Dropbox, ou no download direto da tela.
 *
 * Três formas de chamar, e é de propósito que sejam a mesma função: o pacote
 * precisa ser idêntico nos três casos. Um back-up "de teste" diferente do
 * back-up automático não testa nada.
 *
 *   { acao: "baixar" }    → devolve o pacote em base64, para o navegador salvar
 *   { acao: "enviar" }    → gera e manda agora (e-mail + Dropbox)
 *   { acao: "agendado" }  → o cron; só roda se a frequência mandar
 *
 * QUEM PODE: Admin e Direção com sessão, ou o agendamento com `x-cron-secret`.
 * Não é a mesma régua da tela de Configurações (que inclui o Administrativo):
 * o pacote leva a base inteira, inclusive o financeiro — quem o tira é quem
 * responde pela casa.
 *
 * Deploy: supabase functions deploy backup
 */

const QUEM_TIRA_BACKUP: Papel[] = ["Admin", "Direcao"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/**
 * Orçamento de anexos dentro do pacote (25 MB de arquivos originais).
 *
 * Existe porque o back-up roda na memória de uma Edge Function: sem teto, o dia
 * em que a casa subir muitos arquivos é o dia em que o back-up passa a falhar —
 * e a falha apareceria justamente quando há mais dado a proteger. Com teto, ele
 * sai sempre; o que não coube fica listado no LEIA-ME e no manifesto, com nome
 * e caminho, em vez de sumir calado.
 */
const ORCAMENTO_ANEXOS = 25 * 1024 * 1024;

/** Acima disto o Brevo recusa a mensagem; o pacote vai pelo Dropbox/download. */
const LIMITE_ANEXO_EMAIL_BASE64 = 7_000_000;

const PAGINA = 1000;

/* -------------------------------------------------------------------------- */
/*                          conversa com o banco                              */
/* -------------------------------------------------------------------------- */

const url = () => Deno.env.get("SUPABASE_URL")!;
const chave = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cabecalhos = () => ({
  apikey: chave(),
  Authorization: `Bearer ${chave()}`,
  "Content-Type": "application/json",
});

async function rpc<T>(nome: string): Promise<T> {
  const r = await fetch(`${url()}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: cabecalhos(),
    body: "{}",
  });
  if (!r.ok) throw new Error(`${nome}: ${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

/**
 * Lê uma tabela inteira, de mil em mil.
 *
 * O PostgREST corta a resposta num teto próprio, e sem paginação o back-up de
 * uma tabela grande sairia truncado — o pior defeito possível aqui, porque o
 * arquivo existe, abre, e só está incompleto.
 */
async function lerTabela(tabela: string): Promise<Record<string, unknown>[]> {
  const linhas: Record<string, unknown>[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const r = await fetch(`${url()}/rest/v1/${tabela}?select=*`, {
      headers: { ...cabecalhos(), Range: `${inicio}-${inicio + PAGINA - 1}` },
    });
    if (!r.ok) throw new Error(`Tabela ${tabela}: ${r.status} ${await r.text()}`);
    const pagina = (await r.json()) as Record<string, unknown>[];
    linhas.push(...pagina);
    if (pagina.length < PAGINA) return linhas;
  }
}

async function baixarAnexo(balde: string, caminho: string): Promise<Uint8Array | null> {
  const r = await fetch(`${url()}/storage/v1/object/${balde}/${encodeURI(caminho)}`, {
    headers: { apikey: chave(), Authorization: `Bearer ${chave()}` },
  });
  if (!r.ok) return null;
  return new Uint8Array(await r.arrayBuffer());
}

async function lerConfig(): Promise<ConfigBackup> {
  try {
    const r = await fetch(`${url()}/rest/v1/config_app?chave=eq.backup&select=valor`, { headers: cabecalhos() });
    const [linha] = ((await r.json()) ?? []) as { valor?: Partial<ConfigBackup> }[];
    return { ...CONFIG_PADRAO, ...(linha?.valor ?? {}) };
  } catch {
    return CONFIG_PADRAO;
  }
}

/** Quando o último back-up AUTOMÁTICO deu certo. É o que decide se hoje é dia. */
async function ultimoAutomatico(): Promise<Date | null> {
  try {
    const r = await fetch(
      `${url()}/rest/v1/backups?origem=eq.automatico&status=neq.erro&select=criado_em&order=criado_em.desc&limit=1`,
      { headers: cabecalhos() },
    );
    const [linha] = ((await r.json()) ?? []) as { criado_em?: string }[];
    return linha?.criado_em ? new Date(linha.criado_em) : null;
  } catch {
    return null;
  }
}

async function registrar(linha: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${url()}/rest/v1/backups`, {
      method: "POST",
      headers: { ...cabecalhos(), Prefer: "return=minimal" },
      body: JSON.stringify(linha),
    });
  } catch (_) {
    // O histórico não pode derrubar o back-up: o pacote já existe, e perdê-lo
    // por causa de uma linha de log seria trocar o essencial pelo acessório.
  }
}

/* -------------------------------------------------------------------------- */
/*                             montar o pacote                                */
/* -------------------------------------------------------------------------- */

interface Pacote {
  nome: string;
  bytes: Uint8Array;
  tabelas: { nome: string; linhas: number }[];
  anexos: number;
  anexosDeFora: string[];
}

async function montarPacote(origem: "manual" | "automatico"): Promise<Pacote> {
  const quando = new Date();
  const arquivos: ArquivoZip[] = [];
  const texto = new TextEncoder();

  // --- as tabelas, na ordem em que se restaura ---
  const lista = await rpc<{ tabela: string; ordem: number }[]>("backup_tabelas");
  const tabelas: { nome: string; linhas: number }[] = [];

  for (let i = 0; i < lista.length; i++) {
    const { tabela } = lista[i];
    const linhas = await lerTabela(tabela);
    tabelas.push({ nome: tabela, linhas: linhas.length });
    // O número no nome é a ORDEM DE RESTAURAÇÃO, não a posição no catálogo:
    // quem for restaurar carrega na ordem alfabética dos arquivos e acerta.
    arquivos.push({ nome: nomeDeDados(i + 1, tabela), dados: texto.encode(JSON.stringify(linhas, null, 1)) });
    arquivos.push({ nome: `planilhas/${tabela}.csv`, dados: texto.encode(csvDaTabela(linhas)) });
  }

  // --- os arquivos que as pessoas subiram ---
  const inventario = await rpc<{ balde: string; caminho: string; tamanho: number }[]>("backup_anexos");
  const anexosDeFora: string[] = [];
  let gastos = 0;
  let anexos = 0;

  for (const item of inventario) {
    if (gastos + item.tamanho > ORCAMENTO_ANEXOS) {
      anexosDeFora.push(`${item.balde}/${item.caminho}`);
      continue;
    }
    const dados = await baixarAnexo(item.balde, item.caminho);
    if (!dados) {
      anexosDeFora.push(`${item.balde}/${item.caminho} (não foi possível baixar)`);
      continue;
    }
    arquivos.push({ nome: `anexos/${item.balde}/${item.caminho}`, dados });
    gastos += dados.length;
    anexos++;
  }

  // --- o bilhete e a ficha técnica ---
  const resumo = { quando, tabelas, anexos, anexosDeFora, origem };
  arquivos.push({ nome: "LEIA-ME.txt", dados: texto.encode(leiaMe(resumo)) });
  arquivos.push({
    nome: "manifesto.json",
    dados: texto.encode(
      JSON.stringify(manifesto(resumo, arquivos.map((a) => ({ nome: a.nome, bytes: a.dados.length }))), null, 2),
    ),
  });

  return { nome: nomeDoPacote(quando), bytes: await montarZip(arquivos, quando), tabelas, anexos, anexosDeFora };
}

/** Uint8Array → base64, aos pedaços (`String.fromCharCode(...tudo)` estoura a pilha). */
function base64(dados: Uint8Array): string {
  let s = "";
  for (let i = 0; i < dados.length; i += 0x8000) {
    s += String.fromCharCode(...dados.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

/* -------------------------------------------------------------------------- */
/*                                  entrega                                   */
/* -------------------------------------------------------------------------- */

const h = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function corpoDoEmail(p: Pacote, anexado: boolean, dropbox: string | null): string {
  const total = p.tabelas.reduce((s, t) => s + t.linhas, 0);
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#15161A;max-width:560px;margin:0 auto">
    <div style="padding:18px 0;border-bottom:2px solid #F2820D">
      <span style="font-size:20px;font-weight:800;letter-spacing:-.5px">
        <span style="color:#6A6E78">polo</span><span style="color:#E36F0A">bh</span>
      </span>
      <span style="color:#A0A4AC;font-size:12px;margin-left:8px">Pólobh Promoções</span>
    </div>
    <h2 style="font-size:18px;margin:22px 0 12px">Back-up do sistema — ${h(p.nome)}</h2>
    <p style="font-size:14px">Segue a cópia dos dados do Aplicativo Gestão, tirada em
      ${h(new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))}.</p>
    <ul style="font-size:14px;line-height:1.7">
      <li><b>${p.tabelas.length}</b> tabelas, <b>${total}</b> registros</li>
      <li><b>${p.anexos}</b> arquivo(s) anexo(s)</li>
      <li>Tamanho do pacote: <b>${h(formatarTamanho(p.bytes.length))}</b></li>
    </ul>
    ${
      anexado
        ? `<p style="font-size:14px">O pacote está <b>anexado a esta mensagem</b>. Guarde-o: dentro dele há um
             arquivo <b>LEIA-ME.txt</b> explicando o que tem, o que não tem e como restaurar.</p>`
        : `<p style="font-size:14px;background:#FFF6EC;border-left:3px solid #F2820D;padding:10px 12px">
             O pacote ficou <b>grande demais para ir por e-mail</b> (${h(formatarTamanho(p.bytes.length))}).
             ${
               dropbox
                 ? "Ele foi salvo no Dropbox, no caminho indicado abaixo."
                 : "Baixe-o pelo próprio sistema, em <b>Configurações › Back-up › Baixar agora</b>."
             }</p>`
    }
    ${dropbox ? `<p style="font-size:13px;color:#6A6E78">No Dropbox: <b>${h(dropbox)}</b></p>` : ""}
    ${
      p.anexosDeFora.length
        ? `<p style="font-size:13px;color:#6A6E78">${p.anexosDeFora.length} arquivo(s) anexo(s) não couberam
             neste pacote e estão listados no LEIA-ME. Eles continuam no sistema.</p>`
        : ""
    }
    <p style="color:#A0A4AC;font-size:12px;margin-top:28px;border-top:1px solid #EEEFF2;padding-top:12px">
      Mensagem automática do sistema Pólobh — Gestão de Projetos.
    </p>
  </div>`;
}

interface Entrega {
  destinos: string[];
  erros: string[];
}

async function entregar(p: Pacote, config: ConfigBackup): Promise<Entrega> {
  const destinos: string[] = [];
  const erros: string[] = [];

  // Dropbox primeiro: se o pacote for grande demais para o e-mail, a mensagem
  // precisa saber dizer onde ele foi parar.
  let caminhoDropbox: string | null = null;
  if (config.dropbox) {
    const r = await subirParaDropbox(p.nome, p.bytes);
    if (r.ok) {
      caminhoDropbox = r.caminho ?? null;
      destinos.push("dropbox");
    } else {
      erros.push(`Dropbox: ${r.erro}`);
    }
  }

  if (config.destinatarios.length) {
    const conteudo = base64(p.bytes);
    const anexado = conteudo.length <= LIMITE_ANEXO_EMAIL_BASE64;
    try {
      await enviarPeloBrevo({
        para: config.destinatarios.map((email) => ({ email })),
        assunto: `Back-up do sistema — ${p.nome}`,
        html: corpoDoEmail(p, anexado, caminhoDropbox),
        anexos: anexado ? [{ nome: p.nome, conteudoBase64: conteudo }] : undefined,
      });
      destinos.push(anexado ? "email" : "email (sem anexo)");
    } catch (e) {
      erros.push(`E-mail: ${String((e as Error).message)}`);
    }
  }

  return { destinos, erros };
}

/* -------------------------------------------------------------------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, erro: "Method not allowed" }, 405);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // Corpo vazio é chamada do agendamento antigo; segue como "agendado".
  }
  const acao = String(body.acao ?? "agendado");

  // O agendamento não tem sessão: quem prova quem é são o segredo do cron e a
  // ação, que fica restrita a "agendado". Um segredo vazado não vira, com isso,
  // um jeito de alguém de fora mandar a base da casa para o próprio e-mail.
  const segredoCron = Deno.env.get("CRON_SECRET") ?? "";
  const doCron = Boolean(segredoCron) && req.headers.get("x-cron-secret") === segredoCron;

  let quemPediu = "agendamento";
  if (!doCron) {
    try {
      const quem = await autorizar(req, QUEM_TIRA_BACKUP);
      quemPediu = quem.id;
    } catch (erro) {
      return respostaAutorizacao(erro, cors) ?? json({ ok: false, erro: "Falha ao validar a sessão." }, 500);
    }
  } else if (acao !== "agendado") {
    return json({ ok: false, erro: "O agendamento só executa a ação agendada." }, 403);
  }

  const config = await lerConfig();

  if (acao === "agendado") {
    if (!deveRodarHoje(config.frequencia, await ultimoAutomatico())) {
      // 200, e não erro: não é falha nenhuma — é o dia errado.
      return json({ ok: true, executado: false, motivo: "Hoje não é dia de back-up." });
    }
  }

  const origem: "manual" | "automatico" = acao === "agendado" ? "automatico" : "manual";

  let pacote: Pacote;
  try {
    pacote = await montarPacote(origem);
  } catch (e) {
    const erro = String((e as Error).message);
    console.error(`backup: falha ao montar o pacote — ${erro}`);
    await registrar({ origem, status: "erro", erro, solicitado_por: quemPediu });
    return json({ ok: false, erro }, 500);
  }

  const contagem = Object.fromEntries(pacote.tabelas.map((t) => [t.nome, t.linhas]));

  // "baixar" não entrega em lugar nenhum: o pacote vai no corpo da resposta e
  // quem salva é o navegador. Continua no histórico, porque uma cópia da base
  // saindo do servidor é um evento que precisa ficar registrado.
  if (acao === "baixar") {
    await registrar({
      origem,
      destinos: ["download"],
      arquivo: pacote.nome,
      tamanho_bytes: pacote.bytes.length,
      tabelas: contagem,
      anexos: pacote.anexos,
      status: pacote.anexosDeFora.length ? "parcial" : "concluido",
      solicitado_por: quemPediu,
    });
    return json({
      ok: true,
      nome: pacote.nome,
      zipBase64: base64(pacote.bytes),
      tamanho: pacote.bytes.length,
      tabelas: contagem,
      anexos: pacote.anexos,
      anexosDeFora: pacote.anexosDeFora,
    });
  }

  const { destinos, erros } = await entregar(pacote, config);

  // Nenhum destino configurado e ninguém para receber: dizer isso é mais útil
  // do que gravar um "concluído" que não entregou nada a ninguém.
  const semDestino = !config.destinatarios.length && !config.dropbox;
  const status = erros.length ? (destinos.length ? "parcial" : "erro") : semDestino ? "parcial" : "concluido";
  const erro = semDestino && !erros.length
    ? "Back-up gerado, mas sem destino configurado (nenhum e-mail e Dropbox desligado)."
    : erros.join(" · ") || null;

  await registrar({
    origem,
    destinos,
    arquivo: pacote.nome,
    tamanho_bytes: pacote.bytes.length,
    tabelas: contagem,
    anexos: pacote.anexos,
    status,
    erro,
    solicitado_por: quemPediu,
  });

  if (erro) console.error(`backup: ${pacote.nome} — ${erro}`);

  return json({
    ok: status !== "erro",
    executado: true,
    nome: pacote.nome,
    tamanho: pacote.bytes.length,
    destinos,
    status,
    erro,
    dropboxConfigurado: dropboxConfigurado(),
  });
});
