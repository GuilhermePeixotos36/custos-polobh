import { describe, expect, it } from "vitest";
import {
  aplicarMudancasEvento,
  ecsAtualizaveis,
  mudancasDoEvento,
  ossReemitiveis,
  type SnapshotEvento,
} from "./mudancasEvento";
import { projetoInfoVazio, sincronizarCamposLegados } from "@/domain/projeto";
import type { Cliente, Ec, Os, ProjetoInfo } from "@/data/types";

const clienteBase = (): Cliente => ({
  id: "c1",
  apelido: "ACME",
  nome: "ACME Eventos",
  razaoSocial: "ACME Eventos Ltda",
  endereco: "Rua A, 100",
  cnpjCpf: "12.345.678/0001-90",
  inscricaoEstadual: "ISENTO",
  inscricaoMunicipal: "123",
  representante: { nome: "Ana", cargo: "Diretora", telefones: "(31) 90000-0000", email: "ana@acme.com" },
});

const infoBase = (p: Partial<ProjetoInfo> = {}): ProjetoInfo => {
  const base = projetoInfoVazio();
  return sincronizarCamposLegados({
    ...base,
    titulo: "ACME – Congresso – 2026",
    clienteAbreviado: "ACME",
    nomeProjeto: "Congresso",
    anoProjeto: "2026",
    modalidade: "Corporativo",
    local: "Expominas",
    enderecoLocal: "Av. Amazonas, 6200",
    participantes: 400,
    produtoraResponsavel: "Marisa",
    cronograma: {
      ...base.cronograma,
      montagem: [{ id: "m1", data: "2026-03-03", inicio: "08:00", fim: "18:00" }],
      evento: [{ id: "e1", data: "2026-03-05", inicio: "09:00", fim: "18:00" }],
    },
    ...p,
  });
};

const snap = (p: Partial<ProjetoInfo> = {}, c: Partial<Cliente> = {}): SnapshotEvento => ({
  info: infoBase(p),
  cliente: { ...clienteBase(), ...c },
});

describe("o que mudou", () => {
  it("não acusa mudança quando nada mudou", () => {
    expect(mudancasDoEvento(snap(), snap())).toEqual([]);
  });

  it("aponta o campo com o antes e o depois", () => {
    const m = mudancasDoEvento(snap(), snap({ local: "Minascentro" }));
    expect(m).toEqual([
      { chave: "projeto.local", grupo: "Projeto", label: "Local", antes: "Expominas", depois: "Minascentro" },
    ]);
  });

  it("acusa a troca do número de participantes, inclusive para vazio", () => {
    expect(mudancasDoEvento(snap(), snap({ participantes: 500 }))[0]).toMatchObject({ antes: "400", depois: "500" });
    expect(mudancasDoEvento(snap(), snap({ participantes: null }))[0]).toMatchObject({ antes: "400", depois: "" });
  });

  it("acusa mudança de data pelo cronograma, com o texto que sai no documento", () => {
    const base = infoBase();
    const novo = infoBase({
      cronograma: { ...base.cronograma, evento: [{ id: "e1", data: "2026-04-05", inicio: "09:00", fim: "18:00" }] },
    });
    const [m] = mudancasDoEvento(snap(), { info: novo, cliente: clienteBase() });
    expect(m.chave).toBe("projeto.cronograma");
    expect(m.antes).toContain("Evento: 05 03 26");
    expect(m.depois).toContain("Evento: 05 04 26");
  });

  it("reordenar a lista sem mudar o que é impresso não conta como mudança", () => {
    const base = infoBase();
    // Mesmas datas, ids diferentes: o papel sai igual, então não há o que reemitir.
    const mesmoTexto = infoBase({
      cronograma: { ...base.cronograma, evento: [{ id: "outro-id", data: "2026-03-05", inicio: "09:00", fim: "18:00" }] },
    });
    expect(mudancasDoEvento(snap(), { info: mesmoTexto, cliente: clienteBase() })).toEqual([]);
  });

  it("também olha o bloco do cliente", () => {
    const m = mudancasDoEvento(snap(), snap({}, { endereco: "Rua B, 200" }));
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ grupo: "Cliente", label: "Endereço do cliente", depois: "Rua B, 200" });
  });

  it("representante muda como um campo só", () => {
    const m = mudancasDoEvento(
      snap(),
      snap({}, { representante: { nome: "Bruno", cargo: "Diretor", telefones: "(31) 90000-0000", email: "ana@acme.com" } })
    );
    expect(m).toHaveLength(1);
    expect(m[0].chave).toBe("cliente.representante");
    expect(m[0].depois).toContain("Bruno");
  });

  it("junta as mudanças na ordem do documento: projeto e depois cliente", () => {
    const m = mudancasDoEvento(snap(), snap({ local: "Minascentro" }, { nome: "ACME S/A" }));
    expect(m.map((x) => x.chave)).toEqual(["projeto.local", "cliente.nome"]);
  });
});

