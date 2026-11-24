/**
 * A CAIXA COMBINADA DE FORNECEDOR (24/11/2026) — o único jeito de escolher um
 * fornecedor no app.
 *
 * Substitui o par "CNPJ + razão social" digitáveis da linha da EC (o antigo
 * `FornecedorField`) e os campos soltos do bloco do fornecedor na OS. Digita-se
 * o CPF/CNPJ (com ou sem máscara) ou um pedaço do nome, e aparecem os
 * fornecedores CADASTRADOS que casam; aberta e vazia, a lista inteira em ordem
 * alfabética. Escolher preenche o documento e a razão social.
 *
 * Quem ainda não tem cadastro entra pelo "+", que abre o cadastro em popup ali
 * mesmo e, ao concluir, já deixa o fornecedor escolhido. Não há mais caminho
 * para gravar uma razão social digitada sem CNPJ — era assim que nasciam os
 * fornecedores "parecidos".
 *
 * Linha antiga com razão social sem documento (ou com documento que o cadastro
 * não conhece) continua aparecendo como estava — dado não se apaga —, com um
 * aviso discreto de que não está amarrada a um cadastro.
 */
import { useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

import { ComboBox } from "@/components/padrao/ComboBox";
import { JanelaCadastroFornecedor } from "@/components/fornecedor/JanelaCadastroFornecedor";
import { Button } from "@/components/ui";
import type { Fornecedor } from "@/data/types";
import {
  buscaPorDocumento, filtrarFornecedores, fornecedorEmBranco, opcoesDeFornecedores, situacaoFornecedor,
} from "@/domain/cadastroFornecedor";
import { maskCpfCnpjInput, maskDoc, onlyDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  /** O documento escolhido hoje (com ou sem máscara). */
  cnpj: string;
  /** A razão social gravada junto — é o que aparece numa linha antiga sem cadastro. */
  razao: string;
  /** O cadastro de fornecedores, já carregado pela tela. */
  fornecedores: readonly Fornecedor[];
  /** Escolheu (ou acabou de cadastrar): o fornecedor inteiro, como está no cadastro. */
  onEscolher: (f: Fornecedor) => void;
  /** Cadastrou um fornecedor novo pelo "+": a tela recarrega a lista dela. */
  onCadastrado?: (f: Fornecedor) => void;
  /** Mostra o "x" para tirar o fornecedor (a linha da EC pode ficar sem). */
  onLimpar?: () => void;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
};

export function SeletorFornecedor({
  cnpj, razao, fornecedores, onEscolher, onCadastrado, onLimpar, disabled, "aria-label": rotulo = "Fornecedor", className,
}: Props) {
  /** Quem foi cadastrado pelo "+" entra na lista na hora, antes de a tela recarregar a dela. */
  const [recemCadastrados, setRecemCadastrados] = useState<Fornecedor[]>([]);
  const [cadastrando, setCadastrando] = useState<Fornecedor | null>(null);
  /** O que a pessoa digitou por último — se for documento, o "+" já leva para o cadastro. */
  const ultimaBusca = useRef("");

  const todos = useMemo(() => [...fornecedores, ...recemCadastrados], [fornecedores, recemCadastrados]);
  const opcoes = useMemo(() => opcoesDeFornecedores(todos), [todos]);
  const digitos = onlyDigits(cnpj);
  const situacao = situacaoFornecedor(cnpj, razao, todos);

  function escolher(valor: string) {
    const f = todos.find((x) => onlyDigits(x.cnpj) === valor);
    ultimaBusca.current = "";
    if (f) onEscolher(f);
  }

  function abrirCadastro() {
    // Documento digitado na busca (ou o de uma linha antiga sem cadastro) já vai
    // preenchido: é a primeira informação do cadastro.
    const busca = ultimaBusca.current;
    const doc = buscaPorDocumento(busca) ? maskCpfCnpjInput(busca) : situacao === "sem-cadastro" ? maskDoc(cnpj) : "";
    setCadastrando(fornecedorEmBranco(doc));
  }

  function aoSalvar(f: Fornecedor) {
    setCadastrando(null);
    ultimaBusca.current = "";
    if (!fornecedores.some((x) => x.id === f.id)) setRecemCadastrados((l) => [...l.filter((x) => x.id !== f.id), f]);
    onCadastrado?.(f);
    onEscolher(f);
  }

  // Linha antiga: o texto gravado aparece no lugar do "Selecione", em vez de a
  // caixa parecer vazia.
  const textoAntigo = situacao === "sem-documento" ? razao : situacao === "sem-cadastro" ? [razao, maskDoc(cnpj)].filter(Boolean).join(" · ") : "";

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-1.5">
        <ComboBox
          className="min-w-0 flex-1"
          valor={situacao === "cadastrado" ? digitos : ""}
          opcoes={opcoes}
          onChange={escolher}
          filtrar={filtrarFornecedores}
          onBusca={(b) => { ultimaBusca.current = b; }}
          placeholder={textoAntigo || "CPF, CNPJ ou nome do fornecedor"}
          aria-label={rotulo}
          disabled={disabled}
          vazio="Nenhum fornecedor cadastrado com isso. Use o + para cadastrar."
        />
        {onLimpar && situacao !== "vazio" && !disabled && (
          <button
            type="button"
            onClick={onLimpar}
            className="inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
            title="Tirar o fornecedor"
            aria-label="Tirar o fornecedor"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <Button
          type="button"
          variant="secondary"
          className="w-9 shrink-0 px-0"
          onClick={abrirCadastro}
          disabled={disabled}
          title="Fornecedor ainda sem cadastro? Cadastre aqui e ele já fica escolhido"
          aria-label="Cadastrar novo fornecedor"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {(situacao === "sem-documento" || situacao === "sem-cadastro") && (
        <p className="mt-1 text-2xs text-muted-foreground" role="status">
          {situacao === "sem-documento"
            ? "Fornecedor digitado sem CNPJ: não está amarrado a um cadastro. Escolha da lista ou cadastre pelo +."
            : "Este documento não está no cadastro de fornecedores. Cadastre pelo + para amarrá-lo."}
        </p>
      )}
      <JanelaCadastroFornecedor
        fornecedor={cadastrando}
        cadastro={todos}
        onFechar={() => setCadastrando(null)}
        onSalvo={aoSalvar}
        textoNovo="Cadastrar e usar"
        escolher
      />
    </div>
  );
}
