import { DiasHabilesCalculator, parseIsoDate, sumarDias, toIso } from '../dias-habiles.calculator';

describe('DiasHabilesCalculator', () => {
  const calc = new DiasHabilesCalculator();

  describe('domingo de Pascua', () => {
    it.each([
      [2024, '2024-03-31'],
      [2025, '2025-04-20'],
      [2026, '2026-04-05'],
      [2027, '2027-03-28'],
      [2030, '2030-04-21'],
      [2000, '2000-04-23'],
    ])('año %i → %s', (year, esperado) => {
      expect(DiasHabilesCalculator.pascua(year)).toBe(esperado);
    });
  });

  describe('festivos de Colombia 2025', () => {
    const festivos = DiasHabilesCalculator.festivosColombia(2025);
    const esperados = [
      '2025-01-01', // Año Nuevo
      '2025-01-06', // Reyes (lunes)
      '2025-03-24', // San José (19 → lunes 24)
      '2025-04-17', // Jueves Santo
      '2025-04-18', // Viernes Santo
      '2025-05-01', // Trabajo
      '2025-06-02', // Ascensión
      '2025-06-23', // Corpus Christi
      '2025-06-30', // Sagrado Corazón y San Pedro y San Pablo (29 → lunes 30)
      '2025-07-20', // Independencia (domingo, fijo)
      '2025-08-07', // Boyacá
      '2025-08-18', // Asunción (15 → lunes 18)
      '2025-10-13', // Raza (12 → lunes 13)
      '2025-11-03', // Todos los Santos (1 → lunes 3)
      '2025-11-17', // Independencia de Cartagena (11 → lunes 17)
      '2025-12-08', // Inmaculada
      '2025-12-25', // Navidad
    ];

    it.each(esperados)('incluye %s', (f) => {
      expect(festivos.has(f)).toBe(true);
    });

    it('tiene exactamente 17 fechas distintas (Sagrado Corazón coincide con San Pedro y San Pablo)', () => {
      expect(festivos.size).toBe(17);
      expect([...festivos].sort()).toEqual(esperados);
    });

    it('no marca como festivo la fecha original de uno trasladado', () => {
      expect(festivos.has('2025-03-19')).toBe(false);
      expect(festivos.has('2025-08-15')).toBe(false);
      expect(festivos.has('2025-11-11')).toBe(false);
    });
  });

  describe('festivos de Colombia 2026', () => {
    const festivos = DiasHabilesCalculator.festivosColombia(2026);
    const esperados = [
      '2026-01-01',
      '2026-01-12', // Reyes (6 martes → lunes 12)
      '2026-03-23', // San José (19 jueves → lunes 23)
      '2026-04-02', // Jueves Santo
      '2026-04-03', // Viernes Santo
      '2026-05-01',
      '2026-05-18', // Ascensión
      '2026-06-08', // Corpus Christi
      '2026-06-15', // Sagrado Corazón
      '2026-06-29', // San Pedro y San Pablo (lunes, no se mueve)
      '2026-07-20',
      '2026-08-07',
      '2026-08-17', // Asunción (15 sábado → lunes 17)
      '2026-10-12', // Raza (lunes)
      '2026-11-02', // Todos los Santos (1 domingo → lunes 2)
      '2026-11-16', // Cartagena (11 miércoles → lunes 16)
      '2026-12-08',
      '2026-12-25',
    ];

    it('coincide con el calendario oficial', () => {
      expect([...festivos].sort()).toEqual(esperados);
    });
  });

  describe('calcularDiasHabiles', () => {
    it('cuenta de lunes a viernes en una semana sin festivos', () => {
      expect(calc.calcularDiasHabiles('2026-02-02', '2026-02-08')).toBe(5);
    });

    it('un mismo día hábil cuenta 1', () => {
      expect(calc.calcularDiasHabiles('2026-02-04', '2026-02-04')).toBe(1);
    });

    it('un sábado o domingo cuenta 0', () => {
      expect(calc.calcularDiasHabiles('2026-02-07', '2026-02-08')).toBe(0);
    });

    it('excluye Jueves y Viernes Santo de 2026', () => {
      // Lunes 30/03 a domingo 05/04: lunes, martes y miércoles hábiles.
      expect(calc.calcularDiasHabiles('2026-03-30', '2026-04-05')).toBe(3);
    });

    it('excluye un festivo trasladado (Reyes 2026 → lunes 12 de enero)', () => {
      expect(calc.calcularDiasHabiles('2026-01-12', '2026-01-16')).toBe(4);
    });

    it('un festivo fijo en domingo no resta días hábiles (20 de julio de 2025)', () => {
      expect(calc.calcularDiasHabiles('2025-07-14', '2025-07-25')).toBe(10);
    });

    it('calcula correctamente un rango de 15 días hábiles típico', () => {
      // Del lunes 2 de junio de 2025 (Ascensión) al viernes 27 de junio de 2025:
      // 4 semanas = 20 días laborables menos Ascensión (2/06) y Corpus (23/06) = 18.
      expect(calc.calcularDiasHabiles('2025-06-02', '2025-06-27')).toBe(18);
    });

    it('abarca cambio de año (festivos de dos años distintos)', () => {
      // Lunes 22/12/2025 a viernes 09/01/2026: 15 laborables menos 25/12, 01/01 = 13 (06/01/2026 se traslada al 12).
      expect(calc.calcularDiasHabiles('2025-12-22', '2026-01-09')).toBe(13);
    });

    it('acepta fecha-hora y usa sólo la parte de fecha', () => {
      expect(calc.calcularDiasHabiles('2026-02-02 08:00:00', '2026-02-06T17:30')).toBe(5);
    });

    it('devuelve 0 si la fecha fin es anterior a la de inicio', () => {
      expect(calc.calcularDiasHabiles('2026-02-10', '2026-02-02')).toBe(0);
    });

    it('devuelve 0 con fechas vacías o inválidas', () => {
      expect(calc.calcularDiasHabiles('', '2026-02-02')).toBe(0);
      expect(calc.calcularDiasHabiles(null, undefined)).toBe(0);
      expect(calc.calcularDiasHabiles('2026-02-30', '2026-03-02')).toBe(0);
      expect(calc.calcularDiasHabiles('no-es-fecha', '2026-03-02')).toBe(0);
    });

    it('el año 2025 completo tiene 245 días hábiles', () => {
      // 261 días laborables (lun-vie) menos 16 festivos entre semana
      // (de los 17 festivos distintos de 2025 sólo el 20/07 cae en domingo).
      expect(calc.calcularDiasHabiles('2025-01-01', '2025-12-31')).toBe(245);
    });
  });

  describe('esDiaHabil', () => {
    it('distingue hábiles, fines de semana y festivos', () => {
      expect(calc.esDiaHabil('2026-02-04')).toBe(true);
      expect(calc.esDiaHabil('2026-02-07')).toBe(false);
      expect(calc.esDiaHabil('2026-04-03')).toBe(false);
    });
  });

  describe('utilidades de fecha', () => {
    it('parseIsoDate y toIso son inversas', () => {
      expect(toIso(parseIsoDate('2026-10-08')!)).toBe('2026-10-08');
    });
    it('sumarDias suma días calendario', () => {
      expect(sumarDias('2026-02-27', 3)).toBe('2026-03-02');
    });
  });
});
