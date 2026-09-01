/**
 * Apelido do fornecedor — o nome curto que entra no título da OS.
 *
 * Ninguém precisa digitar: o sistema reduz o nome do fornecedor sozinho. Razão
 * social vem da Receita e é quase toda enfeite jurídico e descrição de
 * atividade — "SOM & LUZ PRODUÇÕES LTDA", "LSPRO LOCACOES, SERVICOS E EVENTOS
 * LTDA" —, e é isso que inchava o título da OS sem ajudar a identificar quem é.
 *
 * A redução tira, nesta ordem:
 *   1. a forma jurídica (LTDA, ME, EIRELI, S/A…), que nunca identifica nada;
 *   2. o RECHEIO CORPORATIVO do fim para o começo (Produções, Serviços,
 *      Locações, Eventos, Comércio…) — palavra que qualquer empresa poderia ter;
 *   3. a ATIVIDADE (Cenografia, Áudio, Estruturas, Buffet…), mas só enquanto
 *      sobrarem DUAS palavras identificando. É o que separa "Casa da
 *      Cenografia" — em que a atividade faz parte do nome — de "Monta Tudo
 *      Estruturas", em que ela é só o ramo.
 *
 * O nome fantasia, quando existe, entra como fonte preferida: ele já é o nome
 * curto escolhido pela empresa. Mas passa pela mesma peneira, porque muita ficha
 * traz "Som & Luz Produções Ltda" no campo de fantasia também.
 */
import type { ContatoFornecedor, Fornecedor } from "@/data/types";

/** Forma jurídica: sai sempre, esteja onde estiver. */
const JURIDICO = new Set([
  "ltda", "limitada", "me", "epp", "eireli", "eirl", "mei", "sa", "s/a", "s.a", "s.a.",
  "cia", "companhia", "ss", "s/s", "microempresa", "empresario", "individual",
  "sociedade", "simples", "matriz", "filial", "grupo",
]);

/**
 * Recheio corporativo: palavra que qualquer empresa poderia ter no nome. Sai do
 * fim para o começo, sem limite — não identifica ninguém.
 */
const RECHEIO = new Set([
  "producoes", "producao", "servicos", "servico", "locacoes", "locacao", "comercio",
  "comercial", "industria", "industrial", "empreendimentos", "empreendimento",
  "participacoes", "representacoes", "representacao", "assessoria", "consultoria",
  "solucoes", "solucao", "promocoes", "promocao", "organizacao", "organizacoes",
  "eventos", "evento", "negocios", "atividades", "gerais", "geral", "brasil",
]);

/**
 * Atividade: diz o que a empresa faz. Ajuda a identificar quando é parte do
 * nome, então só sai enquanto restarem duas palavras identificando.
 */
const ATIVIDADE = new Set([
  "cenografia", "cenotecnica", "audio", "video", "iluminacao", "sonorizacao", "som",
  "luz", "estruturas", "estrutura", "montagem", "montagens", "buffet", "gastronomia",
  "alimentacao", "transportes", "transporte", "logistica", "tecnologia", "marketing",
  "publicidade", "propaganda", "comunicacao", "grafica", "graficas", "impressos",
  "culturais", "cultural", "artisticas", "artistica", "artes", "audiovisual",
  "seguranca", "limpeza", "recepcao", "cerimonial", "turismo", "viagens", "hotel",
  "hotelaria", "engenharia", "arquitetura", "design", "mobiliario", "decoracao",
]);

/** Liga palavras sem identificar nada sozinho ("da", "de", "e", "&"). */
const LIGACAO = new Set(["da", "de", "do", "das", "dos", "e", "em", "com", "&", "para", "por", "a", "o"]);

/** Sem acento e em minúsculas — a chave de comparação com as listas. */
const chave = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.,;:]/g, "").toLocaleLowerCase("pt-BR");

/**
 * Parece sigla e não palavra? Português não começa palavra com três consoantes
 * seguidas ("LSPRO"), e palavra sem vogal nenhuma também não existe ("MPG").
 * Serve para a sigla não virar "Lspro" ao acertar a caixa do texto.
 */
const pareceSigla = (t: string): boolean => {
  const limpo = chave(t).replace(/[^a-z]/g, "");
  if (!limpo) return false;
  return !/[aeiou]/.test(limpo) || /[bcdfghjklmnpqrstvwxyz]{3,}/.test(limpo);
};

/** Quantas palavras de fato identificam (ligações não contam). */
const identificadores = (tokens: string[]) => tokens.filter((t) => !LIGACAO.has(chave(t))).length;

/** Quantas palavras o apelido pode ter, e o teto de caracteres no título da OS. */
const MAX_PALAVRAS = 3;
const MAX_CARACTERES = 24;

