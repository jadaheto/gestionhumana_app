import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Tabla `contrato_prorrogas`. */
@Entity({ name: 'contrato_prorrogas' })
export class ContratoProrrogaOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) contrato_id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'date' }) fecha_fin_anterior!: string;
  @Column({ type: 'int' }) meses_prorroga!: number;
  @Column({ type: 'date' }) fecha_inicio_prorroga!: string;
  @Column({ type: 'date' }) fecha_fin_nueva!: string;
  @Column({ type: 'text', nullable: true }) observacion!: string | null;
  @Column({ type: 'int' }) creado_por!: number;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
