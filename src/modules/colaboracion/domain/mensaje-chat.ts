import { ValidationError } from '../../../shared/domain/domain-error';

export interface MensajeChat {
  id: number;
  emisorId: number;
  receptorId: number;
  mensaje: string;
  leido: boolean;
  createdAt: string;
}

export interface ContactoChat {
  id: number;
  nombre: string;
  profileImage: string | null;
  designation: string | null;
  ultimoMensaje: string | null;
  ultimoMensajeAt: string | null;
  noLeidos: number;
}

export function validarMensajeChat(texto: string | null | undefined): string {
  const t = (texto ?? '').trim();
  if (t === '') throw new ValidationError('El mensaje no puede estar vacío.');
  if (t.length > 5000) throw new ValidationError('El mensaje supera los 5000 caracteres.');
  return t;
}
