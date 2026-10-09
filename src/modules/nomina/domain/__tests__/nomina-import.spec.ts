import { CuentaBancaria } from '../cuenta-bancaria';
import { anioDesprendible, toConceptos } from '../desprendible';
import {
  baseLocalUsuario,
  buildPeriodoKey,
  dividirNombre,
  estadoFinalLote,
  nombresOrganizacion,
  normalizarCedula,
  totalesEmpleado,
  variantesCedula,
} from '../nomina-import';

describe('Reglas de dominio de nómina', () => {
  describe('CuentaBancaria.create', () => {
    it('normaliza y valida los datos', () => {
      const c = CuentaBancaria.create({
        userId: 2,
        banco: '  Bancolombia ',
        tipoCuenta: 'ahorros',
        numeroCuenta: '1234 5678 90',
      });
      expect(c.props).toMatchObject({ banco: 'Bancolombia', numeroCuenta: '1234567890', tipoCuenta: 'ahorros' });
    });
    it('rechaza banco vacío, tipo desconocido y número inválido', () => {
      expect(() =>
        CuentaBancaria.create({ userId: 2, banco: '', tipoCuenta: 'ahorros', numeroCuenta: '123456' }),
      ).toThrow('El banco es obligatorio.');
      expect(() =>
        CuentaBancaria.create({ userId: 2, banco: 'B', tipoCuenta: 'otra' as never, numeroCuenta: '123456' }),
      ).toThrow('tipo de cuenta');
      expect(() =>
        CuentaBancaria.create({ userId: 2, banco: 'B', tipoCuenta: 'corriente', numeroCuenta: '12' }),
      ).toThrow('entre 4 y 30');
    });
  });

  it('normalizarCedula y variantesCedula', () => {
    expect(normalizarCedula('1.102.879-2')).toBe('11028792');
    expect(variantesCedula({ cedula: '1102879310', cedulaRaw: '1102879310-2' })).toEqual(['1102879310', '11028793102']);
    expect(variantesCedula({ cedula: '123', cedulaRaw: '123' })).toEqual(['123']);
  });

  it('dividirNombre usa valores por defecto del legado', () => {
    expect(dividirNombre('PEREZ GOMEZ JUAN CARLOS')).toEqual({ firstName: 'PEREZ', lastName: 'GOMEZ JUAN CARLOS' });
    expect(dividirNombre('SOLO')).toEqual({ firstName: 'SOLO', lastName: 'NOMINA' });
    expect(dividirNombre('')).toEqual({ firstName: 'FUNCIONARIO', lastName: 'NOMINA' });
  });

  it('baseLocalUsuario cae en cascada: cédula → documento → nombre → nomina+hora', () => {
    const ahora = new Date(2026, 9, 8, 10, 5, 9);
    expect(baseLocalUsuario({ documentoNomina: '45871' }, '1102879310', 'A', 'B', ahora)).toBe('1102879310');
    expect(baseLocalUsuario({ documentoNomina: '45871' }, '', 'A', 'B', ahora)).toBe('45871');
    expect(baseLocalUsuario({ documentoNomina: '' }, '', 'Ana', 'López', ahora)).toBe('analpez');
    expect(baseLocalUsuario({ documentoNomina: '' }, '', '', '', ahora)).toBe('nomina100509');
  });

  it('buildPeriodoKey replica el formato del legado', () => {
    expect(
      buildPeriodoKey({
        fechaInicio: '2026-04-16',
        fechaFin: '2026-04-30',
        fuente: 'colegio',
        tipoNomina: '06',
        fechaLiquidacion: null,
        diasLiquidados: null,
      }),
    ).toBe('2026-04-16_2026-04-30_COLEGIO_T06');
    expect(
      buildPeriodoKey({
        fechaInicio: null,
        fechaFin: null,
        fuente: '',
        tipoNomina: '',
        fechaLiquidacion: null,
        diasLiquidados: null,
      }),
    ).toBe('0000-00-00_0000-00-00_GENERAL_TNA');
  });

  it('nombresOrganizacion aplica los valores por defecto', () => {
    expect(nombresOrganizacion({ area: '', cargo: '' }, { fuente: '' })).toEqual({
      sede: 'COLEGIO',
      area: 'EDUCACION',
      cargo: 'SIN CARGO',
    });
    expect(nombresOrganizacion({ area: 'ADMIN', cargo: 'AUX' }, { fuente: 'CAMPANOS' })).toEqual({
      sede: 'CAMPANOS',
      area: 'ADMIN',
      cargo: 'AUX',
    });
  });

  it('totalesEmpleado y estadoFinalLote', () => {
    expect(totalesEmpleado({ devengados: { a: 10, b: 5 }, deducciones: { c: 3 } })).toEqual({
      totalDevengado: 15,
      totalDeducido: 3,
    });
    expect(estadoFinalLote(0)).toBe('completado');
    expect(estadoFinalLote(2)).toBe('parcial');
  });

  it('toConceptos y anioDesprendible toleran JSON en texto y valores nulos', () => {
    expect(toConceptos('{"Salario - 001": "1000", "x": null}')).toEqual({ 'Salario - 001': 1000, x: 0 });
    expect(toConceptos('no-json')).toEqual({});
    expect(anioDesprendible({ fechaFin: '2025-12-31', fechaInicio: null, periodo: '' })).toBe(2025);
    expect(anioDesprendible({ fechaFin: null, fechaInicio: null, periodo: '2024-01-01_2024-01-15_COLEGIO_T06' })).toBe(
      2024,
    );
    expect(anioDesprendible({ fechaFin: null, fechaInicio: null, periodo: 'x' })).toBeNull();
  });
});