describe("aplicar só o que foi escolhido", () => {
  const antes = snap();
  const depois = snap({ local: "Minascentro", participantes: 500 }, { endereco: "Rua B, 200" });
  const todas = mudancasDoEvento(antes, depois);

  /** Snapshot da EC: nasceu do projeto, mas com o título ajustado à mão. */
  const snapshotEc = (): SnapshotEvento => ({
    info: infoBase({ titulo: "Título negociado com o cliente" }),
    cliente: clienteBase(),
  });

  it("leva só os campos marcados", () => {
    const escolhida = todas.filter((m) => m.chave === "projeto.local");
    const r = aplicarMudancasEvento(snapshotEc(), depois, escolhida);
    expect(r.info.local).toBe("Minascentro");
    expect(r.info.participantes).toBe(400);
    expect(r.cliente.endereco).toBe("Rua A, 100");
  });

  it("preserva o que foi digitado dentro do documento", () => {
    const r = aplicarMudancasEvento(snapshotEc(), depois, todas);
    expect(r.info.titulo).toBe("Título negociado com o cliente");
    expect(r.info.local).toBe("Minascentro");
    expect(r.cliente.endereco).toBe("Rua B, 200");
  });

  it("nenhuma mudança escolhida devolve o snapshot como estava", () => {
    const r = aplicarMudancasEvento(snapshotEc(), depois, []);
    expect(r.info.local).toBe("Expominas");
    expect(r.info.titulo).toBe("Título negociado com o cliente");
  });

  it("mudar o cronograma arrasta as datas legadas do documento", () => {
    const base = infoBase();
    const comDataNova = {
      info: infoBase({ cronograma: { ...base.cronograma, evento: [{ id: "e1", data: "2026-04-05", inicio: "10:00", fim: "20:00" }] } }),
      cliente: clienteBase(),
    };
    const m = mudancasDoEvento(antes, comDataNova);
    const r = aplicarMudancasEvento(snapshotEc(), comDataNova, m);
    expect(r.info.evento).toBe("2026-04-05");
    expect(r.info.horario).toBe("10:00 às 20:00");
  });

  it("o snapshot de origem não é alterado", () => {
    const origem = snapshotEc();
    aplicarMudancasEvento(origem, depois, todas);
    expect(origem.info.local).toBe("Expominas");
    expect(origem.cliente.endereco).toBe("Rua A, 100");
  });
});

describe("quem ainda pode receber", () => {
  const ec = (status: Ec["status"]) => ({ id: status, status }) as Ec;
  const os = (status: Os["status"]) => ({ id: status, status }) as Os;

  it("EC encerrada é história e não recebe atualização", () => {
    // Vocabulário novo (a EC é Ativa ou Arquivada) e o legado, que ainda pode
    // vir de linhas antigas — a regra lê os dois do mesmo jeito.
    const lista = [ec("Ativa"), ec("Arquivada"), ec("Cancelada"), ec("Rascunho")];
    expect(ecsAtualizaveis(lista).map((e) => e.status)).toEqual(["Ativa", "Rascunho"]);
  });

  it("OS encerrada não gera nova versão", () => {
    const lista = [os("Rascunho"), os("Emitida"), os("Disparada"), os("Cancelada"), os("Arquivada")];
    expect(ossReemitiveis(lista).map((o) => o.status)).toEqual(["Rascunho", "Emitida", "Disparada"]);
  });
});
