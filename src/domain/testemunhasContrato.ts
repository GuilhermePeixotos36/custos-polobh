/**
 * As testemunhas FIXAS dos contratos da Pólobh (11/11/2026): o Tiago e a
 * Viviane assinam todos os contratos. O padrão vale enquanto ninguém editar em
 * Configurações › Contratos; antes disto cada OS pedia as duas testemunhas à
 * mão, e quase sempre eram as mesmas.
 */
export interface TestemunhaFixa {
  nome: string;
  cpf: string;
}

export const TESTEMUNHAS_PADRAO: TestemunhaFixa[] = [
  { nome: "Tiago Alkimim Resende", cpf: "057.704.986-09" },
  { nome: "Viviane Barreiros dos Santos", cpf: "082.218.156-83" },
];

/** O que foi gravado, normalizado para sempre haver duas testemunhas. */
export function testemunhasDaConfig(gravado: unknown): TestemunhaFixa[] {
  const lista = Array.isArray(gravado) ? (gravado as Partial<TestemunhaFixa>[]) : [];
  return [0, 1].map((i) => {
    const t = lista[i];
    if (t && (t.nome?.trim() || t.cpf?.trim())) return { nome: t.nome ?? "", cpf: t.cpf ?? "" };
    return TESTEMUNHAS_PADRAO[i];
  });
}
