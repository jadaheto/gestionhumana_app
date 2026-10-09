/** Colaborador que cumple años hoy. */
export interface Cumpleanero {
  id: number;
  firstName: string;
  lastName: string;
  profileImage: string | null;
  fechaNacimiento: string | null;
  cargoNombre: string | null;
  areaNombre: string | null;
}

/** Colaborador que cumple aniversario laboral hoy. */
export interface Aniversario {
  id: number;
  firstName: string;
  lastName: string;
  profileImage: string | null;
  fechaReferencia: string | null;
  anios: number;
  cargoNombre: string | null;
  areaNombre: string | null;
}

/** Lectura de las celebraciones del día (consulta sobre users/cargos/areas/contratos). */
export abstract class ConexionesRepository {
  abstract cumpleanerosHoy(): Promise<Cumpleanero[]>;
  abstract aniversariosHoy(): Promise<Aniversario[]>;
}
