/**
 * Quem pode inativar quem.
 *
 * As duas travas testadas aqui protegem contra o mesmo acidente, e é um
 * acidente caro: ficar sem NENHUMA conta capaz de reativar alguém. O conserto
 * seria por SQL no banco de produção, às pressas, por quem tivesse a chave.
 */
import { describe, expect, it } from "vitest";
import type { Papel } from "@/data/types";
import {
  motivoParaNaoMudar,
  podeAtivarUsuarios,
  quantosPodemAtivar,
} from "./usuarioAtivo";

const direcao = { id: "u-direcao", papel: "Direcao" as Papel };
const alvo = (p: Partial<{ id: string; papel: Papel; ativo: boolean }> = {}) => ({
  id: "u-alvo",
  papel: "Producao" as Papel,
  ativo: true,
  ...p,
});

describe("quem ativa e inativa", () => {
  it("Admin e Direção podem", () => {
    expect(podeAtivarUsuarios("Admin")).toBe(true);
    expect(podeAtivarUsuarios("Direcao")).toBe(true);
  });

  // O Administrativo administra o cadastro — nome, telefone, área. Cortar o
  // acesso de alguém é outra decisão, e é de quem responde pela casa.
  it("Produção e Administrativo não podem", () => {
    expect(podeAtivarUsuarios("Producao")).toBe(false);
    expect(podeAtivarUsuarios("Administrativo")).toBe(false);
    expect(podeAtivarUsuarios(undefined)).toBe(false);
  });

  it("quem não pode recebe o motivo, e não um silêncio", () => {
    const m = motivoParaNaoMudar({ id: "x", papel: "Administrativo" }, alvo(), 3);
    expect(m).toContain("Apenas a Direção e o Administrador");
  });
});

describe("as travas contra ficar sem ninguém", () => {
  it("ninguém inativa a si mesmo", () => {
    const m = motivoParaNaoMudar(direcao, alvo({ id: direcao.id, papel: "Direcao" }), 3);
    expect(m).toContain("sua própria conta");
  });

  it("não se inativa a última conta capaz de reativar", () => {
    const m = motivoParaNaoMudar(direcao, alvo({ id: "outro", papel: "Admin" }), 1);
    expect(m).toContain("última conta");
  });

  it("havendo outra, a mesma inativação passa", () => {
    expect(motivoParaNaoMudar(direcao, alvo({ id: "outro", papel: "Admin" }), 2)).toBeNull();
  });

  // A trava é sobre quem PODE reativar. Inativar uma Produção não deixa o
  // sistema sem saída, mesmo que ela fosse a última pessoa ativa da casa.
  it("a contagem só olha quem tem o poder de reativar", () => {
    expect(motivoParaNaoMudar(direcao, alvo({ papel: "Producao" }), 1)).toBeNull();
  });

  // Reativar nunca tranca ninguém do lado de fora — as travas são do caminho
  // que tira acesso, e aplicá-las na volta impediria justamente o conserto.
  it("reativar não esbarra em trava nenhuma", () => {
    expect(motivoParaNaoMudar(direcao, alvo({ id: direcao.id, papel: "Direcao", ativo: false }), 1)).toBeNull();
  });
});

describe("contagem de quem pode reativar", () => {
  it("conta só os ativos com o papel certo", () => {
    const lista = [
      { papel: "Admin" as Papel, ativo: true },
      { papel: "Direcao" as Papel, ativo: false },
      { papel: "Direcao" as Papel, ativo: true },
      { papel: "Producao" as Papel, ativo: true },
    ];
    expect(quantosPodemAtivar(lista)).toBe(2);
  });

  // Os perfis gravados antes desta mudança não têm o campo: ausente é ATIVO,
  // que é o que a coluna nova assume no banco. Tratar como inativo apagaria o
  // acesso de todo mundo de uma vez.
  it("perfil sem o campo conta como ativo", () => {
    expect(quantosPodemAtivar([{ papel: "Admin" as Papel }])).toBe(1);
  });
});
