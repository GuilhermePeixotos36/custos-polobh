/**
 * Como cada texto do sistema é escrito — caixa alta e baixa, num lugar só.
 *
 * O PROBLEMA QUE ISTO RESOLVE. A padronização morava no `<Input formato="...">`
 * e acontecia no BLUR: ela só alcançava o que alguém digitou e depois saiu do
 * campo. Tudo o que entra no formulário POR CÓDIGO escapava — a consulta de
 * CNPJ (a Receita devolve tudo em CAIXA ALTA), a importação de uma EC, a foto
 * do evento copiada para a OS, os modelos de item. O resultado aparecia na tela
 * como "BANCO MERCANTIL DO BRASIL SA" no meio de nomes bem escritos, e a
 * correção era feita caso a caso: a migração `20260809160000` chegou a corrigir
 * três clientes um a um, com os valores calculados à mão rodando a função do
 * app. "ISENTO" na inscrição estadual é o mesmo furo, ainda aberto.
 *
 * A REGRA AGORA É ÚNICA E FICA NO CAMINHO DA GRAVAÇÃO. Este módulo diz como
 * cada campo se escreve, e a camada de dados o aplica em TODO save (ver os
 * `*Row` em `data/supabase.ts`) — não importa se o valor foi digitado, puxado
 * de uma API, importado de outra EC ou herdado de um modelo. O `formato` do
 * `<Input>` continua existindo para o retorno imediato enquanto se digita; a
 * palavra final é daqui.
 *
 * SÓ SE MEXE NO QUE VEIO EM CAIXA ALTA. Esta é a regra da casa, já escrita em
 * `gerarApelidoFornecedor`: texto TODO EM MAIÚSCULAS é o padrão das fontes
 * externas (Receita, BrasilAPI) e se normaliza; texto em caixa mista é decisão
 * de gente e se respeita — quem escreveu "Sonora AV" quis aquilo. Sem esse
 * corte, "Belo Horizonte/MG" viraria "Belo Horizonte/Mg" e "Coffee break"
 * viraria "Coffee Break" a cada gravação. O que se digita já é padronizado na
 * hora, pelo `formato` do `<Input>`.
 *
 * O QUE NÃO SE MEXE, de propósito: documento (CNPJ/CPF), telefone, e-mail, URL,
 * código de serviço, número de nota, CNAE e qualquer campo de número. Formatar
 * isso não arruma nada e estraga dado que precisa bater com fonte externa. O
 * NOME DO ITEM da EC antes ficava de fora, por ser cheio de sigla da casa; desde
 * 07/10/2026 ele e o nome do GRUPO têm regra própria (mais abaixo), que só mexe
 * no que vem todo em maiúsculas e preserva as siglas. Texto longo (descritivo, roteiro, observação) tem dono
 * próprio: o revisor da EC (`lib/correcaoOrtografica`), que preserva parágrafos.
 */
import { capitalizarFrase, colapsarEspacos, tituloProprio } from "@/lib/format";
import { pareceSigla } from "@/domain/fornecedor";
import type {
  Cliente,
  ContatoFornecedor,
  EcLinha,
  Fornecedor,
  GrupoExtraOs,
  ItemExtraOs,
  Os,
  ProjetoInfo,
  Representante,
} from "@/data/types";

/**
 * As formas de escrever um campo.
 *
 *  · `titulo`         — Nome Próprio: pessoas e lugares;
 *  · `titulo-empresa` — idem, preservando siglas societárias (LTDA, ME, S/A);
 *  · `endereco`       — idem, preservando a UF e o "CEP:";
 *  · `frase`          — maiúscula só no começo das frases (títulos curtos);
 *  · `inscricao`      — número fica intocado; palavra vira Nome Próprio (ISENTO);
 *  · `livre`          — só apara espaços: documento, telefone, e-mail, apelido.
 */
export type FormatoTexto =
  | "titulo"
  | "titulo-empresa"
  | "endereco"
  | "frase"
  | "inscricao"
  | "livre";

/** As 27 unidades da federação — para não virarem "Mg" no meio do endereço. */
const UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

