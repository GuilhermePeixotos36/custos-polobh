/**
 * Sub-aba Grupos de permissão (padrão de Acessos LSPRO): Nome (+ selos Sistema e Padrão),
 * Descrição, Nível no banco (adaptação Pólobh), Usuários, Resumo, Status e o lápis. Lista curta:
 * sem filtros. Grupo não se exclui — inativa-se dentro do popup.
 */
import { Eye, Pencil, ShieldCheck } from "lucide-react";
import { EstadoVazio } from "@/components/padrao/EstadoVazio";
import { Selo } from "@/components/padrao/Selo";
import { Table, THead, Th, Tr, Td } from "@/components/ui";
import { BotaoIcone } from "./comum";
import { NIVEIS_NO_BANCO } from "@/config/acessos/catalogo";
import { resumoDoGrupo } from "@/lib/acessos/permissoes";
import type { GrupoAcesso } from "@/lib/acessos/acessosStore";

export function AbaGrupos({ grupos, meuGrupoId, euSouAdministrador, podeEditar, onAbrir }: {
  grupos: GrupoAcesso[];
  meuGrupoId: string | undefined;
  euSouAdministrador: boolean;
  podeEditar: boolean;
  onAbrir: (grupo: GrupoAcesso) => void;
}) {
  if (grupos.length === 0) return <EstadoVazio semCartao icone={ShieldCheck} titulo="Nenhum grupo de permissão cadastrado." />;
  const ordenados = [...grupos].sort((a, b) => Number(b.sistema) - Number(a.sistema) || a.nome.localeCompare(b.nome, "pt-BR"));
  return (
    <Table>
      <THead>
        <Th grudado={false}>Nome</Th>
        <Th grudado={false}>Descrição</Th>
        <Th grudado={false}>Nível no banco</Th>
        <Th grudado={false} align="center">Usuários</Th>
        <Th grudado={false}>Resumo</Th>
        <Th grudado={false}>Status</Th>
        <Th grudado={false} align="right"><span className="sr-only">Ações</span></Th>
      </THead>
      <tbody>
        {ordenados.map((g) => {
          // Só leitura: o de sistema, o próprio grupo de quem não é Administrador, ou sem permissão de editar.
          const soVer = g.sistema || !podeEditar || (g.id === meuGrupoId && !euSouAdministrador);
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
              <Td>{g.sistema ? "Administrador" : NIVEIS_NO_BANCO.find((n) => n.valor === g.nivel)?.rotulo ?? "—"}</Td>
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
