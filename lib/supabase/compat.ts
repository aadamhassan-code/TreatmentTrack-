/**
 * Lets new code ship before its migration has been run: true when a
 * Supabase error says a column or table doesn't exist yet, so the caller
 * can fall back to the old shape instead of failing.
 */
export function isMissingSchema(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "42703" || // undefined column
    error.code === "42P01" || // undefined table
    error.code === "PGRST204" || // column not in schema cache
    error.code === "PGRST205" || // table not in schema cache
    /column .* does not exist|could not find the .* column|relation .* does not exist/i.test(error.message ?? "")
  );
}
