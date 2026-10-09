/**
 * Modelo de la carta (contenido textual independiente del formato) y puerto
 * del renderizador. La implementación con pdfkit vive en `infrastructure/pdf`.
 */
export interface ParrafoDocumento {
  /** Texto con fragmentos `**negrita**`. */
  texto: string;
  /** Tamaño pequeño (pie de página). */
  pie?: boolean;
}

export interface DocumentoContrato {
  /** Código del formato, p. ej. `G.H.3.1.` */
  codigo: string;
  /** Texto derecho de la cabecera: "Vigilado Supersubsidio | Asocajas | Fedecajas". */
  cabeceraDerecha: string;
  /** Logo PNG/JPEG opcional para la cabecera. */
  logo: Buffer | null;
  /** "Sincelejo, 8 de octubre de 2026". */
  lugarYFecha: string;
  destinatario: { nombre: string; cargoArea: string; empresa: string };
  /** Línea de asunto/referencia (en negrita). */
  asunto: string;
  saludo: string;
  parrafos: ParrafoDocumento[];
  despedida: string;
  firma: { imagenPng: Buffer | null; nombre: string; cargo: string };
  /** Dos columnas de revisores (prórroga y renovación). Vacío en el preaviso. */
  revisores: string[];
  pie: string[];
}

export abstract class ContratoDocumentRenderer {
  abstract render(documento: DocumentoContrato): Promise<Buffer>;
}
