import { diferenciaDias, esFechaIso, fechaLargaEs, ordinalTexto, sumar } from '../fechas';

describe('Utilidades de fechas de contratos', () => {
  it('suma meses y resta un día como strtotime de PHP', () => {
    // Inicio de prórroga 2026-02-01, +3 meses -1 día = 2026-04-30
    expect(sumar('2026-02-01', { meses: 3, dias: -1 })).toBe('2026-04-30');
    // Desborde de mes: 2026-01-30 +1 mes -1 día → 2026-03-01 (febrero de 2026 tiene 28 días)
    expect(sumar('2026-01-30', { meses: 1, dias: -1 })).toBe('2026-03-01');
    // Un año de renovación
    expect(sumar('2026-01-01', { anios: 1, dias: -1 })).toBe('2026-12-31');
    expect(sumar('2026-12-31', { dias: 1 })).toBe('2027-01-01');
  });

  it('calcula diferencias de días con signo', () => {
    expect(diferenciaDias('2026-10-08', '2026-10-15')).toBe(7);
    expect(diferenciaDias('2026-10-08', '2026-10-07')).toBe(-1);
  });

  it('valida fechas ISO reales', () => {
    expect(esFechaIso('2026-02-29')).toBe(false);
    expect(esFechaIso('2024-02-29')).toBe(true);
    expect(esFechaIso('08/10/2026')).toBe(false);
  });

  it('formatea fecha larga y ordinales en español', () => {
    expect(fechaLargaEs('2026-10-08')).toBe('8 de octubre de 2026');
    expect(ordinalTexto(1)).toBe('primera');
    expect(ordinalTexto(6)).toBe('6ª');
  });
});
