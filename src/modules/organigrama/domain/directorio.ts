/** Colaborador tal como aparece en el directorio (`Organigrama_model::get_directorio`). */
export interface ColaboradorDirectorio {
  id: number;
  firstName: string;
  lastName: string;
  nombreCompleto: string;
  email: string;
  /** Celular o, en su defecto, teléfono (`celular ?? phone_number`). */
  telefono: string | null;
  /** Nombre del cargo o, en su defecto, `designation`. */
  cargo: string | null;
  areaId: number | null;
  area: string | null;
  sedeId: number | null;
  sede: string | null;
  profileImage: string | null;
}

export interface FiltrosDirectorio {
  /** Texto libre: nombre, correo o cargo. */
  q?: string | null;
  areaId?: number | null;
  sedeId?: number | null;
}
