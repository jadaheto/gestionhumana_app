import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Tabla heredada `asistencia`: registros manuales/externos (presencial, virtual). */
@Entity({ name: 'asistencia' })
export class AsistenciaOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Index() @Column({ type: 'int' }) user_id!: number;
  @Index() @Column({ type: 'date' }) fecha!: string;
  @Column({ type: 'time', nullable: true }) hora_entrada!: string | null;
  @Column({ type: 'time', nullable: true }) hora_salida!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'presencial' }) tipo!: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) observacion!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'local' }) fuente!: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}

/** Cabecera de cada archivo importado (`asistencia_importaciones`). */
@Entity({ name: 'asistencia_importaciones' })
export class AsistenciaImportacionOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) sede_id!: number;
  @Column({ type: 'varchar', length: 255 }) archivo!: string;
  @Column({ type: 'int', default: 0 }) total_filas!: number;
  @Column({ type: 'int', nullable: true }) importado_por!: number | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}

/** Marcaciones crudas del reloj biométrico (`asistencia_marcaciones`). */
@Entity({ name: 'asistencia_marcaciones' })
@Index('idx_asistencia_marcaciones_fecha', ['sede_id', 'fecha_hora'])
export class AsistenciaMarcacionOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int', nullable: true }) importacion_id!: number | null;
  @Column({ type: 'int' }) sede_id!: number;
  @Column({ type: 'int', nullable: true }) user_id!: number | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) identificacion!: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) nombre!: string | null;
  @Column({ type: 'timestamp' }) fecha_hora!: Date;
  @Column({ type: 'varchar', length: 20, nullable: true }) tipo_registro!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) departamento!: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) dispositivo_no!: string | null;
  @Column({ type: 'text', nullable: true }) raw_json!: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}

/** Política de asistencia por sede (`asistencia_politicas`). */
@Entity({ name: 'asistencia_politicas' })
export class AsistenciaPoliticaOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int', unique: true }) sede_id!: number;
  @Column({ type: 'time', default: '08:10:00' }) hora_entrada_limite!: string;
  @Column({ type: 'time', default: '11:59:00' }) hora_salida_temprana!: string;
  @Column({ type: 'int', default: 0 }) tolerancia_minutos!: number;
  @Column({ type: 'boolean', default: true, nullable: true }) enviar_memorando_tardanza!: boolean | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) updated_at!: Date;
}

/** Resumen diario consolidado (`asistencia_resumen_diario`). */
@Entity({ name: 'asistencia_resumen_diario' })
@Index('idx_asistencia_resumen_unique', ['user_id', 'sede_id', 'fecha'], { unique: true })
export class AsistenciaResumenDiarioOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'int' }) sede_id!: number;
  @Column({ type: 'date' }) fecha!: string;
  @Column({ type: 'time', nullable: true }) hora_entrada!: string | null;
  @Column({ type: 'time', nullable: true }) hora_salida!: string | null;
  @Column({ type: 'int', default: 0 }) minutos_tarde!: number;
  @Column({ type: 'int', default: 0 }) minutos_salida_temprana!: number;
  @Column({ type: 'varchar', length: 40, default: 'normal' }) estado!: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) justificacion!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) detalle!: string | null;
  @Column({ type: 'boolean', default: false, nullable: true }) memo_enviado!: boolean | null;
  @Column({ type: 'timestamp', nullable: true }) memo_enviado_at!: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) memo_error!: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) updated_at!: Date;
}