/**
 * Acerta a caixa: nome que veio TODO EM MAIÚSCULAS (o padrão da Receita) é
 * normalizado; nome digitado com caixa mista é respeitado como está — quem
 * escreveu "Sonora AV" quis aquilo.
 */
function ajustarCaixa(tokens: string[], fonteEmCaixaAlta: boolean): string[] {
  if (!fonteEmCaixaAlta) return tokens;
  return tokens.map((t) => {
    if (t === "&") return t;
    if (pareceSigla(t)) return t.toLocaleUpperCase("pt-BR");
    const minusculo = t.toLocaleLowerCase("pt-BR");
    // Ligação no meio do nome fica minúscula: "Casa da Cenografia".
    if (LIGACAO.has(chave(t))) return minusculo;
    return minusculo.charAt(0).toLocaleUpperCase("pt-BR") + minusculo.slice(1);
  });
}

/**
 * Reduz o nome do fornecedor ao apelido usado no título da OS.
 *
 * Devolve "" quando não há nome nenhum; nunca devolve vazio a partir de um nome
 * preenchido — na dúvida, prefere manter palavra a mais do que perder a
 * identificação.
 */
export function gerarApelidoFornecedor(nomeFantasia?: string, razaoSocial?: string): string {
  const fonte = (nomeFantasia || "").trim() || (razaoSocial || "").trim();
  if (!fonte) return "";
  const emCaixaAlta = fonte === fonte.toLocaleUpperCase("pt-BR");

  let tokens = fonte
    .replace(/[/\\|]+/g, " ")
    .split(/[\s]+/)
    .map((t) => t.replace(/[,;]+$/g, ""))
    .filter(Boolean)
    // 1. forma jurídica sai de qualquer posição
    .filter((t) => !JURIDICO.has(chave(t)));

  // 2. do fim para o começo, tirando recheio, ligação solta e atividade — cada
  //    um com a sua regra. Num laço só: em "REINECKE PRODUÇÕES CULTURAIS", é a
  //    atividade ("Culturais") que destrava o recheio ("Produções") atrás dela.
  while (tokens.length > 1) {
    const ultimo = chave(tokens[tokens.length - 1]);
    const removivel =
      RECHEIO.has(ultimo) ||
      LIGACAO.has(ultimo) ||
      // Atividade só sai enquanto sobrarem DUAS palavras identificando.
      (ATIVIDADE.has(ultimo) && identificadores(tokens) - 1 >= 2);
    if (!removivel) break;
    tokens = tokens.slice(0, -1);
  }

  // 4. categoria à frente do nome ("BUFFET Sabor & Arte"), com a mesma trava
  while (tokens.length > 1) {
    const primeiro = chave(tokens[0]);
    if (!ATIVIDADE.has(primeiro) && !RECHEIO.has(primeiro)) break;
    if (identificadores(tokens) - 1 < 2) break;
    tokens = tokens.slice(1);
    while (tokens.length > 1 && LIGACAO.has(chave(tokens[0]))) tokens = tokens.slice(1);
  }

  // 5. corta pelo número de palavras e pelo tamanho, sem terminar em ligação
  const cortadas: string[] = [];
  for (const t of tokens) {
    if (identificadores(cortadas) >= MAX_PALAVRAS) break;
    const proximo = [...cortadas, t].join(" ");
    if (cortadas.length && proximo.length > MAX_CARACTERES) break;
    cortadas.push(t);
  }
  while (cortadas.length > 1 && LIGACAO.has(chave(cortadas[cortadas.length - 1]))) cortadas.pop();

  const final = cortadas.length ? cortadas : tokens.slice(0, 1);
  return ajustarCaixa(final, emCaixaAlta).join(" ").trim();
}

/* ------------------------- Perfil tributário ---------------------------- */

/**
 * Perfis tributários que um fornecedor pode ter — a lista do campo "Perfil" na
 * OS, que antes era texto livre.
 *
 * Livre, o campo virava um dicionário particular: "simples", "SIMPLES NACIONAL",
 * "Simples Nac.", "presumido" — tudo a mesma coisa, e nenhuma comparável com a
 * outra. O perfil decide retenção e o que a nota precisa trazer, então ele
 * precisa ser um valor conhecido, não uma frase.
 *
 * "Lucro Presumido/Real" não é imprecisão nossa: é o que a consulta de CNPJ
 * consegue afirmar. As fontes públicas dizem se a empresa optou por MEI ou pelo
 * Simples; entre Presumido e Real elas não distinguem, e o preenchimento
 * automático cai nessa opção até alguém confirmar qual dos dois é (ver
 * `lib/cnpj`). Por isso ela fica na lista, e não escondida como valor herdado.
 *
 * "Pessoa Física (RPA)" não é regime de empresa, mas é a classificação de quem
 * emite RPA em vez de nota — comum em evento (técnico, operador, artista) e o
 * que mais muda a conta do financeiro.
 */
