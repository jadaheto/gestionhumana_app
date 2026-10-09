/** Extrae el texto plano de un PDF (el legado usaba `pdftotext -layout`). */
export abstract class PdfTextExtractor {
  abstract extract(pdf: Buffer): Promise<string>;
}
