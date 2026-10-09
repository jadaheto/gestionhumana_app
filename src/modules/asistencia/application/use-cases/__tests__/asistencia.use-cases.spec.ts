import { ValidationError } from '../../../../../shared/domain/domain-error';
import { adminActor, FakeClock, FakeMailer, funcionarioActor } from '../../../../../shared/testing';
import { AsistenciaPolitica } from '../../../domain/asistencia-politica';
import { MarcacionImportada } from '../../../domain/marcacion';
import { ConsolidarResumenDiarioUseCase } from '../consolidar-resumen-diario.use-case';
import { EnviarMemorandosUseCase } from '../enviar-memorandos.use-case';
import { GetMiHistorialUseCase } from '../get-mi-historial.use-case';
import { GetResumenDiarioUseCase } from '../get-resumen-diario.use-case';
import { ImportarMarcacionesUseCase } from '../importar-marcaciones.use-case';
import { GetPoliticaUseCase, SavePoliticaUseCase } from '../politica.use-cases';
import {
  FakeFileParser,
  InMemoryColaboradoresReader,
  InMemoryJustificacionReader,
  InMemoryMarcacionRepository,
  InMemoryPoliticaRepository,
  InMemoryRegistroRepository,
  InMemoryResumenRepository,
} from './in-memory-asistencia.repositories';

const SEDE = 1;
const FECHA = '2026-10-08';

function fila(identificacion: string, fechaHora: string, tipoRegistro = ''): MarcacionImportada {
  return {
    identificacion,
    nombre: 'X',
    fechaHora,
    tipoRegistro,
    departamento: '',
    dispositivoNo: '',
    fechaRaw: '',
    horaRaw: '',
  };
}

function setup() {
  const clock = new FakeClock(new Date('2026-10-08T15:00:00'));
  const politicas = new InMemoryPoliticaRepository();
  const marcaciones = new InMemoryMarcacionRepository();
  const resumenes = new InMemoryResumenRepository();
  const registros = new InMemoryRegistroRepository();
  const colaboradores = new InMemoryColaboradoresReader();
  const justificaciones = new InMemoryJustificacionReader();
  const mailer = new FakeMailer();
  const parser = new FakeFileParser();

  const ana = { id: 10, firstName: 'Ana', lastName: 'Pérez', email: 'ana@comfasucre.com.co', cedula: '111' };
  const luis = { id: 11, firstName: 'Luis', lastName: 'Gómez', email: 'luis@comfasucre.com.co', codigo: 'E-22' };
  const sinCorreo = { id: 12, firstName: 'Sin', lastName: 'Correo', email: null, cedula: '333' };
  colaboradores.porSede.set(SEDE, [ana, luis, sinCorreo]);
  for (const c of [ana, luis, sinCorreo]) resumenes.colaboradores.set(c.id, c);

  const consolidar = new ConsolidarResumenDiarioUseCase(
    politicas,
    marcaciones,
    resumenes,
    colaboradores,
    justificaciones,
    clock,
  );
  return {
    clock,
    politicas,
    marcaciones,
    resumenes,
    registros,
    colaboradores,
    justificaciones,
    mailer,
    parser,
    consolidar,
    importar: new ImportarMarcacionesUseCase(parser, marcaciones, colaboradores, clock),
    resumen: new GetResumenDiarioUseCase(consolidar, resumenes, politicas, clock),
    memorandos: new EnviarMemorandosUseCase(consolidar, resumenes, mailer, clock),
    savePolitica: new SavePoliticaUseCase(politicas, clock),
    getPolitica: new GetPoliticaUseCase(politicas),
    historial: new GetMiHistorialUseCase(registros, resumenes, clock),
  };
}

describe('ImportarMarcacionesUseCase', () => {
  it('guarda la importación resolviendo colaboradores por cédula o código y cuenta los no identificados', async () => {
    const s = setup();
    s.parser.filas = [
      fila('111', `${FECHA} 07:50:00`, 'in'),
      fila('E-22', `${FECHA} 08:30:00`, 'in'),
      fila('999', `${FECHA} 08:00:00`),
    ];
    const r = await s.importar.execute({
      sedeId: SEDE,
      actor: adminActor,
      archivo: { buffer: Buffer.from('x'), originalName: 'reloj.csv', mimeType: 'text/csv' },
    });
    expect(r).toMatchObject({ importacionId: 1, totalFilas: 3, sinColaborador: 1 });
    expect(s.marcaciones.importaciones[0]).toMatchObject({
      sedeId: SEDE,
      archivo: 'reloj.csv',
      importadoPor: adminActor.id,
    });
    expect(s.marcaciones.importaciones[0].marcaciones.map((m) => m.userId)).toEqual([10, 11, null]);
  });

  it('rechaza archivos sin filas válidas, sin sede o con extensión no permitida', async () => {
    const s = setup();
    const archivo = { buffer: Buffer.from('x'), originalName: 'reloj.csv', mimeType: 'text/csv' };
    await expect(s.importar.execute({ sedeId: SEDE, actor: adminActor, archivo })).rejects.toThrow(
      'No se encontraron filas válidas',
    );
    await expect(s.importar.execute({ sedeId: 0, actor: adminActor, archivo })).rejects.toThrow(ValidationError);
    await expect(
      s.importar.execute({ sedeId: SEDE, actor: adminActor, archivo: { ...archivo, originalName: 'reloj.pdf' } }),
    ).rejects.toThrow('Tipo de archivo no permitido');
    await expect(s.importar.execute({ sedeId: SEDE, actor: adminActor, archivo: null })).rejects.toThrow(
      'Debes adjuntar',
    );
  });
});

