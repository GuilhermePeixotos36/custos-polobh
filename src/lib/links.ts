/**
 * Links públicos do sistema (credenciamento e cronograma).
 *
 * Os dois nascem de um token não-adivinhável gerado PELO BANCO
 * (`oss.slug_credenciamento`, `ecs.slug_publico`) e só existem depois que o
 * registro é salvo. Por isso eles são derivados aqui, na hora de usar, e não
 * guardados montados: um link gravado em campo vira mentira assim que o
 * endereço do sistema muda — foi o que aconteceu com o
 * `https://forms.polobh.com.br/cred/...` que a OS carregava por padrão e saía
 * na planilha e no PDF sem nunca ter existido.
 */
import type { Ec, Os } from "@/data/types";

/** Origem do app. Fora do navegador (teste/edge), cai no domínio de produção. */
export const origemDoApp = (): string =>
  typeof location !== "undefined" && location.origin ? location.origin : "https://custos-polobh.vercel.app";

/**
 * Formulário público de credenciamento do fornecedor.
 * Devolve "" enquanto a OS não tiver token — a tela avisa em vez de mostrar link quebrado.
 */
export function urlCredenciamento(os: Pick<Os, "slugCredenciamento" | "credenciamento">): string {
  if (os.slugCredenciamento) return `${origemDoApp()}/credenciamento/${os.slugCredenciamento}`;
  // Registro antigo: só aproveita o link gravado se ele não for o domínio fictício.
  const gravado = os.credenciamento?.linkFormulario ?? "";
  return gravado.includes("forms.polobh.com.br") ? "" : gravado;
}

/** Cronograma público do projeto (o que se manda ao cliente). */
export function urlCronogramaPublico(ec: Pick<Ec, "slugPublico">): string {
  return ec.slugPublico ? `${origemDoApp()}/cronograma/${ec.slugPublico}` : "";
}
