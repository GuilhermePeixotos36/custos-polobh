import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_TESTE, protegerDestinatarios } from "./seguranca";
import { flags } from "@/lib/flags";
import type { MensagemEmail } from "./templates";

const msg = (p: Partial<MensagemEmail> = {}): MensagemEmail => ({
  para: [{ email: "contato@somluz.com.br", nome: "Som & Luz" }],
  assunto: "Ordem de Serviço OS-01",
  html: "<p>Segue a OS.</p>",
  ...p,
});

/**
 * A trava que impede o app em homologação de escrever para fornecedor de
 * verdade. Um teste que falhe aqui significa e-mail saindo para gente real.
 */
describe("trava de homologação do e-mail", () => {
  beforeEach(() => {
    vi.spyOn(flags, "emailDestinoReal", "get" as never).mockReturnValue(false as never);
  });

  it("desvia TODO destinatário para a caixa de teste", () => {
    const protegida = protegerDestinatarios(
      msg({ para: [{ email: "a@fornecedor.com" }, { email: "b@fornecedor.com" }] })
    );
    expect(protegida.para).toEqual([{ email: EMAIL_TESTE, nome: "Homologação Pólobh" }]);
  });

  /** Sem isto o e-mail de teste é indistinguível do real na caixa de entrada. */
  it("põe o destino real no assunto e uma tarja no corpo", () => {
    const protegida = protegerDestinatarios(msg());
    expect(protegida.assunto).toContain("[TESTE → contato@somluz.com.br]");
    expect(protegida.assunto).toContain("Ordem de Serviço OS-01");
    expect(protegida.html).toContain("MENSAGEM DE TESTE");
    expect(protegida.html).toContain("Som &amp; Luz <contato@somluz.com.br>".replace("&amp;", "&"));
    // O conteúdo original continua inteiro, depois da tarja.
    expect(protegida.html).toContain("<p>Segue a OS.</p>");
  });

  it("não perde anexo nem os demais campos da mensagem", () => {
    const comAnexo = msg({ anexos: [{ nome: "OS-01.xlsx", conteudoBase64: "AAA" }] });
    expect(protegerDestinatarios(comAnexo).anexos).toEqual(comAnexo.anexos);
  });

  it("mensagem sem destinatário também é desviada, em vez de sair torta", () => {
    const protegida = protegerDestinatarios(msg({ para: [] }));
    expect(protegida.para).toEqual([{ email: EMAIL_TESTE, nome: "Homologação Pólobh" }]);
    expect(protegida.assunto).toContain("sem destino");
  });

  it("com o destino real liberado, a mensagem passa intacta", () => {
    vi.spyOn(flags, "emailDestinoReal", "get" as never).mockReturnValue(true as never);
    const original = msg();
    expect(protegerDestinatarios(original)).toBe(original);
  });
});

/**
 * A ÚNICA porta de saída durante a homologação — e ela precisa continuar
 * estreita.
 *
 * `interna` significa "da Pólobh para a Pólobh": hoje só o Help Desk a usa — o
 * chamado que vai ao suporte e a resposta que volta a quem o abriu. Um teste que
 * falhe aqui significa uma mensagem escapando da trava sem ter direito, que é
 * exatamente o acidente que a trava existe para impedir.
 */
describe("mensagem interna atravessa a trava", () => {
  beforeEach(() => {
    vi.spyOn(flags, "emailDestinoReal", "get" as never).mockReturnValue(false as never);
  });

  it("sai para o destinatário de verdade, sem tarja e sem prefixo no assunto", () => {
    const chamado = msg({
      para: [{ email: "suporte@exemplo.com", nome: "Suporte Pólobh" }],
      assunto: "[Help Desk] Erro no sistema — A OS não salva",
      interna: true,
    });
    const saida = protegerDestinatarios(chamado);
    expect(saida).toBe(chamado);
    expect(saida.para[0].email).toBe("suporte@exemplo.com");
    expect(saida.assunto).not.toContain("[TESTE");
    expect(saida.html).not.toContain("MENSAGEM DE TESTE");
  });

  it("o responder-para sobrevive — é por ele que a resposta volta a quem abriu", () => {
    const chamado = msg({ interna: true, responderPara: { email: "ana@polobh.com.br", nome: "Ana" } });
    expect(protegerDestinatarios(chamado).responderPara).toEqual({ email: "ana@polobh.com.br", nome: "Ana" });
  });

  it("sem a marca, continua desviada — a exceção não vaza para o resto", () => {
    // O e-mail ao fornecedor é o caso que a trava existe para pegar.
    const aoFornecedor = msg();
    expect(protegerDestinatarios(aoFornecedor).para[0].email).toBe(EMAIL_TESTE);
    // E `interna: false` explícito também não abre a porta.
    expect(protegerDestinatarios(msg({ interna: false })).para[0].email).toBe(EMAIL_TESTE);
  });
});

/**
 * Quem pode marcar `interna`? Só o Help Desk — as DUAS pontas dele —, e este
 * teste é o guardião disso.
 *
 * Ele lê os templates de verdade e confere um a um: se alguém amanhã marcar o
 * disparo de OS ou o credenciamento como interno, o teste quebra aqui antes de
 * a mensagem chegar a um fornecedor.
 */
describe("só o Help Desk é mensagem interna", () => {
  it("nenhum outro template escapa da trava", async () => {
    const t = await import("./templates");
    const projeto = {
      titulo: "Convenção", local: "Expominas", evento: "2026-10-14", horario: "08:00 às 18:00",
      cronograma: { evento: [{ data: "2026-10-14" }] },
    };
    const ec = { id: "ec", numero: "EC-01", projeto, cliente: { nome: "ACME", representante: { email: "c@acme.com", nome: "Cliente" } }, validadeDias: 30 };
    const os = {
      id: "os", numero: "OS-01", projeto, cronograma: [],
      fornecedor: { razaoSocial: "Sonora", email: "f@sonora.com" },
      credenciamento: { prazoLimite: "", linkFormulario: "" },
      slugCredenciamento: "abc",
    };
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const externos: MensagemEmail[] = [
      t.emailDispararOs(os as any, ec as any),
      t.emailCredenciamento(os as any, ec as any),
      t.emailCronogramaDoFornecedor(os as any, ec as any),
      t.emailEcParaAprovacao(ec as any),
    ];
    for (const m of externos) expect(m.interna).toBeFalsy();

    // E as duas pontas do Help Desk são, de fato, o que atravessa: o chamado
    // que vai ao suporte, e a resposta do suporte a quem abriu.
    const chamado = t.emailHelpDesk(
      { tipo: "Erro no sistema", assunto: "x", descricao: "y", tela: "/", autorNome: "Ana", autorEmail: "ana@polobh.com.br", ambiente: "—" },
      "suporte@exemplo.com"
    );
    expect(chamado.interna).toBe(true);

    const resposta = t.emailRespostaChamado({
      assuntoChamado: "A OS não salva",
      texto: "Corrigido na versão de hoje.",
      deNome: "O suporte",
      paraNome: "Ana",
      paraEmail: "ana@polobh.com.br",
      urlApp: "https://app.exemplo.com",
    });
    expect(resposta.interna).toBe(true);
    expect(resposta.para[0].email).toBe("ana@polobh.com.br");
    // E com a homologação LIGADA ela ainda chega a quem abriu o chamado — que é
    // o ponto: a resposta do suporte precisa sair de verdade.
    vi.spyOn(flags, "emailDestinoReal", "get" as never).mockReturnValue(false as never);
    expect(protegerDestinatarios(resposta).para[0].email).toBe("ana@polobh.com.br");
  });
});
