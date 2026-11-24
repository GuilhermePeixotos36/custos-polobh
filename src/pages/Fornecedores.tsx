/**
 * FORNECEDORES — o cadastro único (24/11/2026, Módulo 1).
 *
 * A tela virou item do menu principal e segue o padrão de lista do design
 * system: cabeçalho com "Novo fornecedor", a superfície com a barra de busca
 * (nome ou CPF/CNPJ, sempre à vista) e a contagem, a tabela ordenável (nome
 * A→Z de saída), esqueleto no carregamento, os dois estados vazios e cartões
 * no celular.
 *
 * O cadastro abre em popup (`JanelaCadastroFornecedor`) — o MESMO formulário
 * do "+" da EC e do "Abrir cadastro" da OS. O cartão lateral de edição que
 * morava aqui saiu: era a terceira cópia do formulário.
 */
import { useDeferredValue, useMemo, useState } from "react";
import { Plus, Search, Truck } from "lucide-react";

import { CabecalhoPagina } from "@/components/padrao/CabecalhoPagina";
import { BarraFiltros } from "@/components/padrao/BarraFiltros";
import { useOrdenacao } from "@/components/padrao/CabecalhoOrdenavel";
import { CabecalhoDeColuna, useFiltrosDeColuna, type ColunaDeLista } from "@/components/padrao/CabecalhoDeColuna";
import { ordenarPorColuna } from "@/components/padrao/ordenacaoTabela";
import { filtrarPorColunas, type ExtratoresDeFiltro } from "@/components/padrao/filtrosColuna";
import { EsqueletoTabela } from "@/components/padrao/EsqueletoTabela";
import { EstadoVazio } from "@/components/padrao/EstadoVazio";
import { AvisoEmLinha } from "@/components/padrao/AvisoEmLinha";
import { Selo } from "@/components/padrao/Selo";
import { Button } from "@/components/ui";
import { JanelaCadastroFornecedor } from "@/components/fornecedor/JanelaCadastroFornecedor";
import { repo } from "@/data";
import type { Fornecedor } from "@/data/types";
import { filtrarListaFornecedores, fornecedorEmBranco } from "@/domain/cadastroFornecedor";
import { textoDoQueFalta, validarEndereco } from "@/domain/endereco";
import { useAsync } from "@/hooks/useAsync";
import { maskDoc } from "@/lib/format";
import { useAuth } from "@/store/auth";

const COLUNAS: ColunaDeLista[] = [
  { rotulo: "Fornecedor", chave: "fornecedor", tipo: "texto" },
  { rotulo: "CPF/CNPJ", chave: "cnpj", tipo: "natural", classe: "whitespace-nowrap" },
  { rotulo: "Perfil", chave: "perfil", tipo: "texto" },
  { rotulo: "Contato", chave: "contato", tipo: "texto" },
];

const VALORES: Record<string, (f: Fornecedor) => string> = {
  fornecedor: (f) => f.nomeFantasia || f.razaoSocial,
  cnpj: (f) => f.cnpj,
  perfil: (f) => f.perfilTributario,
  contato: (f) => f.email,
};

/**
 * Filtro por coluna (24/11/2026): os mesmos dados da ordenação, com o CPF/CNPJ escrito como na
 * tela (mascarado) — é assim que a pessoa o reconhece no painel.
 */
const VALORES_FILTRO: ExtratoresDeFiltro<Fornecedor> = {
  ...VALORES,
  cnpj: (f) => maskDoc(f.cnpj),
};

/** Desempate estável: pela razão social, depois pelo id. */
const desempate = (a: Fornecedor, b: Fornecedor) =>
  a.razaoSocial.localeCompare(b.razaoSocial, "pt-BR", { sensitivity: "base" }) || a.id.localeCompare(b.id);

/** "Endereço incompleto — falta cep" — o que impede o contrato de sair inteiro. */
function avisoEndereco(f: Fornecedor): string {
  const v = validarEndereco(f.endereco);
  return v.completo ? "" : `Endereço incompleto: ${textoDoQueFalta(v.faltando).replace(/\.$/, "").toLocaleLowerCase("pt-BR")}`;
}

/** Quem é o primeiro contato, não só quantos são: "Maria · Produção +2" ajuda a decidir se abre a ficha. */
function resumoContatos(f: Fornecedor): string {
  const c = f.contatos ?? [];
  if (!c.length) return "";
  const primeiro = [c[0].nome, c[0].funcao].filter(Boolean).join(" · ") || "contato sem nome";
  return c.length > 1 ? `${primeiro} +${c.length - 1}` : primeiro;
}

