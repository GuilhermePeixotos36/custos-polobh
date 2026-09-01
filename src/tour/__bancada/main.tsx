/**
 * Bancada de teste do tour — NÃO faz parte do app (nada importa este arquivo;
 * ele não entra no build de produção).
 *
 * Monta a sobreposição do tour sobre uma tela falsa que tem todas as âncoras
 * (`data-tour` / `data-subguia`) que o roteiro usa, colocadas nas posições
 * difíceis de propósito: alvo colado na borda direita, alvo mais alto que a
 * janela, alvo dentro de cabeçalho grudado. Serve para medir, com o navegador
 * de verdade, se o foco cai em cima do elemento e se o balão fica dentro da
 * tela — o que nenhum teste em jsdom consegue verificar, porque lá não existe
 * layout.
 *
 * Rodar:  npm run dev  →  http://localhost:5173/tour-bancada.html
 */
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { TourOverlay } from "@/tour/TourOverlay";
import { useTour } from "@/tour/store";
import { useAuth, TODOS_RECURSOS } from "@/store/auth";
import "@/index.css";

/** Uma tela falsa com TODAS as âncoras que o roteiro usa, em posições difíceis. */
function TelaFalsa() {
  return (
    <div className="min-h-[3000px] bg-bg">
      <header className="sticky top-0 z-30 h-[var(--altura-topnav)] bg-surface border-b border-border flex items-center gap-3 px-5">
        <nav data-tour="topnav" className="flex items-center gap-1 flex-1">
          {["projetos", "calendario", "agenda", "fornecedores", "configuracoes", "logs", "guia"].map((r) => (
            <a key={r} data-tour={`nav-${r}`} className="px-3 h-9 rounded-btn text-[13px] font-semibold inline-flex items-center bg-[#F5F6F8]">
              {r}
            </a>
          ))}
        </nav>
        {/* alvo colado na borda direita: o pior caso para o balão */}
        <button data-tour="sino" className="h-9 w-9 rounded-btn bg-primary-soft">S</button>
      </header>

      <main className="px-6 py-5">
        <div className="sticky top-[var(--altura-topnav)] z-20 bg-bg/90 pt-3 pb-3 mb-4" style={{ height: 118 }}>
          <div className="flex items-end justify-between gap-4">
            <h1 className="font-display font-bold text-[30px]">Bancada</h1>
            <div data-tour="acoes-tela" className="flex items-center gap-2.5 shrink-0">
              <button className="h-9 px-3 rounded-btn bg-primary-grad text-[13px] font-bold">Novo projeto</button>
            </div>
          </div>
          <div data-tour="subguias" className="mt-3 border-b border-border flex gap-1">
            {["dados", "checklist", "ec", "os", "cronograma", "credenciamento", "fornecedores"].map((k) => (
              <button key={k} data-subguia={k} role="tab" aria-selected={k === "dados"} className="px-4 h-10 text-[13.5px] font-bold">
                {k}
              </button>
            ))}
          </div>
        </div>

        <div data-tour="projetos-filtros" className="flex items-center justify-between gap-3 mb-4">
          <div className="flex gap-1.5">
            <button className="h-9 px-3.5 rounded-btn border">Ativos</button>
            <button className="h-9 px-3.5 rounded-btn border">Arquivados</button>
          </div>
          <input className="h-10 w-[220px] rounded-btn border px-3" placeholder="Buscar" />
        </div>

        <div data-tour="projeto-cliente" className="bg-surface border border-border rounded-card p-6 mb-4" style={{ height: 320 }}>
          Cliente
        </div>

        <div className="bg-surface border border-border rounded-card mb-4">
          <div className="p-5 flex items-center justify-between">
            <span className="font-bold">Estimativas (EC)</span>
            <div data-tour="acoes-ec" className="flex items-center gap-2">
              <button className="h-9 px-3 rounded-btn bg-primary-grad text-[13px] font-bold">Nova EC</button>
              <button className="h-9 px-3 rounded-btn border text-[13px] font-bold">EC em branco</button>
              <button className="h-9 px-3 rounded-btn border text-[13px] font-bold">Importar EC</button>
            </div>
          </div>
        </div>

        {/* alvo MUITO alto: mais que a janela inteira */}
        <div data-tour="ec-grupos" className="bg-surface border border-border rounded-card p-5 mb-4" style={{ height: 1400 }}>
          Grupos e itens da EC
        </div>

        <div className="flex justify-end gap-2 mb-4">
          <button data-tour="emitir-os" className="h-9 px-3 rounded-btn bg-primary-grad text-[13px] font-bold">Emitir OS</button>
          <button data-tour="baixar-pdf" className="h-9 px-3 rounded-btn border text-[13px] font-bold">Baixar PDF</button>
        </div>
      </main>
    </div>
  );
}

function Bancada() {
  const abrir = useTour((s) => s.abrir);
  useEffect(() => {
    useAuth.setState({
      usuario: { id: "1", nome: "Teste", email: "t@t", papel: "Admin", recursos: TODOS_RECURSOS } as never,
      carregando: false,
    });
    // Contexto com registros "existentes": exercita os passos que dependem deles.
    useTour.setState({ contexto: { projetoId: "p1", ecId: "e1", osId: "o1" } });
    abrir();
    useTour.setState({ contexto: { projetoId: "p1", ecId: "e1", osId: "o1" } });
  }, [abrir]);
  return (
    <MemoryRouter initialEntries={["/guia"]}>
      <TelaFalsa />
      <TourOverlay />
    </MemoryRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bancada />
  </StrictMode>
);
