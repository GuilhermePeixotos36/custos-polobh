/**
 * CADASTRO ÚNICO DE FORNECEDORES (24/11/2026) — as regras, sem React.
 *
 * Decisões do dono do app para o Módulo 1:
 *   - o CPF/CNPJ é a PRIMEIRA informação do cadastro, e CNPJ inválido não passa;
 *   - com o CNPJ lançado, o que a consulta pública traz (razão social, nome
 *     fantasia, endereço, CNAEs, inscrição estadual, perfil tributário) entra
 *     sozinho e fica SÓ LEITURA — o que é da Receita não se reescreve à mão;
 *   - a inscrição municipal, o e-mail, o telefone, os contatos e o
 *     representante continuam sendo da casa (a consulta não os traz, ou traz
 *     só o da ficha da Receita);
 *   - pessoa física (CPF) não tem fonte pública: o cadastro é todo manual;
 *   - em toda tela, o fornecedor é ESCOLHIDO do cadastro (caixa combinada) ou
 *     cadastrado ali mesmo pelo "+" — acabou a razão social digitada solta,
 *     que era como nasciam os fornecedores "parecidos" (o mesmo nome escrito
 *     de três jeitos, sem CNPJ amarrando).
 *
 * Mora aqui, e não nos componentes, porque é o que tem caso difícil e merece
 * teste: o que trava, o que fica livre, o que a busca acha.
 */
import type { Fornecedor } from "@/data/types";
import type { DadosCnpj } from "@/lib/cnpj";
import { cnpjValido, cpfValido } from "@/lib/cnpj";
import { normalizarBusca, type OpcaoCombo, type ResultadoFiltro } from "@/lib/comboFiltro";
import { maskDoc, onlyDigits } from "@/lib/format";
import { validarEndereco } from "@/domain/endereco";
import { opcoesPerfilTributario } from "@/domain/fornecedor";

/* ------------------------------ documento ------------------------------- */

export type TipoDocumento = "cnpj" | "cpf" | "incompleto" | "invalido";

/**
 * O que está digitado no campo do documento. "incompleto" é a digitação no
 * meio do caminho; "invalido" é o documento inteiro com dígito verificador
 * errado — esse é bloqueado (não consulta, não salva).
 */
export function tipoDocumento(doc: string): TipoDocumento {
  const d = onlyDigits(doc);
  if (d.length === 14) return cnpjValido(d) ? "cnpj" : "invalido";
  // 11 dígitos podem ser um CNPJ no meio da digitação: só é CPF se o dígito
  // verificador fechar. Se não fechar, ainda pode virar CNPJ — fica incompleto.
  if (d.length === 11) return cpfValido(d) ? "cpf" : "incompleto";
  return "incompleto";
}

/** Fornecedor em branco — o cadastro novo, com o documento que já se sabe. */
export const fornecedorEmBranco = (cnpj = ""): Fornecedor => ({
  id: "", razaoSocial: "", apelido: "", nomeFantasia: "", cnpj, perfilTributario: "", endereco: "",
  inscricaoEstadual: "", inscricaoMunicipal: "",
  dadosBancarios: { tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "" },
  representante: "", telefone: "", email: "", cnaes: [], contatos: [],
});

/* ------------------------- o que a consulta traz ------------------------ */

/** Os campos que a consulta do CNPJ preenche e que, depois disso, ficam só leitura. */
export const CAMPOS_AUTOMATICOS = [
  "razaoSocial", "nomeFantasia", "endereco", "cnaes", "inscricaoEstadual", "perfilTributario",
] as const;
export type CampoAutomatico = (typeof CAMPOS_AUTOMATICOS)[number];

const preenchido = (f: Fornecedor, campo: CampoAutomatico): boolean =>
  campo === "cnaes" ? (f.cnaes?.length ?? 0) > 0 : !!String(f[campo] ?? "").trim();

