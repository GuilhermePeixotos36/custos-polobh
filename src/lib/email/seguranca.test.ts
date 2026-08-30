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
