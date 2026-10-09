/**
 * Puerto hacia el contexto de usuarios/colaboradores. Colaboración sólo
 * necesita el directorio básico (id, nombre, correo) para asignar tareas,
 * elegir destinatarios de correo y validar contactos de chat.
 */
export interface UsuarioResumen {
  id: number;
  nombre: string;
  email: string;
  profileImage: string | null;
}

export abstract class UsuariosPort {
  abstract listar(): Promise<UsuarioResumen[]>;
  abstract existe(id: number): Promise<boolean>;
  abstract buscarPorEmail(email: string): Promise<UsuarioResumen | null>;
  abstract nombresPorIds(ids: number[]): Promise<Map<number, string>>;
}

/** Evento de sistema del calendario (cumpleaños o aniversario laboral). */
export interface EventoSistema {
  tipo: 'cumpleanos' | 'aniversario';
  userId: number;
  nombre: string;
  areaNombre: string | null;
  /** Fecha original (nacimiento o ingreso de referencia) `YYYY-MM-DD`. */
  fechaOrigen: string;
}

/** Datos para generar los eventos especiales del calendario (`Calendar_model::get_special_events`). */
export abstract class EventosSistemaPort {
  abstract listar(): Promise<EventoSistema[]>;
}
