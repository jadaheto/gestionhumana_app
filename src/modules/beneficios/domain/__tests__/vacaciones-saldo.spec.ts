import { DiasHabilesCalculator } from '../dias-habiles.calculator';
import { Permiso } from '../permiso';
import { DIAS_VACACIONES_POR_PERIODO, VacacionesSaldoCalculator } from '../vacaciones-saldo';

function vacaciones(id: number, inicio: string, fin: string, estado: 'aprobado' | 'pendiente' = 'aprobado'): Permiso {
  const p = Permiso.create({
    userId: 2,
    tipoPermiso: 'vacaciones',
    fechaInicio: inicio,
    fechaFin: fin,
    justificacion: 'Descanso',
  }).withId(id);
  return estado === 'aprobado' ? p.aprobar(1, null, '2026-01-01 00:00:00') : p;
}

describe('VacacionesSaldoCalculator', () => {
  const saldo = new VacacionesSaldoCalculator(new DiasHabilesCalculator());

  describe('periodosCumplidos', () => {
    it('cuenta años completos desde la fecha de referencia', () => {
      expect(saldo.periodosCumplidos('2020-03-15', '2026-10-08')).toBe(6);
    });
    it('no cuenta el año en curso si aún no llega el aniversario', () => {
      expect(saldo.periodosCumplidos('2020-12-15', '2026-10-08')).toBe(5);
      expect(saldo.periodosCumplidos('2020-10-09', '2026-10-08')).toBe(5);
      expect(saldo.periodosCumplidos('2020-10-08', '2026-10-08')).toBe(6);
    });
    it('devuelve 0 sin fecha, con fecha inválida o futura', () => {
      expect(saldo.periodosCumplidos(null, '2026-10-08')).toBe(0);
      expect(saldo.periodosCumplidos('xx', '2026-10-08')).toBe(0);
      expect(saldo.periodosCumplidos('2027-01-01', '2026-10-08')).toBe(0);
      expect(saldo.periodosCumplidos('2026-05-01', '2026-10-08')).toBe(0);
    });
  });

  describe('calcularSaldo', () => {
    it('acumula 15 días por período y descuenta las vacaciones aprobadas', () => {
      expect(DIAS_VACACIONES_POR_PERIODO).toBe(15);
      const r = saldo.calcularSaldo({
        fechaReferencia: '2024-01-15',
        hoy: '2026-10-08',
        vacacionesAprobadas: [vacaciones(1, '2026-02-02', '2026-02-06')], // 5 días hábiles
        diasDisfrutadosPorPermiso: new Map(),
      });
      expect(r).toEqual({ periodos: 2, diasAcumulados: 30, diasConsumidos: 5, diasPendientes: 25 });
    });

    it('con una suspensión sólo descuenta los días disfrutados', () => {
      const r = saldo.calcularSaldo({
        fechaReferencia: '2024-01-15',
        hoy: '2026-10-08',
        vacacionesAprobadas: [vacaciones(7, '2026-02-02', '2026-02-13')], // 10 días hábiles
        diasDisfrutadosPorPermiso: new Map([[7, 3]]),
      });
      expect(r.diasConsumidos).toBe(3);
      expect(r.diasPendientes).toBe(27);
    });

    it('los días disfrutados nunca superan los días hábiles del permiso', () => {
      const r = saldo.calcularSaldo({
        fechaReferencia: '2024-01-15',
        hoy: '2026-10-08',
        vacacionesAprobadas: [vacaciones(7, '2026-02-02', '2026-02-06')], // 5
        diasDisfrutadosPorPermiso: new Map([[7, 99]]),
      });
      expect(r.diasConsumidos).toBe(5);
    });

    it('el saldo pendiente nunca es negativo', () => {
      const r = saldo.calcularSaldo({
        fechaReferencia: '2026-01-15',
        hoy: '2026-10-08',
        vacacionesAprobadas: [vacaciones(1, '2026-02-02', '2026-02-13')],
        diasDisfrutadosPorPermiso: new Map(),
      });
      expect(r).toEqual({ periodos: 0, diasAcumulados: 0, diasConsumidos: 10, diasPendientes: 0 });
    });

    it('sin fecha de referencia no hay días acumulados', () => {
      const r = saldo.calcularSaldo({
        fechaReferencia: null,
        hoy: '2026-10-08',
        vacacionesAprobadas: [],
        diasDisfrutadosPorPermiso: new Map(),
      });
      expect(r).toEqual({ periodos: 0, diasAcumulados: 0, diasConsumidos: 0, diasPendientes: 0 });
    });
  });
});