describe('GetResumenDiarioUseCase', () => {
  it('consolida a todos los colaboradores activos de la sede y devuelve la política por defecto si no hay una guardada', async () => {
    const s = setup();
    s.parser.filas = [
      fila('111', `${FECHA} 07:50:00`, 'in'),
      fila('111', `${FECHA} 17:00:00`, 'out'),
      fila('E-22', `${FECHA} 08:30:00`, 'in'),
      fila('E-22', `${FECHA} 17:00:00`, 'out'),
    ];
    await s.importar.execute({
      sedeId: SEDE,
      actor: adminActor,
      archivo: { buffer: Buffer.from('x'), originalName: 'a.txt', mimeType: 'text/plain' },
    });
    s.justificaciones.justificaciones.set(`12|${FECHA}`, 'Incapacidad vigente');

    const r = await s.resumen.execute({ sedeId: SEDE, fecha: FECHA });
    expect(r.politica).toMatchObject({ horaEntradaLimite: '08:10:00', configurada: false });
    const porNombre = Object.fromEntries(r.resumen.map((x) => [x.colaborador, x]));
    expect(porNombre['Ana Pérez']).toMatchObject({ estado: 'normal', horaEntrada: '07:50:00', minutosTarde: 0 });
    expect(porNombre['Luis Gómez']).toMatchObject({
      estado: 'tarde',
      minutosTarde: 20,
      detalle: 'Llegó tarde (20 min)',
    });
    expect(porNombre['Sin Correo']).toMatchObject({ estado: 'justificado', detalle: 'Incapacidad vigente' });
  });

  it('usa la fecha de hoy cuando no se indica y vuelve a consolidar sin duplicar filas', async () => {
    const s = setup();
    await s.resumen.execute({ sedeId: SEDE });
    const r = await s.resumen.execute({ sedeId: SEDE });
    expect(r.fecha).toBe(FECHA);
    expect(r.resumen).toHaveLength(3);
    expect(r.resumen.every((x) => x.estado === 'falla')).toBe(true);
  });

  it('valida la fecha', async () => {
    const s = setup();
    await expect(s.resumen.execute({ sedeId: SEDE, fecha: '08/10/2026' })).rejects.toThrow(ValidationError);
  });
});

describe('EnviarMemorandosUseCase', () => {
  async function conTardanzas() {
    const s = setup();
    s.parser.filas = [
      fila('111', `${FECHA} 08:30:00`, 'in'),
      fila('E-22', `${FECHA} 08:45:00`, 'in'),
      fila('333', `${FECHA} 09:00:00`, 'in'),
    ];
    await s.importar.execute({
      sedeId: SEDE,
      actor: adminActor,
      archivo: { buffer: Buffer.from('x'), originalName: 'a.csv', mimeType: 'text/csv' },
    });
    return s;
  }

  it('envía un correo por cada tardanza pendiente con correo y marca memo_enviado', async () => {
    const s = await conTardanzas();
    const r = await s.memorandos.execute({ sedeId: SEDE, fecha: FECHA });
    expect(r).toMatchObject({ enviados: 2, fallidos: 0, mensaje: 'Memorandos de tardanza enviados: 2.' });
    expect(s.mailer.sent.map((m) => m.to).sort()).toEqual(['ana@comfasucre.com.co', 'luis@comfasucre.com.co']);
    expect(s.mailer.sent[0].subject).toBe('Memorando - Llegada tarde (08/10/2026)');
    expect(s.mailer.sent[0].html).toContain('Minutos de tardanza: <strong>20</strong>');
    const ana = s.resumenes.items.find((x) => x.userId === 10);
    expect(ana?.memoEnviado).toBe(true);
    expect(ana?.memoEnviadoAt).toEqual(s.clock.now());
  });

  it('no reenvía memorandos ya enviados', async () => {
    const s = await conTardanzas();
    await s.memorandos.execute({ sedeId: SEDE, fecha: FECHA });
    const r = await s.memorandos.execute({ sedeId: SEDE, fecha: FECHA });
    expect(r.enviados).toBe(0);
    expect(r.mensaje).toBe('No hay memorandos pendientes de envío para esa fecha.');
    expect(s.mailer.sent).toHaveLength(2);
  });

  it('registra el error cuando el correo falla', async () => {
    const s = await conTardanzas();
    s.mailer.send = () => Promise.reject(new Error('SMTP caído'));
    const r = await s.memorandos.execute({ sedeId: SEDE, fecha: FECHA });
    expect(r).toMatchObject({ enviados: 0, fallidos: 2 });
    expect(s.resumenes.items.find((x) => x.userId === 10)).toMatchObject({
      memoEnviado: false,
      memoError: 'SMTP caído',
    });
  });

  it('respeta el interruptor de la política', async () => {
    const s = await conTardanzas();
    await s.politicas.save(AsistenciaPolitica.create({ sedeId: SEDE, enviarMemorandoTardanza: false }), new Date());
    const r = await s.memorandos.execute({ sedeId: SEDE, fecha: FECHA });
    expect(r.enviados).toBe(0);
    expect(s.mailer.sent).toHaveLength(0);
  });
});