export const PERFIS_TRIBUTARIOS = [
  "MEI",
  "Simples Nacional",
  "Lucro Presumido",
  "Lucro Real",
  "Lucro Presumido/Real",
  "Imune / Isenta",
  "Pessoa Física (RPA)",
] as const;

/**
 * Opções para o campo, com o valor JÁ GRAVADO na frente quando ele não estiver
 * na lista. Um `<select>` cujo valor não existe entre as opções aparece vazio, e
 * salvar a OS depois disso apagaria em silêncio o que estava lá — numa OS antiga
 * cujo perfil foi digitado à mão, é dado perdido sem ninguém perceber.
 */
export function opcoesPerfilTributario(atual: string): string[] {
  const valor = atual.trim();
  const conhecido = PERFIS_TRIBUTARIOS.some((p) => p.toLocaleLowerCase("pt-BR") === valor.toLocaleLowerCase("pt-BR"));
  return valor && !conhecido ? [valor, ...PERFIS_TRIBUTARIOS] : [...PERFIS_TRIBUTARIOS];
}

/* --------------------- o cadastro preenchendo a OS ---------------------- */

/** Tira do patch o que está vazio: fonte sem valor não apaga o que está na tela. */
export function semVazios<T extends Record<string, string | undefined>>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => !!v?.trim())) as Partial<T>;
}

/**
 * O que o cadastro do fornecedor tem a dizer sobre ele, pronto para preencher a
 * OS.
 *
 * Inclui justamente o que NENHUMA fonte pública devolve — Inscrição Estadual e
 * Municipal, dados bancários, representante. É por isso que o cadastro vem
 * antes da Receita numa consulta de CNPJ: ele é a memória da casa, e a API não
 * tem como reconstituí-lo.
 *
 * Campo vazio no cadastro não entra, para não apagar o que já está na tela.
 */
export function doCadastro(f: Fornecedor): Partial<Fornecedor> {
  const texto = semVazios({
    razaoSocial: f.razaoSocial,
    nomeFantasia: f.nomeFantasia,
    perfilTributario: f.perfilTributario,
    endereco: f.endereco,
    inscricaoEstadual: f.inscricaoEstadual,
    inscricaoMunicipal: f.inscricaoMunicipal,
    representante: f.representante,
    telefone: f.telefone,
    email: f.email,
  });
  const bancarios = semVazios({
    tipoConta: f.dadosBancarios?.tipoConta,
    banco: f.dadosBancarios?.banco,
    agencia: f.dadosBancarios?.agencia,
    conta: f.dadosBancarios?.conta,
    chavePix: f.dadosBancarios?.chavePix,
  });
  return {
    ...texto,
    ...(f.cnaes?.length ? { cnaes: f.cnaes } : {}),
    // Os bancários vêm como bloco: a OS guarda o objeto inteiro.
    ...(Object.keys(bancarios).length
      ? { dadosBancarios: { ...f.dadosBancarios, ...bancarios } as Fornecedor["dadosBancarios"] }
      : {}),
  };
}

/* ------------------------- Contatos do fornecedor ----------------------- */

/**
 * Os contatos já foram uma LISTA DE FRASES ("Maria — (31) 9…"), e o banco
 * guarda o que foi gravado na época. Estas funções são a ponte: leem os dois
 * formatos e gravam sempre o novo.
 *
 * A conversão acontece na LEITURA, não numa migração de banco. Uma frase só
 * vira nome/telefone/e-mail depois de passar por uma leitura que entende
 * telefone brasileiro e endereço de e-mail — coisa que se faz bem em código e
 * mal em SQL. Assim nenhum registro antigo se perde e nenhum precisa ser
 * convertido de véspera: ele se acerta sozinho quando alguém salva o cadastro.
 */

/** E-mail dentro de uma frase. */
const RE_EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

/**
 * Telefone brasileiro dentro de uma frase, com ou sem DDI, parênteses e
 * separadores: "(31) 99999-0000", "31 3333-4444", "+55 31 999990000".
 */
const RE_TELEFONE = /(?:\+?55[\s.-]*)?\(?\d{2}\)?[\s.-]*\d{4,5}[\s.-]?\d{4}/;

/** Sobras de pontuação que separavam os pedaços da frase. */
const SEPARADORES = /^[\s·•—–\-|/,;:]+|[\s·•—–\-|/,;:]+$/g;

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Lê uma frase antiga e devolve o contato separado. Devolve `null` quando não
 * sobra nada de útil — string vazia, ou só pontuação.
 */
