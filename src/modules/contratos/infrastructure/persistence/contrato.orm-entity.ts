import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Tabla `contratos` (ver `database/001_schema_base.sql`). */
@Entity({ name: 'contratos' })
export class ContratoOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Index('idx_contratos_user') @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'varchar', length: 50 }) tipo_contrato!: string;
  @Column({ type: 'varchar', length: 50 }) numero_contrato!: string;
  @Column({ type: 'date' }) fecha_inicio!: string;
  @Column({ type: 'date', nullable: true }) fecha_fin!: string | null;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) salario_base!: string;
  @Column({ type: 'varchar', length: 20, default: 'activo' }) estado!: string;
  @Column({ type: 'text', nullable: true }) observaciones!: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) updated_at!: Date;
}
