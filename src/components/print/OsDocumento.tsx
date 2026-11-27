/**
 * OS como documento A4 — a visualização em tela. Espelha o modelo em Excel.
 *
 * O que vai escrito é decidido em `domain/osDocumento` (o mesmo conteúdo que o
 * arquivo PDF da emissão usa, em `lib/pdf/os`); aqui só se desenha.
 */
import type { Ec, Os } from "@/data/types";
import { useEmpresas } from "@/store/empresas";
import { montarOsDocumento, type BlocoOs } from "@/domain/osDocumento";

/** Faixa de seção — cinza das barras do modelo original Pólobh (COR.sectionGray). */
function Secao({ titulo }: { titulo: string }) {
  return (
    <div className="bg-[#C0C0C0] text-ink font-bold text-[12px] uppercase tracking-wide px-3 py-1.5 mt-4 doc-avoid-break">
      {titulo}
    </div>
  );
}

function LV({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="grid grid-cols-[170px_1fr] border-b border-border-soft text-[12px]">
      <div className="bg-[#F2F2F2] font-bold px-3 py-1">{label}</div>
      <div className="px-3 py-1 whitespace-pre-line">{valor}</div>
    </div>
  );
}

/** Linha "rótulo | lista": título de cada grupo em negrito e tópicos com as duas colunas alinhadas. */
function Lista({ b }: { b: Extract<BlocoOs, { t: "lista" }> }) {
  return (
    <div className="grid grid-cols-[170px_1fr] border-b border-border-soft text-[12px]">
      <div className="bg-[#F2F2F2] font-bold px-3 py-1">{b.label}</div>
      <div className="px-3 py-1 space-y-1.5">
        {b.grupos.map((g, i) => (
          <div key={i} className="doc-avoid-break">
            <div className="font-bold">{g.titulo}</div>
            <ul>
              {g.itens.map((it, j) => (
                <li key={j} className="grid grid-cols-[12px_78px_1fr] items-baseline tabular-nums">
                  <span aria-hidden>•</span>
                  <span>{it.a || "—"}</span>
                  <span>{it.b}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tabela({ b }: { b: Extract<BlocoOs, { t: "tabela" }> }) {
  const escuro = b.estilo === "escuro";
  const celula = escuro ? "px-2 py-1.5" : "px-3 py-1 border-b border-border-soft";
  return (
    <table className="w-full text-[11px] border-collapse">
      <thead>
        <tr className={escuro ? "bg-[#595959] text-white" : "bg-[#F2F2F2] font-bold"}>
          {b.colunas.map((c, i) => (
            <th
              key={i}
              style={c.largura ? { width: `${c.largura * 100}%` } : undefined}
              className={`${c.direita ? "text-right" : "text-left"} ${escuro ? "px-2 py-1.5" : "px-3 py-1.5 border-b border-border-soft"}`}
            >
              {c.titulo}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {b.linhas.length === 0 && b.vazio ? (
          <tr><td colSpan={b.colunas.length} className="px-2 py-2 text-ink-3">{b.vazio}</td></tr>
        ) : (
          b.linhas.map((linha, i) => (
            <tr key={i} className={escuro ? "border-b border-border-soft doc-avoid-break" : undefined}>
              {linha.map((v, j) => (
                <td
                  key={j}
                  className={`${celula} ${b.colunas[j]?.direita ? "text-right" : ""} ${j === 0 && b.primeiraEmDestaque ? "font-semibold" : ""}`}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
      {b.rodape && (
        <tfoot>
          <tr className="font-bold">
            {b.rodape.map((v, j) => (
              <td key={j} className={`px-3 py-1.5 ${b.colunas[j]?.direita ? "text-right" : ""}`}>{v}</td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

export function OsDocumento({ os, ec, restrito = false }: { os: Os; ec: Ec; restrito?: boolean }) {
  const empresas = useEmpresas((s) => s.empresas);
  const doc = montarOsDocumento(os, ec, { restrito, empresas });

  return (
    <div className="doc-sheet p-[14mm] text-ink">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b-2 border-primary pb-3">
        <img src="/polobh-logo.png" alt="Pólobh" className="h-9 w-auto object-contain" />
        <div className="text-right">
          <div className="font-display font-extrabold text-[16px] tracking-tight leading-tight">Ordem de Serviço</div>
        </div>
      </div>

      {doc.blocos.map((b, i) =>
        b.t === "secao" ? (
          <Secao key={i} titulo={b.titulo} />
        ) : b.t === "lv" ? (
          <LV key={i} label={b.label} valor={b.valor} />
        ) : b.t === "lista" ? (
          <Lista key={i} b={b} />
        ) : b.t === "tabela" ? (
          <Tabela key={i} b={b} />
        ) : (
          // Em box âmbar, e não como mais uma linha cinza — a linha cinza é
          // justamente o que ninguém lê.
          <div key={i} className="mt-2 border-2 border-[#FFC000] bg-[#FFF8E6] px-3 py-2 text-[11px] doc-avoid-break">
            <div className="font-bold uppercase tracking-wide text-[10.5px] mb-0.5">{b.titulo}</div>
            <div className="whitespace-pre-line">{b.texto}</div>
          </div>
        )
      )}

      <div className="grid grid-cols-2 gap-8 mt-10 text-[11px] doc-avoid-break">
        <div><div className="border-t border-ink pt-1">Pólobh Promoções</div></div>
        <div><div className="border-t border-ink pt-1">{doc.assinaturaFornecedor} — Data: ____ ____ ______</div></div>
      </div>
    </div>
  );
}
