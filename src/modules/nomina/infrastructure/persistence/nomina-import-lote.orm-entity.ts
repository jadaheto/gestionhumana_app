import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'nomina_import_lotes' })
export class NominaImportLoteOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 255 }) archivo!: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) archivo_original!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) fuente!: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) tipo_nomina!: string | null;
  @Column({ type: 'date', nullable: true }) fecha_liquidacion!: string | null;
  @Column({ type: 'date', nullable: true }) fecha_inicio!: string | null;
  @Column({ type: 'date', nullable: true }) fecha_fin!: string | null;
  @Column({ type: 'int', default: 0 }) total_empleados_pdf!: number;
  @Column({ type: 'int', default: 0 }) empleados_creados!: number;
  @Column({ type: 'int', default: 0 }) empleados_actualizados!: number;
  @Column({ type: 'int', default: 0 }) desprendibles_creados!: number;
  @Column({ type: 'int', default: 0 }) desprendibles_actualizados!: number;
  @Column({ type: 'int', default: 0 }) contratos_actualizados!: number;
  @Column({ type: 'int', default: 0 }) errores!: number;
  /** pendiente, procesando, completado, parcial, error */
  @Column({ type: 'varchar', length: 20, default: 'pendiente' }) estado!: string;
  @Column({ type: 'text', nullable: true }) detalle!: string | null;
  @Column({ type: 'int', nullable: true }) created_by!: number | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