/**
 * Endereço: Nome Próprio, menos a UF e o "CEP:", que continuam em caixa alta.
 *
 * Passar o endereço inteiro pelo `tituloProprio` é justamente o erro que a
 * migração `20260809160000` deixou gravado — há um cliente em produção com
 * "... - Belo Horizonte - Mg - Cep: 30575834". A régua da casa é a mesma de
 * `montarEndereco` (lib/cnpj), que já montava o endereço pedaço a pedaço para
 * escapar disso; aqui ela vale para o endereço venha de onde vier.
 */
function padronizarEndereco(texto: string): string {
  return preservarMaiusculas(tituloProprio(texto), (letras) => letras === "CEP" || (letras.length === 2 && UFS.has(letras)));
}

/**
 * Devolve à CAIXA ALTA as palavras que o `tituloProprio` não devia ter baixado.
 *
 * Ele trata cada palavra como nome próprio, e há duas famílias que não são:
 * a UF e o "CEP:" do endereço, e as siglas — português não começa palavra com
 * três consoantes seguidas ("LSPRO") nem escreve palavra sem vogal ("VT"), que
 * é o mesmo teste que o apelido do fornecedor já usa (`pareceSigla`).
 */
function preservarMaiusculas(texto: string, manter: (letras: string, palavra: string) => boolean): string {
  return texto
    .split(" ")
    .map((palavra) => {
      // Só as letras decidem: "Mg" e "MG," são a mesma coisa; "Sé" não é "SE".
      const letras = palavra.replace(/[^\p{L}]/gu, "").toLocaleUpperCase("pt-BR");
      return letras && manter(letras, palavra) ? palavra.toLocaleUpperCase("pt-BR") : palavra;
    })
    .join(" ");
}

/**
 * Sigla é palavra CURTA. O teste de `pareceSigla` procura três consoantes
 * seguidas, e em palavra comprida isso acontece o tempo todo — "CONSTRUTORA"
 * tem "nstr", "CONTRIBUINTE" tem "ntr". Sem o teto elas ficariam gritando no
 * meio do texto. O caso sem vogal nenhuma ("VT") já é curto por natureza.
 */
const LETRAS_SIGLA = 5;
const ehSigla = (letras: string): boolean => letras.length <= LETRAS_SIGLA && pareceSigla(letras);

/** Nome próprio com as siglas de pé: "LSPRO Locacoes", e não "Lspro Locacoes". */
const tituloComSiglas = (texto: string, opts: { preservarSiglas?: boolean } = {}): string =>
  preservarMaiusculas(tituloProprio(texto, opts), ehSigla);

/**
 * Veio de fonte externa?
 *
 * CAIXA ALTA é como Receita e BrasilAPI entregam tudo. Caixa mista é escolha de
 * quem escreveu, e não se mexe nela — é o mesmo critério de `ajustarCaixa`, em
 * `domain/fornecedor`.
 */
const emCaixaAlta = (texto: string): boolean =>
  /\p{L}/u.test(texto) && texto === texto.toLocaleUpperCase("pt-BR");

export function padronizarTexto(valor: string | undefined | null, formato: FormatoTexto): string {
  const limpo = colapsarEspacos(valor ?? "");
  if (!limpo) return "";
  // Caixa mista já é escolha de gente: só apara os espaços e devolve.
  if (formato === "livre" || !emCaixaAlta(limpo)) return limpo;
  switch (formato) {
    case "titulo":
      return tituloComSiglas(limpo);
    case "titulo-empresa":
      return tituloComSiglas(limpo, { preservarSiglas: true });
    case "endereco":
      return padronizarEndereco(limpo);
    case "frase":
      // Baixa tudo antes: `capitalizarFrase` só mexe na primeira letra, e
      // "MÍDIA" continuaria "MÍDIA".
      return capitalizarFrase(limpo.toLocaleLowerCase("pt-BR"));
    case "inscricao":
      // O campo aceita duas coisas muito diferentes: um número de inscrição ou a
      // palavra que diz que não há inscrição. Havendo qualquer dígito é o
      // número, e ele fica exatamente como a fonte mandou — mexer ali quebraria
      // a conferência com a Receita. Sendo só palavra ("ISENTO"), vira texto
      // escrito como o resto do sistema.
      return /\d/.test(limpo) ? limpo : tituloComSiglas(limpo);
  }
}

