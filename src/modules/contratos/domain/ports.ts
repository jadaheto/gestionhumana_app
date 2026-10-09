/**
 * Puertos hacia otros contextos (usuarios, notificaciones, branding).
 * Se implementan en `infrastructure` con SQL parametrizado para no importar
 * clases de otros módulos.
 */
export interface ColaboradorResumen {
  id: number;
  firstName: string;
  lastName: string;
  cedula: string | null;
  cargoNombre: string | null;
}

export abstract class UsuariosPort {
  /** Colaboradores (rol distinto de admin) para el select del formulario (`Colaborador_model::get_all`). */
  abstract listarColaboradores(): Promise<ColaboradorResumen[]>;
  abstract existeUsuario(id: number): Promise<boolean>;
  /** Ids de administradores con `estado_colaborador = 'activo'` (destinatarios de alertas). */
  abstract listarAdminsActivos(): Promise<number[]>;
  /**
   * `sync_user_status_by_contracts`: pone `estado_colaborador` en activo o
   * inactivo (nunca toca admins ni retirados) según exista un contrato
   * activo vigente en la fecha indicada.
   */
  abstract sincronizarEstadoPorContratos(hoy: string): Promise<void>;
}

export interface NuevaNotificacion {
  userId: number;
  titulo: string;
  mensaje: string;
  tipo: string;
  link: string | null;
}

export abstract class NotificacionesPort {
  abstract crear(notificacion: NuevaNotificacion): Promise<void>;
}

export abstract class BrandingPort {
  /** Logo oscuro configurado en `app_settings` (`branding_logo_dark`) como imagen PNG/JPEG, o null. */
  abstract logoOscuro(): Promise<Buffer | null>;
}
