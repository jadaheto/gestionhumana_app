import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Tabla `comunicados`. */
@Entity({ name: 'comunicados' })
export class ComunicadoOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 200 }) titulo!: string;
  @Column({ type: 'text', nullable: true }) resumen!: string | null;
  @Column({ type: 'text', nullable: true }) contenido!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'borrador' }) estado!: string;
  @Column({ type: 'timestamp', nullable: true }) publicado_at!: Date | null;
  @Column({ type: 'timestamp', nullable: true }) email_enviado_at!: Date | null;
  @Column({ type: 'int', nullable: true }) created_by!: number | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) updated_at!: Date;
}
