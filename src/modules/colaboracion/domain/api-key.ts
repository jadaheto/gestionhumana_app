export type EstadoApiKey = 'Active' | 'Inactive';

export interface ApiKey {
  id: number;
  userId: number;
  nombre: string;
  clave: string;
  estado: EstadoApiKey;
  createdAt: string;
}

export function alternarEstado(estado: EstadoApiKey): EstadoApiKey {
  return estado === 'Active' ? 'Inactive' : 'Active';
}
