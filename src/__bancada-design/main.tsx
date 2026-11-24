/**
 * Bancada do design system Pólobh — NÃO faz parte do app (só `design-bancada.html` importa este
 * arquivo, e ele não entra no build de produção). Monta a casca e as peças com dados FALSOS.
 */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { Plus, Search, Truck } from "lucide-react";
import "@fontsource-variable/figtree";
import "@/index.css";
import { CascaDoApp } from "@/components/layout/casca/CascaDoApp";
import { ITENS_DE_NAVEGACAO } from "@/config/navegacao";
import { Button, Card, CardTitle, Field, Input, Select, Table, THead, Th, Tr, Td, Badge } from "@/components/ui";
import { CabecalhoPagina } from "@/components/padrao/CabecalhoPagina";
import { BarraFiltros } from "@/components/padrao/BarraFiltros";
import { JanelaModal } from "@/components/padrao/JanelaModal";
import { CabecalhoJanela } from "@/components/padrao/CabecalhoJanela";
import { EstadoVazio } from "@/components/padrao/EstadoVazio";
import { ComboBox } from "@/components/padrao/ComboBox";

const LINHAS = [
  { nome: "Som Teste Ltda", cnpj: "00.000.000/0001-91", cidade: "Belo Horizonte", status: "Ativo" },
  { nome: "Luz Teste Ltda", cnpj: "11.111.111/0001-11", cidade: "Contagem", status: "Ativo" },
  { nome: "Palco Exemplo ME", cnpj: "22.222.222/0001-22", cidade: "Nova Lima", status: "Inativo" },
];

function Tela() {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [forn, setForn] = useState("");
  const visiveis = LINHAS.filter((l) => l.nome.toLowerCase().includes(busca.toLowerCase()));
  return (
    <div className="px-(--gutter) py-6 space-y-5">
      <CabecalhoPagina
        titulo="Fornecedores"
        descricao="Cadastro único por CNPJ — a mesma ficha em toda EC, OS e contrato."
        acoes={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setAberto(true)}>Novo fornecedor</Button>}
      />
      <div className="card-surface overflow-hidden">
        <BarraFiltros busca={busca} onBusca={setBusca} placeholderBusca="Nome ou CNPJ" contagem={`${visiveis.length} fornecedor(es)`} ativos={0}>
          <Select aria-label="Filtrar por status" defaultValue=""><option value="">Todos os status</option><option>Ativo</option></Select>
        </BarraFiltros>
        {visiveis.length ? (
          <Table>
            <THead>
              <Th>Fornecedor</Th><Th>CNPJ</Th><Th>Cidade</Th><Th>Status</Th><Th align="right">Ações</Th>
            </THead>
            <tbody>
              {visiveis.map((l) => (
                <Tr key={l.cnpj}>
                  <Td className="font-semibold">{l.nome}</Td>
                  <Td className="tabular-nums">{l.cnpj}</Td>
                  <Td>{l.cidade}</Td>
                  <Td><Badge tom={l.status === "Ativo" ? "success" : "neutral"}>{l.status}</Badge></Td>
                  <Td align="right"><Button variant="text" size="sm">Abrir</Button></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EstadoVazio semCartao icone={Search} titulo="Nenhum fornecedor encontrado." descricao="Confira a busca." acao={<Button variant="secondary" onClick={() => setBusca("")}>Limpar filtros</Button>} />
        )}
      </div>
      <Card>
        <CardTitle hint="Campos, selos e botões do padrão">Formulário de exemplo</CardTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="CNPJ" obrigatorio><Input placeholder="00.000.000/0000-00" /></Field>
          <Field label="Fornecedor (caixa combinada)">
            <ComboBox valor={forn} onChange={setForn} placeholder="Digite o CNPJ ou o nome" opcoes={LINHAS.map((l) => ({ valor: l.cnpj, rotulo: `${l.nome} · ${l.cnpj}` }))} />
          </Field>
          <Field label="Inscrição municipal" hint="(manual)"><Input /></Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button>Salvar</Button><Button variant="secondary">Cancelar</Button><Button variant="soft">Suave</Button>
          <Button variant="text">Texto</Button><Button variant="danger">Excluir</Button>
          <Badge tom="success">Ativa</Badge><Badge tom="warning">Pendente</Badge><Badge tom="danger">Vencida</Badge><Badge tom="info">Emitida</Badge><Badge>Arquivada</Badge>
        </div>
      </Card>
      <JanelaModal aberto={aberto} onFechar={() => setAberto(false)} rotulo="Novo fornecedor" className="w-full max-w-lg">
        <CabecalhoJanela titulo="Novo fornecedor" icone={Truck} onFechar={() => setAberto(false)} />
        <div className="p-5 space-y-4">
          <Field label="CNPJ" obrigatorio><Input placeholder="Digite o CNPJ" /></Field>
          <p className="text-sm text-muted-foreground">Os dados chegam da consulta ao CNPJ e ficam só leitura.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="secondary" onClick={() => setAberto(false)}>Cancelar</Button>
          <Button>Cadastrar</Button>
        </div>
      </JanelaModal>
    </div>
  );
}

// Sem o PageShell aqui, ninguém publica a altura do cabeçalho: zera para a tabela não descer.
document.documentElement.style.setProperty("--altura-cabecalho", "0px");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MemoryRouter initialEntries={["/fornecedores"]}>
      <CascaDoApp
        marca="/icone-aviso.png"
        nomeDoApp="Pólobh"
        itens={ITENS_DE_NAVEGACAO.map((i) => ({ ...i, contador: i.pendencias ? 3 : undefined }))}
        caminho="/fornecedores"
        pessoa={{ nome: "Pessoa de Teste", grupo: "Administrador", email: "teste@exemplo.com", formaDeEntrada: "E-mail e senha" }}
        onSair={() => {}}
        onAlterarSenha={() => {}}
        telaCheia
      >
        <Tela />
      </CascaDoApp>
    </MemoryRouter>
  </StrictMode>
);
