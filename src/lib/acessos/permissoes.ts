/**
 * Regras puras das permissões por grupo (padrão de Acessos LSPRO). Nada aqui lê banco nem React:
 * o store de autenticação, a guarda de rota e a matriz do grupo só chamam estas funções, e é por
 * isso que dá para testá-las sem montar tela.
 */
import {
  ACOES_PADRAO, CATALOGO, RECURSO_POR_PERMISSAO, ROTULO_ACAO, type ModuloAcesso, type TelaAcesso,
} from "@/config/acessos/catalogo";

/** Uma permissão gravada: tela + ação, em colunas separadas no banco. */
export type Permissao = { tela: string; acao: string };

const chaveDe = (p: Permissao) => `${p.tela}|${p.acao}`;

const TELAS: TelaAcesso[] = CATALOGO.flatMap((modulo) => modulo.telas);

export function telaPorChave(chave: string): TelaAcesso | undefined {
  return TELAS.find((tela) => tela.chave === chave);
}

export function moduloPorChaveDeTela(chave: string): ModuloAcesso | undefined {
  return CATALOGO.find((modulo) => modulo.telas.some((tela) => tela.chave === chave));
}

/** Todas as ações que a tela tem: as padrão que ela declara e as extras. */
export function acoesDaTela(tela: TelaAcesso): string[] {
  return [...tela.acoes, ...(tela.extras ?? []).map((extra) => extra.chave)];
}

/** Rótulo de uma ação da tela (padrão ou extra), para os nomes acessíveis da matriz. */
export function rotuloDaAcao(tela: TelaAcesso, acao: string): string {
  if ((ACOES_PADRAO as readonly string[]).includes(acao)) return ROTULO_ACAO[acao as keyof typeof ROTULO_ACAO];
  return tela.extras?.find((e) => e.chave === acao)?.rotulo ?? acao;
}

/** A ação escreve? Ver não; extra com `escrita: false` também não. */
export function acaoEscreve(tela: TelaAcesso, acao: string): boolean {
  if (acao === "ver") return false;
  const extra = tela.extras?.find((e) => e.chave === acao);
  return extra ? extra.escrita !== false : true;
}

/** Toda chave `tela|acao` que o catálogo permite — o que o banco nunca valida por conta própria. */
export function chavesDoCatalogo(): Set<string> {
  return new Set(TELAS.flatMap((tela) => acoesDaTela(tela).map((acao) => `${tela.chave}|${acao}`)));
}

/** Tudo marcado: é o que o grupo de sistema (Administrador) mostra, travado. */
export function todasAsPermissoes(moduloId?: string): Permissao[] {
  return CATALOGO
    .filter((modulo) => !moduloId || modulo.id === moduloId)
    .flatMap((modulo) => modulo.telas.flatMap((tela) => acoesDaTela(tela).map((acao) => ({ tela: tela.chave, acao }))));
}

export function pode(permissoes: readonly Permissao[], tela: string, acao: string): boolean {
  return permissoes.some((p) => p.tela === tela && p.acao === acao);
}

const casaRota = (prefixo: string, rota: string) => rota === prefixo || rota.startsWith(`${prefixo}/`);

/**
 * As telas que cobrem a rota, pelo prefixo MAIS LONGO que casa (rota filha cai na tela da mãe).
 * Mais de uma só quando o catálogo põe duas telas na mesma rota (`/acessos`: usuários e grupos).
 * Sem nenhuma, a rota é livre (a página inicial, que só redireciona).
 */
export function telasDaRota(rota?: string): TelaAcesso[] {
  if (!rota) return [];
  let melhor = -1;
  let achadas: TelaAcesso[] = [];
  for (const tela of TELAS) {
    for (const prefixo of tela.rotas) {
      if (!casaRota(prefixo, rota)) continue;
      if (prefixo.length > melhor) { melhor = prefixo.length; achadas = [tela]; }
      else if (prefixo.length === melhor && !achadas.includes(tela)) achadas.push(tela);
    }
  }
  return achadas;
}

