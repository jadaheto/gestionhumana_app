import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'areas' })
export class AreaOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 150 }) nombre!: string;
  @Column({ type: 'text', nullable: true }) descripcion!: string | null;
  @Column({ type: 'int', nullable: true }) sede_id!: number | null;
  @Column({ type: 'int', nullable: true }) responsable_id!: number | null;
  @Column({ type: 'varchar', length: 20, default: 'activo' }) estado!: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
