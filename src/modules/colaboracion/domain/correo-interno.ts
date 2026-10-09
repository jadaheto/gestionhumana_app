export type CarpetaCorreo = 'inbox' | 'sent';

export interface CorreoInterno {
  id: number;
  emisorId: number | null;
  receptorId: number | null;
  deNombre: string | null;
  deEmail: string | null;
  paraNombre: string | null;
  paraEmail: string | null;
  asunto: string | null;
  cuerpo: string | null;
  carpeta: CarpetaCorreo;
  leido: boolean;
  createdAt: string;
}

export interface NuevoCorreo {
  emisorId: number;
  receptorId: number;
  asunto: string;
  cuerpo: string;
  carpeta: CarpetaCorreo;
  leido: boolean;
  createdAt: string;
}
