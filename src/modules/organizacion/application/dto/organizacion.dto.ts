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
  /** Área de la que depende en el organigrama (null = raíz). */
  padreId: number | null;
  padreNombre: string | null;
  orden: number;
  estado: string;
}
/** `padreId` y `orden` sin enviar (`undefined`) conservan el valor actual al editar. */
export type SaveAreaInput = Pick<AreaDto, 'nombre' | 'descripcion' | 'sedeId' | 'responsableId'> & {
  id?: number;
  estado?: string;
  padreId?: number | null;
  orden?: number;
};

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
