/**
 * Sub-aba Grupos de permissão (padrão de Acessos LSPRO): Nome (+ selos Sistema e Padrão),
 * Descrição, Nível no banco (adaptação Pólobh), Usuários, Resumo, Status e o lápis. Lista curta:
 * sem filtros. Grupo não se exclui — inativa-se dentro do popup.
 *
 * Cabeçalho do padrão (24/11/2026): as colunas ordenam como nas outras listas, mas sem o funil
 * de filtro — são poucos grupos, a tela não tem barra de filtros, e um filtro sem contador nem
 * "Limpar filtros" à vista seria um filtro esquecido. O grupo de sistema fica sempre no topo,
 * em qualquer ordem: é a referência da lista.
 */
import { useMemo } from "react";
import { Eye, Pencil, ShieldCheck } from "lucide-react";
import { EstadoVazio } from "@/components/padrao/EstadoVazio";
import { Selo } from "@/components/padrao/Selo";
import { Table, Tr, Td } from "@/components/ui";
import { CabecalhoDeColuna, type ColunaDeLista } from "@/components/padrao/CabecalhoDeColuna";
import { useOrdenacao } from "@/components/padrao/CabecalhoOrdenavel";
import { ordenarPorColuna, type ValorOrdenavel } from "@/components/padrao/ordenacaoTabela";
import { BotaoIcone } from "./comum";
import { NIVEIS_NO_BANCO } from "@/config/acessos/catalogo";
import { resumoDoGrupo } from "@/lib/acessos/permissoes";
import type { GrupoAcesso } from "@/lib/acessos/acessosStore";

const COLUNAS: ColunaDeLista[] = [
  { rotulo: "Nome", chave: "nome", tipo: "texto" },
  { rotulo: "Descrição", chave: "descricao", tipo: "texto" },
  { rotulo: "Nível no banco", chave: "nivel", tipo: "texto" },
  { rotulo: "Usuários", chave: "usuarios", tipo: "numero", classe: "text-center" },
  { rotulo: "Resumo" },
  { rotulo: "Status", chave: "status", tipo: "texto" },
  { rotulo: "Ações", classe: "text-right", conteudo: <span className="sr-only">Ações</span> },
];

const nivelDe = (g: GrupoAcesso) => (g.sistema ? "Administrador" : NIVEIS_NO_BANCO.find((n) => n.valor === g.nivel)?.rotulo);

const VALORES: Record<string, (g: GrupoAcesso) => ValorOrdenavel> = {
  nome: (g) => g.nome,
  descricao: (g) => g.descricao,
  nivel: nivelDe,
  usuarios: (g) => g.usuarios,
  status: (g) => (g.ativo ? "Ativo" : "Inativo"),
};

const desempate = (a: GrupoAcesso, b: GrupoAcesso) => a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id);

export function AbaGrupos({ grupos, meuGrupoId, euSouAdministrador, podeEditar, concediveisIds, onAbrir }: {
  grupos: GrupoAcesso[];
  meuGrupoId: string | undefined;
  euSouAdministrador: boolean;
  podeEditar: boolean;
  /** Grupos que quem está na tela poderia conceder: só esses ele altera (se não é do Administrador). */
  concediveisIds: ReadonlySet<string>;
  onAbrir: (grupo: GrupoAcesso) => void;
}) {
  const { ordem, ordenarPor } = useOrdenacao({ chave: "nome", sentido: "asc" });
  const ordenados = useMemo(() => {
    const lista = ordenarPorColuna(grupos, COLUNAS, ordem, VALORES, desempate);
    return [...lista.filter((g) => g.sistema), ...lista.filter((g) => !g.sistema)];
  }, [grupos, ordem]);
  if (grupos.length === 0) return <EstadoVazio semCartao icone={ShieldCheck} titulo="Nenhum grupo de permissão cadastrado." />;
  return (
    <Table>
      <CabecalhoDeColuna colunas={COLUNAS} ordem={ordem} onOrdenar={ordenarPor} />
      <tbody>
        {ordenados.map((g) => {
          // Só leitura: o de sistema, o próprio grupo de quem não é Administrador, ou sem permissão de editar.
          const soVer = g.sistema || !podeEditar
            || (!euSouAdministrador && (g.id === meuGrupoId || !concediveisIds.has(g.id)));
          return (
            <Tr key={g.id} onClick={() => onAbrir(g)}>
              <Td>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{g.nome}</span>
                  {g.sistema && <Selo tom="marca">Sistema</Selo>}
                  {g.padrao && <Selo tom="cinza">Padrão</Selo>}
                </span>
              </Td>
              <Td className="text-muted-foreground">{g.descricao || "—"}</Td>
              <Td>{nivelDe(g) ?? "—"}</Td>
              <Td align="center" className="tabular-nums">
                {g.usuarios === null
                  ? <span title="Você não tem permissão para ver os usuários">—</span>
                  : g.usuarios}
              </Td>
              <Td className="text-muted-foreground">{resumoDoGrupo(g.permissoes)}</Td>
              <Td><Selo tom={g.ativo ? "sucesso" : "neutro"} ponto>{g.ativo ? "Ativo" : "Inativo"}</Selo></Td>
              <Td align="right">
                <BotaoIcone
                  rotulo={soVer ? `Ver o grupo ${g.nome}` : `Editar o grupo ${g.nome}`}
                  icone={soVer ? <Eye /> : <Pencil />}
                  onClick={() => onAbrir(g)}
                />
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
