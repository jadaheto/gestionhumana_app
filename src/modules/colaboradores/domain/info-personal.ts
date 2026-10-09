import { ValidationError } from '../../../shared/domain/domain-error';
import { normalizeDate, normalizeText } from './colaborador';

export const NIVELES_EDUCACION = [
  'bachiller',
  'tecnico',
  'tecnologo',
  'profesional',
  'especializacion',
  'maestria',
  'doctorado',
] as const;
export const ESTADOS_ESTUDIO = ['finalizado', 'cursando', 'abandonado'] as const;
export const TIPOS_EDUCACION_NO_FORMAL = [
  'curso',
  'diplomado',
  'seminario',
  'taller',
  'certificacion',
  'congreso',
] as const;
export const PARENTESCOS = ['padre', 'madre', 'conyuge', 'hijo', 'hermano', 'otro'] as const;

/** Entrada tolerante: los casos de uso reciben valores posiblemente nulos y el dominio los valida. */
export type Nullable<T> = { [K in keyof T]: T[K] | null | undefined };

/** Registro que pertenece a un usuario (tablas con `user_id`). */
export interface OwnedRecord {
  id: number | null;
  userId: number;
}

function inList(value: string | null | undefined, list: readonly string[], label: string): string {
  const v = (value ?? '').trim();
  if (!list.includes(v)) throw new ValidationError(`${label} no es válido. Valores permitidos: ${list.join(', ')}.`);
  return v;
}

function required(value: string | null | undefined, label: string): string {
  const v = (value ?? '').trim();
  if (v === '') throw new ValidationError(`${label} es obligatorio.`);
  return v;
}

function checkRange(inicio: string | null, fin: string | null): void {
  if (inicio && fin && fin < inicio)
    throw new ValidationError('La fecha final no puede ser anterior a la fecha inicial.');
}

// ---------- Educación formal ----------
export interface EducacionFormalProps extends OwnedRecord {
  nivel: string;
  institucion: string;
  tituloObtenido: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  estadoEstudio: string;
  tarjetaProfesional: string | null;
}
export type EducacionFormalInput = Nullable<Omit<EducacionFormalProps, 'id' | 'userId'>> & {
  id?: number | null;
  userId: number;
};

export class EducacionFormal implements OwnedRecord {
  private constructor(readonly props: EducacionFormalProps) {}
  static create(p: EducacionFormalInput): EducacionFormal {
    const fechaInicio = normalizeDate(p.fechaInicio, 'La fecha de inicio');
    const fechaFin = normalizeDate(p.fechaFin, 'La fecha de fin');
    checkRange(fechaInicio, fechaFin);
    return new EducacionFormal({
      id: p.id ?? null,
      userId: p.userId,
      nivel: inList(p.nivel, NIVELES_EDUCACION, 'El nivel'),
      institucion: required(p.institucion, 'La institución'),
      tituloObtenido: normalizeText(p.tituloObtenido),
      fechaInicio,
      fechaFin,
      estadoEstudio: inList(p.estadoEstudio ?? 'finalizado', ESTADOS_ESTUDIO, 'El estado del estudio'),
      tarjetaProfesional: normalizeText(p.tarjetaProfesional),
    });
  }
  get id() {
    return this.props.id;
  }
  get userId() {
    return this.props.userId;
  }
  withId(id: number): EducacionFormal {
    return new EducacionFormal({ ...this.props, id });
  }
}

// ---------- Educación no formal ----------
export interface EducacionNoFormalProps extends OwnedRecord {
  tipo: string;
  institucion: string | null;
  nombrePrograma: string;
  horas: number | null;
  fecha: string | null;
  certificado: string | null;
}
export type EducacionNoFormalInput = Nullable<Omit<EducacionNoFormalProps, 'id' | 'userId'>> & {
  id?: number | null;
  userId: number;
};

export class EducacionNoFormal implements OwnedRecord {
  private constructor(readonly props: EducacionNoFormalProps) {}
  static create(p: EducacionNoFormalInput): EducacionNoFormal {
    const horas = p.horas ?? null;
    if (horas !== null && (!Number.isInteger(horas) || horas < 0)) {
      throw new ValidationError('Las horas deben ser un entero mayor o igual a cero.');
    }
    return new EducacionNoFormal({
      id: p.id ?? null,
      userId: p.userId,
      tipo: inList(p.tipo, TIPOS_EDUCACION_NO_FORMAL, 'El tipo'),
      institucion: normalizeText(p.institucion),
      nombrePrograma: required(p.nombrePrograma, 'El nombre del programa'),
      horas,
      fecha: normalizeDate(p.fecha, 'La fecha'),
      certificado: normalizeText(p.certificado),
    });
  }
  get id() {
    return this.props.id;
  }
  get userId() {
    return this.props.userId;
  }
  withId(id: number): EducacionNoFormal {
    return new EducacionNoFormal({ ...this.props, id });
  }
  withCertificado(path: string | null): EducacionNoFormal {
    return new EducacionNoFormal({ ...this.props, certificado: path });
  }
}

// ---------- Familiares ----------
export interface FamiliarProps extends OwnedRecord {
  nombreCompleto: string;
  parentesco: string;
  fechaNacimiento: string | null;
  cedula: string | null;
  ocupacion: string | null;
  telefono: string | null;
  dependiente: boolean;
}
export type FamiliarInput = Nullable<Omit<FamiliarProps, 'id' | 'userId'>> & { id?: number | null; userId: number };