/**
 * Quais campos automáticos estão TRAVADOS neste cadastro.
 *
 * Calculado a partir do fornecedor como ele chegou à tela (do banco ou da
 * consulta que acabou de responder) — não a cada tecla: se fosse ao vivo, o
 * campo vazio travaria na primeira letra digitada.
 *
 * - CPF: nada trava; pessoa física é cadastro manual.
 * - CNPJ válido: trava o que veio preenchido. O que está VAZIO fica livre —
 *   metade dos cadastros antigos não tem endereço nem perfil (lidos em
 *   24/11/2026), e a consulta pode estar fora do ar: sem essa saída o cadastro
 *   ficaria impossível de completar. O CNPJ continua amarrando o registro, então
 *   isso não abre porta para fornecedor parecido.
 * - Endereço só trava se estiver COMPLETO: o contrato exige o endereço inteiro,
 *   e a Receita às vezes manda sem CEP ou sem número.
 * - Sem documento válido, tudo trava: o CNPJ vem primeiro.
 */
export function camposTravados(f: Fornecedor): Set<CampoAutomatico> {
  const tipo = tipoDocumento(f.cnpj);
  if (tipo === "cpf") return new Set();
  if (tipo !== "cnpj") return new Set(CAMPOS_AUTOMATICOS);
  return new Set(
    CAMPOS_AUTOMATICOS.filter((c) => preenchido(f, c) && (c !== "endereco" || validarEndereco(f.endereco).completo)),
  );
}

/**
 * Os campos do cadastro que a pessoa pode preencher agora — os da casa, que a
 * consulta não decide. Sem documento válido nada abre: o CPF/CNPJ vem primeiro.
 */
export function camposDaCasaLiberados(f: Fornecedor): boolean {
  const tipo = tipoDocumento(f.cnpj);
  return tipo === "cnpj" || tipo === "cpf";
}

/**
 * "Lucro Presumido/Real" não é dado incompleto nosso: é o que a fonte pública
 * consegue afirmar (ver `PERFIS_TRIBUTARIOS`). Por isso, mesmo travado, o perfil
 * dessa família pode ser CONFIRMADO entre Presumido e Real — e só isso.
 */
const FAMILIA_LUCRO = ["Lucro Presumido/Real", "Lucro Presumido", "Lucro Real"];

/**
 * As opções do perfil tributário no cadastro. `null` quando o perfil está
 * travado sem escolha (vai como leitura); lista quando há o que escolher.
 */
export function opcoesPerfilNoCadastro(perfil: string, travado: boolean): string[] | null {
  if (!travado) return opcoesPerfilTributario(perfil);
  return FAMILIA_LUCRO.includes(perfil.trim()) ? FAMILIA_LUCRO : null;
}

/**
 * O fornecedor depois da resposta da consulta do CNPJ.
 *
 * Os campos automáticos passam a ser os da Receita (valor vazio na fonte não
 * apaga o que havia). Telefone e e-mail são da casa: a consulta só preenche o
 * que estiver em branco — a ficha da Receita costuma trazer o contador, não a
 * pessoa com quem a Pólobh fala. Sem IE na pesquisa, "Isenta" (29/09/2026),
 * a menos que já houvesse uma.
 */
export function aplicarConsulta(f: Fornecedor, d: DadosCnpj): Fornecedor {
  const ou = (novo: string | undefined, atual: string | undefined) => (novo ?? "").trim() || atual || "";
  return {
    ...f,
    razaoSocial: ou(d.razaoSocial, f.razaoSocial),
    nomeFantasia: ou(d.nomeFantasia, f.nomeFantasia),
    endereco: ou(d.endereco, f.endereco),
    perfilTributario: ou(d.perfilTributario, f.perfilTributario),
    cnaes: d.cnaes?.length ? d.cnaes : f.cnaes ?? [],
    inscricaoEstadual: ou(d.inscricaoEstadual, f.inscricaoEstadual) || "Isenta",
    // A IM a Receita não tem; só entra se uma integração municipal a devolver.
    inscricaoMunicipal: f.inscricaoMunicipal || (d.inscricaoMunicipal ?? ""),
    telefone: f.telefone || (d.telefone ?? ""),
    email: f.email || (d.email ?? ""),
  };
}

