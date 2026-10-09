/** Helpers de conversión entre columnas TIMESTAMP (Date local del driver pg) y strings. */

/** `Date` → ISO completo (para `created_at`/`updated_at`). */
export const toIso = (d: Date | string | null | undefined): string | null =>
  d === null || d === undefined ? null : d instanceof Date ? d.toISOString() : String(d);

/** `Date` local → `YYYY-MM-DDTHH:mm:ss` sin zona (eventos de calendario). */
export function toLocalDateTime(d: Date | null): string | null {
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** `YYYY-MM-DDTHH:mm:ss` sin zona → `Date` local (inversa de `toLocalDateTime`). */
export function fromLocalDateTime(s: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (!m) return new Date(s);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
}
