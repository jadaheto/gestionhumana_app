import { AsistenciaPolitica } from './asistencia-politica';
import { Marcacion } from './marcacion';
import { EstadoAsistencia } from './resumen-diario';

export interface ConsolidacionInput {
  /** Marcaciones de un mismo colaborador en un mismo día (en cualquier orden). */
  marcaciones: Marcacion[];
  politica: AsistenciaPolitica;
  /** Texto de justificación (permiso/vacaciones/incapacidad) o cadena vacía. */
  justificacion: string;
}

export interface ConsolidacionResult {
  horaEntrada: string | null;
  horaSalida: string | null;
  minutosTarde: number;
  minutosSalidaTemprana: number;
  estado: EstadoAsistencia;
  detalle: string;
  justificacion: string;
}

const TIPOS_ENTRADA = ['in', 'entrada'];
const TIPOS_SALIDA = ['out', 'salida'];

/** Convierte `HH:mm:ss` (o `HH:mm`) a segundos desde medianoche. */
export function horaASegundos(hora: string): number {
  const [h = '0', m = '0', s = '0'] = hora.split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/** Extrae `HH:mm:ss` de un timestamp `YYYY-MM-DD HH:mm:ss`. */
function horaDe(fechaHora: string): string {
  const parte = fechaHora.trim().split(/[ T]/)[1] ?? '00:00:00';
  const [h = '00', m = '00', s = '00'] = parte.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.slice(0, 2).padStart(2, '0')}`;
}

/**
 * Servicio de dominio puro: consolida las marcaciones de un colaborador en un
 * día según la política de la sede. Replica exactamente la lógica de
 * `Asistencia_model::rebuild_daily_summary` del sistema legado:
 *  - entrada = primera marcación tipo in/entrada, o la primera del día;
 *  - salida  = última marcación tipo out/salida, o la última del día;
 *  - tarde   = minutos enteros después de (hora límite + tolerancia);
 *  - salida temprana = minutos enteros antes de la hora de salida temprana;
 *  - sin marcaciones → `justificado` si hay justificación, si no `falla`.
 */
export function consolidarDia(input: ConsolidacionInput): ConsolidacionResult {
  const registros = [...input.marcaciones].sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
  const tipo = (m: Marcacion) => (m.tipoRegistro ?? '').trim().toLowerCase();

  let entrada = registros.find((m) => TIPOS_ENTRADA.includes(tipo(m))) ?? null;
  if (!entrada && registros.length > 0) entrada = registros[0];

  let salida: Marcacion | null = null;
  for (let i = registros.length - 1; i >= 0; i--) {
    if (TIPOS_SALIDA.includes(tipo(registros[i]))) {
      salida = registros[i];
      break;
    }
  }
  if (!salida && registros.length > 0) salida = registros[registros.length - 1];

  const horaEntrada = entrada ? horaDe(entrada.fechaHora) : null;
  const horaSalida = salida ? horaDe(salida.fechaHora) : null;

  let minutosTarde = 0;
  if (horaEntrada) {
    const limite = horaASegundos(input.politica.horaEntradaLimite) + input.politica.toleranciaMinutos * 60;
    const marco = horaASegundos(horaEntrada);
    if (marco > limite) minutosTarde = Math.floor((marco - limite) / 60);
  }

  let minutosSalidaTemprana = 0;
  if (horaSalida) {
    const referencia = horaASegundos(input.politica.horaSalidaTemprana);
    const salio = horaASegundos(horaSalida);
    if (salio < referencia) minutosSalidaTemprana = Math.floor((referencia - salio) / 60);
  }

  const justificacion = (input.justificacion ?? '').trim();
  let estado: EstadoAsistencia = 'normal';
  let detalle = '';

  if (!horaEntrada && !horaSalida) {
    if (justificacion !== '') {
      estado = 'justificado';
      detalle = justificacion;
    } else {
      estado = 'falla';
      detalle = 'No registró marcación';
    }
  } else {
    if (minutosTarde > 0) {
      estado = 'tarde';
      detalle = `Llegó tarde (${minutosTarde} min)`;
    }
    if (minutosSalidaTemprana > 0) {
      estado = estado === 'tarde' ? 'tarde_salida_temprana' : 'salida_temprana';
      detalle = `${detalle} / Salida temprana (${minutosSalidaTemprana} min)`.replace(/^[\s/]+|[\s/]+$/g, '');
    }
  }

  return { horaEntrada, horaSalida, minutosTarde, minutosSalidaTemprana, estado, detalle, justificacion };
}
