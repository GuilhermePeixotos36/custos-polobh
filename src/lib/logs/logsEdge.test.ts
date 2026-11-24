// O helper das Edge Functions (`supabase/functions/_shared/log.ts`) não usa nada do Deno na carga:
// o vitest do app o importa direto. Este arquivo também amarra as listas que moram em dois lugares
// (Edge × migration, front × migration): acrescentar um nome num lado só quebra o teste.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CHAVES_CONTEM, CHAVES_EXATAS, CHAVES_PROIBIDAS, chaveProibida, comRegistroDeErros, cortar, ipDaRequisicao, linhaDoLog,
  mascararEmail, mascararMensagem, motivoDaResposta, registrarErroDaEdge, registrarLog, sanearDetalhe, telaSemQuery,
  type ClienteDeLog,
} from "../../../supabase/functions/_shared/log";
import { ACOES_DO_APP } from "./registrarLog";

const MIGRATION = readFileSync(
  // O vitest roda na raiz do repositório (o jsdom não dá um import.meta.url de arquivo).
  resolve(process.cwd(), "supabase/migrations/20261124120000_logs_padrao.sql"),
  "utf8",
);

function arrayDaMigration(nome: string): string[] {
  const achado = new RegExp(`${nome}\\s+constant\\s+text\\[\\]\\s*:=\\s*array\\[([^\\]]*)\\]`).exec(MIGRATION);
  if (!achado) throw new Error(`lista ${nome} não encontrada na migration`);
  return [...achado[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const req = (cabecalhos: Record<string, string>) => new Request("https://exemplo.test/x", { headers: cabecalhos });

describe("saneamento", () => {
  it("cortar: corta no tamanho e troca caractere de controle por espaço; não-texto vira vazio", () => {
    expect(cortar("ab\ncd\u0007", 4)).toBe("ab c");
    expect(cortar(42, 10)).toBe("");
  });

  it("telaSemQuery tira query string e fragmento", () => {
    expect(telaSemQuery("/projetos?token=x#y")).toBe("/projetos");
  });

  it("mascararEmail: duas letras e o domínio; sem arroba vira ***", () => {
    expect(mascararEmail("Fulano@Exemplo.com.br")).toBe("fu***@exemplo.com.br");
    expect(mascararEmail("sem-arroba")).toBe("***");
  });

  it("sanearDetalhe remove as chaves proibidas sem caixa, em qualquer nível; só aceita objeto; corta acima de 4 KB", () => {
    expect(sanearDetalhe({ senhaNova: "x", a: { CPF: "1", lista: [{ token: "t", ok: 1 }] }, ok: true })).toEqual({ a: { lista: [{ ok: 1 }] }, ok: true });
    expect(sanearDetalhe([1, 2])).toBeNull();
    expect(sanearDetalhe("x")).toBeNull();
    expect(sanearDetalhe({ x: "a".repeat(5000) })).toEqual({ cortado: true });
  });

  it("percorre CHAVES_PROIBIDAS inteira", () => {
    const objeto = Object.fromEntries(CHAVES_PROIBIDAS.map((c) => [c, "x"]));
    expect(sanearDetalhe({ ...objeto, fica: 1 })).toEqual({ fica: 1 });
  });

  it("chaveProibida pega variações por contém e poupa palavra comum", () => {
    for (const c of ["senhaNova", "x_token", "cpfDoCliente", "cnpjFornecedor", "numeroDocumento", "PIX", "chave_pix"]) expect(chaveProibida(c)).toBe(true);
    for (const c of ["contato", "descricao", "bancada", "pixel", "contagem"]) expect(chaveProibida(c)).toBe(false);
  });

  it("mascararMensagem: CPF com ou sem pontuação e o valor de Key (coluna)=(valor)", () => {
    expect(mascararMensagem("doc 123.456.789-09 e 12345678909")).toBe("doc *** e ***");
    expect(mascararMensagem("Key (email)=(a@b.com) already exists")).toBe("Key (email)=(***) already exists");
  });

  it("ipDaRequisicao: cf-connecting-ip; senão a ÚLTIMA entrada do x-forwarded-for; só se parecer IP", () => {
    expect(ipDaRequisicao(req({ "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "1.2.3.4" }))).toBe("198.51.100.7");
    expect(ipDaRequisicao(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(ipDaRequisicao(req({ "x-forwarded-for": "nao-e-ip" }))).toBeNull();
    expect(ipDaRequisicao(null)).toBeNull();
  });

  it("linhaDoLog descarta ação fora do padrão e categoria desconhecida; usa os padrões; mascara a mensagem", () => {
    expect(linhaDoLog({ categoria: "erro", acao: "Ação Inválida" }, null)).toBeNull();
    expect(linhaDoLog({ categoria: "x" as "erro", acao: "erro_edge" }, null)).toBeNull();
    const linha = linhaDoLog({ categoria: "erro", acao: "erro_edge", mensagem: "cpf 123.456.789-09", tela: "edge/x?y=1" }, null);
    expect(linha).toMatchObject({ nivel: "info", resultado: "ok", origem: "edge", mensagem: "cpf ***", tela: "edge/x", ator_id: null });
  });
});

describe("gravação", () => {
  function clienteFalso(resultado: { error: unknown } | "lanca" = { error: null }) {
    const inseridos: { tabela: string; valor: unknown }[] = [];
    const cliente: ClienteDeLog = {
      from: (tabela) => ({
        insert: (valor) => {
          if (resultado === "lanca") throw new Error("rede");
          inseridos.push({ tabela, valor });
          return Promise.resolve(resultado);
        },
      }),
    };
    return { cliente, inseridos };
  }

  it("registrarLog insere em log_evento; falha do insert e cliente que lança não propagam", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ok = clienteFalso();
    await registrarLog(ok.cliente, null, { categoria: "erro", acao: "erro_edge" });
    expect(ok.inseridos[0].tabela).toBe("log_evento");
    await expect(registrarLog(clienteFalso({ error: { message: "x" } }).cliente, null, { categoria: "erro", acao: "erro_edge" })).resolves.toBeUndefined();
    await expect(registrarLog(clienteFalso("lanca").cliente, null, { categoria: "erro", acao: "erro_edge" })).resolves.toBeUndefined();
    await expect(registrarErroDaEdge(clienteFalso("lanca").cliente, null, "f", new Error("x"))).resolves.toBeUndefined();
    espiao.mockRestore();
  });

  it("motivoDaResposta lê `erro`/`error` de uma cópia e deixa o corpo original intacto", async () => {
    const resposta = new Response(JSON.stringify({ ok: false, erro: "Dropbox recusou o arquivo (500)." }), { status: 502 });
    expect(await motivoDaResposta(resposta)).toBe("Dropbox recusou o arquivo (500).");
    expect(await resposta.json()).toMatchObject({ erro: "Dropbox recusou o arquivo (500)." });
    expect(await motivoDaResposta(new Response("texto cru", { status: 500 }))).toBe("texto cru");
  });

  it("comRegistroDeErros: exceção solta vira 500 genérico; resposta < 500 passa sem mexer", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const quebrada = comRegistroDeErros("teste", () => { throw new Error("boom"); });
    const r = await quebrada(req({}));
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ ok: false, erro: "Não foi possível concluir a operação." });
    const normal = comRegistroDeErros("teste", () => new Response("ok", { status: 200 }));
    expect(await (await normal(req({}))).text()).toBe("ok");
    const erro502 = comRegistroDeErros("teste", () => new Response(JSON.stringify({ erro: "x" }), { status: 502 }));
    const r502 = await erro502(req({}));
    expect(r502.status).toBe(502);
    expect(await r502.json()).toEqual({ erro: "x" });
    espiao.mockRestore();
  });
});

describe("listas que moram em dois lugares", () => {
  it("chaves proibidas: Edge = migration", () => {
    expect([...CHAVES_CONTEM].sort()).toEqual(arrayDaMigration("v_contem").sort());
    expect([...CHAVES_EXATAS].sort()).toEqual(arrayDaMigration("v_exatas").sort());
  });

  it("as seis ações do front = as de registrar_log no banco", () => {
    const corpo = /create or replace function public\.registrar_log\(p jsonb\)[\s\S]*?\$\$;/.exec(MIGRATION)?.[0] ?? "";
    const doBanco = [...corpo.matchAll(/when '([a-z_]+)' then '(?:acesso|erro|atividade)'/g)].map((m) => m[1]);
    expect(doBanco.sort()).toEqual([...ACOES_DO_APP].sort());
  });

  it("nenhum escape unicode no helper das Edges (a publicação por MCP reescreve e quebra a regex)", () => {
    const helper = readFileSync(resolve(process.cwd(), "supabase/functions/_shared/log.ts"), "utf8");
    expect(helper.includes("\\" + "u")).toBe(false);
  });
});

describe("ajustes da revisão de segurança", () => {
  it("mascara CNPJ, e-mail e o valor de Key com índice de expressão", () => {
    expect(mascararMensagem("cnpj 12.345.678/0001-90 e 12345678000190")).toBe("cnpj *** e ***");
    expect(mascararMensagem("falha para fulano@exemplo.com.br")).toBe("falha para ***");
    expect(mascararMensagem("Key (lower(email))=(x@y.com) already exists")).toBe("Key (lower(email))=(***) already exists");
  });

  it("o valor de texto do detalhe também passa pela máscara (a pilha repete a mensagem)", () => {
    expect(sanearDetalhe({ pilha: "Error: cpf 123.456.789-09\n  at x" })).toEqual({ pilha: "Error: cpf ***\n  at x" });
  });

  it("mascararEmail não deixa texto livre no lugar do domínio", () => {
    expect(mascararEmail("ab@ATENÇÃO ligue para 0800")).toBe("***");
  });

  it("IP só se for IP de verdade; invisíveis de formatação viram espaço", () => {
    expect(ipDaRequisicao(req({ "x-forwarded-for": "1.2.3" }))).toBeNull();
    expect(ipDaRequisicao(req({ "x-forwarded-for": "999.1.1.1" }))).toBeNull();
    expect(ipDaRequisicao(req({ "x-forwarded-for": "abc" }))).toBeNull();
    expect(ipDaRequisicao(req({ "cf-connecting-ip": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(cortar("a" + String.fromCharCode(0x202e) + "b", 10)).toBe("a b");
  });

  it("a resposta genérica de erro sai com CORS aberto", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await comRegistroDeErros("teste", () => { throw new Error("boom"); })(req({}));
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    espiao.mockRestore();
  });
});
