import { InvalidOperationError, ValidationError } from '../../../../shared/domain/domain-error';
import { DiasHabilesCalculator } from '../dias-habiles.calculator';
import { Permiso } from '../permiso';
import { VacacionesSuspension } from '../vacaciones-suspension';

const calculadora = new DiasHabilesCalculator();
const AHORA = '2026-02-10 09:00:00';

function permisoVacaciones(
  estado: 'aprobado' | 'pendiente' = 'aprobado',
  inicio = '2026-02-02',
  fin = '2026-02-13',
): Permiso {
  const p = Permiso.create({
    userId: 2,
    tipoPermiso: 'vacaciones',
    fechaInicio: inicio,
    fechaFin: fin,
    justificacion: 'Descanso',
  }).withId(5);
  return estado === 'aprobado' ? p.aprobar(1, null, AHORA) : p;
}

describe('VacacionesSuspension.registrar', () => {
  it('calcula días totales, disfrutados y reintegrados', () => {
    const s = VacacionesSuspension.registrar({
      permiso: permisoVacaciones(),
      diasDisfrutados: 4,
      motivo: ' Necesidad del servicio ',
      adminId: 1,
      ahora: AHORA,
      calculadora,
    });
    expect(s.props).toMatchObject({
      permisoId: 5,
      userId: 2,
      diasTotales: 10,
      diasDisfrutados: 4,
      diasReintegrados: 6,
      motivo: 'Necesidad del servicio',
      suspendidoPor: 1,
      fechaSuspension: AHORA,
    });
    expect(s.id).toBeNull();
  });

  it('conserva el id y created_at de una suspensión previa del mismo permiso', () => {
    const previa = VacacionesSuspension.rehydrate({
      id: 9,
      permisoId: 5,
      userId: 2,
      diasTotales: 10,
      diasDisfrutados: 2,
      diasReintegrados: 8,
      motivo: null,
      suspendidoPor: 1,
      fechaSuspension: '2026-02-05 08:00:00',
      createdAt: '2026-02-05 08:00:00',
      updatedAt: '2026-02-05 08:00:00',
    });
    const s = VacacionesSuspension.registrar({
      permiso: permisoVacaciones(),
      diasDisfrutados: 3,
      motivo: null,
      adminId: 1,
      ahora: AHORA,
      calculadora,
      existente: previa,
    });
    expect(s.id).toBe(9);
    expect(s.props.createdAt).toBe('2026-02-05 08:00:00');
    expect(s.props.updatedAt).toBe(AHORA);
    expect(s.props.diasDisfrutados).toBe(3);
  });

  it('sólo permite suspender vacaciones aprobadas', () => {
    expect(() =>
      VacacionesSuspension.registrar({
        permiso: permisoVacaciones('pendiente'),
        diasDisfrutados: 1,
        motivo: null,
        adminId: 1,
        ahora: AHORA,
        calculadora,
      }),
    ).toThrow(new InvalidOperationError('Solo se pueden suspender vacaciones aprobadas.'));

    const personal = Permiso.create({
      userId: 2,
      tipoPermiso: 'personal',
      fechaInicio: '2026-02-02',
      fechaFin: '2026-02-02',
      justificacion: 'x',
    })
      .withId(6)
      .aprobar(1, null, AHORA);
    expect(() =>
      VacacionesSuspension.registrar({
        permiso: personal,
        diasDisfrutados: 1,
        motivo: null,
        adminId: 1,
        ahora: AHORA,
        calculadora,
      }),
    ).toThrow(InvalidOperationError);
  });

  it('rechaza solicitudes sin días hábiles', () => {
    expect(() =>
      VacacionesSuspension.registrar({
        permiso: permisoVacaciones('aprobado', '2026-02-07', '2026-02-08'),
        diasDisfrutados: 1,
        motivo: null,
        adminId: 1,
        ahora: AHORA,
        calculadora,
      }),
    ).toThrow('La solicitud no tiene días hábiles de vacaciones.');
  });

  it('exige al menos un día disfrutado', () => {
    expect(() =>
      VacacionesSuspension.registrar({
        permiso: permisoVacaciones(),
        diasDisfrutados: 0,
        motivo: null,
        adminId: 1,
        ahora: AHORA,
        calculadora,
      }),
    ).toThrow(new ValidationError('Debes indicar al menos 1 día disfrutado.'));
  });

  it('los días disfrutados no pueden superar los aprobados', () => {
    expect(() =>
      VacacionesSuspension.registrar({
        permiso: permisoVacaciones(),
        diasDisfrutados: 11,
        motivo: null,
        adminId: 1,
        ahora: AHORA,
        calculadora,
      }),
    ).toThrow('Los días disfrutados no pueden superar los días aprobados.');
  });
});
