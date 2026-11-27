import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui";
import { IcCheck, IcPlus } from "@/components/icons";
import { FormularioFornecedor, novoFornecedor } from "@/components/cadastros/FormularioFornecedor";
import { useAuth } from "@/store/auth";
import { onlyDigits, maskCpfCnpjInput, maskDoc } from "@/lib/format";
import { cnpjValido } from "@/lib/cnpj";
import { flags } from "@/lib/flags";
import { useAoCompletarDocumento } from "@/lib/buscaPorDocumento";
import type { Fornecedor } from "@/data/types";

interface Props {
  razao: string;
  cnpj: string;
  fornecedores: Fornecedor[];
  onChange: (patch: { fornecedorRazao?: string; fornecedorCnpj?: string }) => void;
  /** Consulta o CNPJ na API e registra o fornecedor no sistema. Retorna a razão social ou null. */
  onValidar: (cnpj: string) => Promise<string | null>;
}

/**
 * Campo de fornecedor da linha da EC — CNPJ e Razão social lado a lado.
 *
 * O preenchimento automático é governado pelo CNPJ e roda num efeito, não no
 * `onChange` do input. Isso conserta o caso em que ele "sumia": digitar o CNPJ
 * antes de a lista de fornecedores terminar de carregar, ou editar o CNPJ de uma
 * linha que já tinha razão social preenchida — nas duas situações o antigo
 * `onChange` só olhava a lista naquele instante e desistia.
 *
 * O efeito aplica o nome UMA vez por CNPJ (`ultimoAplicado`): depois disso, a
 * razão social continua livre para ser corrigida à mão sem o sistema desfazer.
 */
