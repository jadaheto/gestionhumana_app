import { MarcacionImportada } from './marcacion';

/**
 * Normaliza una cabecera del archivo: minúsculas, sin tildes ni puntos y con
 * `_` como separador (`"ID de Usuario"` → `id_de_usuario`, `"Fecha/Hora"` → `fecha_hora`).
 */
export function normalizarCabecera(cabecera: string): string {
  const h = (cabecera ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[áéíóúñ.]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ñ: 'n', '.': '' })[c] ?? c)
    .replace(/[^a-z0-9]+/g, '_');
  return h.replace(/^_+|_+$/g, '');
}

const FECHA_DMY = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const FECHA_YMD = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const SOLO_HORA = /^\d{1,2}:\d{2}(?::\d{2})?$/;

function diasEnMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}

function armar(anio: number, mes: number, dia: number, h: number, mi: number, s: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasEnMes(anio, mes) || h > 23 || mi > 59 || s > 59) return null;
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${p(anio, 4)}-${p(mes)}-${p(dia)} ${p(h)}:${p(mi)}:${p(s)}`;
}

/**
 * Interpreta fecha y hora del archivo y devuelve `YYYY-MM-DD HH:mm:ss`.
 * Formatos aceptados (como el legado): `d/m/y H:i:s`, `d/m/Y H:i:s`, `Y-m-d H:i:s`
 * y variantes sin segundos o con `T`. Si falta la hora se asume `00:00:00`.
 */
export function parsearFechaHora(fechaRaw: string, horaRaw = ''): string | null {
  const fecha = (fechaRaw ?? '').toString().trim();
  const hora = (horaRaw ?? '').toString().trim();
  if (fecha === '') return null;
  const candidato = SOLO_HORA.test(hora) && !/\d:\d/.test(fecha) ? `${fecha} ${hora}` : fecha;

  let m = FECHA_DMY.exec(candidato);
  if (m) {
    const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return armar(anio, Number(m[2]), Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0));
  }
  m = FECHA_YMD.exec(candidato);
  if (m) {
    return armar(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0));
  }
  return null;
}

/**
 * Convierte una fila (ya separada en celdas) en una marcación, usando las
 * cabeceras normalizadas. Devuelve `null` si faltan identificación, nombre o
 * una fecha/hora interpretable (la fila se descarta, igual que en el legado).
 */
export function mapearFilaMarcacion(celdas: string[], cabeceras: string[]): MarcacionImportada | null {
  const mapa: Record<string, string> = {};
  cabeceras.forEach((c, i) => {
    let clave = normalizarCabecera(c ?? `col_${i}`);
    if (clave === '') clave = `col_${i}`;
    mapa[clave] = (celdas[i] ?? '').toString().trim();
  });

  let identificacion = mapa['id_de_usuario'] ?? '';
  if (identificacion === '' && mapa['identificacion'] !== undefined && mapa['identificacion'] !== '0') {
    identificacion = mapa['identificacion'];
  }
  const nombre = mapa['nombre'] ?? '';
  const tipoRegistro = mapa['tipo_de_registro'] ?? mapa['tipo_registro'] ?? '';
  const departamento = mapa['departamento'] ?? '';
  const dispositivoNo = mapa['dispositivo_nro'] ?? mapa['dispositivo_no'] ?? '';

  const fechaRaw = mapa['fecha_hora'] ?? mapa['fecha'] ?? (celdas[5] ?? '').toString().trim();
  const horaRaw = mapa['hora'] ?? (celdas[6] ?? '').toString().trim();

  const fechaHora = parsearFechaHora(fechaRaw, horaRaw);
  if (fechaHora === null || identificacion === '' || nombre === '') return null;

  return {
    identificacion: identificacion.replace(/\s+/g, ''),
    nombre,
    fechaHora,
    tipoRegistro,
    departamento,
    dispositivoNo,
    fechaRaw,
    horaRaw,
  };
}
