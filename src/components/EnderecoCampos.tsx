/**
 * O ENDEREÇO EM CAMPOS (13/11/2026, pedido da Marisa): Tipo (Rua/Avenida…), Nome,
 * Número, Complemento, Bairro, Cidade, UF e CEP — e o texto padronizado que o
 * resto do sistema consome sai daqui (`formatarEndereco`):
 *
 *   Rua Nome, Número - Complemento - Bairro - Cidade - UF - CEP: 00000-000
 *
 * A tela guarda os campos enquanto a pessoa digita e só devolve o TEXTO a quem
 * a usa. Isso importa: reler o texto a cada tecla redistribuiria o que foi
 * digitado (um complemento sem bairro viraria o bairro). O texto de fora só
 * é relido quando ele muda por outro caminho — a consulta de CNPJ, por exemplo.
 */
import { useEffect, useRef, useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import {
  camposFaltando,
  formatarCep,
  formatarEndereco,
  lerEndereco,
  ROTULO_CAMPO,
  TIPOS_LOGRADOURO,
  UFS,
  type EnderecoPartes,
} from "@/domain/endereco";
import { cx } from "@/lib/format";

const maskCep = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

export function EnderecoCampos({
  value,
  onChange,
  onBlur,
  className,
}: {
  value: string;
  onChange: (texto: string) => void;
  /** Para quem grava ao sair do campo (Empresas do Grupo). Recebe o texto atual. */
  onBlur?: (texto: string) => void;
  className?: string;
}) {
  const lido = lerEndereco(value);
  const [partes, setPartes] = useState<EnderecoPartes>(lido.partes);
  /** O último texto que ESTE componente conhece (o que leu ou o que escreveu). */
  const conhecido = useRef(value);

  useEffect(() => {
    if (value !== conhecido.current) {
      conhecido.current = value;
      setPartes(lerEndereco(value).partes);
    }
  }, [value]);

  const faltando = camposFaltando(partes);
  const foraDoPadrao = !lerEndereco(value).padronizado && !!value.trim() && formatarEndereco(partes) !== value.trim();

  function mudar(patch: Partial<EnderecoPartes>) {
    const proximo = { ...partes, ...patch };
    const texto = formatarEndereco(proximo);
    conhecido.current = texto;
    setPartes(proximo);
    onChange(texto);
  }

  const sair = () => onBlur?.(conhecido.current);
  const obrig = (c: keyof EnderecoPartes) => c !== "complemento";

  return (
    <div className={cx("space-y-2", className)}>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        <Field label={ROTULO_CAMPO.tipo} obrigatorio={obrig("tipo")} className="sm:col-span-2">
          <Select value={partes.tipo} onChange={(e) => mudar({ tipo: e.target.value })} onBlur={sair}>
            <option value="">Selecione…</option>
            {TIPOS_LOGRADOURO.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label={ROTULO_CAMPO.nome} obrigatorio className="col-span-2 sm:col-span-3">
          <Input formato="titulo" value={partes.nome} onChange={(e) => mudar({ nome: e.target.value })} onBlur={sair} />
        </Field>
        <Field label={ROTULO_CAMPO.numero} obrigatorio className="sm:col-span-1">
          <Input value={partes.numero} onChange={(e) => mudar({ numero: e.target.value })} onBlur={sair} placeholder="S/N" />
        </Field>
        <Field label={ROTULO_CAMPO.complemento} className="col-span-2 sm:col-span-2">
          <Input formato="titulo" value={partes.complemento} onChange={(e) => mudar({ complemento: e.target.value })} onBlur={sair} />
        </Field>
        <Field label={ROTULO_CAMPO.bairro} obrigatorio className="col-span-2 sm:col-span-2">
          <Input formato="titulo" value={partes.bairro} onChange={(e) => mudar({ bairro: e.target.value })} onBlur={sair} />
        </Field>
        <Field label={ROTULO_CAMPO.cep} obrigatorio className="col-span-2 sm:col-span-2">
          <Input
            value={partes.cep}
            inputMode="numeric"
            placeholder="00000-000"
            onChange={(e) => mudar({ cep: maskCep(e.target.value) })}
            onBlur={() => {
              if (partes.cep) mudar({ cep: formatarCep(partes.cep) });
              sair();
            }}
          />
        </Field>
        <Field label={ROTULO_CAMPO.cidade} obrigatorio className="col-span-2 sm:col-span-4">
          <Input formato="titulo" value={partes.cidade} onChange={(e) => mudar({ cidade: e.target.value })} onBlur={sair} />
        </Field>
        <Field label={ROTULO_CAMPO.uf} obrigatorio className="col-span-2 sm:col-span-2">
          <Select value={partes.uf} onChange={(e) => mudar({ uf: e.target.value })} onBlur={sair}>
            <option value="">Selecione…</option>
            {UFS.map((u) => <option key={u}>{u}</option>)}
          </Select>
        </Field>
      </div>
      {foraDoPadrao && faltando.length === 0 && (
        <p className="text-[12px] text-warning font-semibold">Este endereço estava fora do padrão; ele passa para o padrão ao salvar.</p>
      )}
      {faltando.length > 0 && !!(value.trim() || Object.values(partes).some(Boolean)) && (
        <p className="text-[12px] text-warning font-semibold">
          Falta preencher: {faltando.map((c) => ROTULO_CAMPO[c].replace(/ \(.*\)$/, "")).join(", ")}.
        </p>
      )}
    </div>
  );
}
