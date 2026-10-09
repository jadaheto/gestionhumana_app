import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Tabla `notificaciones`. */
@Entity({ name: 'notificaciones' })
export class NotificacionOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'varchar', length: 200 }) titulo!: string;
  @Column({ type: 'text', nullable: true }) mensaje!: string | null;
  @Column({ type: 'varchar', length: 50, default: 'info' }) tipo!: string;
  @Column({ type: 'boolean', default: false }) leida!: boolean;
  @Column({ type: 'varchar', length: 255, nullable: true }) link!: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