export function contatoDeTexto(frase: string): ContatoFornecedor | null {
  let resto = frase ?? "";
  const email = resto.match(RE_EMAIL)?.[0] ?? "";
  if (email) resto = resto.replace(email, " ");
  const telefone = resto.match(RE_TELEFONE)?.[0] ?? "";
  if (telefone) resto = resto.replace(telefone, " ");
  const nome = resto.replace(/\s+/g, " ").replace(SEPARADORES, "").trim();
  if (!nome && !telefone && !email) return null;
  return semCamposVazios({ nome, telefone: telefone.trim(), email: email.trim() });
}

/** Tira os campos vazios para o objeto gravado não carregar `""` à toa. */
function semCamposVazios(c: ContatoFornecedor): ContatoFornecedor {
  return {
    nome: (c.nome ?? "").trim(),
    ...(c.funcao?.trim() ? { funcao: c.funcao.trim() } : {}),
    ...(c.telefone?.trim() ? { telefone: c.telefone.trim() } : {}),
    ...(c.email?.trim() ? { email: c.email.trim() } : {}),
  };
}

/**
 * Lê o que veio do banco, seja qual for o formato: a lista de frases antiga ou
 * a lista de contatos separados. Lixo é descartado em silêncio — uma linha
 * estranha no meio da agenda não pode derrubar a tela de fornecedores.
 */
export function normalizarContatos(cru: unknown): ContatoFornecedor[] {
  if (!Array.isArray(cru)) return [];
  const lidos: ContatoFornecedor[] = [];
  for (const item of cru) {
    if (typeof item === "string") {
      const c = contatoDeTexto(item);
      if (c) lidos.push(c);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const c = semCamposVazios({
      nome: texto(o.nome),
      funcao: texto(o.funcao),
      telefone: texto(o.telefone),
      email: texto(o.email),
    });
    if (!contatoVazio(c)) lidos.push(c);
  }
  return semRepetidos(lidos);
}

/** Contato sem nada dentro — some ao salvar, em vez de virar uma linha em branco. */
export function contatoVazio(c: ContatoFornecedor): boolean {
  return !`${c.nome ?? ""}${c.funcao ?? ""}${c.telefone ?? ""}${c.email ?? ""}`.trim();
}

/**
 * A identidade de um contato: nome, telefone (só os dígitos) e e-mail. O
 * telefone entra por dígitos porque "(31) 99999-0000" e "31999990000" são a
 * mesma pessoa, e a EC nem sempre digita igual ao cadastro.
 */
export function chaveContato(c: ContatoFornecedor): string {
  const nome = (c.nome ?? "").trim().toLocaleLowerCase("pt-BR");
  return `${nome}|${(c.telefone ?? "").replace(/\D/g, "")}|${(c.email ?? "").trim().toLowerCase()}`;
}

function semRepetidos(lista: ContatoFornecedor[]): ContatoFornecedor[] {
  const vistos = new Set<string>();
  return lista.filter((c) => {
    const k = chaveContato(c);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/** O que vai para o banco: sem os vazios, sem repetidos, sem espaço sobrando. */
export function limparContatos(lista: ContatoFornecedor[]): ContatoFornecedor[] {
  return semRepetidos(lista.map(semCamposVazios).filter((c) => !contatoVazio(c)));
}

/**
 * Junta o que veio das ECs com o que já está no cadastro.
 *
 * A regra que faz diferença: contato com o MESMO NOME não vira uma segunda
 * linha — ele COMPLETA a que existe. A EC quase sempre traz um pedaço só
 * ("Maria" numa linha, "Maria (31) 9…" em outra), e sem isto a agenda de um
 * fornecedor antigo viraria cinco Marias, cada uma com metade do contato.
 * Só preenche o que está em branco: o que a equipe digitou no cadastro manda.
 */
export function mesclarContatos(
  existentes: ContatoFornecedor[],
  novos: ContatoFornecedor[]
): ContatoFornecedor[] {
  const saida = existentes.map(semCamposVazios);
  for (const novo of novos.map(semCamposVazios)) {
    if (contatoVazio(novo)) continue;
    const nome = novo.nome.trim().toLocaleLowerCase("pt-BR");
    const alvo = saida.find(
      (c) =>
        chaveContato(c) === chaveContato(novo) ||
        (!!nome && c.nome.trim().toLocaleLowerCase("pt-BR") === nome)
    );
    if (!alvo) {
      saida.push(novo);
      continue;
    }
    if (!alvo.funcao && novo.funcao) alvo.funcao = novo.funcao;
    if (!alvo.telefone && novo.telefone) alvo.telefone = novo.telefone;
    if (!alvo.email && novo.email) alvo.email = novo.email;
  }
  return semRepetidos(saida);
}

/** O contato em uma linha — para a busca da tela e para textos corridos. */
export function textoDoContato(c: ContatoFornecedor): string {
  return [c.nome, c.funcao, c.telefone, c.email].map((p) => (p ?? "").trim()).filter(Boolean).join(" · ");
}
