import { describe, expect, it } from "vitest";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { ProvedorRecolher, useSecaoRecolhivel } from "./Recolher";
import { EVENTO_ABRIR_SECAO } from "@/lib/destaque";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Bloco({ id }: { id: string }) {
  const { recolhida, alternar } = useSecaoRecolhivel(id, { fechadoDeInicio: true });
  return h("button", { "data-id": id, "data-fechado": String(recolhida), onClick: alternar }, id);
}

describe("blocos recolhíveis da OS", () => {
  it("nascem fechados, abrem pela seta e pelo pedido do destaque", async () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => {
      root.render(h(ProvedorRecolher, null, h(Bloco, { id: "a" }), h(Bloco, { id: "b" })));
    });
    const estado = (id: string) => div.querySelector(`[data-id="${id}"]`)!.getAttribute("data-fechado");
    expect(estado("a")).toBe("true");
    expect(estado("b")).toBe("true");

    await act(async () => { (div.querySelector('[data-id="a"]') as HTMLButtonElement).click(); });
    expect(estado("a")).toBe("false");

    await act(async () => { window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_SECAO, { detail: "b" })); });
    expect(estado("b")).toBe("false");
    root.unmount();
  });
});
