export interface SedeDto {
  id: number;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  estado: string;
}
export type SaveSedeInput = Omit<SedeDto, 'id' | 'estado'> & { id?: number; estado?: string };

export interface AreaDto {
  id: number;
  nombre: string;
  descripcion: string | null;
  sedeId: number | null;
  sedeNombre: string | null;
  responsableId: number | null;
  estado: string;
}
export type SaveAreaInput = Omit<AreaDto, 'id' | 'estado' | 'sedeNombre'> & { id?: number; estado?: string };

export interface CargoDto {
  id: number;
  nombre: string;
  descripcion: string | null;
  areaId: number | null;
  areaNombre: string | null;
  nivelJerarquico: number;
  nivelNombre: string;
  funciones: string | null;
  estado: string;
}
export type SaveCargoInput = Omit<CargoDto, 'id' | 'estado' | 'areaNombre' | 'nivelNombre'> & {
  id?: number;
  estado?: string;
};
