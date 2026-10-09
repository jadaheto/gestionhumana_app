import { EstadoApiKey } from '../../domain/api-key';
import { CarpetaCorreo, CorreoInterno } from '../../domain/correo-interno';
import { ContactoChat, MensajeChat } from '../../domain/mensaje-chat';
import { EstadoTarea, PrioridadTarea } from '../../domain/tarea';
import { UsuarioResumen } from '../../domain/usuarios.port';

// ---------- Tareas ----------
export interface AsignadoDto {
  id: number;
  nombre: string;
}

export interface TareaDto {
  id: number;
  titulo: string;
  descripcion: string | null;
  proyecto: string | null;
  cliente: string | null;
  responsable: string | null;
  creadorId: number | null;
  fechaLimite: string | null;
  estado: EstadoTarea;
  prioridad: PrioridadTarea;
  asignados: AsignadoDto[];
  createdAt: string | null;
  updatedAt: string | null;
  /** Si el actor puede editar/eliminar/cambiar estado (admin o creador). */
  puedeModificar: boolean;
}

export interface GuardarTareaInput {
  id?: number;
  titulo: string;
  descripcion?: string | null;
  proyecto?: string | null;
  cliente?: string | null;
  responsable?: string | null;
  fechaLimite?: string | null;
  estado?: string | null;
  prioridad?: string | null;
  asignadoIds?: number[];
}

export interface EstadisticasTareasDto {
  total: number;
  sinAsignar: number;
  porHacer: number;
  enProgreso: number;
  enRevision: number;
  completadas: number;
}

export type KanbanDto = Record<EstadoTarea, TareaDto[]>;

// ---------- Calendario ----------
export interface EventoCalendarioDto {
  id: number | string;
  titulo: string;
  inicio: string;
  fin: string | null;
  todoElDia: boolean;
  clase: string;
  ubicacion: string | null;
  descripcion: string | null;
  /** true para cumpleaños/aniversarios generados por el sistema (no editables). */
  esDeSistema: boolean;
  tipoSistema?: 'cumpleanos' | 'aniversario';
}

export interface GuardarEventoInput {
  id?: number;
  titulo: string;
  inicio: string;
  fin?: string | null;
  todoElDia?: boolean;
  clase?: string | null;
  ubicacion?: string | null;
  descripcion?: string | null;
}

// ---------- Chat ----------
export type ContactoChatDto = ContactoChat;
export type MensajeChatDto = MensajeChat;

// ---------- Correo ----------
export type CorreoDto = CorreoInterno;
export interface RedactarCorreoInput {
  paraEmail: string;
  asunto: string;
  cuerpo: string;
}
export interface RedactarCorreoResultado {
  id: number;
  /** false si la notificación externa por SMTP falló (el correo interno sí se entregó). */
  notificacionExternaEnviada: boolean;
}
export type { CarpetaCorreo };

// ---------- API keys ----------
export interface ApiKeyDto {
  id: number;
  nombre: string;
  clave: string;
  estado: EstadoApiKey;
  createdAt: string;
  creadoPor: string;
}

// ---------- Usuarios ----------
export type UsuarioResumenDto = UsuarioResumen;