/* --------------------------- a caixa combinada -------------------------- */

const COLATOR = new Intl.Collator("pt-BR", { sensitivity: "base" });

/** O nome com que o fornecedor aparece na caixa combinada: a razão social (é ela que vai à EC). */
export const rotuloFornecedor = (f: Pick<Fornecedor, "razaoSocial" | "nomeFantasia" | "cnpj">): string =>
  (f.razaoSocial || f.nomeFantasia || maskDoc(f.cnpj)).trim();

/** A opção da caixa combinada: valor = só os dígitos do documento. */
export function opcaoDeFornecedor(f: Fornecedor): OpcaoCombo {
  const fantasia = (f.nomeFantasia ?? "").trim();
  const rotulo = rotuloFornecedor(f);
  return {
    valor: onlyDigits(f.cnpj),
    rotulo,
    detalhe: [maskDoc(f.cnpj), fantasia && fantasia !== rotulo ? fantasia : "", f.apelido?.trim() && f.apelido !== fantasia ? f.apelido : ""]
      .filter(Boolean)
      .join(" · "),
  };
}

/** As opções em ordem alfabética, sem documento repetido e sem quem não tem documento. */
export function opcoesDeFornecedores(lista: readonly Fornecedor[]): OpcaoCombo[] {
  const vistos = new Set<string>();
  const saida: OpcaoCombo[] = [];
  for (const f of lista) {
    const d = onlyDigits(f.cnpj);
    if ((d.length !== 11 && d.length !== 14) || vistos.has(d)) continue;
    vistos.add(d);
    saida.push(opcaoDeFornecedor(f));
  }
  return saida.sort((a, b) => COLATOR.compare(a.rotulo, b.rotulo));
}

/** A digitação é de documento (só números e a pontuação da máscara)? */
export const buscaPorDocumento = (busca: string): boolean => /^[\d.\-/\s]+$/.test(busca.trim()) && /\d/.test(busca);

/**
 * A busca da caixa combinada de fornecedor.
 *
 * - Vazia: a lista inteira, em ordem alfabética (como chegou).
 * - Só números (com ou sem máscara): procura no CPF/CNPJ pelos DÍGITOS — quem
 *   cola "12345678000190" acha o "12.345.678/0001-90" guardado com máscara.
 *   O que começa pelo que foi digitado vem primeiro.
 * - Texto: cada palavra precisa aparecer na razão social, no nome fantasia ou
 *   no apelido, sem acento e sem caixa; quem começa pela primeira palavra sobe.
 */
export function filtrarFornecedores(opcoes: readonly OpcaoCombo[], busca: string, limite = 50): ResultadoFiltro {
  const texto = busca.trim();
  if (!texto) return { visiveis: opcoes.slice(0, limite), total: opcoes.length };

  const comecam: OpcaoCombo[] = [];
  const contem: OpcaoCombo[] = [];
  if (buscaPorDocumento(texto)) {
    const digitos = onlyDigits(texto);
    for (const o of opcoes) {
      if (o.valor.startsWith(digitos)) comecam.push(o);
      else if (o.valor.includes(digitos)) contem.push(o);
    }
  } else {
    const termos = normalizarBusca(texto).split(" ").filter(Boolean);
    for (const o of opcoes) {
      const rotulo = normalizarBusca(o.rotulo);
      const alvo = `${rotulo} ${normalizarBusca(o.detalhe ?? "")}`;
      if (!termos.every((t) => alvo.includes(t))) continue;
      if (rotulo.startsWith(termos[0])) comecam.push(o);
      else contem.push(o);
    }
  }
  const total = comecam.length + contem.length;
  return { visiveis: comecam.concat(contem).slice(0, limite), total };
}

/* ------------------------ a linha da EC e a OS -------------------------- */

