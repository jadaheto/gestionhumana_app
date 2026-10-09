import { existsSync } from 'node:fs';
import { TEXTO_NOMINA_DOS_EMPLEADOS } from '../../../domain/__tests__/nomina-fixtures';
import { NominaParser } from '../../../domain/nomina-parser';
import { PdfkitPdfRenderer } from '../pdfkit-pdf-renderer';
import { PopplerPdfTextExtractor } from '../poppler-pdf-text-extractor';

const HAY_PDFTOTEXT = existsSync(process.env.PDFTOTEXT_BIN ?? '/usr/bin/pdftotext');

describe('Adaptadores PDF (pdfkit + pdftotext)', () => {
  const renderer = new PdfkitPdfRenderer();

  it('PdfkitPdfRenderer genera un PDF válido con todos los tipos de bloque', async () => {
    const pdf = await renderer.render({
      title: 'Prueba',
      blocks: [
        { type: 'heading', text: 'Título', level: 1, align: 'center' },
        { type: 'paragraph', text: 'Párrafo con tildes: ñandú.', bold: true },
        {
          type: 'keyValue',
          columns: 2,
          rows: [
            ['Clave', 'Valor'],
            ['Otra', 'Más'],
          ],
        },
        {
          type: 'table',
          columns: [
            { header: 'A', width: 50 },
            { header: 'B', width: 50, align: 'right' },
          ],
          rows: [
            ['1', '2'],
            ['3', '4'],
          ],
          boldLastRow: true,
        },
        { type: 'list', items: ['uno', '    dos (sangría)'] },
        { type: 'image', path: '/ruta/inexistente.png', height: 30 },
        { type: 'spacer', height: 5 },
        { type: 'rule' },
      ],
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(500);
  });

  (HAY_PDFTOTEXT ? it : it.skip)(
    'el texto extraído con pdftotext de un PDF generado se parsea correctamente',
    async () => {
      const lineas = TEXTO_NOMINA_DOS_EMPLEADOS.split('\n').filter((l) => l.trim() !== '');
      const pdf = await renderer.render({
        title: 'Liquidación',
        margin: 20,
        blocks: lineas.map((l) => ({ type: 'paragraph', text: l.trim(), size: 7 })),
      });
      const texto = await new PopplerPdfTextExtractor().extract(pdf);
      expect(texto).toContain('NETO A PAGAR');

      const r = new NominaParser().parse(texto);
      expect(r.empleados.map((e) => e.cedula)).toEqual(['1102879310', '64578123']);
      expect(r.empleados[0].neto).toBe(1_242_000);
      expect(r.totales.totalEmpleadosPdf).toBe(2);
      expect(r.meta.fechaInicio).toBe('2026-04-16');
    },
    20_000,
  );
});
