import { ValidationError } from '../../../../shared/domain/domain-error';
import { AsistenciaPolitica, normalizarHora } from '../asistencia-politica';

describe('AsistenciaPolitica', () => {
  it('normaliza horas HH:mm a HH:mm:ss y aplica valores por defecto', () => {
    const p = AsistenciaPolitica.create({ sedeId: 3, horaEntradaLimite: '8:05', horaSalidaTemprana: '12:00' });
    expect(p.horaEntradaLimite).toBe('08:05:00');
    expect(p.horaSalidaTemprana).toBe('12:00:00');
    expect(p.toleranciaMinutos).toBe(0);
    expect(p.enviarMemorandoTardanza).toBe(true);
  });

  it('expone la política por defecto del legado', () => {
    const p = AsistenciaPolitica.porDefecto(1);
    expect(p.props).toEqual({
      sedeId: 1,
      horaEntradaLimite: '08:10:00',
      horaSalidaTemprana: '11:59:00',
      toleranciaMinutos: 0,
      enviarMemorandoTardanza: true,
    });
  });

  it('rechaza horas inválidas, tolerancia negativa y sede ausente', () => {
    expect(() => normalizarHora('25:00')).toThrow(ValidationError);
    expect(() => AsistenciaPolitica.create({ sedeId: 1, horaEntradaLimite: 'abc' })).toThrow(ValidationError);
    expect(() => AsistenciaPolitica.create({ sedeId: 1, toleranciaMinutos: -5 })).toThrow(ValidationError);
    expect(() => AsistenciaPolitica.create({ sedeId: 0 })).toThrow(ValidationError);
  });
});
