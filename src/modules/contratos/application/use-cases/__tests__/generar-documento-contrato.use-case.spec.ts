import { NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
import { FakeClock } from '../../../../../shared/testing';
import { Contrato } from '../../../domain/contrato';
import { GenerarDocumentoContratoUseCase, normalizarOpciones } from '../generar-documento-contrato.use-case';
import {
  FakeBranding,
  FakeDocumentRenderer,
  FakeFileStorage,
  InMemoryContratoRepository,
  InMemoryUsuarios,
} from './in-memory-contratos.repositories';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 1)]);

function contexto() {
  const clock = new FakeClock(new Date('2026-10-08T15:00:00.000Z'));
  const usuarios = new InMemoryUsuarios();
  usuarios.items = [
    {
      id: 2,
      firstName: 'Juan',
      lastName: 'Pérez',
      cedula: '123',
      role: 'funcionario',
      estadoColaborador: 'activo',
      cargoNombre: 'Analista',
      areaNombre: 'Gestión Humana',
    },
    { id: 3, firstName: 'Ana', lastName: 'Gómez', cedula: '456', role: 'funcionario', estadoColaborador: 'activo' },
  ];
  const contratos = new InMemoryContratoRepository(usuarios);
  const renderer = new FakeDocumentRenderer();
  const files = new FakeFileStorage();
  const uc = new GenerarDocumentoContratoUseCase(contratos, renderer, new FakeBranding(), files, clock);
  return { contratos, renderer, files, uc };
}

