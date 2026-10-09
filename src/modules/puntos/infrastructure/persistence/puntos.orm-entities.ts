import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Tabla `puntos`: saldo por colaborador (una fila por `user_id`). */
@Entity({ name: 'puntos' })
export class PuntoOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int', unique: true }) user_id!: number;
  @Column({ type: 'int', default: 0 }) puntos_actuales!: number;
  @Column({ type: 'int', default: 0 }) puntos_totales_ganados!: number;
  @Column({ type: 'int', default: 0 }) puntos_totales_canjeados!: number;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) updated_at!: Date;
}

/** Tabla `puntos_transacciones`: movimientos (ganado, canjeado, reintegro). */
@Entity({ name: 'puntos_transacciones' })
export class PuntosTransaccionOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'varchar', length: 20 }) tipo!: string;
  @Column({ type: 'int' }) cantidad!: number;
  @Column({ type: 'varchar', length: 255 }) concepto!: string;
  @Column({ type: 'int', nullable: true }) referencia_id!: number | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}

/** Tabla `recompensas`: catálogo. */
@Entity({ name: 'recompensas' })
export class RecompensaOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 150 }) nombre!: string;
  @Column({ type: 'text', nullable: true }) descripcion!: string | null;
  @Column({ type: 'int' }) puntos_requeridos!: number;
  @Column({ type: 'varchar', length: 50 }) tipo!: string;
  @Column({ type: 'varchar', length: 50, default: 'ri-gift-line' }) icono!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'activo' }) estado!: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}

/** Tabla `canjes`: solicitudes de canje. */
@Entity({ name: 'canjes' })
export class CanjeOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'int' }) recompensa_id!: number;
  @Column({ type: 'int' }) puntos_usados!: number;
  @Column({ type: 'varchar', length: 20, default: 'pendiente' }) estado!: string;
  @Column({ type: 'int', nullable: true }) aprobado_por!: number | null;
  @Column({ type: 'date', nullable: true }) fecha_uso!: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
