//
// CPF no front: máscara de digitação, validação e a forma mascarada de exibir. A MESMA validação
// está na Edge (`_shared/acessos.ts`, `cpfValido`) e no banco (`private.cpf_valido`). Mudou uma,
// mude as três.
//
// Onde o CPF aparece:
//   * campo de digitação (cadastro, "Alterar CPF"): com máscara 000.000.000-00, enquanto digita;
//   * lista, detalhes, editar: SEMPRE mascarado — `cpf_mascarado` vindo do banco ("***.456.789-**").
//     A sessão não consegue ler o CPF inteiro (o banco não entrega a coluna);
//   * log, URL, armazenamento local, estado global, mensagem de erro: NUNCA.

/** Só os dígitos, no máximo 11 (o que se cola com pontuação ou espaço também serve). */
export function somenteDigitosDoCpf(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, 11);
}

/**
 * Máscara de digitação: aplica-se a cada tecla no `onChange` do campo.
 * "1234" → "123.4" · "12345678909" → "123.456.789-09".
 */
export function formatarCpf(valor: string): string {
  const d = somenteDigitosDoCpf(valor);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** 11 dígitos, não todos iguais, dígitos verificadores conferem. Aceita com ou sem máscara. */
export function cpfValido(valor: string): boolean {
  const cpf = valor.replace(/\D/g, "");
  if (!/^[0-9]{11}$/.test(cpf) || cpf === cpf[0].repeat(11)) return false;
  const d = cpf.split("").map(Number);
  const verificador = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += d[i] * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return verificador(9) === d[9] && verificador(10) === d[10];
}

/** Erro sob o campo; null = ok. Campo vazio só é erro ao enviar (`obrigatorio`). */
export function motivoDoCpfInvalido(valor: string, obrigatorio = true): string | null {
  const d = somenteDigitosDoCpf(valor);
  if (!d) return obrigatorio ? "Informe o CPF." : null;
  if (d.length < 11) return "O CPF tem 11 números.";
  return cpfValido(d) ? null : "CPF inválido. Confira os números.";
}

/**
 * Forma de exibir: "***.456.789-**". O banco já entrega `cpf_mascarado` neste formato; esta função
 * é para o que a tela tem em mãos (o que acabou de ser digitado, num resumo de confirmação).
 */
export function mascararCpf(valor: string): string {
  const d = valor.replace(/\D/g, "");
  return /^[0-9]{11}$/.test(d) ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : "";
}

/**
 * A busca da lista acha pelo CPF mesmo sem a tela ter o número inteiro: compara os 6 dígitos do
 * meio, que são os que `cpf_mascarado` mostra. Digitar o CPF inteiro (ou só o miolo) acha a pessoa.
 * Com menos de 6 dígitos na busca, não há comparação por CPF.
 */
export function buscaCasaComCpf(busca: string, cpfMascarado: string | null | undefined): boolean {
  if (!cpfMascarado) return false;
  const digitos = busca.replace(/\D/g, "");
  const miolo = cpfMascarado.replace(/\D/g, ""); // 6 dígitos
  if (digitos.length === 11) return digitos.slice(3, 9) === miolo;
  return digitos.length >= 6 && miolo.includes(digitos.slice(0, 6));
}
