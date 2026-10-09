const PAGE_SIZE = 1000;

/**
 * Supabase returns at most 1,000 rows per request. This keeps asking for the
 * next page until there are none left, so totals don't silently stop at 1,000.
 * `page` must apply a stable order (e.g. by id) so pages don't overlap.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}
