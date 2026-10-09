import { formatNumber, NominaParser } from '../nomina-parser';
import { TEXTO_NOMINA_DESCUADRADA, TEXTO_NOMINA_DOS_EMPLEADOS } from './nomina-fixtures';

describe('NominaParser (port de Nomina_parser.php)', () => {
  const parser = new NominaParser();

  describe('parse() con el reporte de dos empleados', () => {
    const r = parser.parse(TEXTO_NOMINA_DOS_EMPLEADOS);

    it('extrae los metadatos del encabezado', () => {
      expect(r.meta).toEqual({
        fechaLiquidacion: '2026-04-30',
        diasLiquidados: 15,
        fechaInicio: '2026-04-16',
        fechaFin: '2026-04-30',
        tipoNomina: '06',
        fuente: 'COLEGIO',
      });
    });

    it('detecta los dos empleados en orden de aparición', () => {
      expect(r.empleados.map((e) => e.nombre)).toEqual(['PEREZ GOMEZ JUAN CARLOS', 'LOPEZ MARTINEZ ANA MARIA']);
      expect(r.totales.empleadosDetectados).toBe(2);
    });

    it('limpia la cédula quitando el dígito de verificación y conserva la cruda', () => {
      const e = r.empleados[0];
      expect(e.cedula).toBe('1102879310');
      expect(e.cedulaRaw).toBe('1102879310-2');
      expect(e.documentoNomina).toBe('45871');
      expect(e.cargo).toBe('DOCENTE PRIMARIA');
      expect(e.sueldoBase).toBe(2_500_000);
      expect(e.area).toBe('EDUCACION');
      expect(e.dias).toBe(15);
    });

    it('clasifica devengados y deducciones (paréntesis o prefijo "Descuento")', () => {
      const e = r.empleados[0];
      expect(e.devengados).toEqual({ 'Salario - 001': 1_250_000, 'Auxilio Transporte - 010': 100_000 });
      expect(e.deducciones).toEqual({
        'Descuento Salud - 410': 54_000,
        'Descuento Pensión Colpensiones - 416': 54_000,
      });
      expect(e.neto).toBe(1_242_000);
    });

    it('fusiona un bloque partido por salto de página e ignora cabeceras/pies', () => {
      const e = r.empleados[1];
      expect(e.devengados).toEqual({ 'Salario - 001': 1_500_000, 'Bonificación - 020': 200_000 });
      expect(e.deducciones).toEqual({
        'Descuento Salud - 410': 60_000,
        'Descuento Pensión Porvenir - 417': 60_000,
        'Retención Fuente': 10_000,
      });
      expect(e.neto).toBe(1_570_000);
      expect(e.rawBlock).not.toContain('Pagina 1 de 2');
      expect(e.rawBlock).not.toContain('CAJA DE COMPENSACION');
    });

    it('lee los totales de control del PDF y no genera advertencias cuando todo cuadra', () => {
      expect(r.totales).toEqual({
        totalLiquidadoPdf: 2_812_000,
        totalEmpleadosPdf: 2,
        sumaNetos: 2_812_000,
        empleadosDetectados: 2,
      });
      expect(r.warnings).toEqual([]);
    });
  });

  describe('parse() con descuadres', () => {
    const r = parser.parse(TEXTO_NOMINA_DESCUADRADA);

    it('acepta montos en formato colombiano y detecta la fuente CAMPANOS', () => {
      expect(r.meta.fuente).toBe('CAMPANOS');
      expect(r.meta.tipoNomina).toBe('02');
      expect(r.empleados[0].sueldoBase).toBe(1_300_000);
      expect(r.empleados[0].neto).toBe(700_000);
      expect(r.empleados[0].area).toBe('ADMINISTRATIVA');
    });

    it('advierte neto que no cuadra, conteo distinto y total liquidado distinto', () => {
      expect(r.warnings).toEqual([
        'RUIZ PEDRO (123456): neto del PDF 700,000 no cuadra con conceptos 650,000.',
        'Empleados detectados (1) difiere del total del PDF (3).',
        'Suma de netos (700,000) difiere del TOTAL LIQUIDADO del PDF (999,999).',
      ]);
    });
  });

  it('devuelve una estructura vacía con texto sin empleados', () => {
    const r = parser.parse('Fecha Liquidación: 01/15/2026\nTOTAL EMPLEADOS LIQUIDADOS : 0');
    expect(r.empleados).toEqual([]);
    expect(r.meta.fechaLiquidacion).toBe('2026-01-15');
    expect(r.totales.totalEmpleadosPdf).toBe(0);
  });

  describe('parseMoney()', () => {
    it.each([
      ['1,232,414.00', 1_232_414],
      ['1.232.414,00', 1_232_414],
      ['1,232,414', 1_232_414],
      ['1.232.414', 1_232_414],
      ['12,50', 12.5],
      ['15.00', 15],
      ['$ 2,500,000.00', 2_500_000],
      ['', 0],
      ['abc', 0],
    ])('convierte "%s" en %d', (raw, esperado) => {
      expect(parser.parseMoney(raw)).toBe(esperado);
    });
  });

  describe('normalizeDate()', () => {
    it.each([
      ['04/30/2026', '2026-04-30'],
      ['30/04/2026', '2026-04-30'],
      ['2026-4-5', '2026-04-05'],
      ['02/30/2026', null],
      ['', null],
    ])('normaliza "%s" → %s', (raw, esperado) => {
      expect(parser.normalizeDate(raw)).toBe(esperado);
    });
  });

  it('formatNumber replica number_format($n, 0)', () => {
    expect(formatNumber(1242000)).toBe('1,242,000');
    expect(formatNumber(999.6)).toBe('1,000');
    expect(formatNumber(-5000)).toBe('-5,000');
  });
});
