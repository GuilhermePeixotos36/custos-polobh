import { useMemo } from "react";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { PERMISSOES } from "@/store/auth";
import type { Usuario } from "@/data/types";

/**
 * Usuários elegíveis a Produtor Responsável — quem pode editar projetos.
 *
 * O critério sai da ÁREA do usuário (Configurações → Áreas), não mais de uma
 * lista fixa de papéis: uma área nova como "Atendimento" passa a aparecer aqui
 * sozinha, desde que tenha a permissão de editar Projetos. Sem área cadastrada,
 * vale a matriz padrão do papel.
 *
 * Importa porque o Produtor Responsável é o dono das pendências do projeto
 * (`domain/pendencias.ts`), que são roteadas pelo NOME cadastrado — um nome
 * digitado à mão nunca encontra dono.
 */
export function useResponsaveis(usuarios: Usuario[] | null | undefined) {
  // Área é legível por qualquer autenticado; se falhar, o filtro cai no papel.
  const { data: areas } = useAsync(() => repo.areas.listar().catch(() => null), []);

  return useMemo(
    () =>
      (usuarios ?? []).filter((u) => {
        // O Admin é o desenvolvedor do sistema, não gente da produção da Pólobh —
        // fora da lista mesmo tendo acesso a tudo.
        if (u.papel === "Admin") return false;
        const area = areas?.find((a) => a.id === u.areaId);
        if (area?.recursos.length) return area.recursos.includes("projetos.editar");
        return PERMISSOES[u.papel].includes("projetos.editar");
      }),
    [usuarios, areas]
  );
}