describe('Generar documento de contrato', () => {
  it('normaliza las opciones con los valores por defecto del legado', () => {
    expect(
      normalizarOpciones({ contratoId: 1, tipo: 'raro', meses: 0, numero: -1, anios: null, codigo: ' ' }),
    ).toMatchObject({
      tipo: 'preaviso',
      meses: 3,
      numero: 1,
      anios: 1,
      codigo: 'G.H.3.1.',
      firmanteNombre: 'DIRECTORA ADMINISTRATIVA',
      firmanteCargo: 'Comfasucre',
      revisoUno: 'Jefe Departamento',
      revisoDos: 'Revisó Jurídica',
      proyecto: 'Talento Humano',
    });
    expect(normalizarOpciones({ contratoId: 1, tipo: 'prorroga', meses: 6, codigo: 'X.1' })).toMatchObject({
      tipo: 'prorroga',
      meses: 6,
      codigo: 'D.A.3'.replace('D.A.3', 'X.1'),
    });
    expect(normalizarOpciones({ contratoId: 1, tipo: 'renovacion' }).codigo).toBe('D.A.3');
  });

  it('genera el preaviso con la fecha de vencimiento en mayúsculas y pie con copia', async () => {
    const ctx = contexto();
    await ctx.contratos.save(
      Contrato.create({
        userId: 2,
        tipoContrato: 'fijo',
        numeroContrato: 'CT-1',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        salarioBase: 1,
      }),
    );
    const r = await ctx.uc.execute({ contratoId: 1, tipo: 'preaviso' });
    expect(r.filename).toBe('Preaviso_Terminacion_1.pdf');
    expect(r.mimeType).toBe('application/pdf');
    const doc = ctx.renderer.ultimo!;
    expect(doc.codigo).toBe('G.H.3.1.');
    expect(doc.lugarYFecha).toBe('Sincelejo, 8 de octubre de 2026');
    expect(doc.destinatario).toEqual({
      nombre: 'JUAN PÉREZ',
      cargoArea: 'Analista - Gestión Humana',
      empresa: 'Comfasucre',
    });
    expect(doc.asunto).toContain('CON FECHA DE VENCIMIENTO EL 31 DE DICIEMBRE DE 2026.');
    expect(doc.parrafos[0].texto).toContain('**31 DE DICIEMBRE DE 2026**');
    expect(doc.revisores).toEqual([]);
    expect(doc.pie).toEqual(['Copia: hoja de vida, jefe inmediato.', 'Proyectó: Talento Humano.']);
  });

  it('genera la prórroga calculando el periodo y el ordinal, con revisores', async () => {
    const ctx = contexto();
    await ctx.contratos.save(
      Contrato.create({
        userId: 2,
        tipoContrato: 'fijo',
        numeroContrato: 'CT-1',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-10-31',
        salarioBase: 1,
      }),
    );
    const r = await ctx.uc.execute({ contratoId: 1, tipo: 'prorroga', meses: 2, numero: 2, revisoUno: 'Jefe TI' });
    expect(r.filename).toBe('Prorroga_Contrato_1.pdf');
    const doc = ctx.renderer.ultimo!;
    expect(doc.codigo).toBe('D.A.3');
    expect(doc.asunto).toBe('Ref. PRÓRROGA DE CONTRATO');
    expect(doc.parrafos[0].texto).toContain('en el área de **GESTIÓN HUMANA**');
    expect(doc.parrafos[1].texto).toContain(
      '**2 MESES**, contados a partir del **1 DE NOVIEMBRE DE 2026** hasta el **31 DE DICIEMBRE DE 2026**',
    );
    expect(doc.parrafos[2].texto).toContain('**segunda (02) prórroga**');
    expect(doc.revisores).toEqual(['Jefe TI', 'Revisó Jurídica']);
  });

  it('genera la renovación por años y usa textos por defecto cuando faltan cargo, área o fecha fin', async () => {
    const ctx = contexto();
    await ctx.contratos.save(
      Contrato.create({
        userId: 3,
        tipoContrato: 'indefinido',
        numeroContrato: 'CT-2',
        fechaInicio: '2026-01-01',
        fechaFin: null,
        salarioBase: 1,
      }),
    );
    const r = await ctx.uc.execute({ contratoId: 1, tipo: 'renovacion', anios: 2 });
    expect(r.filename).toBe('Renovacion_Contrato_1.pdf');
    const doc = ctx.renderer.ultimo!;
    expect(doc.destinatario.cargoArea).toBe('Cargo no definido - Área no definida');
    expect(doc.parrafos[0].texto).toContain('en el área de **EL ÁREA ASIGNADA**');
    // Sin fecha fin la base es hoy (8 de octubre de 2026): inicio 9/10/2026, fin 8/10/2028
    expect(doc.parrafos[1].texto).toContain(
      '**2 AÑOS**, contados a partir del **9 DE OCTUBRE DE 2026** hasta el **8 DE OCTUBRE DE 2028**',
    );
  });

  it('incrusta la firma PNG válida y la guarda en uploads/documentos', async () => {
    const ctx = contexto();
    await ctx.contratos.save(
      Contrato.create({
        userId: 2,
        tipoContrato: 'fijo',
        numeroContrato: 'CT-1',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        salarioBase: 1,
      }),
    );
    await ctx.uc.execute({
      contratoId: 1,
      tipo: 'preaviso',
      firmaPng: PNG,
      firmaPngNombre: 'sello.png',
      firmanteNombre: 'GERENTE',
    });
    expect(ctx.renderer.ultimo!.firma).toMatchObject({ nombre: 'GERENTE', cargo: 'Comfasucre' });
    expect(ctx.renderer.ultimo!.firma.imagenPng).toBe(PNG);
    expect(ctx.files.guardados[0].options).toMatchObject({
      folder: 'documentos',
      originalName: 'sello.png',
      allowedExtensions: ['png'],
    });
  });

  it('rechaza firmas que no son PNG o superan 5 MB y contratos inexistentes', async () => {
    const ctx = contexto();
    await ctx.contratos.save(
      Contrato.create({
        userId: 2,
        tipoContrato: 'fijo',
        numeroContrato: 'CT-1',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        salarioBase: 1,
      }),
    );
    await expect(
      ctx.uc.execute({ contratoId: 1, tipo: 'preaviso', firmaPng: Buffer.from('GIF89a....') }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      ctx.uc.execute({ contratoId: 1, tipo: 'preaviso', firmaPng: Buffer.alloc(5 * 1024 * 1024 + 1) }),
    ).rejects.toThrow('5 MB');
    await expect(ctx.uc.execute({ contratoId: 7, tipo: 'preaviso' })).rejects.toBeInstanceOf(NotFoundError);
    expect(ctx.files.guardados).toHaveLength(0);
  });
});
