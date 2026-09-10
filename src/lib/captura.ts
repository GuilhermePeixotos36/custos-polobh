/**
 * O print da tela, tirado de dentro do próprio aplicativo.
 *
 * Metade de um chamado de suporte é a imagem: "o botão some", "aparece esse
 * erro aqui", "o valor sai errado". Descrever isso por escrito custa três idas
 * e vindas, e a pessoa está no meio de um trabalho, com pressa.
 *
 * COMO, e por que assim: usamos a captura de tela do PRÓPRIO NAVEGADOR
 * (`getDisplayMedia`) — a mesma de qualquer chamada de vídeo. O navegador abre
 * o seletor dele ("compartilhar esta aba"), a pessoa confirma, e nós tiramos UM
 * quadro e soltamos a câmera imediatamente. Nada fica ligado, nada é gravado.
 *
 * A alternativa seria desenhar a tela por conta (html2canvas e parentes): não
 * pede permissão nenhuma, mas RECONSTRÓI a página em vez de fotografá-la, e
 * erra justamente onde interessa — o menu aberto, a sombra, o campo em foco, o
 * pedaço que está rolado. Um print que não mostra o problema é pior que print
 * nenhum. Aqui é o pixel de verdade, o mesmo que a pessoa está vendo.
 *
 * Onde não houver suporte (Safari do iPhone, por exemplo), `capturaSuportada`
 * devolve `false` e a tela some com o botão — ficam o "anexar arquivo" e o
 * colar (Ctrl+V), que resolvem o mesmo problema com mais um passo.
 */

/** Este navegador sabe fotografar a tela? */
export function capturaSuportada(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

/** Nome do arquivo com data e hora, para dois prints do mesmo dia não se confundirem. */
function nomeDoPrint(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `print-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
}

/**
 * Fotografa a tela e devolve o arquivo pronto para anexar.
 *
 * Devolve `null` quando a pessoa cancela o seletor do navegador — cancelar é
 * uma resposta legítima, e não um erro para mostrar em vermelho. Qualquer outra
 * falha sobe como exceção, para a tela poder dizer o que houve.
 */
export async function capturarTela(): Promise<File | null> {
  if (!capturaSuportada()) throw new Error("Este navegador não permite capturar a tela por aqui.");

  let stream: MediaStream | undefined;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      // `preferCurrentTab` já deixa a aba atual escolhida no seletor (Chrome e
      // Edge); onde não existe, é ignorado sem erro.
      video: { displaySurface: "browser" },
      audio: false,
      preferCurrentTab: true,
    } as DisplayMediaStreamOptions);
  } catch (e) {
    // Cancelar o seletor cai aqui, como "NotAllowedError".
    if ((e as Error)?.name === "NotAllowedError") return null;
    throw e;
  }

  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // Dois quadros de espera: o primeiro costuma vir preto, antes de o
    // compositor entregar a imagem de verdade.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );

    const largura = video.videoWidth;
    const altura = video.videoHeight;
    if (!largura || !altura) throw new Error("A imagem da tela veio vazia. Tente de novo.");

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    canvas.getContext("2d")?.drawImage(video, 0, 0, largura, altura);
    video.pause();
    video.srcObject = null;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Não foi possível gerar a imagem do print.");
    return new File([blob], nomeDoPrint(), { type: "image/png" });
  } finally {
    // Solta a câmera aconteça o que acontecer: deixar a captura ligada mantém
    // o aviso do navegador na tela e assusta, com razão.
    stream.getTracks().forEach((t) => t.stop());
  }
}

/**
 * Imagens que vieram de um Ctrl+V.
 *
 * É como a maioria das pessoas já tira print: tecla PrintScreen, cola. Não
 * custa nada suportar, e cobre quem não quer (ou não pode) usar o seletor do
 * navegador.
 */
export function imagensColadas(dados: DataTransfer | null): File[] {
  if (!dados) return [];
  const arquivos: File[] = [];
  for (const item of Array.from(dados.items ?? [])) {
    if (item.kind !== "file") continue;
    const arquivo = item.getAsFile();
    if (!arquivo || !arquivo.type.startsWith("image/")) continue;
    // A área de transferência costuma entregar "image.png" para tudo; o nome
    // com hora evita dois anexos idênticos na mesma conversa.
    arquivos.push(new File([arquivo], arquivo.name && arquivo.name !== "image.png" ? arquivo.name : nomeDoPrint(), {
      type: arquivo.type,
    }));
  }
  return arquivos;
}
