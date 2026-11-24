/**
 * Lê todas as linhas de uma consulta em páginas (`.range(de, ate)`).
 *
 * O PostgREST do Supabase devolve no máximo 1000 linhas por consulta: sem paginar, a lista
 * parava em silêncio na milésima linha. Pede página por página até vir uma incompleta.
 */
export async function buscarTodasAsPaginas<T>(
    buscarPagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
    tamanho = 1000,
): Promise<T[]> {
    const todas: T[] = []
    for (let de = 0; ; de += tamanho) {
        const { data, error } = await buscarPagina(de, de + tamanho - 1)
        if (error) throw error
        const pagina = data ?? []
        todas.push(...pagina)
        if (pagina.length < tamanho) return todas
    }
}
