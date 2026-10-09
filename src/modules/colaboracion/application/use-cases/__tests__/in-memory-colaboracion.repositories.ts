import { ApiKey, EstadoApiKey } from '../../../domain/api-key';
import { CarpetaCorreo, CorreoInterno, NuevoCorreo } from '../../../domain/correo-interno';
import { EventoCalendario } from '../../../domain/evento-calendario';
import { ContactoChat, MensajeChat } from '../../../domain/mensaje-chat';
import { NotificacionesPort, NuevaNotificacion } from '../../../domain/notificaciones.port';
import {
  ApiKeyRepository,
  ChatRepository,
  CorreoRepository,
  EventoCalendarioRepository,
  FiltroTareas,
  TareaRepository,
} from '../../../domain/repositories';
import { Tarea } from '../../../domain/tarea';
import { EventoSistema, EventosSistemaPort, UsuarioResumen, UsuariosPort } from '../../../domain/usuarios.port';

export class InMemoryTareaRepository extends TareaRepository {
  items: Tarea[] = [];
  private seq = 1;
  findAll(filtro: FiltroTareas = {}): Promise<Tarea[]> {
    return Promise.resolve(
      this.items.filter(
        (t) =>
          (!filtro.estado || t.props.estado === filtro.estado) &&
          (!filtro.busqueda || t.props.titulo.includes(filtro.busqueda)),
      ),
    );
  }
  findById(id: number): Promise<Tarea | null> {
    return Promise.resolve(this.items.find((t) => t.id === id) ?? null);
  }
  save(tarea: Tarea): Promise<Tarea> {
    if (tarea.id) {
      this.items = this.items.map((t) => (t.id === tarea.id ? tarea : t));
      return Promise.resolve(tarea);
    }
    const saved = tarea.withId(this.seq++);
    this.items.push(saved);
    return Promise.resolve(saved);
  }
  updateEstado(id: number, estado: string): Promise<void> {
    this.items = this.items.map((t) => (t.id === id ? t.withEstado(estado) : t));
    return Promise.resolve();
  }
  delete(id: number): Promise<void> {
    this.items = this.items.filter((t) => t.id !== id);
    return Promise.resolve();
  }
}

export class InMemoryEventoRepository extends EventoCalendarioRepository {
  items: EventoCalendario[] = [];
  private seq = 1;
  findByUsuario(userId: number, desde?: string, hasta?: string): Promise<EventoCalendario[]> {
    return Promise.resolve(
      this.items.filter((e) => {
        const p = e.props;
        if (p.userId !== userId) return false;
        if (desde && (p.fin ?? p.inicio).slice(0, 10) < desde) return false;
        if (hasta && p.inicio.slice(0, 10) > hasta) return false;
        return true;
      }),
    );
  }
  findById(id: number): Promise<EventoCalendario | null> {
    return Promise.resolve(this.items.find((e) => e.id === id) ?? null);
  }
  save(evento: EventoCalendario): Promise<EventoCalendario> {
    if (evento.id) {
      this.items = this.items.map((e) => (e.id === evento.id ? evento : e));
      return Promise.resolve(evento);
    }
    const saved = evento.withId(this.seq++);
    this.items.push(saved);
    return Promise.resolve(saved);
  }
  delete(id: number): Promise<void> {
    this.items = this.items.filter((e) => e.id !== id);
    return Promise.resolve();
  }
}

export class InMemoryChatRepository extends ChatRepository {
  items: MensajeChat[] = [];
  private seq = 1;
  constructor(private readonly usuarios: InMemoryUsuariosPort) {
    super();
  }
  contactos(userId: number): Promise<ContactoChat[]> {
    return Promise.resolve(
      this.usuarios.items
        .filter((u) => u.id !== userId)
        .map((u) => {
          const conv = this.items.filter(
            (m) => (m.emisorId === u.id && m.receptorId === userId) || (m.emisorId === userId && m.receptorId === u.id),
          );
          const ultimo = conv[conv.length - 1];
          return {
            id: u.id,
            nombre: u.nombre,
            profileImage: null,
            designation: null,
            ultimoMensaje: ultimo?.mensaje ?? null,
            ultimoMensajeAt: ultimo?.createdAt ?? null,
            noLeidos: conv.filter((m) => m.emisorId === u.id && !m.leido).length,
          };
        }),
    );
  }
  conversacion(userId: number, contactoId: number): Promise<MensajeChat[]> {
    return Promise.resolve(
      this.items.filter(
        (m) =>
          (m.emisorId === userId && m.receptorId === contactoId) ||
          (m.emisorId === contactoId && m.receptorId === userId),
      ),
    );
  }
  guardar(emisorId: number, receptorId: number, mensaje: string, now: string): Promise<MensajeChat> {
    const m: MensajeChat = { id: this.seq++, emisorId, receptorId, mensaje, leido: false, createdAt: now };
    this.items.push(m);
    return Promise.resolve(m);
  }
  marcarLeidos(emisorId: number, receptorId: number): Promise<void> {
    this.items = this.items.map((m) =>
      m.emisorId === emisorId && m.receptorId === receptorId ? { ...m, leido: true } : m,
    );
    return Promise.resolve();
  }
  contarNoLeidos(userId: number): Promise<number> {
    return Promise.resolve(this.items.filter((m) => m.receptorId === userId && !m.leido).length);
  }
}

