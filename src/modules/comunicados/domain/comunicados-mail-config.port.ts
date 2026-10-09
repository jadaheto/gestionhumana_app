export type ModoCorreoComunicados = 'test' | 'produccion';

export interface ConfigCorreoComunicados {
  modo: ModoCorreoComunicados;
  testTo: string;
  prodTo: string;
}

/**
 * Puerto de configuración del correo de comunicados. La implementación lee
 * `app_settings` (claves `comunicados_mail_*`) con respaldo en la configuración
 * de la aplicación (`COMUNICADOS_MAIL_*`).
 */
export abstract class ComunicadosMailConfig {
  abstract get(): Promise<ConfigCorreoComunicados>;

  /** Destinatario efectivo según el modo (vacío si no está configurado). */
  async destinatario(): Promise<string> {
    const cfg = await this.get();
    return (cfg.modo === 'produccion' ? cfg.prodTo : cfg.testTo).trim();
  }
}
