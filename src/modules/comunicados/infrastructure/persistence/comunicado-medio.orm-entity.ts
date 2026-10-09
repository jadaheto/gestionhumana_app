import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Tabla `comunicado_medios` (imagen, video, pdf o URL de vídeo). */
@Entity({ name: 'comunicado_medios' })
export class ComunicadoMedioOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) comunicado_id!: number;
  @Column({ type: 'varchar', length: 20 }) tipo!: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) archivo!: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) url!: string | null;
  @Column({ type: 'int', default: 0 }) orden!: number;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
