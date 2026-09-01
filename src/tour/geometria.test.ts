import { describe, expect, it } from "vitest";
import { posicionarBalao, rolagemNecessaria, type Lado, type Retangulo } from "./geometria";

const JANELA = { largura: 1440, altura: 900 };
const BALAO = { largura: 380, altura: 220 };

const fim = (p: { top: number; left: number }) => ({
  direita: p.left + BALAO.largura,
  base: p.top + BALAO.altura,
});

describe("balão do tour: de que lado ele fica", () => {
  it("fica embaixo do alvo quando cabe embaixo", () => {
    const p = posicionarBalao({ alvo: { top: 100, left: 600, width: 160, height: 40 }, balao: BALAO, janela: JANELA });
    expect(p.lado).toBe("baixo");
    expect(p.top).toBeGreaterThan(140);
  });

  it("vira para cima quando o alvo está colado no rodapé", () => {
    const p = posicionarBalao({ alvo: { top: 830, left: 600, width: 160, height: 40 }, balao: BALAO, janela: JANELA });
    expect(p.lado).toBe("cima");
    expect(fim(p).base).toBeLessThanOrEqual(830);
  });

  it("respeita a preferência quando ela cabe", () => {
    const p = posicionarBalao({
      alvo: { top: 400, left: 200, width: 160, height: 40 },
      balao: BALAO, janela: JANELA, preferida: "direita",
    });
    expect(p.lado).toBe("direita");
  });

  it("ignora a preferência que não cabe e escolhe uma que caiba", () => {
    // Alvo encostado na direita: o balão não cabe à direita dele.
    const p = posicionarBalao({
      alvo: { top: 400, left: 1380, width: 50, height: 40 },
      balao: BALAO, janela: JANELA, preferida: "direita",
    });
    expect(p.lado).not.toBe("direita");
    expect(fim(p).direita).toBeLessThanOrEqual(JANELA.largura);
  });

  it("sem alvo, o balão vai para o centro e não desenha seta", () => {
    const p = posicionarBalao({ alvo: null, balao: BALAO, janela: JANELA });
    expect(p.lado).toBe("centro");
    expect(p.seta).toBeNull();
    expect(Math.round(p.left + BALAO.largura / 2)).toBe(JANELA.largura / 2);
  });
});

describe("balão do tour: nunca sai da janela", () => {
  /**
   * A garantia que mais importa. Um balão meio fora da tela é o bug clássico
   * de tour guiado, e ele só aparece nas combinações que ninguém testa à mão:
   * alvo no canto, alvo maior que a tela, alvo fora da área visível, tela de
   * celular. Aqui são 2400 combinações a cada rodada.
   */
  const janelas = [
    { largura: 1440, altura: 900 },
    { largura: 1280, altura: 720 },
    { largura: 390, altura: 844 },  // celular
    { largura: 820, altura: 1180 }, // tablet em pé
  ];
  const alvos: Retangulo[] = [
    { top: 0, left: 0, width: 10, height: 10 },
    { top: 0, left: 0, width: 4000, height: 60 },      // barra do topo inteira
    { top: -200, left: 100, width: 300, height: 120 }, // alvo rolado para cima
    { top: 500, left: 1400, width: 200, height: 60 },  // alvo saindo pela direita
    { top: 40, left: 40, width: 1200, height: 2000 },  // alvo maior que a tela
    { top: 860, left: 300, width: 120, height: 30 },   // alvo no rodapé
  ];
  const lados: Lado[] = ["baixo", "cima", "direita", "esquerda", "centro"];
  const baloes = [
    { largura: 380, altura: 220 },
    { largura: 340, altura: 420 }, // texto longo
    { largura: 300, altura: 160 },
  ];

  for (const janela of janelas) {
    for (const balao of baloes) {
      for (const alvo of alvos) {
        for (const preferida of lados) {
          it(`${janela.largura}x${janela.altura} · balão ${balao.largura}x${balao.altura} · alvo ${alvo.left},${alvo.top} · ${preferida}`, () => {
            const p = posicionarBalao({ alvo, balao, janela, preferida });
            expect(p.left).toBeGreaterThanOrEqual(0);
            expect(p.top).toBeGreaterThanOrEqual(0);
            // Em janela menor que o balão o limite empata em vez de estourar.
            expect(p.left + balao.largura).toBeLessThanOrEqual(Math.max(janela.largura, balao.largura + 24));
            expect(p.top + balao.altura).toBeLessThanOrEqual(Math.max(janela.altura, balao.altura + 24));
            if (p.seta !== null) {
              const tamanho = p.lado === "baixo" || p.lado === "cima" ? balao.largura : balao.altura;
              expect(p.seta).toBeGreaterThanOrEqual(0);
              expect(p.seta).toBeLessThanOrEqual(tamanho);
            }
          });
        }
      }
    }
  }
});

describe("rolagem até o alvo", () => {
  const camadas = 180; // topnav + cabeçalho grudado

  it("não rola quando o alvo já está visível abaixo do cabeçalho", () => {
    expect(rolagemNecessaria({ top: 300, left: 0, width: 100, height: 40 }, { altura: 900 }, camadas, 500)).toBeNull();
  });

  it("não rola atrás de um alvo que vive na barra grudada", () => {
    // A barra de cima nunca sai da tela: rolar por causa dela faria a página
    // pular a cada passo do tour que aponta para o menu.
    expect(rolagemNecessaria({ top: 210, left: 0, width: 100, height: 36 }, { altura: 900 }, camadas, 0)).toBeNull();
  });

  it("rola quando o alvo está escondido atrás do cabeçalho", () => {
    const r = rolagemNecessaria({ top: 40, left: 0, width: 100, height: 40 }, { altura: 900 }, camadas, 1000);
    expect(r).toBe(1000 + 40 - (camadas + 24));
  });

  it("rola quando o alvo está abaixo da dobra", () => {
    const r = rolagemNecessaria({ top: 1200, left: 0, width: 100, height: 40 }, { altura: 900 }, camadas, 0);
    expect(r).toBe(1200 - (camadas + 24));
  });

  it("alvo mais alto que a tela: alinha o começo dele, não o meio", () => {
    const r = rolagemNecessaria({ top: 400, left: 0, width: 100, height: 3000 }, { altura: 900 }, camadas, 0);
    expect(r).toBe(400 - (camadas + 24));
  });

  it("nunca pede rolagem negativa", () => {
    expect(rolagemNecessaria({ top: -50, left: 0, width: 10, height: 10 }, { altura: 900 }, camadas, 0)).toBe(0);
  });
});
