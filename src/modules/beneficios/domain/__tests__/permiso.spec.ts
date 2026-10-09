import { InvalidOperationError, ValidationError } from '../../../../shared/domain/domain-error';
import { normalizarFechaHora, Permiso } from '../permiso';

const base = {
  userId: 2,
  tipoPermiso: 'personal',
  fechaInicio: '2026-03-02T08:00',
  fechaFin: '2026-03-02T12:00',
  horas: 4,
  justificacion: 'Cita personal',
};

describe('Permiso (entidad de dominio)', () => {
  it('crea una solicitud pendiente normalizando las fechas', () => {
    const p = Permiso.create(base);
    expect(p.estado).toBe('pendiente');
    expect(p.props.fechaInicio).toBe('2026-03-02 08:00:00');
    expect(p.props.fechaFin).toBe('2026-03-02 12:00:00');
    expect(p.props.horas).toBe(4);
    expect(p.fechaInicioDia).toBe('2026-03-02');
  });

  it('rechaza tipos no permitidos', () => {
    expect(() => Permiso.create({ ...base, tipoPermiso: 'sabatico' })).toThrow(
      new ValidationError('Tipo de solicitud inválido.'),
    );
  });

  it('rechaza fechas inválidas o fin anterior al inicio', () => {
    expect(() => Permiso.create({ ...base, fechaInicio: '' })).toThrow(ValidationError);
    expect(() => Permiso.create({ ...base, fechaInicio: '2026-03-05', fechaFin: '2026-03-02' })).toThrow(
      'Las fechas de la solicitud no son válidas.',
    );
    expect(() => Permiso.create({ ...base, fechaInicio: '2026-02-31' })).toThrow(ValidationError);
  });

  it('exige justificación', () => {
    expect(() => Permiso.create({ ...base, justificacion: '   ' })).toThrow('La justificación es obligatoria.');
  });

  it('exige soporte para incapacidad', () => {
    expect(() => Permiso.create({ ...base, tipoPermiso: 'incapacidad' })).toThrow(
      'Para incapacidad debes adjuntar archivo soporte.',
    );
    const ok = Permiso.create({ ...base, tipoPermiso: 'incapacidad', archivoSoporte: 'soportes/a.pdf' });
    expect(ok.props.archivoSoporte).toBe('soportes/a.pdf');
  });

  it('ignora las horas en vacaciones e incapacidad', () => {
    const v = Permiso.create({ ...base, tipoPermiso: 'vacaciones', fechaInicio: '2026-03-02', fechaFin: '2026-03-20' });
    expect(v.props.horas).toBeNull();
    expect(v.esVacaciones).toBe(true);
  });

  it('rechaza horas negativas', () => {
    expect(() => Permiso.create({ ...base, horas: -1 })).toThrow(ValidationError);
  });

  it('aprueba y rechaza sólo solicitudes pendientes', () => {
    const p = Permiso.create(base).withId(10);
    const aprobada = p.aprobar(1, '  Ok  ', '2026-03-01 10:00:00');
    expect(aprobada.estado).toBe('aprobado');
    expect(aprobada.props.aprobadoPor).toBe(1);
    expect(aprobada.props.observacionRespuesta).toBe('Ok');
    expect(aprobada.props.updatedAt).toBe('2026-03-01 10:00:00');
    expect(() => aprobada.rechazar(1, null, '2026-03-01 10:00:00')).toThrow(
      new InvalidOperationError('La solicitud ya fue procesada.'),
    );

    const rechazada = p.rechazar(1, null, '2026-03-01 10:00:00');
    expect(rechazada.estado).toBe('rechazado');
    expect(rechazada.props.observacionRespuesta).toBeNull();
    expect(() => rechazada.aprobar(1, null, '2026-03-01 10:00:00')).toThrow(InvalidOperationError);
  });
});

describe('normalizarFechaHora', () => {
  it.each([
    ['2026-03-02', '2026-03-02 00:00:00'],
    ['2026-03-02T08:30', '2026-03-02 08:30:00'],
    ['2026-03-02T08:30:15', '2026-03-02 08:30:15'],
    ['2026-03-02 08:30:15', '2026-03-02 08:30:15'],
    ['2026-03-02T08:30:15.000Z', '2026-03-02 08:30:15'],
  ])('%s → %s', (input, esperado) => {
    expect(normalizarFechaHora(input)).toBe(esperado);
  });

  it('devuelve null para valores inválidos', () => {
    expect(normalizarFechaHora('')).toBeNull();
    expect(normalizarFechaHora('02/03/2026')).toBeNull();
    expect(normalizarFechaHora('2026-03-02T25:00')).toBeNull();
    expect(normalizarFechaHora('2026-13-02')).toBeNull();
  });
});
