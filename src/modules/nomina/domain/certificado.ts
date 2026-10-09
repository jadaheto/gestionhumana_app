export const TIPOS_CERTIFICADO = ['laboral_con_funciones', 'laboral_sin_funciones', 'ingresos_retenciones'] as const;
export type TipoCertificado = (typeof TIPOS_CERTIFICADO)[number];

/** Registro de un certificado generado (tabla `certificados`). */
export interface Certificado {
  id: number;
  userId: number;
  tipo: string; // TipoCertificado; la columna no tiene CHECK
  fechaGeneracion: string;
  archivoPdf: string | null;
  generadoPor: number | null;
  datos: Record<string, unknown>;
  createdAt: Date | null;
}

export type NuevoCertificado = Omit<Certificado, 'id' | 'createdAt'>;

export const MODOS_CERTIFICADO_LABORAL = ['actual', 'historico', 'vencido'] as const;
export type ModoCertificadoLaboral = (typeof MODOS_CERTIFICADO_LABORAL)[number];
