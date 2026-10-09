import * as ExcelJS from 'exceljs';
import { BufferAsistenciaFileParser, detectarDelimitador, parsearLineaCsv } from '../asistencia-file.parser';

describe('BufferAsistenciaFileParser', () => {
  const parser = new BufferAsistenciaFileParser();

  it('lee un TSV con cabeceras del reloj biométrico', async () => {
    const contenido =
      'ID de Usuario\tNombre\tTipo de registro\tDepartamento\tDispositivo Nro\tFecha\tHora\n' +
      '111\tAna Pérez\tin\tSistemas\t1\t08/10/2026\t07:55:00\n' +
      '\t\t\t\t\t\t\n' +
      '222\tLuis Gómez\tout\tSistemas\t1\t08/10/2026\t17:05:30\n';
    const filas = await parser.parse({
      buffer: Buffer.from(contenido, 'utf8'),
      originalName: 'reloj.txt',
      mimeType: 'text/plain',
    });
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({
      identificacion: '111',
      nombre: 'Ana Pérez',
      fechaHora: '2026-10-08 07:55:00',
      tipoRegistro: 'in',
    });
    expect(filas[1].fechaHora).toBe('2026-10-08 17:05:30');
  });

  it('lee un CSV con BOM, comillas y columna Fecha/Hora combinada', async () => {
    const contenido =
      '﻿Identificación,Nombre,"Fecha/Hora",Tipo registro\n"333","Pérez, María",2026-10-08 08:20:00,entrada\n';
    const filas = await parser.parse({
      buffer: Buffer.from(contenido, 'utf8'),
      originalName: 'reloj.csv',
      mimeType: 'text/csv',
    });
    expect(filas).toEqual([
      expect.objectContaining({
        identificacion: '333',
        nombre: 'Pérez, María',
        fechaHora: '2026-10-08 08:20:00',
        tipoRegistro: 'entrada',
      }),
    ]);
  });

  it('lee un XLSX generado con exceljs convirtiendo las fechas', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Marcaciones');
    ws.addRow(['ID de Usuario', 'Nombre', 'Fecha/Hora', 'Tipo de registro']);
    ws.addRow([111, 'Ana Pérez', new Date(Date.UTC(2026, 9, 8, 7, 59, 1)), 'in']);
    ws.addRow([111, 'Ana Pérez', '08/10/2026 17:00:00', 'out']);
    ws.addRow([null, null, null, null]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const filas = await parser.parse({
      buffer,
      originalName: 'reloj.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    expect(filas.map((f) => f.fechaHora)).toEqual(['2026-10-08 07:59:01', '2026-10-08 17:00:00']);
    expect(filas[0].identificacion).toBe('111');
  });

  it('devuelve vacío cuando sólo hay cabeceras', async () => {
    const filas = await parser.parse({
      buffer: Buffer.from('ID de Usuario,Nombre\n'),
      originalName: 'a.csv',
      mimeType: 'text/csv',
    });
    expect(filas).toEqual([]);
  });
});

describe('utilidades CSV', () => {
  it('detecta tabulador, punto y coma o coma', () => {
    expect(detectarDelimitador('a\tb')).toBe('\t');
    expect(detectarDelimitador('a;b')).toBe(';');
    expect(detectarDelimitador('a,b')).toBe(',');
  });
  it('respeta comillas dobles escapadas', () => {
    expect(parsearLineaCsv('1,"Dice ""hola"", sí",x', ',')).toEqual(['1', 'Dice "hola", sí', 'x']);
  });
});
