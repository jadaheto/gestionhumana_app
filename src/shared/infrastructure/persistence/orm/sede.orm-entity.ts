import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'sedes' })
export class SedeOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 150 }) nombre!: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) direccion!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) ciudad!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) telefono!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'activo' }) estado!: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
