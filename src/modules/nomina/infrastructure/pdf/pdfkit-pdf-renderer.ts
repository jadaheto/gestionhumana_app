import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  PdfAlign,
  PdfBlock,
  PdfDocumentSpec,
  PdfRenderer,
  PdfSegment,
} from '../../application/ports/pdf-renderer.port';

/** Margen inferior de las páginas con pie institucional (el pie se dibuja dentro de esa franja). */
const MARGEN_CON_PIE = 78;
/** Colores de marca de la franja inferior. */
const FRANJA_PIE = ['#17365d', '#1c9ad6', '#8cc63f'];

/** Renderiza un `PdfDocumentSpec` con pdfkit (A4 vertical). */
@Injectable()
export class PdfkitPdfRenderer extends PdfRenderer {
  private readonly logger = new Logger(PdfkitPdfRenderer.name);

  render(spec: PdfDocumentSpec): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const margin = spec.margin ?? 40;
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: margin, left: margin, right: margin, bottom: spec.footer ? MARGEN_CON_PIE : margin },
        bufferPages: true,
        info: { Title: spec.title, Author: spec.author ?? 'Gestión Humana', Creator: 'Comfasucre' },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        for (const block of spec.blocks) this.draw(doc, block, margin);
        if (spec.footer) this.drawFooter(doc, spec.footer.columns, margin);
        doc.end();
      } catch (e) {
        reject(e as Error);
      }
    });
  }

  private draw(doc: PDFKit.PDFDocument, b: PdfBlock, margin: number): void {
    const width = doc.page.width - margin * 2;
    switch (b.type) {
      case 'heading': {
        const size = b.level === 1 ? 18 : b.level === 3 ? 12 : 15;
        doc
          .moveDown(0.4)
          .font('Helvetica-Bold')
          .fontSize(size)
          .fillColor('#000')
          .text(b.text, { align: b.align ?? 'left', width });
        doc.moveDown(0.3);
        return;
      }
      case 'paragraph': {
        const base = b.bold ? 'Helvetica-Bold' : b.italic ? 'Helvetica-Oblique' : 'Helvetica';
        const opts = { align: b.align ?? 'left', width, lineGap: b.lineGap ?? 2 };
        doc
          .fontSize(b.size ?? 11)
          .fillColor(b.muted ? '#666' : '#000')
          .font(base);
        doc.x = margin;
        const segs = (b.segments ?? []).filter((s) => s.text !== '');
        if (segs.length === 0) doc.text(b.text, opts);
        else this.drawRichText(doc, segs, base, margin, width, opts.align, opts.lineGap);
        doc.moveDown(0.5);
        return;
      }
      case 'letterhead': {
        const alto = 52;
        const y = doc.y;
        if (b.logoPath) {
          try {
            doc.image(b.logoPath, margin, y, { fit: [width * 0.4, alto], valign: 'center' });
          } catch {
            /* logo ilegible: se omite */
          }
        }
        const sellos = b.badges ?? [];
        let sellosDibujados = 0;
        if (sellos.length > 0) {
          const separacion = 12;
          const altoSello = 26;
          let x = margin + width - sellos.reduce((a, s) => a + s.width, 0) - separacion * (sellos.length - 1);
          for (const s of sellos) {
            try {
              doc.image(s.path, x, y + (alto - altoSello) / 2, {
                fit: [s.width, altoSello],
                align: 'center',
                valign: 'center',
              });
              sellosDibujados++;
            } catch {
              /* sello ilegible: se omite */
            }
            x += s.width + separacion;
          }
        }
        if (sellosDibujados === 0) {
          doc.font('Helvetica').fontSize(8.5).fillColor('#666');
          const anchoTexto = width * 0.55;
          const altoTexto = doc.heightOfString(b.text, { width: anchoTexto, align: 'right' });
          doc.text(b.text, margin + width - anchoTexto, y + (alto - altoTexto) / 2, {
            width: anchoTexto,
            align: 'right',
          });
        }
        doc.x = margin;
        doc.y = y + alto + 8;
        return;
      }
      case 'signature': {
        const altoFirma = b.imagePath ? 64 : 34;
        const altoBloque = altoFirma + 16 + b.lines.length * 15 + 6;
        if (doc.y + altoBloque > doc.page.height - doc.page.margins.bottom) doc.addPage();
        const y = doc.y;
        if (b.imagePath) {
          try {
            doc.image(b.imagePath, margin, y, { fit: [width, altoFirma], align: 'center', valign: 'bottom' });
          } catch (e) {
            // Queda el espacio para firmar a mano, pero se deja rastro del motivo.
            this.logger.warn(`No se pudo dibujar la firma ${b.imagePath}: ${(e as Error).message}`);
          }
        }
        const anchoLinea = 230;
        const xLinea = margin + (width - anchoLinea) / 2;
        doc
          .moveTo(xLinea, y + altoFirma + 3)
          .lineTo(xLinea + anchoLinea, y + altoFirma + 3)
          .lineWidth(0.7)
          .stroke('#333');
        doc.x = margin;
        doc.y = y + altoFirma + 8;
        doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#000').text(b.name, { align: 'center', width });
        doc.font('Helvetica').fontSize(11);
        for (const linea of b.lines) doc.text(linea, { align: 'center', width });
        doc.moveDown(0.5);
        return;
      }
      case 'keyValue': {
        const cols = b.columns ?? 1;
        const colWidth = width / cols;
        const startX = doc.x;
        let y = doc.y;
        doc.fontSize(10).fillColor('#000');
        for (let i = 0; i < b.rows.length; i += cols) {
          let rowHeight = 0;
          for (let c = 0; c < cols && i + c < b.rows.length; c++) {
            const [k, v] = b.rows[i + c];
            const x = startX + c * colWidth;
            doc.font('Helvetica-Bold').text(`${k}: `, x, y, { continued: true, width: colWidth - 6 });
            doc.font('Helvetica').text(v ?? '', { width: colWidth - 6 });
            rowHeight = Math.max(rowHeight, doc.y - y);
          }
          y += rowHeight + 2;
        }
        doc.x = startX;
        doc.y = y + 4;
        return;
      }
      case 'table': {
        const totalPct = b.columns.reduce((a, c) => a + (c.width ?? 100 / b.columns.length), 0) || 100;
        const widths = b.columns.map((c) => ((c.width ?? 100 / b.columns.length) / totalPct) * width);
        const startX = doc.x;
        const pad = 4;
        const drawRow = (cells: string[], bold: boolean, fill: string | null) => {
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5);
          const heights = cells.map((text, i) => doc.heightOfString(text ?? '', { width: widths[i] - pad * 2 }));
          const h = Math.max(...heights, 12) + pad * 2;
          if (doc.y + h > doc.page.height - margin) {
            doc.addPage();
            doc.x = startX;
          }
          const y = doc.y;
          let x = startX;
          cells.forEach((text, i) => {
            if (fill) doc.rect(x, y, widths[i], h).fillAndStroke(fill, '#999');
            else doc.rect(x, y, widths[i], h).stroke('#999');
            doc
              .fillColor('#000')
              .text(text ?? '', x + pad, y + pad, { width: widths[i] - pad * 2, align: b.columns[i].align ?? 'left' });
            x += widths[i];
          });
          doc.x = startX;
          doc.y = y + h;
        };
        drawRow(
          b.columns.map((c) => c.header),
          true,
          '#f2f2f2',
        );
        b.rows.forEach((r, idx) => drawRow(r, Boolean(b.boldLastRow && idx === b.rows.length - 1), null));
        doc.moveDown(0.6);
        return;
      }
      case 'list':
        doc.font('Helvetica').fontSize(11).fillColor('#000');
        for (const item of b.items) {
          const indent = /^\s+/.test(item) ? 24 : 0;
          doc.text(`• ${item.trim()}`, doc.x + indent, doc.y, { width: width - indent - 10, lineGap: 2 });
          doc.x -= indent;
          doc.moveDown(0.2);
        }
        doc.moveDown(0.4);
        return;
      case 'image': {
        try {
          const h = b.height ?? 40;
          doc.image(b.path, margin, doc.y, {
            fit: [width, h],
            align: !b.align || b.align === 'left' ? undefined : b.align,
          });
          doc.y += h + 6;
          doc.x = margin;
        } catch {
          /* imagen ilegible: se omite */
        }
        return;
      }
      case 'spacer':
        doc.y += b.height ?? 10;
        return;
      case 'rule':
        doc
          .moveTo(margin, doc.y)
          .lineTo(margin + width, doc.y)
          .stroke('#999');
        doc.y += 8;
        return;
      default:
        return;
    }
  }

  /**
   * Párrafo con negritas puntuales. pdfkit no justifica bien el texto
   * encadenado con `continued` (deja sin justificar la última línea de cada
   * tramo), así que las líneas se componen aquí palabra por palabra.
   */
  private drawRichText(
    doc: PDFKit.PDFDocument,
    segments: PdfSegment[],
    baseFont: string,
    margin: number,
    width: number,
    align: PdfAlign | 'justify',
    lineGap: number,
  ): void {
    type Trozo = { text: string; font: string; width: number };
    type Palabra = { trozos: Trozo[]; width: number };
    // Una palabra puede mezclar fuentes ("TORRES" en negrita seguido de la coma normal).
    const palabras: Palabra[] = [];
    let nueva = true;
    for (const seg of segments) {
      const font = seg.bold ? 'Helvetica-Bold' : baseFont;
      doc.font(font);
      for (const parte of seg.text.split(/(\s+)/)) {
        if (parte === '') continue;
        if (/^\s+$/.test(parte)) {
          nueva = true;
          continue;
        }
        const trozo: Trozo = { text: parte, font, width: doc.widthOfString(parte) };
        if (nueva || palabras.length === 0) palabras.push({ trozos: [trozo], width: trozo.width });
        else {
          const ultima = palabras[palabras.length - 1];
          ultima.trozos.push(trozo);
          ultima.width += trozo.width;
        }
        nueva = false;
      }
    }
    doc.font(baseFont);
    const espacio = doc.widthOfString(' ');
    const altoLinea = doc.currentLineHeight(true) + lineGap;

    const lineas: Palabra[][] = [];
    let actual: Palabra[] = [];
    let ancho = 0;
    for (const p of palabras) {
      const conEspacio = actual.length > 0 ? espacio + p.width : p.width;
      if (actual.length > 0 && ancho + conEspacio > width) {
        lineas.push(actual);
        actual = [p];
        ancho = p.width;
      } else {
        actual.push(p);
        ancho += conEspacio;
      }
    }
    if (actual.length > 0) lineas.push(actual);

    lineas.forEach((linea, i) => {
      if (doc.y + altoLinea > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const y = doc.y;
      const anchoPalabras = linea.reduce((a, p) => a + p.width, 0);
      const natural = anchoPalabras + espacio * (linea.length - 1);
      const esUltima = i === lineas.length - 1;
      let separacion = espacio;
      let x = margin;
      if (align === 'justify' && !esUltima && linea.length > 1) {
        separacion = (width - anchoPalabras) / (linea.length - 1);
      } else if (align === 'center') x = margin + (width - natural) / 2;
      else if (align === 'right') x = margin + width - natural;
      for (const p of linea) {
        for (const t of p.trozos) {
          doc.font(t.font).text(t.text, x, y, { lineBreak: false });
          x += t.width;
        }
        x += separacion;
      }
      doc.x = margin;
      doc.y = y + altoLinea;
    });
    doc.font(baseFont);
  }

  /** Pie institucional en cada página: datos de contacto en columnas y franja con los colores de marca. */
  private drawFooter(doc: PDFKit.PDFDocument, columns: string[][], margin: number): void {
    const rango = doc.bufferedPageRange();
    for (let i = rango.start; i < rango.start + rango.count; i++) {
      doc.switchToPage(i);
      const { width: anchoPagina, height: altoPagina } = doc.page;
      const width = anchoPagina - margin * 2;
      // Sin margen inferior mientras se dibuja, para que pdfkit no salte de página.
      const margenInferior = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const y = altoPagina - MARGEN_CON_PIE + 16;
      doc
        .moveTo(margin, y)
        .lineTo(margin + width, y)
        .lineWidth(0.5)
        .stroke('#bbb');
      const anchoCol = width / Math.max(columns.length, 1);
      doc.font('Helvetica').fontSize(8).fillColor('#555');
      columns.forEach((lineas, c) => {
        doc.text(lineas.join('\n'), margin + c * anchoCol, y + 7, {
          width: anchoCol - 8,
          align: c === 0 ? 'left' : c === columns.length - 1 ? 'right' : 'center',
          lineBreak: true,
        });
      });
      const altoFranja = 7;
      const anchoFranja = anchoPagina / FRANJA_PIE.length;
      FRANJA_PIE.forEach((color, c) => {
        doc.rect(c * anchoFranja, altoPagina - altoFranja, anchoFranja + 0.5, altoFranja).fill(color);
      });
      doc.page.margins.bottom = margenInferior;
    }
  }
}