/* ------------------------- GRUPOS e ITENS (EC e OS) ------------------------ */

/**
 * NOME DE GRUPO — sempre em CAIXA ALTA (07/10/2026).
 *
 * O grupo é cabeçalho de faixa ("EQUIPE PRODUÇÃO", "SEGURANÇA") e sai assim na
 * tela, no Excel e no documento. Até aqui a caixa alta era só um efeito de CSS
 * no campo: o que se gravava era o que a pessoa digitou, e "equipe produção"
 * aparecia maiúscula na tela e minúscula na planilha. Agora a regra é a mesma
 * em todo lugar, e vale na gravação — venha o nome de onde vier (digitado,
 * importado de outra EC, modelo).
 */
export const padronizarNomeGrupo = (valor: string | undefined | null): string =>
  colapsarEspacos(valor ?? "").toLocaleUpperCase("pt-BR");

/**
 * Siglas que a casa escreve em caixa alta e que o teste de `pareceSigla` não
 * pega (têm vogal e não têm três consoantes seguidas). Só valem quando o nome
 * do item veio TODO em maiúsculas — em caixa mista nada é mexido.
 */
const SIGLAS_DA_CASA = new Set([
  "ECAD", "BV", "NF", "NFS", "OS", "EC", "DJ", "MC", "TV", "TI", "AV", "RH", "PA",
  "ART", "LED", "VIP", "PCD", "EPI", "SCE", "GPS", "USB", "CPF", "CNPJ", "UTI", "WIFI",
]);

/**
 * NOME DE ITEM (e rótulo de item da OS) — primeira letra maiúscula (07/10/2026).
 *
 * Duas regras, as duas SEM IA e sem adivinhar:
 *  · caixa mista é decisão de gente e se respeita — só garante a primeira letra
 *    maiúscula ("palco" → "Palco"; "E-mail MKT" fica como está);
 *  · o que veio TODO EM MAIÚSCULAS ("EQUIPE TÉCNICA", "MÍDIA") vira frase —
 *    "Equipe técnica", "Mídia" —, preservando as siglas ("ECAD", "VT", "BV").
 *
 * Antes o nome do item ficava de fora da padronização por medo de baixar sigla.
 * O medo continua certo para o texto em caixa mista (por isso não se mexe nele);
 * mas tudo-maiúsculo já é sinal de texto que veio de fora ou de CapsLock.
 */
export function padronizarNomeItem(valor: string | undefined | null): string {
  const limpo = colapsarEspacos(valor ?? "");
  if (!limpo) return "";
  const frase = emCaixaAlta(limpo)
    ? limpo
        .split(" ")
        .map((palavra) => {
          const letras = palavra.replace(/[^\p{L}]/gu, "");
          // Palavra de uma letra só e sigla conhecida ficam; o resto desce.
          return SIGLAS_DA_CASA.has(letras) || (letras.length > 1 && ehSigla(letras))
            ? palavra
            : palavra.toLocaleLowerCase("pt-BR");
        })
        .join(" ")
    : limpo;
  return frase.charAt(0).toLocaleUpperCase("pt-BR") + frase.slice(1);
}

const padronizarItemExtra = (i: ItemExtraOs): ItemExtraOs => ({ ...i, rotulo: padronizarNomeItem(i.rotulo) });
const padronizarGrupoExtra = (g: GrupoExtraOs): GrupoExtraOs => ({
  ...g,
  nome: padronizarNomeGrupo(g.nome),
  itens: (g.itens ?? []).map(padronizarItemExtra),
});

/**
 * Grupos e itens que a OS carrega: os grupos extras (nome em CAIXA ALTA, itens
 * em frase) e os rótulos dos itens extras de Logística e Infraestrutura. Os
 * campos FIXOS não entram — o nome deles é do sistema.
 */
export function padronizarBlocosDaOs(os: Pick<Os, "logistica" | "infraestrutura" | "gruposExtras">) {
  return {
    logistica: os.logistica && {
      ...os.logistica,
      ...(os.logistica.extras ? { extras: os.logistica.extras.map(padronizarItemExtra) } : {}),
    },
    infraestrutura: os.infraestrutura && {
      ...os.infraestrutura,
      ...(os.infraestrutura.extras ? { extras: os.infraestrutura.extras.map(padronizarItemExtra) } : {}),
    },
    gruposExtras: os.gruposExtras?.map(padronizarGrupoExtra),
  };
}

