/**
 * Busca os feriados NACIONAIS na BrasilAPI e guarda o resultado.
 *
 * A API é pública e sem chave, como a de CNPJ que o sistema já usa. O resultado
 * fica em `config_app` (`feriados`), e não é buscado toda vez que alguém abre o
 * calendário: a lista de um ano não muda depois de publicada, e o quadro do ano
 * é a tela mais aberta da casa.
 *
 * Falha de rede não é erro de tela: o quadro funciona sem feriado nenhum — ele
 * só fica menos informado. Por isso as funções daqui devolvem o que têm e
 * seguem, em vez de propagar exceção para a tela do calendário.
 */
import { repo } from "@/data";
import { feriadosDaApi, feriadosVazios, type Feriado, type FeriadosGuardados } from "@/domain/feriados";

const CHAVE = "feriados";
const ENDPOINT = (ano: number) => `https://brasilapi.com.br/api/feriados/v1/${ano}`;

/** O que está guardado — sem ir à rede. */
export async function lerFeriados(): Promise<FeriadosGuardados> {
  const guardado = await repo.config.ler<FeriadosGuardados>(CHAVE).catch(() => undefined);
  return { ...feriadosVazios(), ...(guardado ?? {}) };
}

export async function gravarFeriados(valor: FeriadosGuardados): Promise<void> {
  await repo.config.gravar(CHAVE, valor);
}

/**
 * Garante os feriados nacionais de um ano, buscando na BrasilAPI só quando
 * ainda não temos.
 *
 * Devolve a lista guardada (atualizada ou não) — quem chama desenha o que
 * receber. Buscar de novo um ano que já veio seria uma chamada de rede por
 * abertura de calendário para trazer exatamente o mesmo conteúdo.
 */
export async function garantirFeriadosNacionais(ano: number): Promise<FeriadosGuardados> {
  const atual = await lerFeriados();
  if (atual.nacionais[String(ano)]?.length) return atual;
  try {
    const resp = await fetch(ENDPOINT(ano));
    if (!resp.ok) return atual;
    const lista = feriadosDaApi(await resp.json());
    if (!lista.length) return atual;
    const novo: FeriadosGuardados = {
      ...atual,
      nacionais: { ...atual.nacionais, [String(ano)]: lista },
    };
    // Gravar pode falhar por permissão (quem não administra não escreve em
    // `config_app`): a tela do ano continua com a lista em mãos de qualquer
    // jeito, e a gravação acontece quando alguém que pode abrir o calendário.
    await gravarFeriados(novo).catch(() => {});
    return novo;
  } catch {
    return atual;
  }
}

/** Os feriados municipais lançados à mão, ano a ano (Configurações). */
export async function salvarFeriadosMunicipais(ano: number, lista: Feriado[]): Promise<void> {
  const atual = await lerFeriados();
  await gravarFeriados({
    ...atual,
    municipais: { ...atual.municipais, [String(ano)]: lista },
  });
}