describe('Política de asistencia', () => {
  it('guarda la política normalizando horas y devuelve configurada=true', async () => {
    const s = setup();
    const r = await s.savePolitica.execute({
      sedeId: SEDE,
      horaEntradaLimite: '08:00',
      horaSalidaTemprana: '12:30',
      toleranciaMinutos: 5,
      enviarMemorandoTardanza: false,
    });
    expect(r).toEqual({
      sedeId: SEDE,
      horaEntradaLimite: '08:00:00',
      horaSalidaTemprana: '12:30:00',
      toleranciaMinutos: 5,
      enviarMemorandoTardanza: false,
      configurada: true,
    });
    expect(await s.getPolitica.execute({ sedeId: SEDE })).toMatchObject({ toleranciaMinutos: 5, configurada: true });
    expect(await s.getPolitica.execute({ sedeId: 2 })).toMatchObject({
      horaEntradaLimite: '08:10:00',
      configurada: false,
    });
  });

  it('rechaza datos incompletos', async () => {
    const s = setup();
    await expect(
      s.savePolitica.execute({
        sedeId: SEDE,
        horaEntradaLimite: '',
        horaSalidaTemprana: '12:00',
        toleranciaMinutos: 0,
        enviarMemorandoTardanza: true,
      }),
    ).rejects.toThrow('Datos de política incompletos.');
  });
});

describe('GetMiHistorialUseCase', () => {
  it('devuelve sólo los registros del actor, uniendo tabla asistencia y resumen diario, en el mes actual por defecto', async () => {
    const s = setup();
    s.registros.items.push(
      {
        id: 1,
        userId: funcionarioActor.id,
        fecha: '2026-10-02',
        horaEntrada: '08:00:00',
        horaSalida: '17:00:00',
        tipo: 'virtual',
        observacion: 'Teletrabajo',
        fuente: 'local',
      },
      {
        id: 2,
        userId: 99,
        fecha: '2026-10-02',
        horaEntrada: '08:00:00',
        horaSalida: '17:00:00',
        tipo: 'presencial',
        observacion: null,
        fuente: 'local',
      },
      {
        id: 3,
        userId: funcionarioActor.id,
        fecha: '2026-09-30',
        horaEntrada: null,
        horaSalida: null,
        tipo: 'presencial',
        observacion: null,
        fuente: 'local',
      },
    );
    await s.resumenes.upsert({
      userId: funcionarioActor.id,
      sedeId: SEDE,
      fecha: '2026-10-01',
      horaEntrada: '08:20:00',
      horaSalida: '17:00:00',
      minutosTarde: 10,
      minutosSalidaTemprana: 0,
      estado: 'tarde',
      justificacion: null,
      detalle: 'Llegó tarde (10 min)',
      updatedAt: new Date(),
    });

    const r = await s.historial.execute({ actor: funcionarioActor });
    expect(r).toEqual([
      {
        fecha: '2026-10-01',
        horaEntrada: '08:20:00',
        horaSalida: '17:00:00',
        tipo: 'biometrico',
        estado: 'tarde',
        observacion: 'Llegó tarde (10 min)',
      },
      {
        fecha: '2026-10-02',
        horaEntrada: '08:00:00',
        horaSalida: '17:00:00',
        tipo: 'virtual',
        estado: null,
        observacion: 'Teletrabajo',
      },
    ]);
  });

  it('valida el rango de fechas', async () => {
    const s = setup();
    await expect(
      s.historial.execute({ actor: funcionarioActor, desde: '2026-10-10', hasta: '2026-10-01' }),
    ).rejects.toThrow('La fecha inicial no puede ser posterior a la final.');
    await expect(s.historial.execute({ actor: funcionarioActor, desde: 'x' })).rejects.toThrow(ValidationError);
  });
});
