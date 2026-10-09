import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

const numeric = {
  type: 'numeric' as const,
  precision: 14,
  scale: 2,
  default: 0,
  transformer: { to: (v: number) => v, from: (v: string | null) => Number(v ?? 0) },
};
const pct = { ...numeric, precision: 8 };

/** Cabecera de la evaluación de endeudamiento (`endeudamiento_solicitudes`). */
@Entity({ name: 'endeudamiento_solicitudes' })
export class EndeudamientoSolicitudOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Index('idx_endeudamiento_user') @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'varchar', length: 50 }) solicitud_no!: string;
  @Index('idx_endeudamiento_fecha') @Column({ type: 'date' }) fecha!: string;
  @Column({ type: 'int', nullable: true }) anio!: number | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) libranza!: string | null;
  @Column(numeric) salario_mensual!: number;
  @Column(numeric) otros_devengados!: number;
  @Column(numeric) total_devengado!: number;
  @Column(numeric) total_deducido!: number;
  @Column(numeric) neto_actual!: number;
  @Column(numeric) deducciones_ley!: number;
  @Column(numeric) deducciones_endeudamiento!: number;
  @Column(pct) porcentaje_actual!: number;
  @Column(numeric) valor_solicitado!: number;
  @Column({ type: 'int', default: 0 }) plazo_meses!: number;
  @Column(numeric) cuota_mensual!: number;
  @Column(numeric) valor_quincenal!: number;
  @Column(pct) porcentaje_nuevo_credito!: number;
  @Column(numeric) neto_recibir!: number;
  @Column({ ...pct, default: 50 }) umbral_aprobacion!: number;
  @Column({ type: 'varchar', length: 10, nullable: true }) opcion_credito!: string | null;
  @Column({ type: 'text', nullable: true }) conclusion!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'borrador' }) estado!: string;
  @Column({ type: 'int', nullable: true }) created_by!: number | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) updated_at!: Date;
}

/** Conceptos (devengados/deducidos) de cada evaluación (`endeudamiento_conceptos`). */
@Entity({ name: 'endeudamiento_conceptos' })
export class EndeudamientoConceptoOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Index('idx_endeudamiento_conceptos_solicitud') @Column({ type: 'int' }) solicitud_id!: number;
  @Column({ type: 'varchar', length: 150 }) concepto!: string;
  @Column(numeric) devengado!: number;
  @Column(numeric) deducido!: number;
  @Column(pct) porcentaje!: number;
  @Column({ type: 'int', default: 0 }) orden!: number;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
