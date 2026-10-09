import { aDecimal, calcularEndeudamiento, cuotaSugerida } from '../endeudamiento-calculator';

describe('calcularEndeudamiento', () => {
  const conceptos = [
    { concepto: 'SALUD', devengado: 0, deducido: 100_000 },
    { concepto: 'PENSION', devengado: 0, deducido: 100_000 },
    { concepto: '', devengado: 0, deducido: 999_999 }, // sin concepto: se ignora
  ];

  it('calcula totales, porcentajes, neto y estado aprobado dentro del umbral', () => {
    const r = calcularEndeudamiento({
      salarioMensual: 2_000_000,
      otrosDevengados: 500_000,
      deduccionesLey: 150_000,
      conceptos,
      cuotaMensual: 300_000,
      umbralAprobacion: 50,
    });
    expect(r.totalDevengado).toBe(2_500_000);
    expect(r.totalDeducido).toBe(200_000);
    expect(r.netoActual).toBe(2_300_000);
    expect(r.deduccionesEndeudamiento).toBe(50_000);
    expect(r.porcentajeActual).toBe(8);
    expect(r.valorQuincenal).toBe(150_000);
    expect(r.porcentajeNuevoCredito).toBe(20);
    expect(r.netoRecibir).toBe(2_000_000);
    expect(r.estado).toBe('aprobado');
    expect(r.nivel).toBe('ZONA SEGURA');
    expect(r.conceptos).toEqual([
      { concepto: 'SALUD', devengado: 0, deducido: 100_000, porcentaje: 4 },
      { concepto: 'PENSION', devengado: 0, deducido: 100_000, porcentaje: 4 },
    ]);
  });

  it('rechaza cuando el porcentaje con el nuevo crédito supera el umbral', () => {
    const r = calcularEndeudamiento({
      salarioMensual: 1_000_000,
      otrosDevengados: 0,
      deduccionesLey: 0,
      conceptos,
      cuotaMensual: 400_000,
      umbralAprobacion: 50,
    });
    expect(r.porcentajeNuevoCredito).toBe(60);
    expect(r.estado).toBe('rechazado');
    expect(r.nivel).toBe('SUPERA LIMITE');
    expect(r.netoRecibir).toBe(400_000);
  });

  it('marca CERCA DEL LIMITE a partir del 90 % del umbral', () => {
    const r = calcularEndeudamiento({
      salarioMensual: 1_000_000,
      otrosDevengados: 0,
      deduccionesLey: 0,
      conceptos,
      cuotaMensual: 260_000,
      umbralAprobacion: 50,
    });
    expect(r.porcentajeNuevoCredito).toBe(46);
    expect(r.estado).toBe('aprobado');
    expect(r.nivel).toBe('CERCA DEL LIMITE');
  });

  it('usa umbral 50 cuando viene vacío o cero y base 1 cuando no hay devengados', () => {
    const r = calcularEndeudamiento({
      salarioMensual: 0,
      otrosDevengados: 0,
      deduccionesLey: 0,
      conceptos: [],
      cuotaMensual: 0,
      umbralAprobacion: 0,
    });
    expect(r.umbralAprobacion).toBe(50);
    expect(r.porcentajeActual).toBe(0);
    expect(r.estado).toBe('aprobado');
    const r2 = calcularEndeudamiento({
      salarioMensual: 0,
      otrosDevengados: 0,
      deduccionesLey: 0,
      conceptos: [{ concepto: 'X', devengado: 0, deducido: 2 }],
      cuotaMensual: 0,
      umbralAprobacion: 0,
    });
    expect(r2.porcentajeActual).toBe(200); // base = 1
  });

  it('no deja negativas las deducciones de endeudamiento y redondea a 2 decimales', () => {
    const r = calcularEndeudamiento({
      salarioMensual: 3_000_000,
      otrosDevengados: 0,
      deduccionesLey: 500_000,
      conceptos: [{ concepto: 'A', devengado: 0, deducido: 100_000 }],
      cuotaMensual: 123_456.789,
      umbralAprobacion: 30,
    });
    expect(r.deduccionesEndeudamiento).toBe(0);
    expect(r.valorQuincenal).toBe(61_728.39);
    expect(r.porcentajeNuevoCredito).toBe(7.45);
  });
});

describe('cuotaSugerida y aDecimal', () => {
  it('sugiere valor/plazo sólo cuando ambos son positivos', () => {
    expect(cuotaSugerida(1_000_000, 24)).toBe(41_666.67);
    expect(cuotaSugerida(0, 24)).toBeNull();
    expect(cuotaSugerida(1000, 0)).toBeNull();
  });
  it('interpreta números en formato colombiano y cadenas vacías', () => {
    expect(aDecimal('1.234.567,89')).toBe(1234567.89);
    expect(aDecimal('$ 2.500.000')).toBe(2_500_000);
    expect(aDecimal('1500.5')).toBe(1500.5);
    expect(aDecimal('')).toBe(0);
    expect(aDecimal('abc')).toBe(0);
    expect(aDecimal(null)).toBe(0);
  });
});