/**
 * A situação do fornecedor de uma linha (da EC, da OS) diante do cadastro.
 *
 * - "vazio": ninguém escolhido;
 * - "cadastrado": o documento está no cadastro — é o caminho normal;
 * - "sem-cadastro": documento completo que o cadastro não conhece (linha
 *   antiga, ou cadastro apagado);
 * - "sem-documento": só a razão social, digitada antes de 24/11/2026. Fica
 *   na tela como está — dado não se apaga —, com o aviso de que não está
 *   amarrada a um cadastro.
 */
export type SituacaoFornecedor = "vazio" | "cadastrado" | "sem-cadastro" | "sem-documento";

export function situacaoFornecedor(
  cnpj: string,
  razao: string,
  cadastro: readonly Pick<Fornecedor, "cnpj">[],
): SituacaoFornecedor {
  const d = onlyDigits(cnpj);
  if (d.length === 11 || d.length === 14) {
    return cadastro.some((f) => onlyDigits(f.cnpj) === d) ? "cadastrado" : "sem-cadastro";
  }
  return razao.trim() ? "sem-documento" : "vazio";
}

/** O que a linha da EC guarda quando o fornecedor é escolhido do cadastro: o CNPJ e a razão social. */
export const linhaComFornecedor = (f: Pick<Fornecedor, "cnpj" | "razaoSocial" | "nomeFantasia">) => ({
  fornecedorCnpj: maskDoc(f.cnpj),
  fornecedorRazao: (f.razaoSocial || f.nomeFantasia || "").trim(),
});

/**
 * O fornecedor da OS quando ele é TROCADO pela caixa combinada.
 *
 * Tudo o que é do cadastro vem dele; os dados bancários também, quando o
 * cadastro os tem — e, quando não tem, a OS começa em branco: os bancários do
 * fornecedor anterior não podem ficar na OS do novo (18/11/2026). O histórico
 * das OSs dele completa depois (ver `bancariosDoHistorico`).
 */
export function fornecedorDaOsPeloCadastro(cadastro: Fornecedor): Fornecedor {
  return {
    ...fornecedorEmBranco(cadastro.cnpj),
    ...cadastro,
    dadosBancarios: { ...fornecedorEmBranco().dadosBancarios, ...(cadastro.dadosBancarios ?? {}) },
  };
}

/** Campos que a OS mostra do cadastro e que a OS exige para emitir — o que falta é avisado. */
export function faltandoNoCadastroParaOs(f: Pick<Fornecedor, "telefone" | "email" | "endereco" | "perfilTributario">): string[] {
  const falta: string[] = [];
  if (!f.endereco?.trim()) falta.push("endereço");
  if (!f.perfilTributario?.trim()) falta.push("perfil tributário");
  if (!f.telefone?.trim()) falta.push("telefone");
  if (!f.email?.trim()) falta.push("e-mail");
  return falta;
}

/* --------------------------- a tela de cadastro -------------------------- */

/**
 * A busca da tela /fornecedores: nome ou CPF/CNPJ (com ou sem máscara) — e,
 * como antes, o que mais a linha mostra (perfil, e-mail, telefone, contatos):
 * era possível ver "Som & Luz" na lista e não achar nada ao digitar isso.
 */
export function filtrarListaFornecedores(lista: readonly Fornecedor[], busca: string): Fornecedor[] {
  const texto = busca.trim();
  if (!texto) return [...lista];
  if (buscaPorDocumento(texto)) {
    const digitos = onlyDigits(texto);
    return lista.filter((f) => onlyDigits(f.cnpj).includes(digitos));
  }
  const termos = normalizarBusca(texto).split(" ").filter(Boolean);
  return lista.filter((f) => {
    const alvo = normalizarBusca(
      [f.apelido, f.nomeFantasia, f.razaoSocial, f.cnpj, f.perfilTributario, f.email, f.telefone, f.representante,
       ...(f.contatos ?? []).flatMap((c) => [c.nome, c.funcao, c.email, c.telefone])]
        .filter(Boolean)
        .join(" "),
    );
    return termos.every((t) => alvo.includes(t));
  });
}
