/**
 * O contrato em Word, do clique ao arquivo salvo.
 *
 * A biblioteca que escreve .docx é grande, e o contrato é um documento que a
 * maioria das telas nunca abre. Por isso ela entra por `import()` dinâmico,
 * junto com o gerador: quem só olha uma OS não paga por ela no carregamento.
 */
import type { Cliente, EmpresaGrupo, Os } from "@/data/types";
import { montarContrato, nomeArquivoContrato } from "@/domain/contratoDocumento";

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Gera o .docx desta OS e entrega ao navegador. */
export async function baixarContrato(
  os: Os,
  ctx: { cliente: Cliente; empresas: EmpresaGrupo[] }
): Promise<void> {
  const { documentoDoContrato } = await import("./contrato");
  const { Packer } = await import("docx");
  const blob = await Packer.toBlob(documentoDoContrato(montarContrato(os, ctx)));
  const url = URL.createObjectURL(new Blob([blob], { type: MIME_DOCX }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivoContrato(os);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
