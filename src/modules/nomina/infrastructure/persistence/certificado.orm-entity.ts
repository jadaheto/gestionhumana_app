import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'certificados' })
export class CertificadoOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) user_id!: number;
  /** laboral_con_funciones, laboral_sin_funciones, ingresos_retenciones */
  @Column({ type: 'varchar', length: 50 }) tipo!: string;
  @Column({ type: 'date', default: () => 'CURRENT_DATE' }) fecha_generacion!: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) archivo_pdf!: string | null;
  @Column({ type: 'int', nullable: true }) generado_por!: number | null;
  @Column({ type: 'jsonb', default: () => `'{}'` }) datos!: Record<string, unknown>;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