/* ----------------------------- por entidade ------------------------------ */

export function padronizarRepresentante(r: Representante | undefined): Representante {
  return {
    nome: padronizarTexto(r?.nome, "titulo"),
    cargo: padronizarTexto(r?.cargo, "titulo"),
    telefones: padronizarTexto(r?.telefones, "livre"),
    email: padronizarTexto(r?.email, "livre"),
  };
}

export function padronizarCliente(c: Cliente): Cliente {
  return {
    ...c,
    // O apelido é o código curto pelo qual a casa chama o cliente ("BM", "BR")
    // e vira prefixo do número da EC: passá-lo por Nome Próprio daria "Bm".
    apelido: padronizarTexto(c.apelido, "livre"),
    nome: padronizarTexto(c.nome, "titulo"),
    razaoSocial: padronizarTexto(c.razaoSocial, "titulo-empresa"),
    endereco: padronizarTexto(c.endereco, "endereco"),
    cnpjCpf: padronizarTexto(c.cnpjCpf, "livre"),
    inscricaoEstadual: padronizarTexto(c.inscricaoEstadual, "inscricao"),
    inscricaoMunicipal: padronizarTexto(c.inscricaoMunicipal, "inscricao"),
    representante: padronizarRepresentante(c.representante),
  };
}

const padronizarContato = (c: ContatoFornecedor): ContatoFornecedor => ({
  ...c,
  nome: padronizarTexto(c.nome, "titulo"),
  funcao: padronizarTexto(c.funcao, "titulo"),
  telefone: padronizarTexto(c.telefone, "livre"),
  email: padronizarTexto(c.email, "livre"),
});

export function padronizarFornecedor(f: Fornecedor): Fornecedor {
  return {
    ...f,
    razaoSocial: padronizarTexto(f.razaoSocial, "titulo-empresa"),
    // O apelido é escolha da casa e entra no título da OS: fica como escreveram.
    apelido: f.apelido,
    nomeFantasia: padronizarTexto(f.nomeFantasia, "titulo"),
    endereco: padronizarTexto(f.endereco, "endereco"),
    inscricaoEstadual: padronizarTexto(f.inscricaoEstadual, "inscricao"),
    inscricaoMunicipal: padronizarTexto(f.inscricaoMunicipal, "inscricao"),
    representante: padronizarTexto(f.representante, "titulo"),
    contatos: (f.contatos ?? []).map(padronizarContato),
  };
}

/**
 * Dados do evento. `titulo` fica de fora: ele é COMPOSTO (cliente + projeto +
 * ano, ver `compoeTituloProjeto`) e às vezes ajustado à mão para o documento —
 * reescrevê-lo aqui desfaria o ajuste. As partes que o compõem, sim, passam.
 */
export function padronizarProjetoInfo(info: ProjetoInfo): ProjetoInfo {
  return {
    ...info,
    clienteAbreviado: padronizarTexto(info.clienteAbreviado, "titulo"),
    nomeProjeto: padronizarTexto(info.nomeProjeto, "titulo"),
    local: padronizarTexto(info.local, "titulo"),
    enderecoLocal: padronizarTexto(info.enderecoLocal, "endereco"),
    produtoraResponsavel: padronizarTexto(info.produtoraResponsavel, "titulo"),
  };
}

/**
 * Linha da EC: fornecedor, GRUPO e NOME DO ITEM.
 *
 * O grupo sai em CAIXA ALTA e o item com a primeira letra maiúscula (ver
 * `padronizarNomeGrupo` e `padronizarNomeItem`). A descrição financeira NÃO
 * entra aqui: tem dono próprio (o revisor da EC).
 */
export function padronizarEcLinha(l: EcLinha): EcLinha {
  return {
    ...l,
    grupo: padronizarNomeGrupo(l.grupo) || l.grupo,
    item: padronizarNomeItem(l.item),
    fornecedorRazao: padronizarTexto(l.fornecedorRazao, "titulo-empresa"),
    fornecedorContato: padronizarTexto(l.fornecedorContato, "titulo"),
  };
}
