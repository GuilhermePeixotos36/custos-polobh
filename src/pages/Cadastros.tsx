/**
 * CADASTROS (27/11/2026) — fornecedores e clientes numa tela só, em duas subabas.
 *
 * O cadastro de fornecedores já era tela própria; o de clientes não existia (o
 * cliente nascia dentro do projeto). Agora os dois moram aqui, com a mesma
 * lista (ID, olho, lápis) e o mesmo formulário em janela — o mesmo que o "+"
 * abre dentro do projeto e do item da EC.
 */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { SubGuias } from "@/components/layout/SubGuias";
import { Button } from "@/components/ui";
import { IcPlus } from "@/components/icons";
import { ListaFornecedores } from "@/components/cadastros/ListaFornecedores";
import { ListaClientes } from "@/components/cadastros/ListaClientes";
import { useAuth } from "@/store/auth";

type Aba = "fornecedores" | "clientes";
const ABAS: { key: Aba; label: string }[] = [
  { key: "fornecedores", label: "Fornecedores" },
  { key: "clientes", label: "Clientes" },
];

export function Cadastros() {
  const podeEditar = useAuth((s) => s.pode("fornecedores.editar"));
  // A subaba fica no endereço: voltar do navegador e recarregar caem na mesma.
  const [params, setParams] = useSearchParams();
  const aba: Aba = params.get("aba") === "clientes" ? "clientes" : "fornecedores";
  // Cada clique em "Novo…" muda o número; a lista da subaba abre o formulário em branco.
  const [pedidoNovo, setPedidoNovo] = useState({ fornecedores: 0, clientes: 0 });

  return (
    <PageShell
      title="Cadastros"
      subtitle={
        aba === "clientes"
          ? "Os clientes da casa: empresas (CNPJ) e pessoas físicas (CPF)."
          : "Os fornecedores da casa: empresas (CNPJ) e pessoas físicas (CPF)."
      }
      topAction={
        podeEditar && (
          <Button size="sm" icon={<IcPlus width={15} height={15} />} onClick={() => setPedidoNovo((p) => ({ ...p, [aba]: p[aba] + 1 }))}>
            {aba === "clientes" ? "Novo cliente" : "Novo fornecedor"}
          </Button>
        )
      }
      subabas={
        <SubGuias<Aba>
          rotulo="Cadastros"
          atual={aba}
          onChange={(k) => setParams(k === "clientes" ? { aba: "clientes" } : {}, { replace: true })}
          abas={ABAS}
        />
      }
    >
      {aba === "clientes" ? <ListaClientes pedidoNovo={pedidoNovo.clientes} /> : <ListaFornecedores pedidoNovo={pedidoNovo.fornecedores} />}
    </PageShell>
  );
}