export class Familiar implements OwnedRecord {
  private constructor(readonly props: FamiliarProps) {}
  static create(p: FamiliarInput): Familiar {
    return new Familiar({
      id: p.id ?? null,
      userId: p.userId,
      nombreCompleto: required(p.nombreCompleto, 'El nombre completo'),
      parentesco: inList(p.parentesco, PARENTESCOS, 'El parentesco'),
      fechaNacimiento: normalizeDate(p.fechaNacimiento, 'La fecha de nacimiento'),
      cedula: normalizeText(p.cedula),
      ocupacion: normalizeText(p.ocupacion),
      telefono: normalizeText(p.telefono),
      dependiente: p.dependiente === true,
    });
  }
  get id() {
    return this.props.id;
  }
  get userId() {
    return this.props.userId;
  }
  withId(id: number): Familiar {
    return new Familiar({ ...this.props, id });
  }
}

// ---------- Experiencia laboral ----------
export interface ExperienciaLaboralProps extends OwnedRecord {
  empresa: string;
  cargo: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  funciones: string | null;
  motivoRetiro: string | null;
  telefonoContacto: string | null;
  jefeInmediato: string | null;
}
export type ExperienciaLaboralInput = Nullable<Omit<ExperienciaLaboralProps, 'id' | 'userId'>> & {
  id?: number | null;
  userId: number;
};

export class ExperienciaLaboral implements OwnedRecord {
  private constructor(readonly props: ExperienciaLaboralProps) {}
  static create(p: ExperienciaLaboralInput): ExperienciaLaboral {
    const fechaInicio = normalizeDate(p.fechaInicio, 'La fecha de inicio');
    const fechaFin = normalizeDate(p.fechaFin, 'La fecha de fin');
    checkRange(fechaInicio, fechaFin);
    return new ExperienciaLaboral({
      id: p.id ?? null,
      userId: p.userId,
      empresa: required(p.empresa, 'La empresa'),
      cargo: required(p.cargo, 'El cargo'),
      fechaInicio,
      fechaFin,
      funciones: normalizeText(p.funciones),
      motivoRetiro: normalizeText(p.motivoRetiro),
      telefonoContacto: normalizeText(p.telefonoContacto),
      jefeInmediato: normalizeText(p.jefeInmediato),
    });
  }
  get id() {
    return this.props.id;
  }
  get userId() {
    return this.props.userId;
  }
  withId(id: number): ExperienciaLaboral {
    return new ExperienciaLaboral({ ...this.props, id });
  }
}

// ---------- Datos básicos (campos de `users` editables por el propio usuario) ----------
export interface DatosBasicosProps {
  direccion: string | null;
  telefono: string | null;
  celular: string | null;
  genero: string | null;
  estadoCivil: string | null;
  tipoSangre: string | null;
  eps: string | null;
  arl: string | null;
  fondoPension: string | null;
  cajaCompensacion: string | null;
  numeroHijos: number;
}

/** Datos básicos junto con la identidad (sólo lectura) del usuario. */
export interface DatosBasicos extends DatosBasicosProps {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  cedula: string | null;
  codigoEmpresa: string | null;
  fechaNacimiento: string | null;
  fechaIngreso: string | null;
}

export function normalizeDatosBasicos(p: Partial<Nullable<DatosBasicosProps>>): DatosBasicosProps {
  const numeroHijos = p.numeroHijos ?? 0;
  if (!Number.isInteger(numeroHijos) || numeroHijos < 0) {
    throw new ValidationError('El número de hijos debe ser un entero mayor o igual a cero.');
  }
  return {
    direccion: normalizeText(p.direccion),
    telefono: normalizeText(p.telefono),
    celular: normalizeText(p.celular),
    genero: normalizeText(p.genero),
    estadoCivil: normalizeText(p.estadoCivil),
    tipoSangre: normalizeText(p.tipoSangre),
    eps: normalizeText(p.eps),
    arl: normalizeText(p.arl),
    fondoPension: normalizeText(p.fondoPension),
    cajaCompensacion: normalizeText(p.cajaCompensacion),
    numeroHijos,
  };
}

// ---------- Puertos ----------
/** Repositorio genérico de registros pertenecientes a un usuario. */
export abstract class OwnedRecordRepository<T extends OwnedRecord> {
  abstract findByUser(userId: number): Promise<T[]>;
  abstract findOne(id: number, userId: number): Promise<T | null>;
  abstract insert(record: T): Promise<T>;
  abstract update(record: T): Promise<T>;
  abstract delete(id: number, userId: number): Promise<void>;
}

export abstract class EducacionFormalRepository extends OwnedRecordRepository<EducacionFormal> {}
export abstract class EducacionNoFormalRepository extends OwnedRecordRepository<EducacionNoFormal> {}
export abstract class FamiliarRepository extends OwnedRecordRepository<Familiar> {}
export abstract class ExperienciaLaboralRepository extends OwnedRecordRepository<ExperienciaLaboral> {}

export abstract class DatosBasicosRepository {
  abstract find(userId: number): Promise<DatosBasicos | null>;
  abstract update(userId: number, datos: DatosBasicosProps): Promise<void>;
}
