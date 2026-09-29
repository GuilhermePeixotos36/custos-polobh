/**
 * Um escritor de .zip em ~120 linhas, sem dependência nenhuma.
 *
 * POR QUE NÃO UMA BIBLIOTECA
 *
 * Esta é a única peça do sistema cujo defeito só aparece no pior dia possível:
 * o dia em que alguém precisa do back-up de volta. Um pacote que o Windows
 * recusa abrir vale zero, e a suíte de testes precisa conseguir provar que ele
 * abre — o que exige o código rodar tanto no Deno (onde o back-up é gerado)
 * quanto no Node (onde os testes rodam). Só usa `CompressionStream`, que é
 * padrão da web e existe nos dois.
 *
 * O formato é o ZIP clássico (sem zip64): serve até 4 GB por arquivo e 65.535
 * arquivos, folgado para o que a casa guarda. Cada arquivo entra comprimido
 * (método 8, deflate) ou guardado cru (método 0) — o que sair menor. Guardar
 * cru também é a saída quando `CompressionStream` não está disponível: um
 * pacote maior é muito melhor do que um pacote que não sai.
 */

export interface ArquivoZip {
  /** Caminho dentro do pacote, com barras normais: "dados/projetos.json". */
  nome: string;
  dados: Uint8Array;
}

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (o mesmo do ZIP e do PNG). É o que prova que o arquivo chegou inteiro. */
export function crc32(dados: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < dados.length; i++) c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Deflate cru. Devolve `null` quando não vale a pena (ou não dá) comprimir.
 *
 * Usa o fluxo na mão em vez do caminho curto (`new Response(blob.stream()…)`)
 * porque `Blob` e `Response` são de quem hospeda: no ambiente de teste eles
 * vêm do jsdom, e o fluxo do jsdom não engata no CompressionStream do Node —
 * o resultado era o pacote sair inteiro SEM COMPRESSÃO, em silêncio, e o
 * defeito só apareceria no dia em que um back-up grande não coubesse no
 * e-mail. `CompressionStream` sozinho é padrão nos três (Deno, Node, navegador).
 */
async function deflate(dados: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined" || dados.length === 0) return null;
  try {
    const cs = new CompressionStream("deflate-raw");
    const escritor = cs.writable.getWriter();
    void escritor.write(dados as BufferSource);
    void escritor.close();

    const partes: Uint8Array[] = [];
    let total = 0;
    const leitor = cs.readable.getReader();
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      partes.push(value as Uint8Array);
      total += (value as Uint8Array).length;
    }
    // Arquivo já comprimido (um PDF, um JPEG) sai MAIOR depois do deflate.
    if (total >= dados.length) return null;

    const saida = new Uint8Array(total);
    let p = 0;
    for (const parte of partes) {
      saida.set(parte, p);
      p += parte.length;
    }
    return saida;
  } catch {
    return null;
  }
}

/** Data e hora no formato do MS-DOS, que é o que o ZIP guarda até hoje. */
function dataDos(d: Date): { hora: number; data: number } {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    data: ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Acumula bytes sem precisar saber o tamanho final. */
class Buffer {
  private partes: Uint8Array[] = [];
  tamanho = 0;

  bytes(b: Uint8Array) {
    this.partes.push(b);
    this.tamanho += b.length;
  }

  numero(valor: number, bytes: 2 | 4) {
    // Sempre 4 bytes no buffer: `setUint32` num Uint8Array de 2 estoura. O
    // campo de 2 bytes sai do recorte, em little-endian, que é a ordem do ZIP.
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, valor >>> 0, true);
    this.bytes(bytes === 2 ? b.subarray(0, 2) : b);
  }

  concluir(): Uint8Array {
    const saida = new Uint8Array(this.tamanho);
    let p = 0;
    for (const parte of this.partes) {
      saida.set(parte, p);
      p += parte.length;
    }
    return saida;
  }
}

/**
 * Monta o pacote. `quando` entra na data de cada arquivo — recebe de fora para
 * o teste poder fixar e comparar byte a byte.
 */
export async function montarZip(arquivos: ArquivoZip[], quando = new Date()): Promise<Uint8Array> {
  const { hora, data } = dataDos(quando);
  const corpo = new Buffer();
  const centro = new Buffer();
  const nomeEmBytes = new TextEncoder();

  for (const arquivo of arquivos) {
    const nome = nomeEmBytes.encode(arquivo.nome);
    const crc = crc32(arquivo.dados);
    const comprimido = await deflate(arquivo.dados);
    const conteudo = comprimido ?? arquivo.dados;
    const metodo = comprimido ? 8 : 0;
    const deslocamento = corpo.tamanho;

    // Cabeçalho local. A flag 0x0800 diz que o nome está em UTF-8 — sem ela,
    // "Ação.csv" abre com o nome corrompido fora do Brasil.
    corpo.numero(0x04034b50, 4);
    corpo.numero(20, 2);
    corpo.numero(0x0800, 2);
    corpo.numero(metodo, 2);
    corpo.numero(hora, 2);
    corpo.numero(data, 2);
    corpo.numero(crc, 4);
    corpo.numero(conteudo.length, 4);
    corpo.numero(arquivo.dados.length, 4);
    corpo.numero(nome.length, 2);
    corpo.numero(0, 2);
    corpo.bytes(nome);
    corpo.bytes(conteudo);

    // A mesma ficha, de novo, no índice do fim do arquivo. É por ele que o
    // descompactador acha cada arquivo — o corpo ele nem varre.
    centro.numero(0x02014b50, 4);
    centro.numero(20, 2);
    centro.numero(20, 2);
    centro.numero(0x0800, 2);
    centro.numero(metodo, 2);
    centro.numero(hora, 2);
    centro.numero(data, 2);
    centro.numero(crc, 4);
    centro.numero(conteudo.length, 4);
    centro.numero(arquivo.dados.length, 4);
    centro.numero(nome.length, 2);
    centro.numero(0, 2);
    centro.numero(0, 2);
    centro.numero(0, 2);
    centro.numero(0, 2);
    centro.numero(0, 4);
    centro.numero(deslocamento, 4);
    centro.bytes(nome);
  }

  const indice = centro.concluir();
  const fim = new Buffer();
  fim.numero(0x06054b50, 4);
  fim.numero(0, 2);
  fim.numero(0, 2);
  fim.numero(arquivos.length, 2);
  fim.numero(arquivos.length, 2);
  fim.numero(indice.length, 4);
  fim.numero(corpo.tamanho, 4);
  fim.numero(0, 2);

  const pacote = new Buffer();
  pacote.bytes(corpo.concluir());
  pacote.bytes(indice);
  pacote.bytes(fim.concluir());
  return pacote.concluir();
}
