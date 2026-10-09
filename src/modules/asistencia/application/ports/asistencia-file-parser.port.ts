import { MarcacionImportada } from '../../domain/marcacion';

export interface ArchivoMarcaciones {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

/**
 * Puerto para interpretar el archivo de marcaciones (CSV/TSV/TXT/XLSX) y
 * devolver las filas válidas. La implementación vive en `infrastructure/parsers`.
 */
export abstract class AsistenciaFileParser {
  abstract parse(archivo: ArchivoMarcaciones): Promise<MarcacionImportada[]>;
}
