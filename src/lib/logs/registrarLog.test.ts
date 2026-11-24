import { describe, expect, it } from "vitest";
import {
  ACOES_DO_APP, LIMITE_MENSAGEM, criarRegistrador, prepararEvento, resumoDoErroJs, semSegredoNoCaminho, type EventoLog,
} from "./registrarLog";

const erro: EventoLog = { categoria: "erro", acao: "erro_js", mensagem: "x is not defined", tela: "/projetos" };

function montar(resposta: { error: { code?: string; message?: string } | null } = { error: null }) {
  const enviados: Record<string, unknown>[] = [];
  let relogio = 0;
  let fechar: (() => void) | null = null;
  const r = criarRegistrador({
    enviar: (p) => { enviados.push(p); return Promise.resolve(resposta); },
    agora: () => relogio,
    agendar: (acao) => { fechar = acao; return 1; },
    cancelar: () => { fechar = null; },
  });
  return { r, enviados, andar: (ms: number) => { relogio += ms; }, fecharJanela: () => fechar?.() };
}

describe("prepararEvento", () => {
  it("corta a mensagem em 500 caracteres", () => {
    const p = prepararEvento({ ...erro, mensagem: "a".repeat(900) });
    expect((p?.mensagem as string).length).toBe(LIMITE_MENSAGEM);
  });

  it("detalhe acima de 4.000 caracteres vira aviso de corte; pequeno passa intacto", () => {
    const grande = prepararEvento({ ...erro, detalhe: { x: "a".repeat(5000) } });
    expect(grande?.detalhe).toMatchObject({ cortado: true });
    const pequeno = prepararEvento({ ...erro, detalhe: { codigo: "42501" } });
    expect(pequeno?.detalhe).toEqual({ codigo: "42501" });
  });

  it("referência circular no detalhe não lança", () => {
    const circular: Record<string, unknown> = {};
    circular.eu = circular;
    expect(() => prepararEvento({ ...erro, detalhe: circular })).not.toThrow();
    expect(prepararEvento({ ...erro, detalhe: circular })?.detalhe).toEqual({ cortado: true });
  });

  it("ação fora das seis do app é descartada (inclusive as de banco e de Edge)", () => {
    for (const acao of ["usuario_criado", "login_falhou", "erro_edge", "qualquer"]) {
      expect(prepararEvento({ categoria: "acesso", acao })).toBeNull();
    }
    for (const acao of ACOES_DO_APP) expect(prepararEvento({ categoria: "acesso", acao })).not.toBeNull();
  });
});

describe("repetição", () => {
  it("o primeiro sai na hora; os iguais em 60 s só contam e saem juntos quando a janela fecha", async () => {
    const { r, enviados, fecharJanela } = montar();
    await r.registrarAgora(erro);
    await r.registrarAgora(erro);
    await r.registrarAgora(erro);
    expect(enviados).toHaveLength(1);
    fecharJanela();
    await Promise.resolve();
    expect(enviados).toHaveLength(2);
    expect(enviados[1].detalhe).toEqual({ repeticoes: 2 });
  });

  it("sem repetição, fechar a janela não manda nada", async () => {
    const { r, enviados, fecharJanela } = montar();
    await r.registrarAgora(erro);
    fecharJanela();
    expect(enviados).toHaveLength(1);
  });

  it("um evento diferente fecha o resumo antes de sair", async () => {
    const { r, enviados } = montar();
    await r.registrarAgora(erro);
    await r.registrarAgora(erro);
    await r.registrarAgora({ ...erro, mensagem: "outro" });
    expect(enviados.map((e) => e.mensagem)).toEqual(["x is not defined", "x is not defined", "outro"]);
    expect(enviados[1].detalhe).toEqual({ repeticoes: 1 });
  });

  it("passada a janela, o mesmo erro volta como evento novo; tela diferente não é repetição", async () => {
    const { r, enviados, andar } = montar();
    await r.registrarAgora(erro);
    andar(61_000);
    await r.registrarAgora(erro);
    await r.registrarAgora({ ...erro, tela: "/ordens" });
    expect(enviados).toHaveLength(3);
  });

  it("descarregar() manda o resumo pendente", async () => {
    const { r, enviados } = montar();
    await r.registrarAgora(erro);
    await r.registrarAgora(erro);
    r.descarregar();
    await Promise.resolve();
    expect(enviados).toHaveLength(2);
  });
});

describe("tolerância: log nunca derruba", () => {
  it("função inexistente (PGRST202) desliga o registro pelo resto da sessão", async () => {
    const { r, enviados } = montar({ error: { code: "PGRST202" } });
    await r.registrarAgora(erro);
    await r.registrarAgora({ ...erro, mensagem: "outro" });
    expect(enviados).toHaveLength(1);
    expect(r.desligado()).toBe(true);
  });

  it("outro erro do banco não desliga", async () => {
    const { r, enviados } = montar({ error: { code: "42501", message: "permissão" } });
    await r.registrarAgora(erro);
    await r.registrarAgora({ ...erro, mensagem: "outro" });
    expect(enviados).toHaveLength(2);
    expect(r.desligado()).toBe(false);
  });

  it("rejeição de rede é engolida e enviar que lança não derruba", async () => {
    const rede = criarRegistrador({ enviar: () => Promise.reject(new Error("rede")) });
    await expect(rede.registrarAgora(erro)).resolves.toBeUndefined();
    const quebrado = criarRegistrador({ enviar: () => { throw new Error("síncrono"); } });
    expect(() => quebrado.registrar(erro)).not.toThrow();
  });

  it("inativo (ativo: () => false) não envia", async () => {
    const enviados: unknown[] = [];
    const r = criarRegistrador({ enviar: (p) => { enviados.push(p); return Promise.resolve({ error: null }); }, ativo: () => false });
    await r.registrarAgora(erro);
    expect(enviados).toHaveLength(0);
  });
});

describe("erro de JavaScript", () => {
  it("guarda a mensagem e só as 5 primeiras linhas da pilha", () => {
    const e = new Error("quebrou");
    e.stack = ["Error: quebrou", "a", "b", "c", "d", "e", "f", "g"].join("\n");
    const r = resumoDoErroJs(e);
    expect(r.mensagem).toBe("quebrou");
    expect(r.pilha?.split("\n")).toHaveLength(5);
  });

  it("aceita o que não é Error", () => {
    expect(resumoDoErroJs("texto").mensagem).toBe("texto");
    expect(resumoDoErroJs(undefined).mensagem).toBe("Erro sem mensagem");
  });
});

describe("tela sem segredo", () => {
  it("as rotas públicas perdem o token do caminho", () => {
    expect(semSegredoNoCaminho("/credenciamento/abc123")).toBe("/credenciamento/:token");
    expect(semSegredoNoCaminho("/cronograma/meu-evento")).toBe("/cronograma/:slug");
    expect(semSegredoNoCaminho("/projetos/abc")).toBe("/projetos/abc");
  });

  it("a pilha não repete a mensagem (primeira linha do V8)", () => {
    const e = new Error("cpf 123");
    e.stack = ["Error: cpf 123", "at a", "at b"].join("\n");
    expect(resumoDoErroJs(e).pilha).toBe("at a\nat b");
  });
});
