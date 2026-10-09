import { DocumentoContrato } from '../../application/contrato-document-renderer.port';
import { PdfKitContratoDocumentRenderer } from './pdfkit-contrato-document-renderer';

// PNG 1x1 válido (transparente) para probar la incrustación de la firma.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const documento: DocumentoContrato = {
  codigo: 'G.H.3.1.',
  cabeceraDerecha: 'Vigilado Supersubsidio | Asocajas | Fedecajas',
  logo: null,
  lugarYFecha: 'Sincelejo, 8 de octubre de 2026',
  destinatario: { nombre: 'JUAN PÉREZ', cargoArea: 'Analista - TI', empresa: 'Comfasucre' },
  asunto: 'Ref. PRÓRROGA DE CONTRATO',
  saludo: 'Cordial saludo:',
  parrafos: [{ texto: 'Texto con **negrita** y más texto.' }, { texto: 'Segundo párrafo.' }],
  despedida: 'Atentamente,',
  firma: { imagenPng: PNG_1X1, nombre: 'DIRECTORA ADMINISTRATIVA', cargo: 'Comfasucre' },
  revisores: ['Jefe Departamento', 'Revisó Jurídica'],
  pie: ['Proyectó: Talento Humano.'],
};

describe('PdfKitContratoDocumentRenderer', () => {
  it('produce un PDF válido con firma incrustada', async () => {
    const pdf = await new PdfKitContratoDocumentRenderer().render(documento);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.toString('latin1')).toContain('/Image');
  });

  it('también renderiza sin firma, sin revisores y con logo inválido (lo omite)', async () => {
    const pdf = await new PdfKitContratoDocumentRenderer().render({
      ...documento,
      logo: Buffer.from('no-es-una-imagen'),
      firma: { ...documento.firma, imagenPng: null },
      revisores: [],
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
