import { AsistenciaPolitica } from '../asistencia-politica';
import { consolidarDia } from '../consolidar-resumen.service';
import { Marcacion } from '../marcacion';

const politica = AsistenciaPolitica.create({
  sedeId: 1,
  horaEntradaLimite: '08:10:00',
  horaSalidaTemprana: '11:59:00',
  toleranciaMinutos: 0,
  enviarMemorandoTardanza: true,
});

let seq = 1;
const marca = (fechaHora: string, tipoRegistro: string | null = null): Marcacion => ({
  id: seq++,
  userId: 7,
  fechaHora,
  tipoRegistro,
});

describe('consolidarDia (servicio de dominio)', () => {
  it('marca como normal a quien llega a tiempo y sale después de la hora de salida temprana', () => {
    const r = consolidarDia({
      politica,
      justificacion: '',
      marcaciones: [marca('2026-10-08 07:58:10', 'in'), marca('2026-10-08 17:02:00', 'out')],
    });
    expect(r).toMatchObject({
      horaEntrada: '07:58:10',
      horaSalida: '17:02:00',
      minutosTarde: 0,
      minutosSalidaTemprana: 0,
      estado: 'normal',
      detalle: '',
    });
  });

  it('calcula los minutos de tardanza (enteros, hacia abajo) cuando entra después del límite', () => {
    const r = consolidarDia({
      politica,
      justificacion: '',
      marcaciones: [marca('2026-10-08 08:25:45', 'in'), marca('2026-10-08 17:00:00', 'out')],
    });
    expect(r.minutosTarde).toBe(15);
    expect(r.estado).toBe('tarde');
    expect(r.detalle).toBe('Llegó tarde (15 min)');
  });

  it('detecta salida temprana cuando la última salida es anterior a la hora de referencia', () => {
    const r = consolidarDia({
      politica,
      justificacion: '',
      marcaciones: [marca('2026-10-08 07:50:00', 'in'), marca('2026-10-08 11:30:00', 'out')],
    });
    expect(r.minutosSalidaTemprana).toBe(29);
    expect(r.estado).toBe('salida_temprana');
    expect(r.detalle).toBe('Salida temprana (29 min)');
  });

  it('combina tardanza y salida temprana en un único estado', () => {
    const r = consolidarDia({
      politica,
      justificacion: '',
      marcaciones: [marca('2026-10-08 08:40:00', 'in'), marca('2026-10-08 11:00:00', 'out')],
    });
    expect(r.estado).toBe('tarde_salida_temprana');
    expect(r.detalle).toBe('Llegó tarde (30 min) / Salida temprana (59 min)');
  });

  it('usa la única marcación como entrada y como salida cuando no hay marcación de salida', () => {
    const r = consolidarDia({ politica, justificacion: '', marcaciones: [marca('2026-10-08 08:00:00', 'in')] });
    expect(r.horaEntrada).toBe('08:00:00');
    // La única marcación también se toma como salida (igual que el legado) → salida temprana.
    expect(r.horaSalida).toBe('08:00:00');
    expect(r.estado).toBe('salida_temprana');
    expect(r.minutosSalidaTemprana).toBe(239);
  });

  it('respeta la tolerancia en minutos antes de considerar tardanza', () => {
    const tolerante = AsistenciaPolitica.create({ sedeId: 1, horaEntradaLimite: '08:10', toleranciaMinutos: 10 });
    const puntual = consolidarDia({
      politica: tolerante,
      justificacion: '',
      marcaciones: [marca('2026-10-08 08:19:59'), marca('2026-10-08 17:00:00')],
    });
    expect(puntual.minutosTarde).toBe(0);
    expect(puntual.estado).toBe('normal');

    const tarde = consolidarDia({
      politica: tolerante,
      justificacion: '',
      marcaciones: [marca('2026-10-08 08:22:00'), marca('2026-10-08 17:00:00')],
    });
    expect(tarde.minutosTarde).toBe(2);
  });

  it('sin marcaciones y sin justificación es una falla', () => {
    const r = consolidarDia({ politica, justificacion: '', marcaciones: [] });
    expect(r).toMatchObject({ horaEntrada: null, horaSalida: null, estado: 'falla', detalle: 'No registró marcación' });
  });

  it('sin marcaciones pero con permiso aprobado queda justificado', () => {
    const r = consolidarDia({ politica, justificacion: 'Permiso aprobado', marcaciones: [] });
    expect(r.estado).toBe('justificado');
    expect(r.detalle).toBe('Permiso aprobado');
    expect(r.justificacion).toBe('Permiso aprobado');
  });

  it('prefiere las marcaciones tipo entrada/salida aunque no sean la primera/última del día', () => {
    const r = consolidarDia({
      politica,
      justificacion: '',
      marcaciones: [
        marca('2026-10-08 17:30:00', 'OUT'),
        marca('2026-10-08 07:30:00', 'break'),
        marca('2026-10-08 08:05:00', 'Entrada'),
        marca('2026-10-08 18:00:00', 'break'),
      ],
    });
    expect(r.horaEntrada).toBe('08:05:00');
    expect(r.horaSalida).toBe('17:30:00');
    expect(r.estado).toBe('normal');
  });

  it('un retraso menor a un minuto completo no cuenta como tardanza', () => {
    const r = consolidarDia({
      politica,
      justificacion: '',
      marcaciones: [marca('2026-10-08 08:10:40', 'in'), marca('2026-10-08 17:00:00', 'out')],
    });
    expect(r.minutosTarde).toBe(0);
    expect(r.estado).toBe('normal');
  });
});