/** Rota fora do catálogo é de todo usuário ativo; as demais pedem `ver` em alguma tela dela. */
export function podeVerRota(permissoes: readonly Permissao[], rota?: string): boolean {
  const telas = telasDaRota(rota);
  if (telas.length === 0) return true;
  return telas.some((tela) => pode(permissoes, tela.chave, "ver"));
}

/** A tela tem alguma ação que escreve — é isto que separa "somente leitura" de quem pode mexer. */
export function temEscrita(permissoes: readonly Permissao[], tela: string): boolean {
  const definicao = telaPorChave(tela);
  if (!definicao) return false;
  return permissoes.some((p) => p.tela === tela && acaoEscreve(definicao, p.acao));
}

/**
 * Vê a rota e não tem escrita em nenhuma das telas dela. Rota livre nunca é só leitura, e tela
 * que no catálogo só tem "Ver" (Configurações, Logs, Guia) também não: lá, ver é usar.
 */
export function somenteLeitura(permissoes: readonly Permissao[], rota?: string): boolean {
  const telas = telasDaRota(rota).filter((tela) => acoesDaTela(tela).some((acao) => acaoEscreve(tela, acao)));
  if (telas.length === 0) return false;
  if (!telas.some((tela) => pode(permissoes, tela.chave, "ver"))) return false;
  return !telas.some((tela) => temEscrita(permissoes, tela.chave));
}

/** O módulo aparece se o grupo vê ao menos uma das telas dele. */
export function moduloVisivel(permissoes: readonly Permissao[], moduloId: string): boolean {
  const modulo = CATALOGO.find((m) => m.id === moduloId);
  return !!modulo && modulo.telas.some((tela) => pode(permissoes, tela.chave, "ver"));
}

const semDuplicadas = (lista: Permissao[]): Permissao[] => {
  const vistas = new Set<string>();
  return lista.filter((p) => (vistas.has(chaveDe(p)) ? false : (vistas.add(chaveDe(p)), true)));
};

/**
 * Marca ou desmarca uma ação de uma tela, com a regra do Ver: marcar qualquer ação marca Ver
 * junto (não se edita o que não se vê); desmarcar Ver desmarca a linha inteira.
 */
export function alternarAcao(permissoes: readonly Permissao[], tela: string, acao: string, marcado: boolean): Permissao[] {
  const definicao = telaPorChave(tela);
  if (!definicao || !acoesDaTela(definicao).includes(acao)) return [...permissoes];
  if (marcado) {
    const novas: Permissao[] = acao === "ver" ? [{ tela, acao }] : [{ tela, acao: "ver" }, { tela, acao }];
    return semDuplicadas([...permissoes, ...novas]);
  }
  if (acao === "ver") return permissoes.filter((p) => p.tela !== tela);
  return permissoes.filter((p) => !(p.tela === tela && p.acao === acao));
}

/**
 * Interruptor "Acesso ao módulo". Desligar tira todas as permissões do módulo; ligar não concede
 * nada sozinho (o bloco só abre a tabela).
 */
export function alternarModulo(permissoes: readonly Permissao[], moduloId: string, ligado: boolean): Permissao[] {
  if (ligado) return [...permissoes];
  const modulo = CATALOGO.find((m) => m.id === moduloId);
  if (!modulo) return [...permissoes];
  const telas = new Set(modulo.telas.map((tela) => tela.chave));
  return permissoes.filter((p) => !telas.has(p.tela));
}

/** Cabeçalho de coluna: marca ou desmarca a ação em todas as telas do módulo que a têm. */
export function marcarColuna(permissoes: readonly Permissao[], moduloId: string, acao: string, marcado: boolean): Permissao[] {
  const modulo = CATALOGO.find((m) => m.id === moduloId);
  if (!modulo) return [...permissoes];
  let atual = [...permissoes];
  for (const tela of modulo.telas) {
    if (acoesDaTela(tela).includes(acao)) atual = alternarAcao(atual, tela.chave, acao, marcado);
  }
  return atual;
}