export function Fornecedores() {
  const podeEditar = useAuth((s) => s.pode("fornecedores.editar"));
  const { data, loading, error, reload } = useAsync(() => repo.fornecedores.listar(), [], { oQue: "os fornecedores" });
  const [busca, setBusca] = useState("");
  const buscaAdiada = useDeferredValue(busca);
  const [aberto, setAberto] = useState<Fornecedor | null>(null);
  const { ordem, ordenarPor } = useOrdenacao({ chave: "fornecedor", sentido: "asc" });
  const filtrosColuna = useFiltrosDeColuna();

  /** Depois da busca: é daqui que o painel de cada coluna tira os valores. */
  const base = useMemo(() => filtrarListaFornecedores(data ?? [], buscaAdiada), [data, buscaAdiada]);
  const lista = useMemo(
    () => ordenarPorColuna(filtrarPorColunas(base, filtrosColuna.filtros, VALORES_FILTRO), COLUNAS, ordem, VALORES, desempate),
    [base, filtrosColuna.filtros, ordem],
  );

  const carregando = loading && !data;
  const abrir = (f: Fornecedor) => setAberto(structuredClone(f));

  return (
    <div className="flex-1 w-full max-w-[1600px] mx-auto px-(--gutter) py-5 md:py-6">
      <CabecalhoPagina
        titulo="Fornecedores"
        descricao="Um cadastro por CPF/CNPJ — o mesmo em toda EC, OS e contrato. Os dados da Receita entram sozinhos pelo CNPJ."
        acoes={podeEditar && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAberto(fornecedorEmBranco())}>
            Novo fornecedor
          </Button>
        )}
      />

      <div className="card-surface overflow-hidden">
        <BarraFiltros
          busca={busca}
          onBusca={setBusca}
          placeholderBusca="Nome ou CPF/CNPJ"
          rotuloBusca="Buscar fornecedor por nome ou CPF/CNPJ"
          contagem={carregando || error ? undefined : `${lista.length} fornecedor(es)`}
          filtrosDeColuna={filtrosColuna.ativos}
          onLimpar={filtrosColuna.limpar}
          className="movel:[&_input]:h-10"
        />

        {error ? (
          <div className="px-4 pb-4">
            <AvisoEmLinha tom="erro">
              Não foi possível carregar os fornecedores. {error}{" "}
              <button type="button" onClick={reload} className="font-semibold underline">Tentar de novo</button>
            </AvisoEmLinha>
          </div>
        ) : carregando ? (
          <EsqueletoTabela colunas={COLUNAS.map((c) => c.rotulo)} rotulo="Carregando os fornecedores…" />
        ) : lista.length === 0 ? (
          (data?.length ?? 0) > 0 ? (
            <EstadoVazio
              semCartao
              icone={Search}
              titulo="Nenhum fornecedor encontrado."
              descricao="Confira o nome ou o CPF/CNPJ digitado, ou os filtros das colunas."
              acao={<Button variant="secondary" onClick={() => { setBusca(""); filtrosColuna.limpar(); }}>Limpar filtros</Button>}
            />
          ) : (
            <EstadoVazio
              semCartao
              icone={Truck}
              titulo="Nenhum fornecedor cadastrado."
              descricao="Cadastre pelo CNPJ aqui, ou pelo + ao lado do fornecedor numa EC."
            />
          )
        ) : (
          <>
            {/* Computador: a tabela em matriz. */}
            <div className="overflow-x-auto movel:hidden">
              <table className="lista-matriz w-full text-sm">
                <CabecalhoDeColuna
                  colunas={COLUNAS}
                  ordem={ordem}
                  onOrdenar={ordenarPor}
                  itens={base}
                  valoresFiltro={VALORES_FILTRO}
                  filtros={filtrosColuna.filtros}
                  onFiltros={filtrosColuna.setFiltros}
                />
                <tbody>
                  {lista.map((f) => {
                    const end = avisoEndereco(f);
                    const contatos = resumoContatos(f);
                    return (
                      <tr key={f.id} onClick={() => abrir(f)} className="cursor-pointer">
                        <td className="px-4 py-3">
                          {/* A célula tem um botão de verdade: a linha abre pelo teclado também. */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); abrir(f); }}
                            className="text-left font-semibold text-foreground hover:text-brand-forte focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-sm"
                          >
                            {f.nomeFantasia || f.razaoSocial || "Sem nome"}
                          </button>
                          {f.nomeFantasia && f.razaoSocial !== f.nomeFantasia && (
                            <div className="text-xs text-muted-foreground">{f.razaoSocial}</div>
                          )}
                          {end && <div className="mt-0.5 text-2xs font-semibold text-warning">{end}</div>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums">{maskDoc(f.cnpj) || "—"}</td>
                        <td className="px-4 py-3">{f.perfilTributario ? <Selo tom="neutro">{f.perfilTributario}</Selo> : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3">
                          <div>{f.email || "—"}</div>
                          {contatos && <div className="text-2xs text-muted-foreground">{contatos}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Celular: a mesma lista em cartões. */}
            <ul className="hidden space-y-3 px-4 pb-4 movel:block">
              {lista.map((f) => {
                const end = avisoEndereco(f);
                return (
                  <li key={f.id} className="card-surface">
                    <button type="button" onClick={() => abrir(f)} className="block w-full p-4 text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{f.nomeFantasia || f.razaoSocial || "Sem nome"}</p>
                          {f.nomeFantasia && f.razaoSocial !== f.nomeFantasia && (
                            <p className="text-xs text-muted-foreground">{f.razaoSocial}</p>
                          )}
                        </div>
                        {f.perfilTributario && <Selo tom="neutro" className="shrink-0">{f.perfilTributario}</Selo>}
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                        <div>
                          <dt className="text-muted-foreground">CPF/CNPJ</dt>
                          <dd className="tabular-nums text-foreground">{maskDoc(f.cnpj) || "—"}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-muted-foreground">E-mail</dt>
                          <dd className="truncate text-foreground">{f.email || "—"}</dd>
                        </div>
                      </dl>
                      {end && <p className="mt-2 text-2xs font-semibold text-warning">{end}</p>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <JanelaCadastroFornecedor
        fornecedor={aberto}
        cadastro={data ?? []}
        onFechar={() => setAberto(null)}
        onSalvo={() => { setAberto(null); reload(); }}
      />
    </div>
  );
}
