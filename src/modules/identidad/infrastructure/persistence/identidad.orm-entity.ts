import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Tabla `identidad_empresa` (misión, visión, valores, principios, himno_url). */
@Entity({ name: 'identidad_empresa' })
export class IdentidadOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 50, unique: true }) campo!: string;
  @Column({ type: 'text', nullable: true }) contenido!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'texto' }) tipo!: string;
  @Column({ type: 'int', default: 0 }) orden!: number;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) updated_at!: Date;
}
