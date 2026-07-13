import { useMemo, useState } from "react";
import { Input } from "@/components/ui";
import { IcCheck } from "@/components/icons";
import { onlyDigits, maskCpfCnpjInput } from "@/lib/format";
import { cnpjValido } from "@/lib/cnpj";
import type { Fornecedor } from "@/data/types";

interface Props {
  razao: string;
  cnpj: string;
  fornecedores: Fornecedor[];
  /** id de um <datalist> compartilhado (renderizado uma vez pelo pai). */
  datalistId: string;
  onChange: (patch: { fornecedorRazao?: string; fornecedorCnpj?: string }) => void;
  /** Consulta o CNPJ na API e registra o fornecedor no sistema. Retorna a razão social ou null. */
  onValidar: (cnpj: string) => Promise<string | null>;
}

/**
 * Campo de fornecedor da linha da EC — CNPJ e Razão social lado a lado.
 * - Ao digitar o CNPJ, a lista suspensa mostra os fornecedores já registrados
 *   e, ao escolher, traz o nome automaticamente.
 * - Se o CNPJ é válido mas ainda não existe no sistema, aparece "Validar" que
 *   chama a API do CNPJ e registra o fornecedor.
 */
export function FornecedorField({ razao, cnpj, fornecedores, datalistId, onChange, onValidar }: Props) {
  const [validando, setValidando] = useState(false);
  const digits = onlyDigits(cnpj);

  const registrado = useMemo(
    () => (digits.length === 14 ? fornecedores.find((f) => onlyDigits(f.cnpj) === digits) : undefined),
    [fornecedores, digits]
  );
  const podeValidar = digits.length === 14 && !registrado && cnpjValido(digits);

  function setCnpj(v: string) {
    const masked = maskCpfCnpjInput(v);
    const d = onlyDigits(masked);
    const match = d.length === 14 ? fornecedores.find((f) => onlyDigits(f.cnpj) === d) : undefined;
    onChange(
      match
        ? { fornecedorCnpj: masked, fornecedorRazao: match.nomeFantasia || match.razaoSocial }
        : { fornecedorCnpj: masked }
    );
  }

  async function validar() {
    setValidando(true);
    try {
      const nome = await onValidar(cnpj);
      if (nome) onChange({ fornecedorRazao: nome });
    } finally {
      setValidando(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <Input
          list={datalistId}
          className="!h-9 !px-2 !text-[12.5px]"
          placeholder="CNPJ do fornecedor"
          inputMode="numeric"
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
        />
        {registrado && (
          <span title="Fornecedor já registrado no sistema" className="text-success shrink-0">
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
      </div>
      <Input
        className="!h-9 !px-2 !text-[12.5px] flex-1 min-w-0"
        placeholder="Razão social"
        value={razao}
        onChange={(e) => onChange({ fornecedorRazao: e.target.value })}
      />
    </div>
  );
}
