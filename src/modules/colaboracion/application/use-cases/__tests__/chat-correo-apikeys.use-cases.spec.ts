import { NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
import { adminActor, FakeClock, FakeMailer, FakeTokenGenerator, funcionarioActor } from '../../../../../shared/testing';
import {
  AlternarEstadoApiKeyUseCase,
  CrearApiKeyUseCase,
  EliminarApiKeysUseCase,
  ListApiKeysUseCase,
  RegenerarApiKeyUseCase,
  RenombrarApiKeyUseCase,
} from '../api-keys.use-cases';
import { EnviarMensajeChatUseCase, GetConversacionUseCase, ListContactosChatUseCase } from '../chat.use-cases';
import { GetCorreoUseCase, ListBuzonUseCase, RedactarCorreoUseCase } from '../correo.use-cases';
import {
  InMemoryApiKeyRepository,
  InMemoryChatRepository,
  InMemoryCorreoRepository,
  InMemoryUsuariosPort,
} from './in-memory-colaboracion.repositories';

const clock = new FakeClock();

describe('Casos de uso de Chat', () => {
  let usuarios: InMemoryUsuariosPort;
  let chat: InMemoryChatRepository;

  beforeEach(() => {
    usuarios = new InMemoryUsuariosPort();
    chat = new InMemoryChatRepository(usuarios);
  });

  it('envía mensajes, cuenta no leídos por contacto y los marca leídos al abrir la conversación', async () => {
    const enviar = new EnviarMensajeChatUseCase(chat, usuarios, clock);
    await enviar.execute({ actor: adminActor, receptorId: 2, mensaje: 'Hola Juan' });
    await enviar.execute({ actor: adminActor, receptorId: 2, mensaje: '¿Cómo vas?' });

    const contactosJuan = await new ListContactosChatUseCase(chat).execute(funcionarioActor);
    const admin = contactosJuan.find((c) => c.id === adminActor.id);
    expect(admin).toMatchObject({ noLeidos: 2, ultimoMensaje: '¿Cómo vas?' });

    const conversacion = await new GetConversacionUseCase(chat, usuarios).execute({
      actor: funcionarioActor,
      contactoId: adminActor.id,
    });
    expect(conversacion).toHaveLength(2);
    expect(await chat.contarNoLeidos(funcionarioActor.id)).toBe(0);
  });

  it('rechaza mensajes vacíos, a uno mismo o a usuarios inexistentes', async () => {
    const enviar = new EnviarMensajeChatUseCase(chat, usuarios, clock);
    await expect(enviar.execute({ actor: adminActor, receptorId: 2, mensaje: '   ' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      enviar.execute({ actor: adminActor, receptorId: adminActor.id, mensaje: 'yo' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(enviar.execute({ actor: adminActor, receptorId: 99, mensaje: 'x' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      new GetConversacionUseCase(chat, usuarios).execute({ actor: adminActor, contactoId: 99 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('Casos de uso de Correo interno', () => {
  let usuarios: InMemoryUsuariosPort;
  let correos: InMemoryCorreoRepository;
  let mailer: FakeMailer;
  let redactar: RedactarCorreoUseCase;

  beforeEach(() => {
    usuarios = new InMemoryUsuariosPort();
    correos = new InMemoryCorreoRepository();
    mailer = new FakeMailer();
    redactar = new RedactarCorreoUseCase(correos, usuarios, mailer, clock);
  });

  it('entrega copia en inbox del receptor y en enviados del emisor, y notifica por SMTP', async () => {
    const r = await redactar.execute({
      actor: adminActor,
      input: { paraEmail: 'JPerez@comfasucre.com.co', asunto: 'Hola', cuerpo: 'Cuerpo' },
    });
    expect(r.notificacionExternaEnviada).toBe(true);
    expect(mailer.sent[0].to).toBe('jperez@comfasucre.com.co');
    expect(await new ListBuzonUseCase(correos).execute({ actor: funcionarioActor, carpeta: 'inbox' })).toHaveLength(1);
    expect(await new ListBuzonUseCase(correos).execute({ actor: adminActor, carpeta: 'sent' })).toHaveLength(1);
    expect(await new ListBuzonUseCase(correos).execute({ actor: adminActor, carpeta: 'inbox' })).toHaveLength(0);
  });

  it('si falla el SMTP el correo interno igual queda entregado', async () => {
    mailer.send = () => Promise.reject(new Error('SMTP caído'));
    const r = await redactar.execute({
      actor: adminActor,
      input: { paraEmail: 'jperez@comfasucre.com.co', asunto: 'A', cuerpo: 'B' },
    });
    expect(r.notificacionExternaEnviada).toBe(false);
    expect(correos.items).toHaveLength(2);
  });

  it('sólo permite destinatarios registrados y campos completos', async () => {
    await expect(
      redactar.execute({ actor: adminActor, input: { paraEmail: 'externo@gmail.com', asunto: 'A', cuerpo: 'B' } }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      redactar.execute({
        actor: adminActor,
        input: { paraEmail: 'jperez@comfasucre.com.co', asunto: ' ', cuerpo: 'B' },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('ver un correo lo marca leído sólo para el receptor y oculta correos ajenos', async () => {
    await redactar.execute({
      actor: adminActor,
      input: { paraEmail: 'jperez@comfasucre.com.co', asunto: 'A', cuerpo: 'B' },
    });
    const inbox = (await new ListBuzonUseCase(correos).execute({ actor: funcionarioActor }))[0];
    expect(inbox.leido).toBe(false);
    const visto = await new GetCorreoUseCase(correos).execute({ actor: funcionarioActor, id: inbox.id });
    expect(visto.leido).toBe(true);
    const tercero = { ...funcionarioActor, id: 3 };
    await expect(new GetCorreoUseCase(correos).execute({ actor: tercero, id: inbox.id })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('Casos de uso de API keys', () => {
  let keys: InMemoryApiKeyRepository;
  const tokens = new FakeTokenGenerator('abcd1234');

  beforeEach(() => {
    keys = new InMemoryApiKeyRepository();
  });

  it('crea claves en mayúsculas, las lista por usuario y permite renombrar/regenerar/alternar', async () => {
    const creada = await new CrearApiKeyUseCase(keys, tokens, clock).execute({
      actor: funcionarioActor,
      nombre: 'Integración',
    });
    expect(creada).toMatchObject({ clave: 'ABCD1234', estado: 'Active', creadoPor: 'Juan Pérez' });
    expect(await new ListApiKeysUseCase(keys).execute(adminActor)).toEqual([]);

    const renombrada = await new RenombrarApiKeyUseCase(keys).execute({
      actor: funcionarioActor,
      id: creada.id,
      nombre: 'Nueva',
    });
    expect(renombrada.nombre).toBe('Nueva');
    const regenerada = await new RegenerarApiKeyUseCase(keys, new FakeTokenGenerator('ffff')).execute({
      actor: funcionarioActor,
      id: creada.id,
    });
    expect(regenerada.clave).toBe('FFFF');
    const inactiva = await new AlternarEstadoApiKeyUseCase(keys).execute({ actor: funcionarioActor, id: creada.id });
    expect(inactiva.estado).toBe('Inactive');
  });

  it('no permite operar claves de otro usuario ni nombres vacíos', async () => {
    const creada = await new CrearApiKeyUseCase(keys, tokens, clock).execute({ actor: funcionarioActor, nombre: 'X' });
    await expect(
      new RegenerarApiKeyUseCase(keys, tokens).execute({ actor: adminActor, id: creada.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      new CrearApiKeyUseCase(keys, tokens, clock).execute({ actor: adminActor, nombre: ' ' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await new EliminarApiKeysUseCase(keys).execute({ actor: adminActor, ids: [creada.id] })).toEqual({
      eliminadas: 0,
    });
    expect(await new EliminarApiKeysUseCase(keys).execute({ actor: funcionarioActor, ids: [creada.id, 99] })).toEqual({
      eliminadas: 1,
    });
    await expect(new EliminarApiKeysUseCase(keys).execute({ actor: funcionarioActor, ids: [] })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
