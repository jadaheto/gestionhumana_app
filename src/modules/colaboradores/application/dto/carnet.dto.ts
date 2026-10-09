import { Actor } from '../../../../shared/domain/actor';

export interface GetCarnetInput {
  actor: Actor;
  /** Sólo el admin puede pedir el carnet de otro usuario. */
  userId?: number;
}

/** Datos que muestra `views/carnet/_page.php`. */
export interface CarnetDto {
  userId: number;
  nombreCompleto: string;
  cargo: string;
  area: string;
  sede: string;
  cedula: string;
  codigoEmpresa: string;
  profileImage: string | null;
  /** Ruta relativa en `/uploads` del logo configurado, o null para usar el texto. */
  logo: string | null;
  anio: number;
  /** Contenido del código QR (JSON con nombre, cédula, cargo, área y código). */
  qrData: string;
}
