import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PdfAlign, PdfBlock, PdfDocumentSpec, PdfRenderer } from '../../application/ports/pdf-renderer.port';

/** Renderiza un `PdfDocumentSpec` con pdfkit (A4 vertical). */
@Injectable()
export class PdfkitPdfRenderer extends PdfRenderer {
  render(spec: PdfDocumentSpec): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const margin = spec.margin ?? 40;
      const doc = new PDFDocument({
        size: 'A4',
        margin,
        info: { Title: spec.title, Author: spec.author ?? 'Gestión Humana', Creator: 'Comfasucre' },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        for (const block of spec.blocks) this.draw(doc, block, margin);
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
      case 'paragraph':
        doc
          .font(b.bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(b.size ?? 11)
          .fillColor(b.muted ? '#666' : '#000')
          .text(b.text, { align: b.align ?? 'left', width, lineGap: 2 });
        doc.moveDown(0.5);
        return;
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
          const x = this.alignX(doc, b.align ?? 'left', margin, width, h * 3);
          doc.image(b.path, x, doc.y, { height: h });
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

  private alignX(doc: PDFKit.PDFDocument, align: PdfAlign, margin: number, width: number, w: number): number {
    if (align === 'center') return margin + (width - w) / 2;
    if (align === 'right') return margin + width - w;
    return margin;
  }
}
