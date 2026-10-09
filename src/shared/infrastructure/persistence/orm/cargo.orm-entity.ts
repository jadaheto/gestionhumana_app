import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'cargos' })
export class CargoOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 150 }) nombre!: string;
  @Column({ type: 'text', nullable: true }) descripcion!: string | null;
  @Column({ type: 'int', nullable: true }) area_id!: number | null;
  /** 1=Director, 2=Jefe, 3=Coordinador, 4=Analista, 5=Auxiliar */
  @Column({ type: 'int', default: 5 }) nivel_jerarquico!: number;
  @Column({ type: 'text', nullable: true }) funciones!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'activo' }) estado!: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
