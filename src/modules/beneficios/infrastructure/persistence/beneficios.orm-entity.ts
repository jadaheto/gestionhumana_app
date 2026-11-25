import { Column, Entity, PrimaryGeneratedColumn, ValueTransformer } from 'typeorm';

/**
 * Columnas TIMESTAMP manejadas como cadena `YYYY-MM-DD HH:mm:ss` de extremo a
 * extremo (evita desfases de zona horaria; el driver pg las devuelve como Date).
 */
export const timestampTransformer: ValueTransformer = {
  to: (value: string | null | undefined): string | null => value ?? null,
  from: (value: Date | string | null): string | null => fechaHoraToString(value),
};

export function fechaHoraToString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())} ${p(value.getHours())}:${p(value.getMinutes())}:${p(value.getSeconds())}`;
  }
  return String(value).replace('T', ' ').slice(0, 19);
}

/** Tabla `permisos` (solicitudes de permisos, vacaciones e incapacidades). */
@Entity({ name: 'permisos' })
export class PermisoOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'varchar', length: 50 }) tipo_permiso!: string;
  @Column({ type: 'date', nullable: true }) fecha_solicitud!: string | null;
  @Column({ type: 'timestamp', transformer: timestampTransformer }) fecha_inicio!: string;
  @Column({ type: 'timestamp', transformer: timestampTransformer }) fecha_fin!: string;
  @Column({ type: 'numeric', precision: 4, scale: 1, nullable: true }) horas!: string | null;
  @Column({ type: 'text' }) justificacion!: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) archivo_soporte!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'pendiente' }) estado!: string;
  @Column({ type: 'int', nullable: true }) aprobado_por!: number | null;
  @Column({ type: 'text', nullable: true }) observacion_respuesta!: string | null;
  /** Jefe inmediato que debe dar el visto bueno antes de Gestión Humana. */
  @Column({ type: 'int', nullable: true }) jefe_id!: number | null;
  /** no_aplica | pendiente | aprobado | rechazado */
  @Column({ type: 'varchar', length: 20, default: 'no_aplica' }) jefe_estado!: string;
  @Column({ type: 'text', nullable: true }) jefe_observacion!: string | null;
  @Column({ type: 'timestamp', nullable: true, transformer: timestampTransformer }) jefe_fecha!: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', transformer: timestampTransformer }) created_at!:
    string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', transformer: timestampTransformer }) updated_at!:
    string | null;
}

/** Tabla `incapacidades`. */
@Entity({ name: 'incapacidades' })
export class IncapacidadOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'varchar', length: 50 }) tipo!: string;
  @Column({ type: 'date' }) fecha_inicio!: string;
  @Column({ type: 'date' }) fecha_fin!: string;
  @Column({ type: 'int' }) dias!: number;
  @Column({ type: 'varchar', length: 200, nullable: true }) entidad_emisora!: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) numero_incapacidad!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) archivo_soporte!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'activo' }) estado!: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', transformer: timestampTransformer }) created_at!:
    string | null;
}

/** Tabla `vacaciones` (períodos). */
@Entity({ name: 'vacaciones' })
export class VacacionOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'varchar', length: 20 }) periodo!: string;
  @Column({ type: 'int', default: 15 }) dias_totales!: number;
  @Column({ type: 'int', default: 0 }) dias_tomados!: number;
  @Column({ type: 'int', default: 15 }) dias_pendientes!: number;
  @Column({ type: 'varchar', length: 20, default: 'activo' }) estado!: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', transformer: timestampTransformer }) created_at!:
    string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', transformer: timestampTransformer }) updated_at!:
    string | null;
}

/** Tabla `vacaciones_detalle` (días tomados dentro de un período). */
@Entity({ name: 'vacaciones_detalle' })
export class VacacionDetalleOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) vacacion_id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'date' }) fecha_inicio!: string;
  @Column({ type: 'date' }) fecha_fin!: string;
  @Column({ type: 'int' }) dias!: number;
  @Column({ type: 'varchar', length: 20, default: 'pendiente' }) estado!: string;
  @Column({ type: 'int', nullable: true }) aprobado_por!: number | null;
  @Column({ type: 'text', nullable: true }) observacion!: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', transformer: timestampTransformer }) created_at!:
    string | null;
}

/** Tabla `vacaciones_suspensiones` (DDL de `002_schema_runtime.sql`). */
@Entity({ name: 'vacaciones_suspensiones' })
export class VacacionesSuspensionOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int', unique: true }) permiso_id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'int' }) dias_totales!: number;
  @Column({ type: 'int' }) dias_disfrutados!: number;
  @Column({ type: 'int' }) dias_reintegrados!: number;
  @Column({ type: 'text', nullable: true }) motivo!: string | null;
  @Column({ type: 'int' }) suspendido_por!: number;
  @Column({ type: 'timestamp', transformer: timestampTransformer }) fecha_suspension!: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', transformer: timestampTransformer }) created_at!:
    string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', transformer: timestampTransformer }) updated_at!:
    string | null;
}
