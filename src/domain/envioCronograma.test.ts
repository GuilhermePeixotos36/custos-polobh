import { describe, expect, it } from "vitest";
import { filaDeCronograma, podeEnviarCronograma, temCronogramaParaEnviar } from "./envioCronograma";
import type { Ec, Os } from "@/data/types";

const ec = (id: string): Ec => ({ id, projetoId: "p1" }) as Ec;

type OsDeTeste = Omit<Partial<Os>, "fornecedor"> & { fornecedor?: Partial<Os["fornecedor"]> };

const os = (p: OsDeTeste): Os =>
  ({
    id: "os1", numero: "OS 01", ecId: "ec1", status: "Emitida",
    cronograma: [{ etapa: "Montagem", data: "2026-09-08", horario: "08:00", atividades: "Rigging" }],
    ...p,
    fornecedor: { razaoSocial: "SOM & LUZ LTDA", email: "contato@someluz.com.br", ...p.fornecedor },
  }) as Os;

describe("fila de envio dos cronogramas", () => {
  it("uma linha por OS, em ordem alfabética de fornecedor", () => {
    const fila = filaDeCronograma(
      [
        os({ id: "a", fornecedor: { apelido: "Som & Luz" } }),
        os({ id: "b", fornecedor: { apelido: "Buffet Sabor" } }),
      ],
      [ec("ec1")]
    );
    expect(fila.map((f) => f.fornecedor)).toEqual(["Buffet Sabor", "Som & Luz"]);
  });

  /**
   * Por OS e não por fornecedor: o mesmo fornecedor pode ter duas OSs com
   * montagens em dias diferentes, e juntá-las mandaria horários que não são dele.
   */
  it("duas OSs do mesmo fornecedor continuam duas linhas", () => {
    const fila = filaDeCronograma([os({ id: "a" }), os({ id: "b", numero: "OS 02" })], [ec("ec1")]);
    expect(fila).toHaveLength(2);
  });

  it("conta as etapas que têm alguma coisa preenchida", () => {
    const [f] = filaDeCronograma(
      [os({ cronograma: [
        { etapa: "Montagem", data: "2026-09-08", horario: "", atividades: "" },
        { etapa: "Vazia", data: "", horario: "", atividades: "  " },
      ] })],
      [ec("ec1")]
    );
    expect(f.etapas).toBe(1);
  });

  it("OS cancelada ou arquivada sai da fila — não há cronograma a cumprir", () => {
    const fila = filaDeCronograma(
      [os({ id: "a" }), os({ id: "b", status: "Cancelada" }), os({ id: "c", status: "Arquivada" })],
      [ec("ec1")]
    );
    expect(fila.map((f) => f.os.id)).toEqual(["a"]);
  });

  describe("quem entra no disparo", () => {
    const so = (p: OsDeTeste) => filaDeCronograma([os(p)], [ec("ec1")])[0];

    it("com e-mail, EC e etapas: entra no 'a todos'", () => {
      expect(temCronogramaParaEnviar(so({}))).toBe(true);
    });

    it("sem etapas fica fora do lote automático, mas pode ser marcado à mão", () => {
      const vazio = so({ cronograma: [] });
      expect(temCronogramaParaEnviar(vazio)).toBe(false);
      expect(podeEnviarCronograma(vazio)).toBe(true);
    });

    it("sem e-mail não sai por caminho nenhum", () => {
      expect(podeEnviarCronograma(so({ fornecedor: { email: "" } }))).toBe(false);
      expect(podeEnviarCronograma(so({ fornecedor: { email: "   " } }))).toBe(false);
    });

    it("OS cuja EC não está carregada fica de fora — o e-mail cita o projeto", () => {
      const semEc = filaDeCronograma([os({ ecId: "outra" })], [ec("ec1")])[0];
      expect(semEc.ec).toBeUndefined();
      expect(podeEnviarCronograma(semEc)).toBe(false);
    });
  });
});
