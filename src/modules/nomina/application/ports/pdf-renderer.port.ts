/**
 * Descripción declarativa de un documento PDF. Los casos de uso construyen
 * esta estructura (sin conocer pdfkit) y el adaptador de infraestructura la
 * renderiza. Así los certificados y desprendibles se prueban sin generar PDFs.
 */
export type PdfAlign = 'left' | 'center' | 'right';

/** Tramo de un párrafo con formato propio (negrita dentro de la misma línea). */
export interface PdfSegment {
  text: string;
  bold?: boolean;
}

export type PdfBlock =
  | { type: 'heading'; text: string; level?: 1 | 2 | 3; align?: PdfAlign }
  | {
      type: 'paragraph';
      /** Texto plano completo; si hay `segments`, es su concatenación. */
      text: string;
      /** Tramos con negrita puntual; cuando existen se dibujan en lugar de `text`. */
      segments?: PdfSegment[];
      align?: PdfAlign | 'justify';
      bold?: boolean;
      italic?: boolean;
      size?: number;
      muted?: boolean;
      /** Interlineado adicional en puntos (por defecto 2). */
      lineGap?: number;
    }
  /** Membrete: logo a la izquierda y leyenda a la derecha en la misma franja. */
  | {
      type: 'letterhead';
      logoPath: string | null;
      /** Leyenda de respaldo cuando no hay sellos en imagen. */
      text: string;
      /** Sellos (Vigilado Supersubsidio, Asocajas, Fedecajas…) alineados a la derecha, con su ancho en puntos. */
      badges?: Array<{ path: string; width: number }>;
    }
  /** Firma centrada (imagen opcional, nombre en negrita y líneas de cargo); no se parte entre páginas. */
  | { type: 'signature'; imagePath: string | null; name: string; lines: string[] }
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
  /** Pie de página institucional (columnas de texto y franja de color) en todas las páginas. */
  footer?: { columns: string[][] };
  blocks: PdfBlock[];
}

export abstract class PdfRenderer {
  abstract render(spec: PdfDocumentSpec): Promise<Buffer>;
}
