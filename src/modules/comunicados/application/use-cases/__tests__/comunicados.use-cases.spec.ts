import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../../config/configuration';
import { Mailer, MailMessage } from '../../../../../shared/application/ports/mailer.port';
import { InvalidOperationError, NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
import {
  adminActor,
  FakeClock,
  FakeMailer,
  funcionarioActor,
  InMemoryFileStorage,
} from '../../../../../shared/testing';
import { ComunicadoMailerService } from '../../services/comunicado-mailer.service';
import { PublicacionComunicadoService } from '../../services/publicacion.service';
import {
  ActualizarComunicadoUseCase,
  CrearComunicadoUseCase,
  EliminarComunicadoUseCase,
  FeedComunicadosUseCase,
  GetComunicadoUseCase,
  ListComunicadosAdminUseCase,
  PublicarComunicadoUseCase,
  ReenviarCorreoComunicadoUseCase,
} from '../comunicados.use-cases';
import { FeedConexionesUseCase } from '../conexiones.use-cases';
import {
  FakeMailConfig,
  InMemoryComunicadoRepository,
  InMemoryConexionesRepository,
  InMemoryNotificaciones,
} from './in-memory-comunicados.repositories';

/** Mailer que siempre falla (simula error SMTP). */
class FailingMailer extends Mailer {
  send(_m: MailMessage): Promise<void> {
    return Promise.reject(new Error('Connection refused smtp.example.com'));
  }
}

const config = {
  get: (key: string) => (key === 'frontendUrl' ? 'http://localhost:4200' : undefined),
} as unknown as ConfigService<AppConfig, true>;

const archivo = (originalName: string, mimeType = 'image/png') => ({
  buffer: Buffer.from('x'),
  originalName,
  mimeType,
  size: 1,
});

function setup(mailer: Mailer = new FakeMailer(), mailConfig = new FakeMailConfig()) {
  const repo = new InMemoryComunicadoRepository();
  const storage = new InMemoryFileStorage();
  const clock = new FakeClock();
  const notificaciones = new InMemoryNotificaciones(3);
  const mailService = new ComunicadoMailerService(mailer, mailConfig, storage, config);
  const publicacion = new PublicacionComunicadoService(repo, notificaciones, mailService, clock);
  return {
    repo,
    storage,
    clock,
    notificaciones,
    mailer,
    crear: new CrearComunicadoUseCase(repo, storage, clock, publicacion),
    actualizar: new ActualizarComunicadoUseCase(repo, storage, clock),
    publicar: new PublicarComunicadoUseCase(repo, clock, publicacion),
    reenviar: new ReenviarCorreoComunicadoUseCase(repo, publicacion),
    eliminar: new EliminarComunicadoUseCase(repo, storage),
    feed: new FeedComunicadosUseCase(repo),
    detalle: new GetComunicadoUseCase(repo),
    listar: new ListComunicadosAdminUseCase(repo),
  };
}

const base = {
  actor: adminActor,
  titulo: 'Bienvenida',
  resumen: 'Resumen',
  contenido: 'Contenido del comunicado',
  archivos: [],
  videoUrls: null,
};

describe('Casos de uso de Comunicados', () => {
  describe('crear', () => {
    it('guarda un borrador con archivos y URLs de vídeo (ignorando líneas inválidas) sin notificar ni enviar correo', async () => {
      const s = setup();
      const r = await s.crear.execute({
        ...base,
        estado: 'borrador',
        archivos: [archivo('foto.png'), archivo('clip.mp4', 'video/mp4'), archivo('doc.pdf', 'application/pdf')],
        videoUrls: 'https://www.youtube.com/watch?v=abc\n\nno-es-url\nftp://x.y/z\nhttps://vimeo.com/1',
      });
      expect(r.comunicado.estado).toBe('borrador');
      expect(r.comunicado.publicadoAt).toBeNull();
      expect(r.comunicado.medios.map((m) => m.tipo)).toEqual(['imagen', 'video', 'pdf', 'video', 'video']);
      expect(r.comunicado.medios.map((m) => m.orden)).toEqual([1, 2, 3, 4, 5]);
      expect(r.comunicado.medios[0].archivo).toBe('comunicados/file-1.png');
      expect(r.comunicado.medios[3].url).toBe('https://www.youtube.com/watch?v=abc');
      expect(r.correo).toBeNull();
      expect(r.mensaje).toBe('Comunicado guardado correctamente.');
      expect(s.notificaciones.creadas).toHaveLength(0);
      expect((s.mailer as FakeMailer).sent).toHaveLength(0);
      expect(s.storage.files.size).toBe(3);
    });

    it('rechaza título o contenido vacíos', async () => {
      const s = setup();
      await expect(s.crear.execute({ ...base, titulo: ' ', estado: 'borrador' })).rejects.toBeInstanceOf(
        ValidationError,
      );
      await expect(s.crear.execute({ ...base, contenido: '', estado: 'borrador' })).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    it('rechaza extensiones no permitidas', async () => {
      const s = setup();
      await expect(s.crear.execute({ ...base, estado: 'borrador', archivos: [archivo('virus.exe')] })).rejects.toThrow(
        /Extensión no permitida/,
      );
    });

    it('al publicar directamente notifica a los usuarios activos, envía el correo con adjuntos al destinatario de pruebas y marca email_enviado_at', async () => {
      const s = setup();
      const r = await s.crear.execute({
        ...base,
        estado: 'publicado',
        archivos: [archivo('foto.png'), archivo('doc.pdf', 'application/pdf'), archivo('clip.mp4', 'video/mp4')],
        videoUrls: 'https://youtu.be/xyz',
      });
      expect(r.comunicado.estado).toBe('publicado');
      expect(r.comunicado.publicadoAt).toBe(s.clock.now().toISOString());
      expect(r.comunicado.emailEnviadoAt).not.toBeNull();
      expect(r.correo?.enviado).toBe(true);
      expect(r.mensaje).toBe('Comunicado guardado, publicado y enviado por correo.');
      expect(s.notificaciones.creadas).toEqual([
        {
          titulo: 'Nuevo comunicado',
          mensaje: 'Bienvenida',
          tipo: 'comunicado',
          link: `/comunicados/ver/${r.comunicado.id}`,
        },
      ]);
      const mail = (s.mailer as FakeMailer).sent[0];
      expect(mail.to).toBe('pruebas@comfasucre.com.co');
      expect(mail.subject).toBe('Nuevo comunicado: Bienvenida');
      // Sólo imágenes y PDF se adjuntan; los vídeos van como enlaces.
      expect(mail.attachments?.map((a) => a.filename)).toEqual(['file-1.png', 'file-2.pdf']);
      expect(mail.html).toContain('https://youtu.be/xyz');
      expect(mail.html).toContain('/uploads/comunicados/file-3.mp4');
      expect(mail.html).toContain(`http://localhost:4200/comunicados/ver/${r.comunicado.id}`);
    });

    it('en modo producción envía al correo de producción', async () => {
      const s = setup(
        new FakeMailer(),
        new FakeMailConfig({ modo: 'produccion', testTo: 't@x.co', prodTo: 'todos@x.co' }),
      );
      await s.crear.execute({ ...base, estado: 'publicado' });
      expect((s.mailer as FakeMailer).sent[0].to).toBe('todos@x.co');
    });

    it('publica aunque el correo falle y devuelve el motivo', async () => {
      const s = setup(new FailingMailer());
      const r = await s.crear.execute({ ...base, estado: 'publicado' });
      expect(r.comunicado.estado).toBe('publicado');
      expect(r.comunicado.emailEnviadoAt).toBeNull();
      expect(r.correo).toEqual({ enviado: false, mensaje: 'Connection refused smtp.example.com' });
      expect(r.mensaje).toContain('no se pudo enviar el correo');
    });

    it('informa cuando el destinatario no está configurado', async () => {
      const s = setup(new FakeMailer(), new FakeMailConfig({ modo: 'test', testTo: '', prodTo: '' }));
      const r = await s.crear.execute({ ...base, estado: 'publicado' });
      expect(r.correo?.enviado).toBe(false);
      expect(r.correo?.mensaje).toContain('Destinatario no configurado');
    });
  });

  describe('publicar y reenviar', () => {
    it('publica un borrador, notifica y envía el correo una sola vez', async () => {
      const s = setup();
      const creado = await s.crear.execute({ ...base, estado: 'borrador' });
      s.clock.advanceMinutes(5);
      const r = await s.publicar.execute(creado.comunicado.id);
      expect(r.comunicado.estado).toBe('publicado');
      expect(r.comunicado.publicadoAt).toBe(s.clock.now().toISOString());
      expect(r.mensaje).toBe('Comunicado publicado y enviado por correo.');
      expect(s.notificaciones.creadas).toHaveLength(1);

      // Publicar de nuevo: vuelve a notificar, pero el correo ya se había enviado.
      const r2 = await s.publicar.execute(creado.comunicado.id);
      expect(r2.correo).toBeNull();
      expect(r2.mensaje).toBe('Comunicado publicado. El correo ya había sido enviado previamente.');
      expect((s.mailer as FakeMailer).sent).toHaveLength(1);
      expect(s.notificaciones.creadas).toHaveLength(2);
    });

    it('publicar un id inexistente lanza NotFound', async () => {
      const s = setup();
      await expect(s.publicar.execute(99)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('reenviar sólo funciona con comunicados publicados', async () => {
      const s = setup();
      const borrador = await s.crear.execute({ ...base, estado: 'borrador' });
      await expect(s.reenviar.execute(borrador.comunicado.id)).rejects.toBeInstanceOf(InvalidOperationError);
      const publicado = await s.crear.execute({ ...base, estado: 'publicado' });
      const r = await s.reenviar.execute(publicado.comunicado.id);
      expect(r.correo?.enviado).toBe(true);
      expect(r.mensaje).toBe('Correo de comunicado reenviado correctamente.');
      expect((s.mailer as FakeMailer).sent).toHaveLength(2);
    });
  });

  describe('actualizar y eliminar', () => {
    it('edita textos, elimina medios indicados (borrando el archivo) y añade nuevos', async () => {
      const s = setup();
      const creado = await s.crear.execute({
        ...base,
        estado: 'borrador',
        archivos: [archivo('a.png'), archivo('b.png')],
      });
      const [m1] = creado.comunicado.medios;
      const r = await s.actualizar.execute({
        id: creado.comunicado.id,
        titulo: 'Nuevo título',
        resumen: null,
        contenido: 'Nuevo contenido',
        archivos: [archivo('c.jpg', 'image/jpeg')],
        videoUrls: 'https://vimeo.com/2',
        eliminarMedios: [m1.id],
      });
      expect(r.titulo).toBe('Nuevo título');
      expect(r.resumen).toBeNull();
      expect(r.medios.map((m) => m.archivo ?? m.url)).toEqual([
        'comunicados/file-2.png',
        'comunicados/file-3.jpg',
        'https://vimeo.com/2',
      ]);
      expect(r.medios.map((m) => m.orden)).toEqual([1, 2, 3]);
      expect(s.storage.files.has('comunicados/file-1.png')).toBe(false);
      expect(s.storage.files.has('comunicados/file-2.png')).toBe(true);
    });

    it('elimina el comunicado y sus archivos', async () => {
      const s = setup();
      const creado = await s.crear.execute({ ...base, estado: 'borrador', archivos: [archivo('a.png')] });
      await s.eliminar.execute(creado.comunicado.id);
      expect(s.repo.items).toHaveLength(0);
      expect(s.storage.files.size).toBe(0);
      await expect(s.eliminar.execute(creado.comunicado.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('lectura', () => {
    it('el feed pagina sólo publicados, ordenados por fecha de publicación desc, con vista previa del primer medio', async () => {
      const s = setup();
      await s.crear.execute({ ...base, titulo: 'Borrador', estado: 'borrador' });
      await s.crear.execute({ ...base, titulo: 'Con imagen', estado: 'publicado', archivos: [archivo('a.png')] });
      s.clock.advanceMinutes(1);
      await s.crear.execute({ ...base, titulo: 'Con vídeo URL', estado: 'publicado', videoUrls: 'https://youtu.be/1' });
      s.clock.advanceMinutes(1);
      await s.crear.execute({ ...base, titulo: 'Sin medios', estado: 'publicado' });

      const p1 = await s.feed.execute({ page: 1, size: 2 });
      expect(p1.total).toBe(3);
      expect(p1.items.map((i) => i.titulo)).toEqual(['Sin medios', 'Con vídeo URL']);
      expect(p1.items[0].previewType).toBeNull();
      expect(p1.items[1]).toMatchObject({ previewType: 'video_url', previewSrc: 'https://youtu.be/1' });
      const p2 = await s.feed.execute({ page: 2, size: 2 });
      expect(p2.items.map((i) => i.titulo)).toEqual(['Con imagen']);
      expect(p2.items[0]).toMatchObject({ previewType: 'imagen', previewSrc: 'comunicados/file-1.png' });
    });

    it('el tamaño de página se limita a 15 (vuelve al valor por defecto 9)', async () => {
      const s = setup();
      expect((await s.feed.execute({ size: 50 })).size).toBe(9);
      expect((await s.feed.execute({ size: 0 })).size).toBe(9);
      expect((await s.feed.execute({})).page).toBe(1);
    });

    it('un funcionario no puede ver borradores; el administrador sí', async () => {
      const s = setup();
      const creado = await s.crear.execute({ ...base, estado: 'borrador' });
      await expect(s.detalle.execute({ id: creado.comunicado.id, actor: funcionarioActor })).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect((await s.detalle.execute({ id: creado.comunicado.id, actor: adminActor })).titulo).toBe('Bienvenida');
      await expect(s.detalle.execute({ id: 999, actor: adminActor })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('el listado de administración incluye todos con autor y estado de correo', async () => {
      const s = setup();
      await s.crear.execute({ ...base, estado: 'borrador' });
      await s.crear.execute({ ...base, estado: 'publicado' });
      const lista = await s.listar.execute();
      expect(lista).toHaveLength(2);
      expect(lista.map((c) => c.creadoPor)).toEqual(['Administrador Sistema', 'Administrador Sistema']);
      expect(lista.filter((c) => c.emailEnviadoAt !== null)).toHaveLength(1);
    });
  });

  describe('Conexiones', () => {
    it('devuelve la fecha de hoy con cumpleañeros y aniversarios', async () => {
      const repo = new InMemoryConexionesRepository();
      repo.cumpleaneros = [
        {
          id: 1,
          firstName: 'Ana',
          lastName: 'Ruiz',
          profileImage: null,
          fechaNacimiento: '1990-10-08',
          cargoNombre: 'Analista',
          areaNombre: 'TI',
        },
      ];
      repo.aniversarios = [
        {
          id: 2,
          firstName: 'Luis',
          lastName: 'Gil',
          profileImage: null,
          fechaReferencia: '2020-10-08',
          anios: 6,
          cargoNombre: null,
          areaNombre: null,
        },
      ];
      const r = await new FeedConexionesUseCase(repo, new FakeClock()).execute();
      expect(r.fecha).toBe('2026-10-08');
      expect(r.cumpleaneros[0].firstName).toBe('Ana');
      expect(r.aniversarios[0].anios).toBe(6);
    });
  });
});