/** "Marcar tudo" do módulo: todas as ações de todas as telas, ou nenhuma. */
export function marcarModulo(permissoes: readonly Permissao[], moduloId: string, marcado: boolean): Permissao[] {
  const semModulo = alternarModulo(permissoes, moduloId, false);
  return marcado ? semDuplicadas([...semModulo, ...todasAsPermissoes(moduloId)]) : semModulo;
}

/** A coluna está inteira marcada? (as telas do módulo que têm a ação) */
export function colunaMarcada(permissoes: readonly Permissao[], moduloId: string, acao: string): boolean {
  const modulo = CATALOGO.find((m) => m.id === moduloId);
  const telas = (modulo?.telas ?? []).filter((tela) => acoesDaTela(tela).includes(acao));
  return telas.length > 0 && telas.every((tela) => pode(permissoes, tela.chave, acao));
}

/** O módulo tem alguma permissão? Decide se o bloco abre ao carregar o grupo. */
export function moduloTemPermissao(permissoes: readonly Permissao[], moduloId: string): boolean {
  const modulo = CATALOGO.find((m) => m.id === moduloId);
  return !!modulo && modulo.telas.some((tela) => permissoes.some((p) => p.tela === tela.chave));
}

/** "12 telas em 2 módulos". Conta tela com ao menos uma permissão. */
export function resumoDoGrupo(permissoes: readonly Permissao[]): string {
  const telas = new Set(permissoes.filter((p) => telaPorChave(p.tela)).map((p) => p.tela));
  if (telas.size === 0) return "Nenhuma tela";
  const modulos = new Set([...telas].map((tela) => moduloPorChaveDeTela(tela)?.id));
  const t = telas.size;
  const m = modulos.size;
  return `${t} ${t === 1 ? "tela" : "telas"} em ${m} ${m === 1 ? "módulo" : "módulos"}`;
}

/**
 * O que pode ir para o banco: descarta chave fora do catálogo (o banco não a recusaria), tira
 * repetição e completa o Ver de toda tela que tem outra ação.
 */
export function permissoesValidas(permissoes: readonly Permissao[]): Permissao[] {
  const validas = chavesDoCatalogo();
  const filtradas = semDuplicadas(permissoes.filter((p) => validas.has(chaveDe(p))));
  const comVer = filtradas.filter((p) => p.acao !== "ver").map((p) => ({ tela: p.tela, acao: "ver" }));
  return semDuplicadas([...filtradas, ...comVer]);
}

/** Colunas fixas da matriz de um módulo + as extras que alguma tela dele declara (sem repetir). */
export function colunasDoModulo(modulo: ModuloAcesso): { chave: string; rotulo: string }[] {
  const extras = new Map<string, string>();
  for (const tela of modulo.telas) for (const extra of tela.extras ?? []) extras.set(extra.chave, extra.rotulo);
  return [
    ...ACOES_PADRAO.map((acao) => ({ chave: acao as string, rotulo: ROTULO_ACAO[acao] })),
    ...[...extras].map(([chave, rotulo]) => ({ chave, rotulo })),
  ];
}

// --- Ponte com os recursos antigos (`Recurso`, src/store/auth.ts) ---------------------------------

/** Os recursos antigos que as permissões do grupo liberam (o que `useAuth().pode` confere). */
export function recursosDasPermissoes(permissoes: readonly Permissao[]): string[] {
  const tem = new Set(permissoes.map(chaveDe));
  return RECURSO_POR_PERMISSAO.filter((m) => tem.has(`${m.tela}|${m.acao}`)).map((m) => m.recurso);
}

/**
 * Modo de compatibilidade (banco ainda sem a migration): as permissões equivalentes aos recursos
 * da área antiga, para a faixa "Somente leitura" e os portões por tela funcionarem igual. As telas
 * de Acessos ficam de fora — sem o banco novo elas só mostram o aviso.
 */
export function permissoesDosRecursos(recursos: readonly string[]): Permissao[] {
  const tem = new Set(recursos);
  return RECURSO_POR_PERMISSAO
    .filter((m) => tem.has(m.recurso) && !m.tela.startsWith("acessos."))
    .map((m) => ({ tela: m.tela, acao: m.acao }));
}
