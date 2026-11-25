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

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** `2018-05-14` → `14 de mayo de 2018`. */
export function fechaLarga(iso: string | null | undefined, vacio = '-'): string {
  if (!iso) return vacio;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return String(iso);
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1] ?? m[2]} de ${m[1]}`;
}

/** Fecha de expedición al estilo notarial: `a los ocho (8) días del mes de octubre de 2026`. */
export function fechaExpedicionEnLetras(d: Date): string {
  const dia = d.getDate();
  const resto = `del mes de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  return dia === 1 ? `al primer (1) día ${resto}` : `a los ${numeroALetras(dia, true)} (${dia}) días ${resto}`;
}

/** Cédula numérica con separador de miles (`1101814261` → `1.101.814.261`); otros formatos se dejan igual. */
export function cedulaConPuntos(cedula: string | null | undefined): string {
  const limpia = String(cedula ?? '').trim();
  const digitos = limpia.replace(/[.\s]/g, '');
  return /^\d{4,}$/.test(digitos) ? digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : limpia;
}

const UNIDADES = [
  '',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
];

/** 1..999 en letras; con `apocope` el "uno" final se acorta (veintiún mil, un millón, treinta y un días). */
function centenasALetras(n: number, apocope: boolean): string {
  if (n === 100) return 'cien';
  const partes: string[] = [];
  if (n >= 100) partes.push(CENTENAS[Math.floor(n / 100)]);
  const resto = n % 100;
  if (resto > 0) {
    let txt: string;
    if (resto < 30) txt = UNIDADES[resto];
    else {
      const u = resto % 10;
      txt = DECENAS[Math.floor(resto / 10)] + (u ? ` y ${UNIDADES[u]}` : '');
    }
    if (apocope && resto % 10 === 1 && resto !== 11) txt = resto === 21 ? 'veintiún' : txt.replace(/uno$/, 'un');
    partes.push(txt);
  }
  return partes.join(' ');
}

/**
 * Entero no negativo en letras (hasta 999.999.999.999). `apocope` acorta el
 * "uno" final para anteponerlo a un sustantivo masculino ("un peso", "veintiún días").
 */
export function numeroALetras(valor: number, apocope = false): string {
  const n = Math.floor(Math.abs(Number(valor) || 0));
  if (n === 0) return 'cero';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const unidades = n % 1000;
  const partes: string[] = [];
  if (millones > 0) {
    if (millones === 1) partes.push('un millón');
    else {
      const milesDeMillon = Math.floor(millones / 1000);
      const m = millones % 1000;
      const txt = [
        milesDeMillon > 0 ? (milesDeMillon === 1 ? 'mil' : `${centenasALetras(milesDeMillon, true)} mil`) : '',
        m > 0 ? centenasALetras(m, true) : '',
      ]
        .filter(Boolean)
        .join(' ');
      partes.push(`${txt} millones`);
    }
  }
  if (miles > 0) partes.push(miles === 1 ? 'mil' : `${centenasALetras(miles, true)} mil`);
  if (unidades > 0) partes.push(centenasALetras(unidades, apocope));
  return partes.join(' ');
}

/** `6061275` → `SEIS MILLONES SESENTA Y UN MIL DOSCIENTOS SETENTA Y CINCO PESOS M/CTE ($6.061.275)`. */
export function pesosEnLetras(valor: number | string | null | undefined): string {
  const n = Math.round(Math.abs(Number(valor ?? 0) || 0));
  const letras = numeroALetras(n, true).toUpperCase();
  const unidad = n === 1 ? 'PESO' : n >= 1_000_000 && n % 1_000_000 === 0 ? 'DE PESOS' : 'PESOS';
  return `${letras} ${unidad} M/CTE ($${pesos(n)})`;
}
