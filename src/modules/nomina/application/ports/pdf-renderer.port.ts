/**
 * Descripción declarativa de un documento PDF. Los casos de uso construyen
 * esta estructura (sin conocer pdfkit) y el adaptador de infraestructura la
 * renderiza. Así los certificados y desprendibles se prueban sin generar PDFs.
 */
export type PdfAlign = 'left' | 'center' | 'right';

export type PdfBlock =
  | { type: 'heading'; text: string; level?: 1 | 2 | 3; align?: PdfAlign }
  | { type: 'paragraph'; text: string; align?: PdfAlign; bold?: boolean; size?: number; muted?: boolean }
  | { type: 'keyValue'; rows: Array<[string, string]>; columns?: 1 | 2 }
  | {
      type: 'table';
      columns: Array<{ header: string; width?: number; align?: PdfAlign }>;
      rows: string[][];
      boldLastRow?: boolean;
    }
  | { type: 'list'; items: string[] }
  | { type: 'image'; path: string; height?: number; align?: PdfAlign }
  | { type: 'spacer'; height?: number }
  | { type: 'rule' };

export interface PdfDocumentSpec {
  title: string;
  author?: string;
  /** Márgenes en puntos (por defecto 40). */
  margin?: number;
  blocks: PdfBlock[];
}

export abstract class PdfRenderer {
  abstract render(spec: PdfDocumentSpec): Promise<Buffer>;
}
