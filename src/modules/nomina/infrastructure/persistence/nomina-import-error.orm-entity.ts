import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'nomina_import_errores' })
export class NominaImportErrorOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) lote_id!: number;
  @Column({ type: 'varchar', length: 120, nullable: true }) empleado_ref!: string | null;
  @Column({ type: 'text', nullable: true }) mensaje!: string | null;
  @Column({ type: 'text', nullable: true }) raw_block!: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
