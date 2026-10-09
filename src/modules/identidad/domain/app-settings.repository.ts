/**
 * Puerto de configuración global clave/valor (tabla `app_settings`).
 * Un valor vacío o nulo se considera "no configurado" y devuelve el valor por defecto.
 */
export abstract class AppSettingsRepository {
  abstract get(key: string, defaultValue: string): Promise<string>;
  abstract set(key: string, value: string): Promise<void>;
  /** Devuelve las claves pedidas; las no configuradas valen `null`. */
  abstract getMany(keys: string[]): Promise<Record<string, string | null>>;
}