export function FornecedorField({ razao, cnpj, fornecedores: doCadastro, onChange, onValidar }: Props) {
  /**
   * O "+" (27/11/2026): cadastrar um fornecedor novo sem sair do item da EC. Abre
   * o mesmo formulário da tela Cadastros, já com o que foi digitado aqui; ao
   * salvar, o CNPJ e o nome entram nos campos. Só para quem cadastra fornecedor.
   */
  const podeCadastrar = useAuth((s) => s.pode("fornecedores.editar"));
  const [cadastrando, setCadastrando] = useState(false);
  // Os cadastrados por aqui entram na lista na hora, sem esperar a tela recarregar.
  const [novos, setNovos] = useState<Fornecedor[]>([]);
  const fornecedores = useMemo(() => (novos.length ? [...doCadastro, ...novos] : doCadastro), [doCadastro, novos]);
  const [validando, setValidando] = useState(false);
  const [foco, setFoco] = useState(false);
  const digits = onlyDigits(cnpj);
  const ultimoAplicado = useRef("");

  const registrado = useMemo(
    () => (digits.length === 14 || digits.length === 11 ? fornecedores.find((f) => onlyDigits(f.cnpj) === digits) : undefined),
    [fornecedores, digits]
  );
  const podeValidar = digits.length === 14 && !registrado && cnpjValido(digits);

  const nomeDe = (f: Fornecedor) => f.nomeFantasia || f.razaoSocial;

  // Autocomplete: dispara quando o CNPJ fica completo E quando a lista de
  // fornecedores chega depois (carregamento assíncrono).
  useEffect(() => {
    if (digits.length !== 14 && digits.length !== 11) {
      // CNPJ incompleto/apagado: libera o próximo preenchimento automático.
      ultimoAplicado.current = "";
      return;
    }
    if (!registrado || ultimoAplicado.current === digits) return;
    ultimoAplicado.current = digits;
    const nome = nomeDe(registrado);
    if (nome && nome !== razao) onChange({ fornecedorRazao: nome });
    // `razao` e `onChange` ficam fora: o efeito reage à identidade do fornecedor,
    // não a cada tecla digitada na razão social.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, registrado]);

  // Sugestões enquanto digita: fornecedores cujo CNPJ começa pelo que já foi digitado.
  const sugestoes = useMemo(() => {
    if (digits.length < 2 || digits.length === 14) return [];
    // Inativo não é sugerido (27/11/2026) — mas continua reconhecido quando o documento é digitado por inteiro.
    return fornecedores.filter((f) => f.ativo !== false && onlyDigits(f.cnpj).startsWith(digits)).slice(0, 6);
  }, [fornecedores, digits]);

  function escolher(f: Fornecedor) {
    ultimoAplicado.current = onlyDigits(f.cnpj);
    setFoco(false);
    onChange({ fornecedorCnpj: maskDoc(f.cnpj), fornecedorRazao: nomeDe(f) });
  }

  async function validar(doc = cnpj) {
    setValidando(true);
    try {
      const nome = await onValidar(doc);
      if (nome) {
        ultimoAplicado.current = onlyDigits(doc);
        onChange({ fornecedorRazao: nome });
      }
    } finally {
      setValidando(false);
    }
  }

  /**
   * CNPJ SEM CADASTRO digitado na linha (18/11/2026, Marisa): a validação na
   * Receita e o registro do fornecedor rodam sozinhos, sem clicar em "Validar".
   * Quem já está no cadastro é preenchido pelo efeito acima; CPF não tem fonte
   * pública. O botão continua para tentar de novo.
   */
  useAoCompletarDocumento(cnpj, true, (d) => {
    if (d.length === 14 && !registrado && flags.consultaCnpj) void validar(d);
  });

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex items-center gap-1 w-[10.5rem] shrink-0">
        <Input
          className="!h-9 !px-2 !text-[12.5px]"
          placeholder="CPF ou CNPJ"
          inputMode="numeric"
          autoComplete="off"
          value={cnpj}
          onChange={(e) => onChange({ fornecedorCnpj: maskCpfCnpjInput(e.target.value) })}
          onFocus={() => setFoco(true)}
          onBlur={() => setTimeout(() => setFoco(false), 150)}
        />
        {registrado && (
          <span title={`Fornecedor já registrado: ${nomeDe(registrado)}`} className="text-success shrink-0">
            <IcCheck width={16} height={16} />
          </span>
        )}
        {podeValidar && (
          <button
            type="button"
            onClick={() => void validar()}
            disabled={validando}
            title="Validar CNPJ na Receita e registrar o fornecedor no sistema"
            className="shrink-0 h-9 px-2 rounded-btn bg-primary-soft text-primary-dark text-[11px] font-extrabold hover:bg-active-border disabled:opacity-50 whitespace-nowrap"
          >
            {validando ? "…" : "Validar"}
          </button>
        )}
        {foco && sugestoes.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-auto rounded-btn border border-border-soft bg-surface shadow-lg">
            {sugestoes.map((f) => (
              <button
                key={f.id || f.cnpj}
                type="button"
                className="w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-bg border-b border-border-soft last:border-b-0"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(f)}
              >
                <div className="font-bold text-ink">{maskDoc(f.cnpj)}</div>
                <div className="text-ink-2 text-[11.5px] truncate">{nomeDe(f)}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      <Input
        className="!h-9 !px-2 !text-[12.5px] flex-1 min-w-[6rem]"
        placeholder="Razão social"
        value={razao}
        onChange={(e) => onChange({ fornecedorRazao: e.target.value })}
      />
      {podeCadastrar && !registrado && (
        <button
          type="button"
          onClick={() => setCadastrando(true)}
          title="Cadastrar um novo fornecedor sem sair daqui"
          aria-label="Cadastrar um novo fornecedor"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-btn border-[1.5px] border-[#D6D9E0] bg-surface text-ink-2 hover:border-primary hover:bg-primary-soft hover:text-primary-dark input-focus"
        >
          <IcPlus width={15} height={15} />
        </button>
      )}
      {cadastrando && (
        <FormularioFornecedor
          inicial={{ ...novoFornecedor(), cnpj, razaoSocial: razao }}
          todos={fornecedores}
          onClose={() => setCadastrando(false)}
          onSalvo={(salvo) => {
            setNovos((atuais) => [...atuais, salvo]);
            setCadastrando(false);
            ultimoAplicado.current = onlyDigits(salvo.cnpj);
            onChange({ fornecedorCnpj: maskDoc(salvo.cnpj), fornecedorRazao: nomeDe(salvo) });
          }}
        />
      )}
    </div>
  );
}
