import { ValidationError } from '../../../../shared/domain/domain-error';
import { Cargo } from '../cargo';

describe('Cargo (dominio)', () => {
  const base = { nombre: 'Analista', descripcion: null, areaId: null, funciones: null, estado: 'activo' as const };

  it('usa nivel 5 (Auxiliar) por defecto', () => {
    const cargo = Cargo.create(base);
    expect(cargo.props.nivelJerarquico).toBe(5);
    expect(cargo.nivelNombre).toBe('Auxiliar');
  });

  it('rechaza nombres vacíos y niveles fuera de rango', () => {
    expect(() => Cargo.create({ ...base, nombre: '  ' })).toThrow(ValidationError);
    expect(() => Cargo.create({ ...base, nivelJerarquico: 0 })).toThrow(ValidationError);
    expect(() => Cargo.create({ ...base, nivelJerarquico: 6 })).toThrow(ValidationError);
  });

  it('normaliza espacios y campos vacíos', () => {
    const cargo = Cargo.create({ ...base, nombre: '  Director  ', funciones: '   ', nivelJerarquico: 1 });
    expect(cargo.props.nombre).toBe('Director');
    expect(cargo.props.funciones).toBeNull();
    expect(cargo.nivelNombre).toBe('Director');
  });
});
