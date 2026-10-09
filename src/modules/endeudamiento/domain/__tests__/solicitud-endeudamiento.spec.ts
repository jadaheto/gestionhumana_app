import { ValidationError } from '../../../../shared/domain/domain-error';
import { SolicitudEndeudamiento } from '../solicitud-endeudamiento';

const base = {
  userId: 7,
  solicitudNo: 'SOL-2026-0001',
  fecha: '2026-10-08',
  salarioMensual: 2_000_000,
  conceptos: [{ concepto: 'SALUD', devengado: 0, deducido: 80_000 }],
  cuotaMensual: 200_000,
};

describe('SolicitudEndeudamiento', () => {
  it('se crea con cálculo, año derivado de la fecha y conclusión automática', () => {
    const s = SolicitudEndeudamiento.create(base);
    expect(s.props.anio).toBe(2026);
    expect(s.props.conclusion).toBe('APROBADO');
    expect(s.estado).toBe('aprobado');
    expect(s.props.calculo.porcentajeNuevoCredito).toBe(14);
    expect(s.props.libranza).toBeNull();
    expect(s.props.plazoMeses).toBe(0);
  });

  it('respeta la conclusión manual en mayúsculas y recorta opción de crédito', () => {
    const s = SolicitudEndeudamiento.create({
      ...base,
      conclusion: 'aprobado con observaciones',
      opcionCredito: ' B ',
      libranza: 'Banco X',
    });
    expect(s.props.conclusion).toBe('APROBADO CON OBSERVACIONES');
    expect(s.props.opcionCredito).toBe('B');
    expect(s.props.libranza).toBe('Banco X');
  });

  it('valida colaborador, número, fecha y valores negativos', () => {
    expect(() => SolicitudEndeudamiento.create({ ...base, userId: 0 })).toThrow('Debes seleccionar un colaborador.');
    expect(() => SolicitudEndeudamiento.create({ ...base, solicitudNo: ' ' })).toThrow(
      'El número de solicitud es obligatorio.',
    );
    expect(() => SolicitudEndeudamiento.create({ ...base, fecha: '08/10/2026' })).toThrow(ValidationError);
    expect(() => SolicitudEndeudamiento.create({ ...base, salarioMensual: -1 })).toThrow('no puede ser negativo');
    expect(() => SolicitudEndeudamiento.create({ ...base, plazoMeses: -3 })).toThrow(
      'El plazo en meses no puede ser negativo.',
    );
    expect(() =>
      SolicitudEndeudamiento.create({ ...base, conceptos: [{ concepto: 'A', devengado: 0, deducido: -5 }] }),
    ).toThrow(ValidationError);
  });
});