export class InMemoryCorreoRepository extends CorreoRepository {
  items: CorreoInterno[] = [];
  private seq = 1;
  buzon(userId: number, carpeta: CarpetaCorreo): Promise<CorreoInterno[]> {
    return Promise.resolve(
      this.items.filter(
        (c) => c.carpeta === carpeta && (carpeta === 'sent' ? c.emisorId === userId : c.receptorId === userId),
      ),
    );
  }
  findById(id: number, userId: number): Promise<CorreoInterno | null> {
    return Promise.resolve(
      this.items.find((c) => c.id === id && (c.emisorId === userId || c.receptorId === userId)) ?? null,
    );
  }
  guardar(correo: NuevoCorreo): Promise<number> {
    const id = this.seq++;
    this.items.push({
      id,
      emisorId: correo.emisorId,
      receptorId: correo.receptorId,
      deNombre: null,
      deEmail: null,
      paraNombre: null,
      paraEmail: null,
      asunto: correo.asunto,
      cuerpo: correo.cuerpo,
      carpeta: correo.carpeta,
      leido: correo.leido,
      createdAt: correo.createdAt,
    });
    return Promise.resolve(id);
  }
  marcarLeido(id: number, receptorId: number): Promise<void> {
    this.items = this.items.map((c) =>
      c.id === id && c.receptorId === receptorId && c.carpeta === 'inbox' ? { ...c, leido: true } : c,
    );
    return Promise.resolve();
  }
  contarNoLeidos(userId: number): Promise<number> {
    return Promise.resolve(
      this.items.filter((c) => c.receptorId === userId && c.carpeta === 'inbox' && !c.leido).length,
    );
  }
}

export class InMemoryApiKeyRepository extends ApiKeyRepository {
  items: ApiKey[] = [];
  private seq = 1;
  findByUsuario(userId: number): Promise<ApiKey[]> {
    return Promise.resolve(this.items.filter((k) => k.userId === userId));
  }
  findOne(id: number, userId: number): Promise<ApiKey | null> {
    return Promise.resolve(this.items.find((k) => k.id === id && k.userId === userId) ?? null);
  }
  crear(userId: number, nombre: string, clave: string, now: string): Promise<ApiKey> {
    const k: ApiKey = { id: this.seq++, userId, nombre, clave, estado: 'Active', createdAt: now };
    this.items.push(k);
    return Promise.resolve(k);
  }
  actualizarNombre(id: number, nombre: string): Promise<void> {
    this.items = this.items.map((k) => (k.id === id ? { ...k, nombre } : k));
    return Promise.resolve();
  }
  actualizarClave(id: number, clave: string): Promise<void> {
    this.items = this.items.map((k) => (k.id === id ? { ...k, clave } : k));
    return Promise.resolve();
  }
  actualizarEstado(id: number, estado: EstadoApiKey): Promise<void> {
    this.items = this.items.map((k) => (k.id === id ? { ...k, estado } : k));
    return Promise.resolve();
  }
  eliminar(ids: number[], userId: number): Promise<number> {
    const antes = this.items.length;
    this.items = this.items.filter((k) => !(ids.includes(k.id) && k.userId === userId));
    return Promise.resolve(antes - this.items.length);
  }
}

export class InMemoryUsuariosPort extends UsuariosPort {
  items: UsuarioResumen[] = [
    { id: 1, nombre: 'Administrador Sistema', email: 'admin@comfasucre.com.co', profileImage: null },
    { id: 2, nombre: 'Juan Pérez', email: 'jperez@comfasucre.com.co', profileImage: null },
    { id: 3, nombre: 'Ana Ruiz', email: 'aruiz@comfasucre.com.co', profileImage: null },
  ];
  listar(): Promise<UsuarioResumen[]> {
    return Promise.resolve(this.items);
  }
  existe(id: number): Promise<boolean> {
    return Promise.resolve(this.items.some((u) => u.id === id));
  }
  buscarPorEmail(email: string): Promise<UsuarioResumen | null> {
    return Promise.resolve(this.items.find((u) => u.email === email.toLowerCase()) ?? null);
  }
  nombresPorIds(ids: number[]): Promise<Map<number, string>> {
    return Promise.resolve(new Map(this.items.filter((u) => ids.includes(u.id)).map((u) => [u.id, u.nombre])));
  }
}

export class InMemoryEventosSistemaPort extends EventosSistemaPort {
  items: EventoSistema[] = [];
  listar(): Promise<EventoSistema[]> {
    return Promise.resolve(this.items);
  }
}

export class InMemoryNotificacionesPort extends NotificacionesPort {
  creadas: NuevaNotificacion[] = [];
  crear(n: NuevaNotificacion): Promise<void> {
    this.creadas.push(n);
    return Promise.resolve();
  }
}
