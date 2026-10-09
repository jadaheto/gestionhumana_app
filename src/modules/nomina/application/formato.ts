/** Utilidades de formato para los PDF (equivalentes a `date('d/m/Y')` y `number_format($v, 0, ',', '.')`). */

export function fechaCorta(iso: string | null | undefined, vacio = '-'): string {
  if (!iso) return vacio;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return String(iso);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function fechaDesdeDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function pesos(valor: number | string | null | undefined): string {
  const n = Math.round(Number(valor ?? 0) || 0);
  const str = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-' : '') + str;
}

export function pesosConSimbolo(valor: number | string | null | undefined): string {
  return `$ ${pesos(valor)}`;
}

/** `ucfirst(str_replace('_', ' ', $tipo))` */
export function tipoContratoLegible(tipo: string | null | undefined): string {
  const s = String(tipo ?? '').replace(/_/g, ' ');
  return s === '' ? '' : s.charAt(0).toUpperCase() + s.slice(1);
}

export function marcaTiempoArchivo(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
