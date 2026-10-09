import { ValidationError } from '../../../shared/domain/domain-error';

/** Política de asistencia por sede (tabla `asistencia_politicas`). */
export interface AsistenciaPoliticaProps {
  sedeId: number;
  /** Hora límite de entrada `HH:mm:ss`. */
  horaEntradaLimite: string;
  /** Salidas anteriores a esta hora `HH:mm:ss` se consideran tempranas. */
  horaSalidaTemprana: string;
  toleranciaMinutos: number;
  enviarMemorandoTardanza: boolean;
}

/** Valores que usaba el legado cuando la sede no tenía política guardada. */
export const POLITICA_POR_DEFECTO = {
  horaEntradaLimite: '08:10:00',
  horaSalidaTemprana: '11:59:00',
  toleranciaMinutos: 0,
  enviarMemorandoTardanza: true,
} as const;

const HORA_REGEX = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/** Normaliza `HH:mm` o `HH:mm:ss` a `HH:mm:ss`; lanza error si no es una hora válida. */
export function normalizarHora(valor: string, campo = 'hora'): string {
  const m = HORA_REGEX.exec((valor ?? '').trim());
  if (!m) throw new ValidationError(`La ${campo} debe tener formato HH:mm.`);
  const h = Number(m[1]);
  const mi = Number(m[2]);
  const s = Number(m[3] ?? '0');
  if (h > 23 || mi > 59 || s > 59) throw new ValidationError(`La ${campo} no es válida.`);
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export class AsistenciaPolitica {
  private constructor(readonly props: AsistenciaPoliticaProps) {}

  static create(props: Partial<AsistenciaPoliticaProps> & { sedeId: number }): AsistenciaPolitica {
    if (!Number.isInteger(props.sedeId) || props.sedeId <= 0) {
      throw new ValidationError('Debes seleccionar una sede.');
    }
    const tolerancia = Number(props.toleranciaMinutos ?? POLITICA_POR_DEFECTO.toleranciaMinutos);
    if (!Number.isFinite(tolerancia) || tolerancia < 0) {
      throw new ValidationError('La tolerancia debe ser un número de minutos mayor o igual a cero.');
    }
    return new AsistenciaPolitica({
      sedeId: props.sedeId,
      horaEntradaLimite: normalizarHora(
        props.horaEntradaLimite ?? POLITICA_POR_DEFECTO.horaEntradaLimite,
        'hora límite de entrada',
      ),
      horaSalidaTemprana: normalizarHora(
        props.horaSalidaTemprana ?? POLITICA_POR_DEFECTO.horaSalidaTemprana,
        'hora de salida temprana',
      ),
      toleranciaMinutos: Math.floor(tolerancia),
      enviarMemorandoTardanza: props.enviarMemorandoTardanza ?? POLITICA_POR_DEFECTO.enviarMemorandoTardanza,
    });
  }

  /** Política implícita de una sede sin configuración guardada. */
  static porDefecto(sedeId: number): AsistenciaPolitica {
    return AsistenciaPolitica.create({ sedeId, ...POLITICA_POR_DEFECTO });
  }

  get sedeId() {
    return this.props.sedeId;
  }
  get horaEntradaLimite() {
    return this.props.horaEntradaLimite;
  }
  get horaSalidaTemprana() {
    return this.props.horaSalidaTemprana;
  }
  get toleranciaMinutos() {
    return this.props.toleranciaMinutos;
  }
  get enviarMemorandoTardanza() {
    return this.props.enviarMemorandoTardanza;
  }
}
