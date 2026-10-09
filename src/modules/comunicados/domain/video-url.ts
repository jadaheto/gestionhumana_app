/**
 * Parsea el texto del campo "URLs de video externo": una URL por línea.
 * Sólo se aceptan URLs absolutas http(s) válidas (equivale a `filter_var(FILTER_VALIDATE_URL)`).
 */
export function parsearUrlsVideo(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const urls: string[] = [];
  for (const linea of raw.split(/\r\n|\r|\n/)) {
    const url = linea.trim();
    if (url === '') continue;
    if (esUrlValida(url)) urls.push(url);
  }
  return urls;
}

export function esUrlValida(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== '';
  } catch {
    return false;
  }
}
