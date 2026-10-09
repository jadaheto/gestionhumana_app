/** Marcación de reloj biométrico ya asociada a un colaborador (tabla `asistencia_marcaciones`). */
export interface Marcacion {
  id: number;
  userId: number;
  /** Fecha y hora local `YYYY-MM-DD HH:mm:ss`. */
  fechaHora: string;
  /** `in`/`entrada`, `out`/`salida` u otro valor del dispositivo. */
  tipoRegistro: string | null;
}

/** Fila válida extraída de un archivo de marcaciones (aún sin resolver el colaborador). */
export interface MarcacionImportada {
  identificacion: string;
  nombre: string;
  /** `YYYY-MM-DD HH:mm:ss` */
  fechaHora: string;
  tipoRegistro: string;
  departamento: string;
  dispositivoNo: string;
  fechaRaw: string;
  horaRaw: string;
}
