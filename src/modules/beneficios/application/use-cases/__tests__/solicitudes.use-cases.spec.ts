import { ValidationError } from '../../../../../shared/domain/domain-error';
import { adminActor, FakeClock, funcionarioActor, InMemoryFileStorage } from '../../../../../shared/testing';
import { DiasHabilesCalculator } from '../../../domain/dias-habiles.calculator';
import { VacacionesSaldoCalculator } from '../../../domain/vacaciones-saldo';
import {
  AprobarSolicitudUseCase,
  CrearSolicitudUseCase,
  ListarMisSolicitudesUseCase,
  ListarSolicitudesAdminUseCase,
  RechazarSolicitudUseCase,
  SuspenderVacacionesUseCase,
} from '../solicitudes.use-cases';
import {
  FakeNotificacionesPort,
  FakeUsuariosPort,
  InMemoryPermisoRepository,
  InMemorySuspensionRepository,
} from './in-memory-beneficios.repositories';

describe('Casos de uso de solicitudes', () => {
  let permisos: InMemoryPermisoRepository;
  let suspensiones: InMemorySuspensionRepository;
  let usuarios: FakeUsuariosPort;
  let notificaciones: FakeNotificacionesPort;
  let files: InMemoryFileStorage;
  let clock: FakeClock;
  const calculadora = new DiasHabilesCalculator();
  const saldo = new VacacionesSaldoCalculator(calculadora);

  let crear: CrearSolicitudUseCase;
  let listarMias: ListarMisSolicitudesUseCase;
  let listarAdmin: ListarSolicitudesAdminUseCase;
  let aprobar: AprobarSolicitudUseCase;
  let rechazar: RechazarSolicitudUseCase;
  let suspender: SuspenderVacacionesUseCase;

  beforeEach(() => {
    permisos = new InMemoryPermisoRepository();
    suspensiones = new InMemorySuspensionRepository();
    usuarios = new FakeUsuariosPort();
    notificaciones = new FakeNotificacionesPort();
    files = new InMemoryFileStorage();
    clock = new FakeClock(new Date('2026-10-08T10:00:00'));
    crear = new CrearSolicitudUseCase(permisos, usuarios, notificaciones, files, clock, calculadora);
    listarMias = new ListarMisSolicitudesUseCase(permisos, calculadora);
    listarAdmin = new ListarSolicitudesAdminUseCase(permisos, calculadora);
    aprobar = new AprobarSolicitudUseCase(permisos, suspensiones, usuarios, clock, calculadora, saldo);
    rechazar = new RechazarSolicitudUseCase(permisos, clock, calculadora);
    suspender = new SuspenderVacacionesUseCase(permisos, suspensiones, clock, calculadora);
  });

  const vacacionesInput = (inicio: string, fin: string) => ({
    actor: funcionarioActor,
    tipoPermiso: 'vacaciones',
    fechaInicio: inicio,
    fechaFin: fin,
    justificacion: 'Descanso anual',
  });

  describe('CrearSolicitudUseCase', () => {
    it('crea la solicitud pendiente para el actor y notifica a los admins activos', async () => {
      usuarios.admins = [1, 7];
      const dto = await crear.execute({
        actor: funcionarioActor,
        tipoPermiso: 'personal',
        fechaInicio: '2026-10-15T08:00',
        fechaFin: '2026-10-15T12:00',
        horas: 4,
        justificacion: 'Cita médica familiar',
      });
      expect(dto.id).toBe(1);
      expect(dto.userId).toBe(funcionarioActor.id);
      expect(dto.estado).toBe('pendiente');
      expect(dto.fechaSolicitud).toBe('2026-10-08');
      expect(dto.fechaInicio).toBe('2026-10-15 08:00:00');
      expect(notificaciones.creadas).toHaveLength(2);
      expect(notificaciones.creadas[0]).toEqual({
        userId: 1,
        titulo: 'Nueva solicitud',
        mensaje: 'Juan Pérez registró una solicitud de Personal',
        tipo: 'solicitud',
        link: '/solicitudes/admin',
      });
    });

    it('guarda el soporte en la carpeta "soportes"', async () => {
      const dto = await crear.execute({
        ...vacacionesInput('2026-11-02', '2026-11-06'),
        tipoPermiso: 'incapacidad',
        archivo: { buffer: Buffer.from('pdf'), originalName: 'incapacidad.pdf', mimeType: 'application/pdf' },
      });
      expect(dto.archivoSoporte).toBe('soportes/file-1.pdf');
      expect(files.files.has('soportes/file-1.pdf')).toBe(true);
    });

    it('rechaza incapacidad sin soporte y tipos inválidos sin guardar nada', async () => {
      await expect(
        crear.execute({ ...vacacionesInput('2026-11-02', '2026-11-06'), tipoPermiso: 'incapacidad' }),
      ).rejects.toThrow('Para incapacidad debes adjuntar archivo soporte.');
      await expect(
        crear.execute({ ...vacacionesInput('2026-11-02', '2026-11-06'), tipoPermiso: 'raro' }),
      ).rejects.toThrow(ValidationError);
      expect(permisos.items).toHaveLength(0);
      expect(notificaciones.creadas).toHaveLength(0);
    });

    it('rechaza extensiones no permitidas del soporte', async () => {
      await expect(
        crear.execute({
          ...vacacionesInput('2026-11-02', '2026-11-06'),
          tipoPermiso: 'personal',
          archivo: { buffer: Buffer.from('x'), originalName: 'virus.exe', mimeType: 'application/octet-stream' },
        }),
      ).rejects.toThrow('Extensión no permitida');
    });
  });

  describe('listados', () => {
    it('el funcionario sólo ve sus solicitudes; el admin ve todas con nombres y filtra por estado', async () => {
      await crear.execute(vacacionesInput('2026-11-02', '2026-11-06'));
      await crear.execute({ ...vacacionesInput('2026-11-09', '2026-11-13'), actor: adminActor });
      permisos.nombres.set(2, 'Juan Pérez');

      const mias = await listarMias.execute(funcionarioActor);
      expect(mias).toHaveLength(1);
      expect(mias[0].diasHabiles).toBe(4); // 2/11 es festivo (Todos los Santos trasladado)

      const todas = await listarAdmin.execute({});
      expect(todas).toHaveLength(2);
      expect(todas.find((p) => p.userId === 2)?.colaborador).toBe('Juan Pérez');

      await rechazar.execute({ actor: adminActor, permisoId: 1, observacion: 'No' });
      expect(await listarAdmin.execute({ estado: 'pendiente' })).toHaveLength(1);
      expect(await listarAdmin.execute({ estado: 'rechazado' })).toHaveLength(1);
    });
  });

  describe('AprobarSolicitudUseCase', () => {
    it('aprueba un permiso pendiente registrando el aprobador y la observación', async () => {
      const creado = await crear.execute({ ...vacacionesInput('2026-11-02', '2026-11-02'), tipoPermiso: 'personal' });
      const dto = await aprobar.execute({ actor: adminActor, permisoId: creado.id, observacion: 'Aprobado' });
      expect(dto.estado).toBe('aprobado');
      expect(dto.aprobadoPor).toBe(adminActor.id);
      expect(dto.observacionRespuesta).toBe('Aprobado');
      expect(dto.updatedAt).toBe('2026-10-08 10:00:00');
    });

    it('falla si la solicitud no existe o ya fue procesada', async () => {
      await expect(aprobar.execute({ actor: adminActor, permisoId: 99 })).rejects.toThrow(
        'Solicitud con id 99 no encontrado.',
      );
      const creado = await crear.execute({ ...vacacionesInput('2026-11-02', '2026-11-02'), tipoPermiso: 'personal' });
      await rechazar.execute({ actor: adminActor, permisoId: creado.id });
      await expect(aprobar.execute({ actor: adminActor, permisoId: creado.id })).rejects.toThrow(
        'La solicitud ya fue procesada.',
      );
    });

    it('aprueba vacaciones cuando hay saldo suficiente', async () => {
      usuarios.fechasIngreso.set(2, '2024-01-15'); // 2 períodos → 30 días
      const creado = await crear.execute(vacacionesInput('2026-11-03', '2026-11-13')); // 9 días hábiles (11/11 se traslada al 16)
      const dto = await aprobar.execute({ actor: adminActor, permisoId: creado.id });
      expect(dto.estado).toBe('aprobado');
    });

    it('rechaza vacaciones sin días hábiles', async () => {
      usuarios.fechasIngreso.set(2, '2024-01-15');
      const creado = await crear.execute(vacacionesInput('2026-11-07', '2026-11-08')); // fin de semana
      await expect(aprobar.execute({ actor: adminActor, permisoId: creado.id })).rejects.toThrow(
        'La solicitud de vacaciones no tiene días hábiles válidos.',
      );
    });

    it('rechaza vacaciones anticipadas con el mensaje del legado', async () => {
      usuarios.fechasIngreso.set(2, '2025-09-01'); // 1 período → 15 días
      const previa = await crear.execute(vacacionesInput('2026-02-02', '2026-02-13')); // 10 días
      await aprobar.execute({ actor: adminActor, permisoId: previa.id });
      const nueva = await crear.execute(vacacionesInput('2026-11-03', '2026-11-13')); // 9 días, quedan 5
      await expect(aprobar.execute({ actor: adminActor, permisoId: nueva.id })).rejects.toThrow(
        'No se puede aprobar vacaciones anticipadas. Solicitados: 9 días hábiles, disponibles: 5.',
      );
    });

    it('al calcular el saldo descuenta sólo los días disfrutados de vacaciones suspendidas', async () => {
      usuarios.fechasIngreso.set(2, '2025-09-01'); // 15 días
      const previa = await crear.execute(vacacionesInput('2026-02-02', '2026-02-13')); // 10 días
      await aprobar.execute({ actor: adminActor, permisoId: previa.id });
      await suspender.execute({ actor: adminActor, permisoId: previa.id, diasDisfrutados: 2, motivo: 'Urgencia' });
      const nueva = await crear.execute(vacacionesInput('2026-11-03', '2026-11-13')); // 9 días, quedan 13
      const dto = await aprobar.execute({ actor: adminActor, permisoId: nueva.id });
      expect(dto.estado).toBe('aprobado');
    });

    it('sin fecha de ingreso no hay saldo y no se aprueban vacaciones', async () => {
      const creado = await crear.execute(vacacionesInput('2026-11-03', '2026-11-03'));
      await expect(aprobar.execute({ actor: adminActor, permisoId: creado.id })).rejects.toThrow('disponibles: 0.');
    });
  });

  describe('RechazarSolicitudUseCase', () => {
    it('rechaza una solicitud pendiente', async () => {
      const creado = await crear.execute({ ...vacacionesInput('2026-11-02', '2026-11-02'), tipoPermiso: 'estudio' });
      const dto = await rechazar.execute({ actor: adminActor, permisoId: creado.id, observacion: 'Sin cupo' });
      expect(dto.estado).toBe('rechazado');
      expect(dto.observacionRespuesta).toBe('Sin cupo');
      await expect(rechazar.execute({ actor: adminActor, permisoId: creado.id })).rejects.toThrow(
        'La solicitud ya fue procesada.',
      );
      await expect(rechazar.execute({ actor: adminActor, permisoId: 123 })).rejects.toThrow('no encontrado');
    });
  });

  describe('SuspenderVacacionesUseCase', () => {
    async function vacacionesAprobadas(): Promise<number> {
      usuarios.fechasIngreso.set(2, '2024-01-15');
      const creado = await crear.execute(vacacionesInput('2026-11-03', '2026-11-13')); // 9 días hábiles (11/11 se traslada al 16)
      await aprobar.execute({ actor: adminActor, permisoId: creado.id });
      return creado.id;
    }

    it('registra la suspensión con días disfrutados y reintegrados y devuelve el mensaje del legado', async () => {
      const id = await vacacionesAprobadas();
      const res = await suspender.execute({
        actor: adminActor,
        permisoId: id,
        diasDisfrutados: 3,
        motivo: 'Necesidad del servicio',
      });
      expect(res).toMatchObject({
        permisoId: id,
        userId: 2,
        diasTotales: 9,
        diasDisfrutados: 3,
        diasReintegrados: 6,
        suspendidoPor: adminActor.id,
        fechaSuspension: '2026-10-08 10:00:00',
        fechaInicio: '2026-11-03 00:00:00',
        message: 'Vacaciones suspendidas. Disfrutados: 3 día(s). Reintegrados: 6 día(s).',
      });
      expect(suspensiones.items).toHaveLength(1);
    });

    it('una segunda suspensión del mismo permiso actualiza la existente', async () => {
      const id = await vacacionesAprobadas();
      await suspender.execute({ actor: adminActor, permisoId: id, diasDisfrutados: 3, motivo: null });
      const res = await suspender.execute({ actor: adminActor, permisoId: id, diasDisfrutados: 5, motivo: null });
      expect(suspensiones.items).toHaveLength(1);
      expect(res.diasDisfrutados).toBe(5);
      expect(res.diasReintegrados).toBe(4);
    });

    it('sólo suspende vacaciones aprobadas (inexistente, pendiente o de otro tipo)', async () => {
      await expect(suspender.execute({ actor: adminActor, permisoId: 55, diasDisfrutados: 1 })).rejects.toThrow(
        'Solo se pueden suspender vacaciones aprobadas.',
      );
      const pendiente = await crear.execute(vacacionesInput('2026-11-03', '2026-11-13'));
      await expect(
        suspender.execute({ actor: adminActor, permisoId: pendiente.id, diasDisfrutados: 1 }),
      ).rejects.toThrow('Solo se pueden suspender vacaciones aprobadas.');
    });

    it('valida los días disfrutados', async () => {
      const id = await vacacionesAprobadas();
      await expect(suspender.execute({ actor: adminActor, permisoId: id, diasDisfrutados: 0 })).rejects.toThrow(
        'Debes indicar al menos 1 día disfrutado.',
      );
      await expect(suspender.execute({ actor: adminActor, permisoId: id, diasDisfrutados: 10 })).rejects.toThrow(
        'Los días disfrutados no pueden superar los días aprobados.',
      );
    });
  });
});
