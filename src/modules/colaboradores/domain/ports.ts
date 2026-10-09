/** Puertos hacia otros contextos (contratos, puntos, auth, branding). Se implementan en infraestructura con SQL. */

export interface ContratoActivo {
  id: number;
  tipoContrato: string;
  numeroContrato: string;
  fechaInicio: string;
  fechaFin: string | null;
  salarioBase: number;
  estado: string;
}

/** Lee el contrato activo más reciente de un colaborador (tabla `contratos`). */
export abstract class ContratoActivoReader {
  abstract findActivo(userId: number): Promise<ContratoActivo | null>;
}

/** Crea la fila inicial de `puntos` del colaborador (como hacía `Colaboradores::guardar`). */
export abstract class PuntosInitializer {
  abstract initialize(userId: number): Promise<void>;
}

export interface LoginHistoryItem {
  id: number;
  device: string;
  location: string;
  ipAddress: string;
  loginTime: Date;
}

/** Historial de inicios de sesión (tabla `login_history`, gestionada por auth). */
export abstract class LoginHistoryReader {
  abstract findRecent(userId: number, limit: number): Promise<LoginHistoryItem[]>;
}

/** Logo configurado en `app_settings` (branding) para la cabecera del carnet. */
export abstract class BrandingReader {
  abstract logoPath(): Promise<string | null>;
}
