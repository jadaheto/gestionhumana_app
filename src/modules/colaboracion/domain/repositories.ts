import { ApiKey, EstadoApiKey } from './api-key';
import { CarpetaCorreo, CorreoInterno, NuevoCorreo } from './correo-interno';
import { EventoCalendario } from './evento-calendario';
import { ContactoChat, MensajeChat } from './mensaje-chat';
import { Tarea } from './tarea';

export interface FiltroTareas {
  estado?: string;
  busqueda?: string;
}

export abstract class TareaRepository {
  abstract findAll(filtro?: FiltroTareas): Promise<Tarea[]>;
  abstract findById(id: number): Promise<Tarea | null>;
  abstract save(tarea: Tarea, now: string): Promise<Tarea>;
  abstract updateEstado(id: number, estado: string, now: string): Promise<void>;
  abstract delete(id: number): Promise<void>;
}

export abstract class EventoCalendarioRepository {
  abstract findByUsuario(userId: number, desde?: string, hasta?: string): Promise<EventoCalendario[]>;
  abstract findById(id: number): Promise<EventoCalendario | null>;
  abstract save(evento: EventoCalendario): Promise<EventoCalendario>;
  abstract delete(id: number): Promise<void>;
}

export abstract class ChatRepository {
  abstract contactos(userId: number): Promise<ContactoChat[]>;
  abstract conversacion(userId: number, contactoId: number): Promise<MensajeChat[]>;
  abstract guardar(emisorId: number, receptorId: number, mensaje: string, now: string): Promise<MensajeChat>;
  abstract marcarLeidos(emisorId: number, receptorId: number): Promise<void>;
  abstract contarNoLeidos(userId: number): Promise<number>;
}

export abstract class CorreoRepository {
  abstract buzon(userId: number, carpeta: CarpetaCorreo): Promise<CorreoInterno[]>;
  abstract findById(id: number, userId: number): Promise<CorreoInterno | null>;
  abstract guardar(correo: NuevoCorreo): Promise<number>;
  abstract marcarLeido(id: number, receptorId: number): Promise<void>;
  abstract contarNoLeidos(userId: number): Promise<number>;
}

export abstract class ApiKeyRepository {
  abstract findByUsuario(userId: number): Promise<ApiKey[]>;
  abstract findOne(id: number, userId: number): Promise<ApiKey | null>;
  abstract crear(userId: number, nombre: string, clave: string, now: string): Promise<ApiKey>;
  abstract actualizarNombre(id: number, nombre: string): Promise<void>;
  abstract actualizarClave(id: number, clave: string): Promise<void>;
  abstract actualizarEstado(id: number, estado: EstadoApiKey): Promise<void>;
  abstract eliminar(ids: number[], userId: number): Promise<number>;
}
