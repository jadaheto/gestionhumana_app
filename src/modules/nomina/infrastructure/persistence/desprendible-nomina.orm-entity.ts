import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'desprendibles_nomina' })
export class DesprendibleNominaOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'varchar', length: 80 }) periodo!: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true }) salario_basico!: string | null;
  @Column({ type: 'jsonb', default: () => `'{}'` }) devengados!: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => `'{}'` }) deducciones!: Record<string, unknown>;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 }) total_devengado!: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 }) total_deducido!: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 }) neto_pagar!: string;
  @Column({ type: 'date', nullable: true }) fecha_inicio!: string | null;
  @Column({ type: 'date', nullable: true }) fecha_fin!: string | null;
  @Column({ type: 'date', nullable: true }) fecha_liquidacion!: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) nro_comprobante!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) banco!: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) numero_cuenta!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) archivo_pdf!: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
