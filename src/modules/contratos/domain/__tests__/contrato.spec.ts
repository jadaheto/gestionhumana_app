import { ValidationError } from '../../../../shared/domain/domain-error';
import { Contrato } from '../contrato';

const base = {
  userId: 2,
  tipoContrato: 'fijo',
  numeroContrato: 'CT-001',
  fechaInicio: '2026-01-01',
  fechaFin: '2026-12-31',
  salarioBase: 2_500_000,
};

describe('Contrato (dominio)', () => {
  it('crea un contrato válido con estado activo por defecto', () => {
    const c = Contrato.create(base);
    expect(c.props.estado).toBe('activo');
    expect(c.puedeProrrogar).toBe(true);
    expect(c.diasParaVencer('2026-12-01')).toBe(30);
  });

  it.each([
    [{ userId: 0 }, 'colaborador'],
    [{ tipoContrato: 'temporal' }, 'tipo de contrato'],
    [{ numeroContrato: '  ' }, 'número de contrato'],
    [{ fechaInicio: '2026-13-01' }, 'fecha de inicio'],
    [{ fechaFin: '2025-12-31' }, 'anterior a la fecha de inicio'],
    [{ salarioBase: 0 }, 'salario base'],
    [{ estado: 'suspendido' }, 'estado del contrato'],
  ])('rechaza %j', (cambio, fragmento) => {
    expect(() => Contrato.create({ ...base, ...cambio })).toThrow(ValidationError);
    expect(() => Contrato.create({ ...base, ...cambio })).toThrow(new RegExp(fragmento, 'i'));
  });

  it('detecta vencimiento y vigencia según la fecha de hoy', () => {
    const c = Contrato.create(base);
    expect(c.estaVencido('2026-12-31')).toBe(false);
    expect(c.estaVencido('2027-01-01')).toBe(true);
    expect(c.estaVigente('2026-06-15')).toBe(true);
    expect(c.estaVigente('2025-12-31')).toBe(false);
    expect(c.finalizar().estaVigente('2026-06-15')).toBe(false);
    const indefinido = Contrato.create({ ...base, tipoContrato: 'indefinido', fechaFin: null });
    expect(indefinido.estaVencido('2099-01-01')).toBe(false);
    expect(indefinido.diasParaVencer('2026-01-01')).toBeNull();
    expect(indefinido.puedeProrrogar).toBe(false);
  });

  it('calcula la prórroga igual que el legado (fin + 1 día, + N meses - 1 día)', () => {
    const r = Contrato.create({ ...base, fechaFin: '2026-01-31' }).prorrogar(3);
    expect(r).toMatchObject({
      fechaFinAnterior: '2026-01-31',
      fechaInicioProrroga: '2026-02-01',
      fechaFinNueva: '2026-04-30',
      meses: 3,
    });
    expect(r.contrato.props.fechaFin).toBe('2026-04-30');
    expect(r.contrato.props.estado).toBe('activo');
  });

  it('no permite prorrogar sin fecha fin ni con meses inválidos', () => {
    expect(() => Contrato.create({ ...base, fechaFin: null }).prorrogar(1)).toThrow(
      'Contrato inválido o sin fecha fin.',
    );
    expect(() => Contrato.create(base).prorrogar(0)).toThrow(ValidationError);
  });
});
