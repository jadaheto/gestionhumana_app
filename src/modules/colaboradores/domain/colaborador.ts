import { ValidationError } from '../../../shared/domain/domain-error';

/** Estados posibles de `users.estado_colaborador`. */
export const ESTADOS_COLABORADOR = ['activo', 'inactivo', 'retirado'] as const;
export type EstadoColaborador = (typeof ESTADOS_COLABORADOR)[number];

export const GENEROS = ['masculino', 'femenino', 'otro'] as const;
export const ESTADOS_CIVILES = ['soltero', 'casado', 'union_libre', 'divorciado', 'viudo'] as const;
export const TIPOS_SANGRE = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const;

export interface ColaboradorProps {
  id: number | null;
  username: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  cedula: string;
  codigoEmpresa: string | null;
  phoneNumber: string | null;
  telefono: string | null;
  celular: string | null;
  sedeId: number | null;
  areaId: number | null;
  cargoId: number | null;
  estadoColaborador: EstadoColaborador;
  fechaNacimiento: string | null;
  fechaIngreso: string | null;
  genero: string | null;
  estadoCivil: string | null;
  direccion: string | null;
  eps: string | null;
  arl: string | null;
  fondoPension: string | null;
  cajaCompensacion: string | null;
  tipoSangre: string | null;
  designation: string | null;
  profileImage: string | null;
  numeroHijos: number;
}

export type CreateColaboradorProps = Omit<
  ColaboradorProps,
  'id' | 'username' | 'role' | 'profileImage' | 'numeroHijos' | 'estadoColaborador'
> & {
  id?: number | null;
  username?: string | null;
  role?: string | null;
  profileImage?: string | null;
  numeroHijos?: number | null;
  estadoColaborador?: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeText(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  return v === '' ? null : v;
}

export function normalizeDate(value: string | null | undefined, label: string): string | null {
  const v = normalizeText(value);
  if (v === null) return null;
  if (!DATE_RE.test(v)) throw new ValidationError(`${label} debe tener el formato YYYY-MM-DD.`);
  return v;
}

export function isEstadoColaborador(value: unknown): value is EstadoColaborador {
  return typeof value === 'string' && (ESTADOS_COLABORADOR as readonly string[]).includes(value);
}

/**
 * Agregado Colaborador (fila de `users` vista desde Gestión Humana).
 * Replica las validaciones obligatorias de `Colaboradores::guardar` del legado.
 */
export class Colaborador {
  private constructor(readonly props: ColaboradorProps) {}

  static create(props: CreateColaboradorProps): Colaborador {
    const firstName = (props.firstName ?? '').trim();
    const lastName = (props.lastName ?? '').trim();
    const email = (props.email ?? '').trim();
    const cedula = (props.cedula ?? '').trim();
    if (firstName === '') throw new ValidationError('Los nombres son obligatorios.');
    if (lastName === '') throw new ValidationError('Los apellidos son obligatorios.');
    if (email === '') throw new ValidationError('El correo electrónico es obligatorio.');
    if (!EMAIL_RE.test(email)) throw new ValidationError('El correo electrónico no es válido.');
    if (cedula === '') throw new ValidationError('La cédula es obligatoria.');
    const estado = props.estadoColaborador ?? 'activo';
    if (!isEstadoColaborador(estado)) {
      throw new ValidationError('El estado del colaborador debe ser activo, inactivo o retirado.');
    }
    const numeroHijos = props.numeroHijos ?? 0;
    if (!Number.isInteger(numeroHijos) || numeroHijos < 0) {
      throw new ValidationError('El número de hijos debe ser un entero mayor o igual a cero.');
    }
    return new Colaborador({
      id: props.id ?? null,
      username: (props.username ?? '').trim(),
      email,
      role: props.role ?? 'funcionario',
      firstName,
      lastName,
      cedula,
      codigoEmpresa: normalizeText(props.codigoEmpresa),
      phoneNumber: normalizeText(props.phoneNumber),
      telefono: normalizeText(props.telefono),
      celular: normalizeText(props.celular),
      sedeId: props.sedeId ?? null,
      areaId: props.areaId ?? null,
      cargoId: props.cargoId ?? null,
      estadoColaborador: estado,
      fechaNacimiento: normalizeDate(props.fechaNacimiento, 'La fecha de nacimiento'),
      fechaIngreso: normalizeDate(props.fechaIngreso, 'La fecha de ingreso'),
      genero: normalizeText(props.genero),
      estadoCivil: normalizeText(props.estadoCivil),
      direccion: normalizeText(props.direccion),
      eps: normalizeText(props.eps),
      arl: normalizeText(props.arl),
      fondoPension: normalizeText(props.fondoPension),
      cajaCompensacion: normalizeText(props.cajaCompensacion),
      tipoSangre: normalizeText(props.tipoSangre),
      designation: normalizeText(props.designation),
      profileImage: normalizeText(props.profileImage),
      numeroHijos,
    });
  }

  get id() {
    return this.props.id;
  }
  get fullName(): string {
    return `${this.props.firstName} ${this.props.lastName}`.trim();
  }
  get isAdmin(): boolean {
    return this.props.role === 'admin';
  }

  withId(id: number): Colaborador {
    return new Colaborador({ ...this.props, id });
  }

  withUsername(username: string): Colaborador {
    return new Colaborador({ ...this.props, username });
  }

  /** Mantiene los campos que el formulario de administración no edita. */
  mergeFrom(existing: Colaborador): Colaborador {
    return new Colaborador({
      ...this.props,
      id: existing.props.id,
      username: existing.props.username,
      role: existing.props.role,
      profileImage: existing.props.profileImage,
      numeroHijos: existing.props.numeroHijos,
    });
  }
}

/**
 * Genera el usuario como el legado: inicial del nombre + apellido sin espacios,
 * sólo letras minúsculas y dígitos.
 */
export function generateUsername(firstName: string, lastName: string): string {
  const base = `${firstName.trim().charAt(0)}${lastName.replace(/\s+/g, '')}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
  return base === '' ? 'usuario' : base;
}
