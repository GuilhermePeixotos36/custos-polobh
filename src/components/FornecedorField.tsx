import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui";
import { IcCheck } from "@/components/icons";
import { onlyDigits, maskCpfCnpjInput, maskDoc } from "@/lib/format";
import { cnpjValido } from "@/lib/cnpj";
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
export function FornecedorField({ razao, cnpj, fornecedores, onChange, onValidar }: Props) {
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
    return fornecedores.filter((f) => onlyDigits(f.cnpj).startsWith(digits)).slice(0, 6);
  }, [fornecedores, digits]);

  function escolher(f: Fornecedor) {
    ultimoAplicado.current = onlyDigits(f.cnpj);
    setFoco(false);
    onChange({ fornecedorCnpj: maskDoc(f.cnpj), fornecedorRazao: nomeDe(f) });
  }

  async function validar() {
    setValidando(true);
    try {
      const nome = await onValidar(cnpj);
      if (nome) {
        ultimoAplicado.current = digits;
        onChange({ fornecedorRazao: nome });
      }
    } finally {
      setValidando(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex items-center gap-1 w-42 shrink-0">
        <Input
          className="h-9! px-2! text-[12.5px]!"
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
            onClick={validar}
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
        className="h-9! px-2! text-[12.5px]! flex-1 min-w-24"
        placeholder="Razão social"
        value={razao}
        onChange={(e) => onChange({ fornecedorRazao: e.target.value })}
      />
    </div>
  );
}
