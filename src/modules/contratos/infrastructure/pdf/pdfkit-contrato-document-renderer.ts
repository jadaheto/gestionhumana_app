import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { ContratoDocumentRenderer, DocumentoContrato } from '../../application/contrato-document-renderer.port';

const FUENTE = 'Helvetica';
const FUENTE_NEGRITA = 'Helvetica-Bold';
const TAMANO = 11;

/**
 * Renderiza la carta con pdfkit replicando la estructura de `doc_styles` /
 * `doc_header` / `firma_block` del legado: cabecera con logo y código,
 * fecha, destinatario, asunto, párrafos con negritas, firma (con PNG opcional),
 * tabla de revisores y pie en letra pequeña.
 */
@Injectable()
export class PdfKitContratoDocumentRenderer extends ContratoDocumentRenderer {
  render(doc: DocumentoContrato): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const pdf = new PDFDocument({
        size: 'LETTER',
        margins: { top: 60, bottom: 60, left: 65, right: 65 },
        info: { Title: doc.asunto },
      });
      const chunks: Buffer[] = [];
      pdf.on('data', (c: Buffer) => chunks.push(c));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', reject);

      const ancho = pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;
      const izquierda = pdf.page.margins.left;

      // --- Cabecera: logo + código a la izquierda, texto de vigilancia a la derecha ---
      const topCabecera = pdf.y;
      if (doc.logo) {
        try {
          pdf.image(doc.logo, izquierda, topCabecera, { height: 40 });
        } catch {
          pdf.font(FUENTE_NEGRITA).fontSize(14).text('COMFASUCRE', izquierda, topCabecera);
        }
      } else {
        pdf.font(FUENTE_NEGRITA).fontSize(14).text('COMFASUCRE', izquierda, topCabecera);
      }
      pdf
        .font(FUENTE_NEGRITA)
        .fontSize(TAMANO)
        .text(doc.codigo, izquierda, topCabecera + 46);
      pdf
        .font(FUENTE)
        .fontSize(8)
        .fillColor('#666666')
        .text(doc.cabeceraDerecha, izquierda + ancho * 0.55, topCabecera, { width: ancho * 0.45, align: 'right' });
      pdf.fillColor('#111111');
      pdf.y = topCabecera + 46 + TAMANO + 30;

      // --- Fecha y destinatario ---
      pdf.font(FUENTE).fontSize(TAMANO).text(doc.lugarYFecha, izquierda, pdf.y, { width: ancho });
      pdf.moveDown(1.2);
      pdf.text('Señor(a):', { width: ancho });
      pdf.font(FUENTE_NEGRITA).text(doc.destinatario.nombre, { width: ancho });
      pdf.font(FUENTE).text(doc.destinatario.cargoArea, { width: ancho });
      pdf.text(doc.destinatario.empresa, { width: ancho });
      pdf.moveDown(1);

      // --- Asunto / referencia ---
      pdf.font(FUENTE_NEGRITA).text(doc.asunto, { width: ancho, align: 'justify' });
      pdf.moveDown(1);
      pdf.font(FUENTE).text(doc.saludo, { width: ancho });
      pdf.moveDown(0.8);

      for (const parrafo of doc.parrafos) {
        this.textoConNegritas(pdf, parrafo.texto, ancho, parrafo.pie ? 8 : TAMANO);
        pdf.moveDown(0.8);
      }

      pdf.font(FUENTE).fontSize(TAMANO).text(doc.despedida, { width: ancho });
      pdf.moveDown(2);

      // --- Bloque de firma ---
      if (doc.firma.imagenPng) {
        try {
          pdf.image(doc.firma.imagenPng, izquierda, pdf.y, { fit: [220, 70] });
          pdf.y += 74;
        } catch {
          /* imagen no válida: se omite */
        }
      }
      pdf.font(FUENTE_NEGRITA).fontSize(TAMANO).text(doc.firma.nombre, izquierda, pdf.y, { width: ancho });
      pdf.font(FUENTE).text(doc.firma.cargo, { width: ancho });

      // --- Revisores en dos columnas ---
      if (doc.revisores.length > 0) {
        pdf.moveDown(2.5);
        const y = pdf.y;
        const colAncho = ancho / doc.revisores.length;
        doc.revisores.forEach((r, i) => {
          pdf
            .font(FUENTE)
            .fontSize(9)
            .text(r, izquierda + colAncho * i, y, { width: colAncho });
        });
        pdf.y = y + 14;
      }

      // --- Pie ---
      pdf.moveDown(2);
      pdf.font(FUENTE).fontSize(8).fillColor('#333333');
      for (const linea of doc.pie) pdf.text(linea, izquierda, pdf.y, { width: ancho });

      pdf.end();
    });
  }

  /**
   * Escribe un párrafo interpretando `**texto**` como negrita. pdfkit descarta
   * el espacio inicial de cada segmento `continued`, así que se traslada al
   * final del segmento anterior; se alinea a la izquierda porque el justificado
   * con segmentos encadenados produce huecos irregulares.
   */
  private textoConNegritas(pdf: PDFKit.PDFDocument, texto: string, ancho: number, tamano: number): void {
    const partes = texto.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== '');
    const segmentos = partes.map((parte) => {
      const negrita = parte.startsWith('**') && parte.endsWith('**');
      return { negrita, contenido: negrita ? parte.slice(2, -2) : parte };
    });
    for (let i = 1; i < segmentos.length; i++) {
      const espacios = /^\s+/.exec(segmentos[i].contenido)?.[0] ?? '';
      if (espacios) {
        segmentos[i - 1].contenido += espacios;
        segmentos[i].contenido = segmentos[i].contenido.slice(espacios.length);
      }
    }
    pdf.fontSize(tamano);
    segmentos.forEach((seg, i) => {
      pdf
        .font(seg.negrita ? FUENTE_NEGRITA : FUENTE)
        .text(seg.contenido, { width: ancho, align: 'left', continued: i < segmentos.length - 1 });
    });
    pdf.font(FUENTE);
  }
}
