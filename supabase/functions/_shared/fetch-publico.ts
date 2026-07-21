const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function ipv4Privado(host: string): boolean {
  const p = host.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
    (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) || (p[0] >= 224);
}

function ipPrivado(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (ipv4Privado(h)) return true;
  return h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe8") ||
    h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb") || h.startsWith("::ffff:127.") ||
    h.startsWith("::ffff:10.") || h.startsWith("::ffff:192.168.");
}

async function validarUrl(valor: string): Promise<URL> {
  const url = new URL(valor);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error("URL não permitida.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "metadata.google.internal" || ipPrivado(host)) {
    throw new Error("Endereço local ou privado não permitido.");
  }
  // Bloqueia também domínios públicos que resolvam para redes internas (DNS rebinding).
  if (!/^\d+(?:\.\d+){3}$/.test(host) && !host.includes(":")) {
    const resolvidos = await Promise.allSettled([Deno.resolveDns(host, "A"), Deno.resolveDns(host, "AAAA")]);
    const ips = resolvidos.flatMap((r) => r.status === "fulfilled" ? r.value : []);
    if (!ips.length || ips.some(ipPrivado)) throw new Error("Destino de rede não permitido.");
  }
  return url;
}

async function lerLimitado(resp: Response): Promise<Uint8Array> {
  const tamanho = Number(resp.headers.get("content-length") || 0);
  if (tamanho > MAX_BYTES) throw new Error("Arquivo excede 5 MB.");
  const reader = resp.body?.getReader();
  if (!reader) return new Uint8Array();
  const blocos: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("Arquivo excede 5 MB.");
    }
    blocos.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const bloco of blocos) { out.set(bloco, offset); offset += bloco.length; }
  return out;
}

export async function buscarPublico(valor: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  let url = await validarUrl(valor);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const resp = await fetch(url, { redirect: "manual", signal: ctrl.signal, headers: { "User-Agent": "Polobh-Proposta/1.0" } });
      if ([301, 302, 303, 307, 308].includes(resp.status)) {
        const local = resp.headers.get("location");
        if (!local || i === MAX_REDIRECTS) throw new Error("Redirecionamentos demais.");
        url = await validarUrl(new URL(local, url).toString());
        continue;
      }
      if (!resp.ok) throw new Error(`Não foi possível acessar o link (${resp.status}).`);
      return { bytes: await lerLimitado(resp), contentType: (resp.headers.get("content-type") || "text/plain").split(";")[0] };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Link inválido.");
}

export function base64(bytes: Uint8Array): string {
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}
